import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus, Role } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { OrdersService } from '../orders/orders.service';
import { orderInclude, OrderWithRelations } from '../orders/order.include';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentIntentDto, PaymentWebhookDto, ConfirmPaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  async createIntent(orderId: string, user: AuthenticatedUser, dto: PaymentIntentDto) {
    const order = await this.orders.findOrder(orderId);
    if (
      user.role !== Role.admin &&
      order.buyer_id !== user.id &&
      order.business.owner_id !== user.id
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }
    if (order.payment_mode === 'external') {
      throw new BadRequestException('External payments are confirmed by the seller');
    }
    if (order.payment_status === 'paid') throw new ConflictException('Order is already paid');
    if (order.status === 'cancelled') throw new BadRequestException('Order was cancelled');

    const provider = dto.provider ?? PaymentProvider.mock;
    const reference = `PAY-${randomUUID()}`;
    const payment = await this.prisma.payment.create({
      data: {
        order_id: order.id,
        provider,
        reference,
        amount: order.total,
        currency: order.currency,
        status: PaymentStatus.pending,
      },
    });

    return {
      payment,
      reference,
      amount: Number(order.total),
      currency: order.currency,
      upi_uri:
        provider === PaymentProvider.upi
          ? this.buildUpiUri(order, order.business.upi_id ?? 'dukaanhub@upi')
          : undefined,
    };
  }

  async confirm(orderId: string, user: AuthenticatedUser, dto: ConfirmPaymentDto) {
    const order = await this.orders.findOrder(orderId);
    const isSeller = user.role === Role.admin || order.business.owner_id === user.id;
    const isBuyer = order.buyer_id === user.id;
    if (!isSeller && !isBuyer) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (order.payment_mode === 'external' && !isSeller) {
      throw new ForbiddenException('Only the seller can confirm an external payment');
    }
    if (order.payment_mode === 'internal' && !isSeller) {
      const autoConfirm = this.config.getOrThrow<boolean>('payments.autoConfirm');
      if (!autoConfirm) {
        throw new ForbiddenException('Payments must be confirmed by the payment webhook');
      }
    }
    if (order.payment_status === 'paid') return order;

    let payment = await this.prisma.payment.findFirst({
      where: { order_id: order.id, reference: dto.reference },
    });
    if (!payment && isSeller) {
      payment = await this.prisma.payment.create({
        data: {
          order_id: order.id,
          provider: dto.provider ?? PaymentProvider.vendor_qr,
          reference: dto.reference,
          amount: order.total,
          currency: order.currency,
          status: PaymentStatus.pending,
        },
      });
    }
    if (!payment) throw new NotFoundException('Payment reference not found for this order');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.paid },
      });

      return tx.order.update({
        where: { id: order.id },
        data: {
          payment_status: PaymentStatus.paid,
          payment_reference: payment.reference,
          status: order.status === 'pending' ? 'confirmed' : order.status,
        },
        include: orderInclude,
      });
    });

    this.orders.broadcastOrder(updated, `Payment confirmed for ${updated.order_number}`);
    return updated;
  }

  async list(orderId: string, user: AuthenticatedUser) {
    await this.orders.getById(orderId, user);
    return this.prisma.payment.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    dto: PaymentWebhookDto,
  ): Promise<{ received: true }> {
    const secret = this.config.getOrThrow<string>('payments.webhookSecret');
    if (!secret) {
      throw new ServiceUnavailableException('Payment webhook is not configured');
    }
    this.verifySignature(rawBody ?? Buffer.from(JSON.stringify(dto)), signature, secret);

    const payment = await this.prisma.payment.findUnique({ where: { reference: dto.reference } });
    if (!payment) throw new NotFoundException('Payment not found');

    const status =
      dto.status === 'paid'
        ? PaymentStatus.paid
        : dto.status === 'failed'
          ? PaymentStatus.failed
          : PaymentStatus.refunded;

    if (payment.status === status && dto.status === 'paid') return { received: true };

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status } });

      if (dto.status === 'paid') {
        return tx.order.update({
          where: { id: payment.order_id },
          data: {
            payment_status: PaymentStatus.paid,
            payment_reference: payment.reference,
            status: 'confirmed',
          },
          include: orderInclude,
        });
      }

      if (dto.status === 'failed') {
        return tx.order.update({
          where: { id: payment.order_id },
          data: { payment_status: PaymentStatus.failed },
          include: orderInclude,
        });
      }

      return tx.order.update({
        where: { id: payment.order_id },
        data: { payment_status: PaymentStatus.refunded },
        include: orderInclude,
      });
    });

    this.orders.broadcastOrder(updated, `Payment ${dto.status} for ${updated.order_number}`);
    return { received: true };
  }

  private verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): void {
    if (!signature) throw new ForbiddenException('Missing webhook signature');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = signature.replace(/^sha256=/, '');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new ForbiddenException('Invalid webhook signature');
    }
  }

  private buildUpiUri(order: OrderWithRelations, payee: string): string {
    const params = new URLSearchParams({
      pa: payee,
      pn: order.business.name,
      am: Number(order.total).toFixed(2),
      cu: order.currency,
      tn: `Order ${order.order_number}`,
    });
    return `upi://pay?${params.toString()}`;
  }
}
