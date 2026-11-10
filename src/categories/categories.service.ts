import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { uniqueSlug } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, children: true } } },
    });
  }

  async tree() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    const byParent = new Map<string | null, typeof categories>();
    for (const category of categories) {
      const key = category.parent_id ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(category);
      byParent.set(key, bucket);
    }
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((category) => ({
        ...category,
        children: build(category.id),
      }));
    return build(null);
  }

  async getById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parent_id) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parent_id },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Parent category not found');
    }

    const slug = await uniqueSlug(dto.slug ?? dto.name, async (candidate) => {
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return Boolean(existing);
    });

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        icon: dto.icon,
        parent_id: dto.parent_id,
        sort_order: dto.sort_order ?? 0,
      },
    });
  }

  async update(id: string, dto: Partial<CreateCategoryDto>) {
    await this.getById(id);
    if (dto.parent_id === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    if (dto.parent_id) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parent_id },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Parent category not found');
    }

    const data: Prisma.CategoryUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
      ...(dto.parent_id !== undefined
        ? { parent: dto.parent_id ? { connect: { id: dto.parent_id } } : { disconnect: true } }
        : {}),
    };

    if (dto.slug !== undefined) {
      data.slug = await uniqueSlug(dto.slug, async (candidate) => {
        const existing = await this.prisma.category.findFirst({
          where: { slug: candidate, NOT: { id } },
          select: { id: true },
        });
        return Boolean(existing);
      });
    }

    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }
}
