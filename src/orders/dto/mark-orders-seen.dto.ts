import { IsArray, IsUUID } from 'class-validator';

export class MarkOrdersSeenDto {
  @IsArray()
  @IsUUID('4', { each: true })
  order_ids: string[];
}
