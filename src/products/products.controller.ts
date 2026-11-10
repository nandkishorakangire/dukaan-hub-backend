import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
  UpdateStockDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get('businesses/:business_id/products')
  @ApiOperation({ summary: 'List active products for a storefront' })
  list(
    @Param('business_id', ParseUUIDPipe) businessId: string,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.products.listForBusiness(businessId, query);
  }

  @Get('businesses/:business_id/products/manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all products for a storefront (owner/admin)' })
  manage(
    @Param('business_id', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.products.listAllForOwner(businessId, user, query);
  }

  @Post('businesses/:business_id/products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product (owner/admin)' })
  create(
    @Param('business_id', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.create(businessId, user, dto);
  }

  @Public()
  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by id' })
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.getById(id);
  }

  @Patch('products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (owner/admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, user, dto);
  }

  @Patch('products/:id/stock')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set stock quantity (owner/admin)' })
  stock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStockDto,
  ) {
    return this.products.updateStock(id, user, dto.stock_quantity);
  }

  @Delete('products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (owner/admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.products.remove(id, user);
  }
}
