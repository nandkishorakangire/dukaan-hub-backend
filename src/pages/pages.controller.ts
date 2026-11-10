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
import { CreatePageDto, ListPagesQueryDto, UpdatePageDto } from './dto/page.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@Controller()
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Public()
  @Get('businesses/:business_id/pages')
  @ApiOperation({ summary: 'List published pages for a storefront' })
  list(
    @Param('business_id', ParseUUIDPipe) businessId: string,
    @Query() query: ListPagesQueryDto,
  ) {
    return this.pages.listForBusiness(businessId, query);
  }

  @Get('businesses/:business_id/pages/manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all pages, including drafts (owner/admin)' })
  manage(
    @Param('business_id', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPagesQueryDto,
  ) {
    return this.pages.listForOwner(businessId, user, query);
  }

  @Public()
  @Get('businesses/:business_id/pages/:slug')
  @ApiOperation({ summary: 'Get a published storefront page by slug' })
  bySlug(
    @Param('business_id', ParseUUIDPipe) businessId: string,
    @Param('slug') slug: string,
  ) {
    return this.pages.getPublishedBySlug(businessId, slug);
  }

  @Post('businesses/:business_id/pages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a storefront page (owner/admin)' })
  create(
    @Param('business_id', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePageDto,
  ) {
    return this.pages.create(businessId, user, dto);
  }

  @Get('pages/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a page by id, including drafts (owner/admin)' })
  byId(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pages.getForOwner(id, user);
  }

  @Patch('pages/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a page (owner/admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pages.update(id, user, dto);
  }

  @Delete('pages/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a page (owner/admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pages.remove(id, user);
  }
}
