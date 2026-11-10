import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class BusinessTimingDto {
  @IsString()
  @MaxLength(40)
  day: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'open must be HH:MM (24h)' })
  open: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'close must be HH:MM (24h)' })
  close: string;

  @IsOptional()
  @IsBoolean()
  closed?: boolean;
}

export class CreateBusinessDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  logo_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  banner_url?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessTimingDto)
  timings?: BusinessTimingDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  upi_id?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  payment_qr_url?: string;

  @IsOptional()
  @IsBoolean()
  accepts_internal_payments?: boolean;
}

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {}

export class ListBusinessesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsIn(['trend', 'rating', 'newest', 'name'])
  sort?: 'trend' | 'rating' | 'newest' | 'name';
}
