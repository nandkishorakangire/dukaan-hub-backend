import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
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
  business_id?: string;

  @IsString()
  @MaxLength(140)
  title: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  image_url: string;

  /** Optional carousel video. The image_url is used as its poster. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  video_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  link_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  /** Status-style fallback timer for an image or a video awaiting first tap. */
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

export class UpdateAdDto extends PartialType(OmitType(CreateAdDto, ['business_id'] as const)) {}

export class ListAdsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}
