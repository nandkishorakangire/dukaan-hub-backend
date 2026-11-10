import { OrderStatus } from '@prisma/client';

export type CouponLike = {
  type: 'percent' | 'flat';
  value: number;
  max_discount?: number | null;
  min_order: number;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Discount for a coupon, or 0 when the order does not meet the minimum. */
export function calculateCouponDiscount(subtotal: number, coupon: CouponLike): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (subtotal < Number(coupon.min_order)) return 0;

  const value = Number(coupon.value);
  const raw = coupon.type === 'percent' ? (subtotal * value) / 100 : value;
  const capped = coupon.max_discount != null ? Math.min(raw, Number(coupon.max_discount)) : raw;
  return roundMoney(Math.max(0, Math.min(capped, subtotal)));
}

export interface OrderTotalsInput {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  handlingFee: number;
  tipAmount: number;
  donationAmount: number;
  freeDeliveryThreshold: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  delivery_fee: number;
  handling_fee: number;
  tip_amount: number;
  donation_amount: number;
  total: number;
}

export function calculateOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotal = roundMoney(input.subtotal);
  const discount = roundMoney(Math.min(Math.max(input.discount, 0), subtotal));
  const delivery_fee =
    subtotal >= input.freeDeliveryThreshold ? 0 : roundMoney(Math.max(input.deliveryFee, 0));
  const handling_fee = roundMoney(Math.max(input.handlingFee, 0));
  const tip_amount = roundMoney(Math.max(input.tipAmount, 0));
  const donation_amount = roundMoney(Math.max(input.donationAmount, 0));

  return {
    subtotal,
    discount,
    delivery_fee,
    handling_fee,
    tip_amount,
    donation_amount,
    total: roundMoney(
      subtotal - discount + delivery_fee + handling_fee + tip_amount + donation_amount,
    ),
  };
}

/** Allowed status transitions. Cancellation is handled separately. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const CANCELLABLE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing'];
