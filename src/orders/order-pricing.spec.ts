import { calculateCouponDiscount, calculateOrderTotals, canTransition, roundMoney } from './order-pricing';

describe('order pricing', () => {
  it('rounds money to paise', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });

  it('applies percentage coupons with a cap', () => {
    const discount = calculateCouponDiscount(1000, {
      type: 'percent',
      value: 10,
      max_discount: 80,
      min_order: 0,
    });
    expect(discount).toBe(80);
  });

  it('applies flat coupons', () => {
    expect(
      calculateCouponDiscount(400, { type: 'flat', value: 50, max_discount: null, min_order: 300 }),
    ).toBe(50);
  });

  it('rejects coupons below the minimum order value', () => {
    expect(
      calculateCouponDiscount(100, { type: 'flat', value: 50, max_discount: null, min_order: 300 }),
    ).toBe(0);
  });

  it('never discounts more than the subtotal', () => {
    expect(
      calculateCouponDiscount(40, { type: 'flat', value: 50, max_discount: null, min_order: 0 }),
    ).toBe(40);
  });

  it('waives delivery above the free-delivery threshold', () => {
    const totals = calculateOrderTotals({
      subtotal: 250,
      discount: 20,
      deliveryFee: 25,
      handlingFee: 2,
      tipAmount: 10,
      donationAmount: 5,
      freeDeliveryThreshold: 199,
    });
    expect(totals).toEqual({
      subtotal: 250,
      discount: 20,
      delivery_fee: 0,
      handling_fee: 2,
      tip_amount: 10,
      donation_amount: 5,
      total: 247,
    });
  });

  it('charges delivery below the threshold', () => {
    const totals = calculateOrderTotals({
      subtotal: 100,
      discount: 0,
      deliveryFee: 25,
      handlingFee: 2,
      tipAmount: 0,
      donationAmount: 0,
      freeDeliveryThreshold: 199,
    });
    expect(totals.total).toBe(127);
  });

  it('allows valid status transitions only', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
    expect(canTransition('delivered', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
  });
});
