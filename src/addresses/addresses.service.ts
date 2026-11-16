import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { updated_at: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    const count = await this.prisma.address.count({ where: { user_id: userId } });
    if (count >= 20) {
      throw new BadRequestException('You can save up to 20 addresses');
    }
    const makeDefault = dto.is_default ?? count === 0;

    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }
      return tx.address.create({
        data: { ...dto, user_id: userId, is_default: makeDefault },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.getOwned(userId, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.is_default === true) {
        await tx.address.updateMany({
          where: { user_id: userId, is_default: true, NOT: { id } },
          data: { is_default: false },
        });
      }
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: string, id: string) {
    const address = await this.getOwned(userId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (address.is_default) {
        const next = await tx.address.findFirst({
          where: { user_id: userId },
          orderBy: { updated_at: 'desc' },
          select: { id: true },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { is_default: true } });
        }
      }
    });

    return { success: true };
  }

  async setDefault(userId: string, id: string) {
    await this.getOwned(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { user_id: userId, is_default: true, NOT: { id } },
        data: { is_default: false },
      });
      return tx.address.update({ where: { id }, data: { is_default: true } });
    });
  }

  private async getOwned(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, user_id: userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }
}
