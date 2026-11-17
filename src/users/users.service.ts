import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmailChangeStatus, Prisma, Role } from '@prisma/client';
import { composeName, NameParts, splitName } from '../common/utils/name';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { normalizePhone } from '../common/utils/phone';
import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUser, publicUserSelect } from './user.select';

type CreateUserInput = {
  name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email: string;
  /** Absent for phone-only and social accounts. */
  password_hash?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  oauth_provider?: string | null;
  oauth_subject?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone: normalizePhone(phone) } });
  }

  findByOAuth(provider: string, subject: string) {
    return this.prisma.user.findFirst({
      where: { oauth_provider: provider, oauth_subject: subject },
      select: publicUserSelect,
    });
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(data: CreateUserInput) {
    const parts: NameParts =
      data.first_name || data.middle_name || data.last_name
        ? {
            first_name: data.first_name,
            middle_name: data.middle_name,
            last_name: data.last_name,
          }
        : splitName(data.name);

    return this.prisma.user.create({
      data: {
        name: composeName(parts) || data.name.trim(),
        first_name: parts.first_name?.trim() || null,
        middle_name: parts.middle_name?.trim() || null,
        last_name: parts.last_name?.trim() || null,
        email: data.email.toLowerCase().trim(),
        password_hash: data.password_hash ?? null,
        phone: data.phone?.trim() || null,
        avatar_url: data.avatar_url ?? null,
        oauth_provider: data.oauth_provider ?? null,
        oauth_subject: data.oauth_subject ?? null,
      },
      select: publicUserSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: {
        name: true,
        first_name: true,
        middle_name: true,
        last_name: true,
      },
    });
    if (!current) throw new NotFoundException('User not found');

    let parts: Required<NameParts> = {
      first_name: current.first_name ?? '',
      middle_name: current.middle_name ?? '',
      last_name: current.last_name ?? '',
    };
    // Rows created before name parts existed only have the composed name.
    if (!parts.first_name && !parts.last_name && current.name) {
      parts = splitName(current.name);
    }

    let nameTouched = false;
    if (dto.first_name !== undefined) {
      parts.first_name = dto.first_name.trim();
      nameTouched = true;
    }
    if (dto.middle_name !== undefined) {
      parts.middle_name = dto.middle_name.trim();
      nameTouched = true;
    }
    if (dto.last_name !== undefined) {
      parts.last_name = dto.last_name.trim();
      nameTouched = true;
    }

    let name: string | undefined;
    if (nameTouched) {
      name = composeName(parts);
      if (name.length < 2) {
        throw new BadRequestException('Provide at least a first name or a last name');
      }
    } else if (dto.name !== undefined) {
      name = dto.name.trim();
      parts = splitName(name);
      nameTouched = true;
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(nameTouched
          ? {
              first_name: parts.first_name || null,
              middle_name: parts.middle_name || null,
              last_name: parts.last_name || null,
            }
          : {}),
        ...(dto.avatar_url !== undefined ? { avatar_url: dto.avatar_url } : {}),
      },
      select: publicUserSelect,
    });
  }

  setPhone(id: string, phone: string): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id },
      data: { phone: normalizePhone(phone) },
      select: publicUserSelect,
    });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { password_hash: passwordHash } });
  }

  linkOAuth(id: string, provider: string, subject: string, avatarUrl?: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: {
        oauth_provider: provider,
        oauth_subject: subject,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      },
      select: publicUserSelect,
    });
  }

  /** Adds the seller role without dropping the buyer role. */
  async promoteToSeller(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, roles: true },
    });
    if (!user || user.roles.includes(Role.seller)) return;

    await this.prisma.user.update({
      where: { id },
      data: {
        roles: [...user.roles, Role.seller],
        // Admins stay admins; everyone else gains seller as their primary role.
        ...(user.role === Role.admin ? {} : { role: Role.seller }),
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Email change requests (admin approved)                              */
  /* ------------------------------------------------------------------ */

  async requestEmailChange(userId: string, requestedEmail: string) {
    const newEmail = requestedEmail.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.email === newEmail) {
      throw new BadRequestException('That is already your email address');
    }

    const owner = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (owner) throw new ConflictException('This email is already in use');

    const pending = await this.prisma.emailChangeRequest.findFirst({
      where: { user_id: userId, status: EmailChangeStatus.pending },
      orderBy: { created_at: 'desc' },
    });
    if (pending) {
      if (pending.new_email === newEmail) return pending;
      throw new ConflictException('You already have a pending email change request');
    }

    return this.prisma.emailChangeRequest.create({
      data: {
        user_id: userId,
        current_email: user.email,
        new_email: newEmail,
      },
    });
  }

  /** Most recent request, including its review status. */
  latestEmailChange(userId: string) {
    return this.prisma.emailChangeRequest.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  listEmailChanges(status?: EmailChangeStatus) {
    return this.prisma.emailChangeRequest.findMany({
      where: status ? { status } : {},
      orderBy: { created_at: 'asc' },
      include: { user: { select: publicUserSelect } },
    });
  }

  async reviewEmailChange(id: string, adminId: string, approve: boolean) {
    const request = await this.prisma.emailChangeRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Email change request not found');
    if (request.status !== EmailChangeStatus.pending) {
      throw new BadRequestException('This request has already been reviewed');
    }

    if (!approve) {
      return this.prisma.emailChangeRequest.update({
        where: { id },
        data: {
          status: EmailChangeStatus.rejected,
          reviewed_by_id: adminId,
          reviewed_at: new Date(),
        },
        include: { user: { select: publicUserSelect } },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({
        where: { email: request.new_email },
        select: { id: true },
      });
      if (owner && owner.id !== request.user_id) {
        throw new ConflictException('This email is already in use');
      }

      await tx.user.update({
        where: { id: request.user_id },
        data: { email: request.new_email },
      });

      return tx.emailChangeRequest.update({
        where: { id },
        data: {
          status: EmailChangeStatus.approved,
          reviewed_by_id: adminId,
          reviewed_at: new Date(),
        },
        include: { user: { select: publicUserSelect } },
      });
    });
  }

  async list(query: PaginationQueryDto): Promise<PaginatedResult<PublicUser>> {
    const where: Prisma.UserWhereInput = {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }
}
