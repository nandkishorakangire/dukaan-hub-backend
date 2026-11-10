import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUser, publicUserSelect } from './user.select';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(data: { name: string; email: string; password_hash: string; phone?: string }) {
    return this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        password_hash: data.password_hash,
        phone: data.phone?.trim() || null,
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
