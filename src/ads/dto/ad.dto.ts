import { AdMediaType } from '@prisma/client';
import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateAdDto {
  /** Omit for a platform-wide ad (admin only). */
  @IsOptional()
  @IsUUID()
  marketplace_id?: string;

  @IsString()
  @MaxLength(140)
  title: string;

  /** Primary media item. For status ads this is also the first media_urls item. */
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  media_url: string;

  /** Ordered media items for a status ad; the first item is also media_url. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUrl({ require_tld: false }, { each: true })
  @MaxLength(2048, { each: true })
  media_urls?: string[];

  /** Media kind. Status ads wait for play and run their list inside one tile. */
  @IsOptional()
  @IsEnum(AdMediaType)
  media_type?: AdMediaType;

  /** Single front-facing carousel image for this ad. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  poster_url?: string;

  /** Thumbnails for media_urls items, in the same order; used by the player. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUrl({ require_tld: false }, { each: true })
  @MaxLength(2048, { each: true })
  thumbnail_urls?: string[];

  /** Landscape/portrait hint for fullscreen. Probed from the video when omitted. */
  @IsOptional()
  @IsIn(['landscape', 'portrait'])
  video_orientation?: 'landscape' | 'portrait';

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  link_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  /** Per-item timer for image media; video fallback uses the carousel default. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  duration_ms?: number;

  @IsOptional()
  @IsBoolean()
  pausable?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_play?: boolean;

  @IsOptional()
  @IsBoolean()
  show_sound_control?: boolean;

  @IsOptional()
  @IsBoolean()
  muted?: boolean;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateAdDto extends PartialType(OmitType(CreateAdDto, ['marketplace_id'] as const)) {}

export class ListAdsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  marketplace_id?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}
