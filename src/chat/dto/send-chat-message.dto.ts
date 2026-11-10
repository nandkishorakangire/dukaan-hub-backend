import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class SendChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string;

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
  @IsUUID()
  reply_to_id?: string;
}
