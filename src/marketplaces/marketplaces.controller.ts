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
import { MarketplacesService } from './marketplaces.service';
import {
  CreateMarketplaceDto,
  ListMarketplacesQueryDto,
  UpdateMarketplaceDto,
} from './dto/marketplace.dto';

@ApiTags('marketplaces')
@Controller('marketplaces')
export class MarketplacesController {
  constructor(private readonly marketplaces: MarketplacesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List storefronts (search, category, featured, sort)' })
  list(@Query() query: ListMarketplacesQueryDto) {
    return this.marketplaces.list(query);
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Trending storefronts' })
  trending(@Query('limit') limit?: string) {
    return this.marketplaces.trending(limit ? Number(limit) : 10);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Storefronts owned by the signed-in user' })
  mine(@CurrentUser('id') userId: string) {
    return this.marketplaces.mine(userId);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a storefront by slug' })
  bySlug(@Param('slug') slug: string) {
    return this.marketplaces.getBySlug(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a storefront by id' })
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketplaces.getById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a storefront (the account becomes a seller)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateMarketplaceDto) {
    return this.marketplaces.create(userId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a storefront (owner or admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMarketplaceDto,
  ) {
    return this.marketplaces.update(id, user, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a storefront (owner or admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.marketplaces.remove(id, user);
  }
}
