import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateProductDto {
  @IsString()
  @Length(1, 160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  weight?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discount_percent?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock_quantity?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  image_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  image_width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  image_height?: number;

  @IsOptional()
  @IsHexColor()
  image_bg_color?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class UpdateStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock_quantity: number;
}

export class ListProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  include_inactive?: boolean;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc', 'name'])
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name';
}
