import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketplacePage, Prisma } from '@prisma/client';
import { MarketplacesService } from '../marketplaces/marketplaces.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { uniqueSlug } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto, ListPagesQueryDto, UpdatePageDto } from './dto/page.dto';

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplaces: MarketplacesService,
  ) {}

  async listForMarketplace(
    marketplaceId: string,
    query: ListPagesQueryDto,
    publishedOnly = true,
  ): Promise<PaginatedResult<MarketplacePage>> {
    const where: Prisma.MarketplacePageWhereInput = {
      marketplace_id: marketplaceId,
      ...(publishedOnly
        ? { is_published: true }
        : query.published !== undefined
          ? { is_published: query.published }
          : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.marketplacePage.findMany({
        where,
        orderBy: [{ is_published: 'desc' }, { created_at: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.marketplacePage.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  /** Owner-only listing that includes drafts. */
  async listForOwner(
    marketplaceId: string,
    user: AuthenticatedUser,
    query: ListPagesQueryDto,
  ): Promise<PaginatedResult<MarketplacePage>> {
    await this.marketplaces.assertOwned(marketplaceId, user);
    return this.listForMarketplace(marketplaceId, query, false);
  }

  async getPublishedBySlug(marketplaceId: string, slug: string): Promise<MarketplacePage> {
    const page = await this.prisma.marketplacePage.findFirst({
      where: { marketplace_id: marketplaceId, slug, is_published: true },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async getById(id: string): Promise<MarketplacePage> {
    const page = await this.prisma.marketplacePage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async getForOwner(id: string, user: AuthenticatedUser): Promise<MarketplacePage> {
    const page = await this.getById(id);
    await this.marketplaces.assertOwned(page.marketplace_id, user);
    return page;
  }

  async create(
    marketplaceId: string,
    user: AuthenticatedUser,
    dto: CreatePageDto,
  ): Promise<MarketplacePage> {
    await this.marketplaces.assertOwned(marketplaceId, user);

    const slug = await uniqueSlug(dto.slug ?? dto.title, (candidate) =>
      this.slugExists(marketplaceId, candidate),
    );

    return this.prisma.marketplacePage.create({
      data: {
        marketplace_id: marketplaceId,
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
  ): Promise<MarketplacePage> {
    const page = await this.getById(id);
    await this.marketplaces.assertOwned(page.marketplace_id, user);

    let slug = page.slug;
    if (dto.slug !== undefined && dto.slug !== page.slug) {
      slug = await uniqueSlug(dto.slug, (candidate) =>
        this.slugExists(page.marketplace_id, candidate, id),
      );
    }

    return this.prisma.marketplacePage.update({
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
    await this.marketplaces.assertOwned(page.marketplace_id, user);
    await this.prisma.marketplacePage.delete({ where: { id } });
    return { success: true };
  }

  private async slugExists(
    marketplaceId: string,
    candidate: string,
    excludeId?: string,
  ): Promise<boolean> {
    const existing = await this.prisma.marketplacePage.findFirst({
      where: {
        marketplace_id: marketplaceId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    return Boolean(existing);
  }
}
