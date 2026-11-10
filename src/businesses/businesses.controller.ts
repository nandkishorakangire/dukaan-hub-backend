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
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { BusinessesService } from './businesses.service';
import {
  CreateBusinessDto,
  ListBusinessesQueryDto,
  UpdateBusinessDto,
} from './dto/business.dto';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get()
  @ApiOperation({ summary: 'List storefronts (search, category, featured, sort)' })
  list(@Query() query: ListBusinessesQueryDto) {
    return this.businesses.list(query);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Trending storefronts' })
  trending(@Query('limit') limit?: string) {
    return this.businesses.trending(limit ? Number(limit) : 10);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Storefronts owned by the signed-in user' })
  mine(@CurrentUser('id') userId: string) {
    return this.businesses.mine(userId);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a storefront by slug' })
  bySlug(@Param('slug') slug: string) {
    return this.businesses.getBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a storefront by id' })
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.businesses.getById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a storefront (the account becomes a seller)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBusinessDto) {
    return this.businesses.create(userId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a storefront (owner or admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businesses.update(id, user, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a storefront (owner or admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.businesses.remove(id, user);
  }
}
