import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  /** When present, returns orders for that storefront (owner/admin only). */
  @IsOptional()
  @IsUUID()
  marketplace_id?: string;
}
