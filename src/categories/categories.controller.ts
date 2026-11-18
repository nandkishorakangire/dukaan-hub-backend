import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateCategoryIconModeDto,
} from './dto/category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List categories' })
  list() {
    return this.categories.list();
  }

  @Public()
  @Get('tree')
  @ApiOperation({ summary: 'List categories as a nested tree' })
  tree() {
    return this.categories.tree();
  }

  @Public()
  @Get('icon-mode')
  @ApiOperation({ summary: 'Get the admin-configured category icon mode' })
  iconMode() {
    return this.categories.getCategoryIconMode();
  }

  @Patch('icon-mode')
  @ApiBearerAuth()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Set the category icon mode (admin)' })
  setIconMode(@Body() dto: UpdateCategoryIconModeDto) {
    return this.categories.setCategoryIconMode(dto.mode);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a category by id' })
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.getById(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Create a category (admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Update a category (admin)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Delete a category (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
