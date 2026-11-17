import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  /** Primary role kept for compatibility with older rows and clients. */
  role: Role;
  /** Additive roles; a seller who shops is both `buyer` and `seller`. */
  roles: Role[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  roles?: Role[];
  type: 'access' | 'refresh';
  jti?: string;
}

/** True when the user holds the role, including through the legacy primary field. */
export function hasRole(user: AuthenticatedUser, role: Role): boolean {
  return user.roles?.includes(role) || user.role === role;
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return hasRole(user, Role.admin);
}
