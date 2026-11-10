import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentMode, Prisma, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { orderInclude, OrderWithRelations } from './order.include';
import {
  CANCELLABLE_STATUSES,
  calculateCouponDiscount,
  calculateOrderTotals,
  canTransition,
} from './order-pricing';

type OrderLine = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
  ) {}

  async create(buyer: AuthenticatedUser, dto: CreateOrderDto): Promise<OrderWithRelations> {
    const business = await this.prisma.business.findUnique({
      where: { id: dto.business_id },
      select: {
        id: true,
        name: true,
        owner_id: true,
        accepts_internal_payments: true,
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    if (dto.payment_mode === PaymentMode.internal && !business.accepts_internal_payments) {
      throw new BadRequestException('This business does not accept in-app payments');
    }

    // Merge duplicate lines so a client cannot bypass the per-line quantity cap.
    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      const next = (quantities.get(item.product_id) ?? 0) + item.quantity;
      if (next > 99) throw new BadRequestException('Maximum quantity per product is 99');
      quantities.set(item.product_id, next);
    }
    const productIds = [...quantities.keys()];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, business_id: business.id, is_active: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are unavailable');
    }

    const lines: OrderLine[] = [];
    for (const [productId, quantity] of quantities) {
      const product = byId.get(productId)!;
      if (product.stock_quantity < quantity) {
        throw new ConflictException(
          product.stock_quantity === 0
            ? `${product.name} is out of stock`
            : `Only ${product.stock_quantity} of ${product.name} left in stock`,
        );
      }
      const price = Number(product.price);
      lines.push({
        product_id: product.id,
        name: product.name,
        price,
        quantity,
        subtotal: price * quantity,
      });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);

    let discount = 0;
    let couponCode: string | null = null;
    if (dto.coupon_code) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: dto.coupon_code } });
      const now = new Date();
      const valid =
        coupon &&
        coupon.is_active &&
        (!coupon.starts_at || coupon.starts_at <= now) &&
        (!coupon.ends_at || coupon.ends_at >= now);
      if (!valid) throw new BadRequestException('Invalid or expired coupon');
      discount = calculateCouponDiscount(subtotal, {
        type: coupon.type,
        value: Number(coupon.value),
        max_discount: coupon.max_discount != null ? Number(coupon.max_discount) : null,
        min_order: Number(coupon.min_order),
      });
      if (discount <= 0) {
        throw new BadRequestException('This coupon is not applicable to this order');
      }
      couponCode = coupon.code;
    }

    const totals = calculateOrderTotals({
      subtotal,
      discount,
      deliveryFee: this.config.getOrThrow<number>('payments.deliveryFee'),
      handlingFee: this.config.getOrThrow<number>('payments.handlingFee'),
      tipAmount: dto.tip_amount ?? 0,
      donationAmount: dto.donation_amount ?? 0,
      freeDeliveryThreshold: this.config.getOrThrow<number>('payments.freeDeliveryThreshold'),
    });

    const order = await this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: { id: line.product_id, stock_quantity: { gte: line.quantity } },
          data: { stock_quantity: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          throw new ConflictException(`Insufficient stock for ${line.name}`);
        }
      }

      return tx.order.create({
        data: {
          order_number: this.generateOrderNumber(),
          buyer_id: buyer.id,
          business_id: business.id,
          subtotal: totals.subtotal,
          discount: totals.discount,
          delivery_fee: totals.delivery_fee,
          handling_fee: totals.handling_fee,
          tip_amount: totals.tip_amount,
          donation_amount: totals.donation_amount,
          total: totals.total,
          currency: 'INR',
          coupon_code: couponCode,
          payment_mode: dto.payment_mode,
          payment_status: 'pending',
          status: 'pending',
          notes: dto.notes,
          delivery_address: dto.delivery_address
            ? (dto.delivery_address as unknown as Prisma.InputJsonValue)
            : undefined,
          items: {
            create: lines.map((line) => ({
              product_id: line.product_id,
              name: line.name,
              price: line.price,
              quantity: line.quantity,
              subtotal: line.subtotal,
            })),
          },
        },
        include: orderInclude,
      });
    });

    this.realtime.emitOrderUpdate(order.id, order, [order.buyer_id, business.owner_id]);
    this.realtime.emitNotification(business.owner_id, {
      type: 'order:new',
      order_id: order.id,
      title: 'New order received',
      body: `${order.order_number} · ₹${order.total}`,
    });
    await this.broadcastStock(productIds);

    return order;
  }

  async list(
    user: AuthenticatedUser,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderWithRelations>> {
    const where: Prisma.OrderWhereInput = {};

    if (query.business_id) {
      await this.businesses.assertOwned(query.business_id, user);
      where.business_id = query.business_id;
    } else if (user.role !== Role.admin) {
      where.buyer_id = user.id;
    }
    if (query.status) where.status = query.status;

    return this.paginateOrders(where, query);
  }

  async listForSeller(
    user: AuthenticatedUser,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderWithRelations>> {
    const businesses = await this.prisma.business.findMany({
      where: user.role === Role.admin ? {} : { owner_id: user.id },
      select: { id: true },
    });
    const where: Prisma.OrderWhereInput = {
      business_id: { in: businesses.map((business) => business.id) },
      ...(query.status ? { status: query.status } : {}),
    };
    return this.paginateOrders(where, query);
  }

  async getById(id: string, user: AuthenticatedUser): Promise<OrderWithRelations> {
    const order = await this.findOrder(id);
    this.assertCanView(order, user);
    return order;
  }

  async updateStatus(
    id: string,
    user: AuthenticatedUser,
    status: OrderStatus,
  ): Promise<OrderWithRelations> {
    const order = await this.findOrder(id);
    this.assertCanSell(order, user);

    if (order.status === status) return order;
    if (!canTransition(order.status, status)) {
      throw new BadRequestException(`Cannot change status from ${order.status} to ${status}`);
    }
    if (status === OrderStatus.cancelled) {
      return this.cancelOrder(order, user, 'Order cancelled by seller');
    }

    const data: Prisma.OrderUpdateInput = { status };

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: orderInclude,
    });

    this.emitOrderChanged(updated, `Order ${updated.order_number} is now ${status}`);
    return updated;
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
    reason?: string,
  ): Promise<OrderWithRelations> {
    const order = await this.findOrder(id);
    if (
      user.role !== Role.admin &&
      order.buyer_id !== user.id &&
      order.business.owner_id !== user.id
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(`An order that is ${order.status} cannot be cancelled`);
    }
    return this.cancelOrder(order, user, reason ?? 'Order cancelled');
  }

  /** Re-broadcasts an order after a payment update. */
  broadcastOrder(order: OrderWithRelations, message?: string): void {
    this.emitOrderChanged(order, message ?? `Order ${order.order_number} was updated`);
  }

  async findOrder(id: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async paginateOrders(
    where: Prisma.OrderWhereInput,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderWithRelations>> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  private async cancelOrder(
    order: OrderWithRelations,
    actor: AuthenticatedUser,
    reason: string,
  ): Promise<OrderWithRelations> {
    const productIds = order.items
      .map((item) => item.product_id)
      .filter((id): id is string => Boolean(id));

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.product_id) continue;
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { increment: item.quantity } },
        });
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          payment_status: order.payment_status === 'paid' ? 'refunded' : order.payment_status,
          notes: reason ? `${order.notes ? `${order.notes}\n` : ''}${reason}` : order.notes,
        },
        include: orderInclude,
      });
    });

    this.emitOrderChanged(updated, `Order ${updated.order_number} was cancelled`);
    if (actor.id === updated.buyer_id) {
      this.realtime.emitNotification(updated.business.owner_id, {
        type: 'order:cancelled',
        order_id: updated.id,
        title: 'Buyer cancelled an order',
        body: `${updated.order_number} · ₹${updated.total}`,
      });
    }
    await this.broadcastStock(productIds);
    return updated;
  }

  private emitOrderChanged(order: OrderWithRelations, message: string): void {
    this.realtime.emitOrderUpdate(order.id, order, [order.buyer_id, order.business.owner_id]);
    this.realtime.emitNotification(order.buyer_id, {
      type: 'order:update',
      order_id: order.id,
      status: order.status,
      title: 'Order updated',
      body: message,
    });
  }

  private async broadcastStock(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, business_id: true, stock_quantity: true },
    });
    for (const product of products) {
      this.realtime.emitProductStock(product.business_id, {
        product_id: product.id,
        stock_quantity: product.stock_quantity,
      });
    }
  }

  private assertCanView(order: OrderWithRelations, user: AuthenticatedUser): void {
    if (
      user.role !== Role.admin &&
      order.buyer_id !== user.id &&
      order.business.owner_id !== user.id
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }
  }

  private assertCanSell(order: OrderWithRelations, user: AuthenticatedUser): void {
    if (user.role !== Role.admin && order.business.owner_id !== user.id) {
      throw new ForbiddenException('Only the seller can change this order');
    }
  }

  private generateOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `DH-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
