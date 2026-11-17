import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateCouponDiscount } from '../orders/order-pricing';
import { ListCouponsQueryDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Currently running coupons, optionally priced against a checkout subtotal. */
  async list(query: ListCouponsQueryDto) {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: {
        is_active: true,
        AND: [
          { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
          { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
        ],
      },
      orderBy: [{ min_order: 'asc' }, { value: 'desc' }],
    });

    return coupons.map((coupon) => {
      const base = {
        type: coupon.type,
        value: Number(coupon.value),
        max_discount: coupon.max_discount != null ? Number(coupon.max_discount) : null,
        min_order: Number(coupon.min_order),
      };
      const discount =
        query.subtotal != null ? calculateCouponDiscount(query.subtotal, base) : null;

      return {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        ...base,
        starts_at: coupon.starts_at,
        ends_at: coupon.ends_at,
        discount,
        applicable:
          query.subtotal != null
            ? discount != null && discount > 0
            : Number(coupon.min_order) <= 0,
      };
    });
  }
}
