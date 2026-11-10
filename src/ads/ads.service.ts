import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto, ListAdsQueryDto, UpdateAdDto } from './dto/ad.dto';

const adInclude = {
  business: { select: { id: true, name: true, slug: true, logo_url: true } },
} satisfies Prisma.AdInclude;

export type AdWithBusiness = Prisma.AdGetPayload<{ include: typeof adInclude }>;

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  /** Ads that are currently live, for app placements. */
  async listPublic(query: ListAdsQueryDto): Promise<PaginatedResult<AdWithBusiness>> {
    const now = new Date();
    const where: Prisma.AdWhereInput = {
      is_active: true,
      ...(query.placement ? { placement: query.placement } : {}),
      ...(query.business_id ? { business_id: query.business_id } : {}),
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      ],
    };

    return this.paginateAds(where, query);
  }

  /** Ads owned by the caller's storefronts (admins see everything). */
  async mine(
    user: AuthenticatedUser,
    query: ListAdsQueryDto,
  ): Promise<PaginatedResult<AdWithBusiness>> {
    const where: Prisma.AdWhereInput = {
      ...(user.role === Role.admin ? {} : { business: { owner_id: user.id } }),
      ...(query.placement ? { placement: query.placement } : {}),
      ...(query.business_id ? { business_id: query.business_id } : {}),
      ...(query.active !== undefined ? { is_active: query.active } : {}),
    };

    return this.paginateAds(where, query);
  }

  async getById(id: string): Promise<AdWithBusiness> {
    const ad = await this.prisma.ad.findUnique({ where: { id }, include: adInclude });
    if (!ad) throw new NotFoundException('Ad not found');
    return ad;
  }

  async create(user: AuthenticatedUser, dto: CreateAdDto): Promise<AdWithBusiness> {
    if (dto.business_id) {
      await this.businesses.assertOwned(dto.business_id, user);
    } else if (user.role !== Role.admin) {
      throw new BadRequestException('business_id is required for storefront ads');
    }

    this.assertDateRange(dto.starts_at, dto.ends_at);

    return this.prisma.ad.create({
      data: {
        business_id: dto.business_id ?? null,
        title: dto.title.trim(),
        image_url: dto.image_url,
        link_url: dto.link_url,
        placement: dto.placement,
        starts_at: dto.starts_at ? new Date(dto.starts_at) : null,
        ends_at: dto.ends_at ? new Date(dto.ends_at) : null,
        is_active: dto.is_active ?? true,
      },
      include: adInclude,
    });
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateAdDto,
  ): Promise<AdWithBusiness> {
    const ad = await this.getById(id);
    await this.assertCanManage(ad, user);
    this.assertDateRange(
      dto.starts_at ?? ad.starts_at?.toISOString(),
      dto.ends_at ?? ad.ends_at?.toISOString(),
    );

    return this.prisma.ad.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.image_url !== undefined ? { image_url: dto.image_url } : {}),
        ...(dto.link_url !== undefined ? { link_url: dto.link_url } : {}),
        ...(dto.placement !== undefined ? { placement: dto.placement } : {}),
        ...(dto.starts_at !== undefined
          ? { starts_at: dto.starts_at ? new Date(dto.starts_at) : null }
          : {}),
        ...(dto.ends_at !== undefined
          ? { ends_at: dto.ends_at ? new Date(dto.ends_at) : null }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
      include: adInclude,
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<{ success: true }> {
    const ad = await this.getById(id);
    await this.assertCanManage(ad, user);
    await this.prisma.ad.delete({ where: { id } });
    return { success: true };
  }

  private async paginateAds(
    where: Prisma.AdWhereInput,
    query: ListAdsQueryDto,
  ): Promise<PaginatedResult<AdWithBusiness>> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.ad.findMany({
        where,
        include: adInclude,
        orderBy: [{ created_at: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ad.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  private async assertCanManage(ad: AdWithBusiness, user: AuthenticatedUser): Promise<void> {
    if (user.role === Role.admin) return;
    if (!ad.business_id) {
      throw new ForbiddenException('You do not have access to this ad');
    }
    await this.businesses.assertOwned(ad.business_id, user);
  }

  private assertDateRange(startsAt?: string | null, endsAt?: string | null): void {
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException('ends_at must be after starts_at');
    }
  }
}
