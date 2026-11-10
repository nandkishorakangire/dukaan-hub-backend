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
import { AdsService } from './ads.service';
import { CreateAdDto, ListAdsQueryDto, UpdateAdDto } from './dto/ad.dto';

@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List live ads, optionally filtered by placement or storefront' })
  list(@Query() query: ListAdsQueryDto) {
    return this.ads.listPublic(query);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ads for the signed-in seller’s storefronts (admin: all ads)' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAdsQueryDto) {
    return this.ads.mine(user, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get an ad by id' })
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.ads.getById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an ad (storefront owner or admin)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdDto) {
    return this.ads.create(user, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an ad (storefront owner or admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAdDto,
  ) {
    return this.ads.update(id, user, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an ad (storefront owner or admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ads.remove(id, user);
  }
}
