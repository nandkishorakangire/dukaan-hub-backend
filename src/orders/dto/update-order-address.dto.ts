import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DeliveryAddressDto } from './create-order.dto';

/** Replaces the delivery address of an order that has not shipped yet. */
export class UpdateOrderAddressDto {
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery_address: DeliveryAddressDto;
}
