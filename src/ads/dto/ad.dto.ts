import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AdPlacement } from '@prisma/client';
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

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  link_url?: string;

  @IsEnum(AdPlacement)
  placement: AdPlacement;

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
  @IsEnum(AdPlacement)
  placement?: AdPlacement;

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
