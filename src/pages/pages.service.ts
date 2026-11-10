import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessPage, Prisma } from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { uniqueSlug } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto, ListPagesQueryDto, UpdatePageDto } from './dto/page.dto';

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async listForBusiness(
    businessId: string,
    query: ListPagesQueryDto,
    publishedOnly = true,
  ): Promise<PaginatedResult<BusinessPage>> {
    const where: Prisma.BusinessPageWhereInput = {
      business_id: businessId,
      ...(publishedOnly
        ? { is_published: true }
        : query.published !== undefined
          ? { is_published: query.published }
          : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.businessPage.findMany({
        where,
        orderBy: [{ is_published: 'desc' }, { created_at: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.businessPage.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  /** Owner-only listing that includes drafts. */
  async listForOwner(
    businessId: string,
    user: AuthenticatedUser,
    query: ListPagesQueryDto,
  ): Promise<PaginatedResult<BusinessPage>> {
    await this.businesses.assertOwned(businessId, user);
    return this.listForBusiness(businessId, query, false);
  }

  async getPublishedBySlug(businessId: string, slug: string): Promise<BusinessPage> {
    const page = await this.prisma.businessPage.findFirst({
      where: { business_id: businessId, slug, is_published: true },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async getById(id: string): Promise<BusinessPage> {
    const page = await this.prisma.businessPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async getForOwner(id: string, user: AuthenticatedUser): Promise<BusinessPage> {
    const page = await this.getById(id);
    await this.businesses.assertOwned(page.business_id, user);
    return page;
  }

  async create(
    businessId: string,
    user: AuthenticatedUser,
    dto: CreatePageDto,
  ): Promise<BusinessPage> {
    await this.businesses.assertOwned(businessId, user);

    const slug = await uniqueSlug(dto.slug ?? dto.title, (candidate) =>
      this.slugExists(businessId, candidate),
    );

    return this.prisma.businessPage.create({
      data: {
        business_id: businessId,
        title: dto.title.trim(),
        slug,
        content: dto.content,
        images: dto.images ?? [],
        is_published: dto.is_published ?? false,
      },
    });
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdatePageDto,
  ): Promise<BusinessPage> {
    const page = await this.getById(id);
    await this.businesses.assertOwned(page.business_id, user);

    let slug = page.slug;
    if (dto.slug !== undefined && dto.slug !== page.slug) {
      slug = await uniqueSlug(dto.slug, (candidate) =>
        this.slugExists(page.business_id, candidate, id),
      );
    }

    return this.prisma.businessPage.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.slug !== undefined ? { slug } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
        ...(dto.is_published !== undefined ? { is_published: dto.is_published } : {}),
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<{ success: true }> {
    const page = await this.getById(id);
    await this.businesses.assertOwned(page.business_id, user);
    await this.prisma.businessPage.delete({ where: { id } });
    return { success: true };
  }

  private async slugExists(
    businessId: string,
    candidate: string,
    excludeId?: string,
  ): Promise<boolean> {
    const existing = await this.prisma.businessPage.findFirst({
      where: {
        business_id: businessId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    return Boolean(existing);
  }
}
