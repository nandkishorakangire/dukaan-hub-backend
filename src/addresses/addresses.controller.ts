import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List my saved delivery addresses' })
  list(@CurrentUser('id') userId: string) {
    return this.addresses.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save a delivery address' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.addresses.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved address' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addresses.update(userId, id, dto);
  }

  @Patch(':id/default')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make an address the default one' })
  setDefault(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addresses.setDefault(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved address' })
  remove(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.addresses.remove(userId, id);
  }
}
