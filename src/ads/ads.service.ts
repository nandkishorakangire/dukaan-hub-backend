import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdMediaType, Prisma } from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { AuthenticatedUser, isAdmin } from '../common/types/authenticated-user';
import { probeVideoOrientation } from '../common/utils/video-orientation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto, ListAdsQueryDto, UpdateAdDto } from './dto/ad.dto';

const adInclude = {
  business: { select: { id: true, name: true, slug: true, logo_url: true } },
} satisfies Prisma.AdInclude;

export type AdWithBusiness = Prisma.AdGetPayload<{ include: typeof adInclude }>;

const isVideoMedia = (type: AdMediaType) => type === 'video' || type === 'status_video';
const isStatusMedia = (type: AdMediaType) =>
  type === 'status_image' || type === 'status_video';

/** Keep media_url/posters aligned with the first item of the ordered lists. */
function resolveMediaLists(
  mediaUrl: string,
  mediaUrls: string[] | undefined,
  posterUrl: string | null | undefined,
  posterUrls: string[] | undefined,
) {
  const urls = mediaUrls?.length ? mediaUrls : [mediaUrl];
  const posters = posterUrls?.length
    ? posterUrls
    : posterUrl
      ? [posterUrl]
      : [];
  return { urls, posters, primary: urls[0] ?? mediaUrl };
}

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  /** Ads that are currently live. */
  async listPublic(query: ListAdsQueryDto): Promise<PaginatedResult<AdWithBusiness>> {
    const now = new Date();
    const where: Prisma.AdWhereInput = {
      is_active: true,
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
      ...(isAdmin(user) ? {} : { business: { owner_id: user.id } }),
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
    } else if (!isAdmin(user)) {
      throw new BadRequestException('business_id is required for storefront ads');
    }

    this.assertDateRange(dto.starts_at, dto.ends_at);

    const mediaType = dto.media_type ?? 'image';
    const video = isVideoMedia(mediaType);
    const { urls, posters, primary } = resolveMediaLists(
      dto.media_url,
      dto.media_urls,
      dto.poster_url,
      dto.poster_urls,
    );
    // Both status types wait for one play click, then run their list in order.
    const autoPlay = isStatusMedia(mediaType) ? false : (dto.auto_play ?? true);

    return this.prisma.ad.create({
      data: {
        business_id: dto.business_id ?? null,
        title: dto.title.trim(),
        media_url: primary,
        media_urls: urls,
        media_type: mediaType,
        poster_url: posters[0] ?? null,
        poster_urls: posters,
        video_orientation: video
          ? dto.video_orientation ?? (await probeVideoOrientation(primary))
          : null,
        link_url: dto.link_url,
        sort_order: dto.sort_order ?? 0,
        duration_ms: dto.duration_ms ?? null,
        pausable: dto.pausable ?? true,
        auto_play: autoPlay,
        show_sound_control: dto.show_sound_control ?? true,
        muted: dto.muted ?? true,
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

    const mediaType = dto.media_type ?? ad.media_type;
    const video = isVideoMedia(mediaType);
    const currentUrls = ad.media_urls?.length ? ad.media_urls : [ad.media_url];
    const currentPosters = ad.poster_urls?.length
      ? ad.poster_urls
      : ad.poster_url
        ? [ad.poster_url]
        : [];
    const { urls, posters, primary } = resolveMediaLists(
      dto.media_url ?? ad.media_url,
      dto.media_urls ?? (dto.media_url === undefined ? currentUrls : undefined),
      dto.poster_url !== undefined ? dto.poster_url : (currentPosters[0] ?? null),
      dto.poster_urls ?? (dto.poster_url === undefined ? currentPosters : undefined),
    );
    const mediaChanged =
      primary !== ad.media_url ||
      JSON.stringify(urls) !== JSON.stringify(currentUrls) ||
      (dto.media_type !== undefined && dto.media_type !== ad.media_type);
    // Probe orientation only for a video, and only when its media actually
    // changed. Switching an ad to an image clears the now-irrelevant hint.
    const probedOrientation =
      mediaChanged && video ? await probeVideoOrientation(primary) : null;
    const nextOrientation =
      dto.video_orientation ??
      probedOrientation ??
      (mediaChanged && !video ? null : undefined);

    // Both status types wait for one play click. Leaving one restores auto-play
    // so a type-only edit does not keep the old tap-to-start behaviour.
    const nextAutoPlay = isStatusMedia(mediaType)
      ? false
      : dto.auto_play !== undefined
        ? dto.auto_play
        : isStatusMedia(ad.media_type)
          ? true
          : undefined;

    return this.prisma.ad.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        media_url: primary,
        media_urls: urls,
        ...(dto.media_type !== undefined ? { media_type: dto.media_type } : {}),
        poster_url: posters[0] ?? null,
        poster_urls: posters,
        ...(nextOrientation !== undefined ? { video_orientation: nextOrientation } : {}),
        ...(dto.link_url !== undefined ? { link_url: dto.link_url } : {}),
        ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
        ...(dto.duration_ms !== undefined ? { duration_ms: dto.duration_ms } : {}),
        ...(dto.pausable !== undefined ? { pausable: dto.pausable } : {}),
        ...(nextAutoPlay !== undefined ? { auto_play: nextAutoPlay } : {}),
        ...(dto.show_sound_control !== undefined
          ? { show_sound_control: dto.show_sound_control }
          : {}),
        ...(dto.muted !== undefined ? { muted: dto.muted } : {}),
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
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ad.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  private async assertCanManage(ad: AdWithBusiness, user: AuthenticatedUser): Promise<void> {
    if (isAdmin(user)) return;
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
