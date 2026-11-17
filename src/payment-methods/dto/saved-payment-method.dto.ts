import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { SavedPaymentMethodKind } from '@prisma/client';
import { NET_BANKING_IDS, WALLET_IDS } from '../payment-method-options';

export class CreateSavedPaymentMethodDto {
  @IsEnum(SavedPaymentMethodKind)
  kind!: SavedPaymentMethodKind;

  @ValidateIf((dto: CreateSavedPaymentMethodDto) => dto.kind === SavedPaymentMethodKind.upi)
  @IsString()
  @Matches(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, {
    message: 'upi_id must look like name@bank',
  })
  upi_id?: string;

  @ValidateIf((dto: CreateSavedPaymentMethodDto) => dto.kind === SavedPaymentMethodKind.card)
  @IsString()
  @Matches(/^\d{12,19}$/, { message: 'card_number must contain 12 to 19 digits' })
  card_number?: string;

  @ValidateIf((dto: CreateSavedPaymentMethodDto) => dto.kind === SavedPaymentMethodKind.card)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  expiry_month?: number;

  @ValidateIf((dto: CreateSavedPaymentMethodDto) => dto.kind === SavedPaymentMethodKind.card)
  @Type(() => Number)
  @IsInt()
  @Min(2024)
  @Max(2100)
  expiry_year?: number;

  @IsOptional()
  @ValidateIf((dto: CreateSavedPaymentMethodDto) => dto.kind === SavedPaymentMethodKind.card)
  @IsString()
  @Length(2, 60)
  cardholder_name?: string;

  @ValidateIf((dto: CreateSavedPaymentMethodDto) => dto.kind === SavedPaymentMethodKind.netbanking)
  @IsString()
  @IsIn(NET_BANKING_IDS)
  bank?: string;

  @ValidateIf((dto: CreateSavedPaymentMethodDto) => dto.kind === SavedPaymentMethodKind.wallet)
  @IsString()
  @IsIn(WALLET_IDS)
  wallet?: string;

  @IsOptional()
  @IsBoolean()
  make_default?: boolean;
}
