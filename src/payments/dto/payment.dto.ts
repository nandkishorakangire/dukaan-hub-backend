import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

const INTERNAL_PROVIDERS = [
  PaymentProvider.mock,
  PaymentProvider.upi,
  PaymentProvider.card,
  PaymentProvider.netbanking,
  PaymentProvider.wallet,
  PaymentProvider.cod,
] as const;

export class PaymentIntentDto {
  @IsOptional()
  @IsIn(INTERNAL_PROVIDERS)
  provider?: PaymentProvider;
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
