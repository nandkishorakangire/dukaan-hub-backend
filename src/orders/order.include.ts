import { Prisma } from '@prisma/client';

export const orderInclude = {
  items: { orderBy: [{ name: 'asc' }] },
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
      logo_url: true,
      phone: true,
      owner_id: true,
      upi_id: true,
      payment_qr_url: true,
    },
  },
  buyer: { select: { id: true, name: true, avatar_url: true, phone: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
