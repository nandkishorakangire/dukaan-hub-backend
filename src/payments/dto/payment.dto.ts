import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

const INTERNAL_PROVIDERS = [
  PaymentProvider.mock,
  PaymentProvider.upi,
  PaymentProvider.card,
  PaymentProvider.netbanking,
  PaymentProvider.wallet,
  PaymentProvider.cod,
  PaymentProvider.pay_later,
] as const;

export class PaymentIntentDto {
  @IsOptional()
  @IsIn(INTERNAL_PROVIDERS)
  provider?: PaymentProvider;

  /** Instrument the shopper saved beforehand; the provider is derived from it. */
  @IsOptional()
  @IsUUID()
  saved_method_id?: string;
}

export class ConfirmPaymentDto {
  @IsString()
  @MaxLength(160)
  reference: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}

export class PaymentWebhookDto {
  @IsString()
  @MaxLength(160)
  reference: string;

  @IsIn(['paid', 'failed', 'refunded'])
  status: 'paid' | 'failed' | 'refunded';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  signature?: string;
}
