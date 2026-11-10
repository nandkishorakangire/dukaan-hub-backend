import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly realtime: RealtimeService,
  ) {}

  async listForBusiness(
    businessId: string,
    query: ListProductsQueryDto,
  ): Promise<PaginatedResult<Prisma.ProductGetPayload<object>>> {
    await this.ensureBusinessExists(businessId);

    const where: Prisma.ProductWhereInput = {
      business_id: businessId,
      is_active: query.include_inactive ? undefined : true,
      ...(query.category_id ? { category_id: query.category_id } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : query.sort === 'name'
            ? { name: 'asc' }
            : { created_at: 'desc' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async listAllForOwner(
    businessId: string,
    user: AuthenticatedUser,
    query: ListProductsQueryDto,
  ): Promise<PaginatedResult<Prisma.ProductGetPayload<object>>> {
    await this.businesses.assertOwned(businessId, user);
    return this.listForBusiness(businessId, { ...query, include_inactive: true });
  }

  async getById(id: string, user?: AuthenticatedUser) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.is_active && !user) throw new NotFoundException('Product not found');
    return product;
  }

  async create(businessId: string, user: AuthenticatedUser, dto: CreateProductDto) {
    await this.businesses.assertOwned(businessId, user);
    if (dto.category_id) await this.ensureCategoryExists(dto.category_id);

    const product = await this.prisma.product.create({
      data: {
        business_id: businessId,
        name: dto.name.trim(),
        description: dto.description,
        price: dto.price,
        mrp: dto.mrp,
        weight: dto.weight,
        discount_percent: dto.discount_percent ?? this.deriveDiscount(dto.price, dto.mrp),
        currency: dto.currency ?? 'INR',
        stock_quantity: dto.stock_quantity ?? 0,
        image_url: dto.image_url,
        image_width: dto.image_width,
        image_height: dto.image_height,
        image_bg_color: dto.image_bg_color,
        category_id: dto.category_id,
        is_active: dto.is_active ?? true,
      },
    });

    this.realtime.emitProductStock(product.business_id, {
      product_id: product.id,
      stock_quantity: product.stock_quantity,
    });

    return product;
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateProductDto) {
    const product = await this.findProduct(id);
    await this.businesses.assertOwned(product.business_id, user);
    if (dto.category_id) await this.ensureCategoryExists(dto.category_id);

    const price = dto.price ?? Number(product.price);
    const mrp = dto.mrp === undefined ? (product.mrp ? Number(product.mrp) : undefined) : dto.mrp;

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.mrp !== undefined ? { mrp: dto.mrp } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.discount_percent !== undefined
          ? { discount_percent: dto.discount_percent }
          : dto.price !== undefined || dto.mrp !== undefined
            ? { discount_percent: this.deriveDiscount(price, mrp) }
            : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.stock_quantity !== undefined ? { stock_quantity: dto.stock_quantity } : {}),
        ...(dto.image_url !== undefined ? { image_url: dto.image_url } : {}),
        ...(dto.image_width !== undefined ? { image_width: dto.image_width } : {}),
        ...(dto.image_height !== undefined ? { image_height: dto.image_height } : {}),
        ...(dto.image_bg_color !== undefined ? { image_bg_color: dto.image_bg_color } : {}),
        ...(dto.category_id !== undefined
          ? dto.category_id
            ? { category: { connect: { id: dto.category_id } } }
            : { category: { disconnect: true } }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
    });

    if (dto.stock_quantity !== undefined) {
      this.realtime.emitProductStock(updated.business_id, {
        product_id: updated.id,
        stock_quantity: updated.stock_quantity,
      });
    }

    return updated;
  }

  async updateStock(id: string, user: AuthenticatedUser, stockQuantity: number) {
    const product = await this.findProduct(id);
    await this.businesses.assertOwned(product.business_id, user);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock_quantity: stockQuantity },
    });

    this.realtime.emitProductStock(updated.business_id, {
      product_id: updated.id,
      stock_quantity: updated.stock_quantity,
    });

    return updated;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const product = await this.findProduct(id);
    await this.businesses.assertOwned(product.business_id, user);
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  private async findProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async ensureBusinessExists(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Category not found');
  }

  private deriveDiscount(price: number, mrp?: number): number | undefined {
    if (!mrp || mrp <= price) return undefined;
    return Math.round(((mrp - price) / mrp) * 100);
  }
}
