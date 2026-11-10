import { Prisma } from '@prisma/client';

/** Fields that are safe to expose on the wire. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatar_url: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
