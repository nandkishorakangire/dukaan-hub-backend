import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { uniqueSlug } from '../common/utils/slug';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBusinessDto,
  ListBusinessesQueryDto,
  UpdateBusinessDto,
} from './dto/business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListBusinessesQueryDto,
  ): Promise<PaginatedResult<Prisma.BusinessGetPayload<object>>> {
    const where: Prisma.BusinessWhereInput = {
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(query.featured !== undefined ? { is_featured: query.featured } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
              { address: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.BusinessOrderByWithRelationInput =
      query.sort === 'rating'
        ? { rating: 'desc' }
        : query.sort === 'newest'
          ? { created_at: 'desc' }
          : query.sort === 'name'
            ? { name: 'asc' }
            : { trend_score: 'desc' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        orderBy: [orderBy, { created_at: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.business.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async trending(limit = 10) {
    return this.prisma.business.findMany({
      orderBy: [{ trend_score: 'desc' }, { rating: 'desc' }],
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  async getById(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: { owner: { select: { id: true, name: true, avatar_url: true } } },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async getBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async mine(ownerId: string) {
    return this.prisma.business.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: 'desc' },
    });
  }

  async create(ownerId: string, dto: CreateBusinessDto) {
    const slug = await uniqueSlug(dto.slug ?? dto.name, async (candidate) => {
      const existing = await this.prisma.business.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return Boolean(existing);
    });

    const business = await this.prisma.business.create({
      data: {
        owner_id: ownerId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
        logo_url: dto.logo_url,
        banner_url: dto.banner_url,
        images: dto.images ?? [],
        amenities: dto.amenities ?? [],
        category: dto.category,
        address: dto.address,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        timings: (dto.timings ?? undefined) as Prisma.InputJsonValue | undefined,
        upi_id: dto.upi_id,
        payment_qr_url: dto.payment_qr_url,
        accepts_internal_payments: dto.accepts_internal_payments ?? true,
      },
    });

    // Creating a storefront turns a buyer into a seller.
    await this.prisma.user.updateMany({
      where: { id: ownerId, role: Role.buyer },
      data: { role: Role.seller },
    });

    return business;
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateBusinessDto) {
    const business = await this.assertOwned(id, user);

    let slug = business.slug;
    if (dto.slug && dto.slug !== business.slug) {
      slug = await uniqueSlug(dto.slug, async (candidate) => {
        const existing = await this.prisma.business.findUnique({
          where: { slug: candidate },
          select: { id: true },
        });
        return Boolean(existing);
      });
    }

    return this.prisma.business.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.logo_url !== undefined ? { logo_url: dto.logo_url } : {}),
        ...(dto.banner_url !== undefined ? { banner_url: dto.banner_url } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
        ...(dto.amenities !== undefined ? { amenities: dto.amenities } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.timings !== undefined
          ? { timings: dto.timings as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.upi_id !== undefined ? { upi_id: dto.upi_id } : {}),
        ...(dto.payment_qr_url !== undefined ? { payment_qr_url: dto.payment_qr_url } : {}),
        ...(dto.accepts_internal_payments !== undefined
          ? { accepts_internal_payments: dto.accepts_internal_payments }
          : {}),
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.assertOwned(id, user);
    await this.prisma.business.delete({ where: { id } });
    return { success: true };
  }

  /** Loads a business and verifies that the caller owns it (admins bypass). */
  async assertOwned(id: string, user: AuthenticatedUser) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    if (business.owner_id !== user.id && user.role !== Role.admin) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return business;
  }
}
