import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SavedPaymentMethodKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedPaymentMethodDto } from './dto/saved-payment-method.dto';
import { NET_BANKING_OPTIONS, WALLET_OPTIONS } from './payment-method-options';

/** How many instruments a single account may keep on file. */
const MAX_SAVED_METHODS = 10;

/** Luhn checksum used to reject obviously mistyped card numbers. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

/** Payment-network brand inferred from the issuer identification number. */
export function detectCardBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(60|65|81|82|508)/.test(digits)) return 'RuPay';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  if (/^(?:2131|1800|35)/.test(digits)) return 'JCB';
  return 'Card';
}

function twoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Rejects expiry dates that are already in the past. */
function assertNotExpired(month: number, year: number): void {
  const now = new Date();
  const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  if (lastDayOfMonth < now) {
    throw new BadRequestException('This card has expired');
  }
}

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.savedPaymentMethod.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateSavedPaymentMethodDto) {
    const count = await this.prisma.savedPaymentMethod.count({ where: { user_id: userId } });
    if (count >= MAX_SAVED_METHODS) {
      throw new BadRequestException(`You can save up to ${MAX_SAVED_METHODS} payment methods`);
    }

    const data = this.buildInstrument(dto);
    const makeDefault = dto.make_default ?? count === 0;

    const duplicate = await this.prisma.savedPaymentMethod.findFirst({
      where: { user_id: userId, kind: dto.kind, detail: data.detail },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException('This payment method is already saved');
    }

    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.savedPaymentMethod.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }

      return tx.savedPaymentMethod.create({
        data: { ...data, user_id: userId, is_default: makeDefault },
      });
    });
  }

  async remove(userId: string, id: string) {
    const instrument = await this.getOwned(userId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.delete({ where: { id } });

      if (instrument.is_default) {
        const next = await tx.savedPaymentMethod.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          select: { id: true },
        });
        if (next) {
          await tx.savedPaymentMethod.update({ where: { id: next.id }, data: { is_default: true } });
        }
      }
    });

    return { success: true };
  }

  async setDefault(userId: string, id: string) {
    await this.getOwned(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.updateMany({
        where: { user_id: userId, is_default: true, NOT: { id } },
        data: { is_default: false },
      });
      return tx.savedPaymentMethod.update({ where: { id }, data: { is_default: true } });
    });
  }

  /** Validates the kind-specific payload and keeps only non-sensitive metadata. */
  private buildInstrument(dto: CreateSavedPaymentMethodDto) {
    switch (dto.kind) {
      case SavedPaymentMethodKind.upi: {
        const upiId = (dto.upi_id ?? '').trim().toLowerCase();
        if (!upiId) throw new BadRequestException('Enter the UPI ID you want to save');
        return {
          kind: dto.kind,
          label: 'UPI ID',
          detail: upiId,
          provider: 'upi',
          brand: null,
          last4: null,
          expiry: null,
        };
      }

      case SavedPaymentMethodKind.card: {
        const digits = (dto.card_number ?? '').replace(/\s+/g, '');
        if (digits.length < 12 || digits.length > 19) {
          throw new BadRequestException('card_number must contain 12 to 19 digits');
        }
        if (!passesLuhn(digits)) {
          throw new BadRequestException('That card number is not valid');
        }
        if (!dto.expiry_month || !dto.expiry_year) {
          throw new BadRequestException('Enter the card expiry date');
        }
        assertNotExpired(dto.expiry_month, dto.expiry_year);

        const brand = detectCardBrand(digits);
        const last4 = digits.slice(-4);
        const expiry = `${twoDigits(dto.expiry_month)}/${String(dto.expiry_year).slice(-2)}`;

        return {
          kind: dto.kind,
          label: brand,
          // Only the brand, last four digits and expiry leave the request.
          detail: `${brand} •••• ${last4}`,
          provider: 'card',
          brand,
          last4,
          expiry,
        };
      }

      case SavedPaymentMethodKind.netbanking: {
        const bank = NET_BANKING_OPTIONS.find((option) => option.id === dto.bank);
        if (!bank) throw new BadRequestException('Choose a supported bank');
        return {
          kind: dto.kind,
          label: 'Net banking',
          detail: bank.name,
          provider: bank.id,
          brand: null,
          last4: null,
          expiry: null,
        };
      }

      case SavedPaymentMethodKind.wallet: {
        const wallet = WALLET_OPTIONS.find((option) => option.id === dto.wallet);
        if (!wallet) throw new BadRequestException('Choose a supported wallet');
        return {
          kind: dto.kind,
          label: wallet.name,
          detail: `${wallet.name} wallet`,
          provider: wallet.id,
          brand: null,
          last4: null,
          expiry: null,
        };
      }

      default:
        throw new BadRequestException('Unsupported payment method type');
    }
  }

  private async getOwned(userId: string, id: string) {
    const instrument = await this.prisma.savedPaymentMethod.findFirst({
      where: { id, user_id: userId },
    });
    if (!instrument) throw new NotFoundException('Saved payment method not found');
    return instrument;
  }
}
