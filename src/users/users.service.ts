import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { normalizePhone } from '../common/utils/phone';
import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUser, publicUserSelect } from './user.select';

type CreateUserInput = {
  name: string;
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
    return this.prisma.user.create({
      data: {
        name: data.name.trim(),
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

  update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
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

  async promoteToSeller(id: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, role: Role.buyer },
      data: { role: Role.seller },
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
