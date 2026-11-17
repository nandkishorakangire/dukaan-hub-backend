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
import { CreateSavedPaymentMethodDto } from './dto/saved-payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';

@ApiTags('payment-methods')
@ApiBearerAuth()
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List my saved payment methods' })
  list(@CurrentUser('id') userId: string) {
    return this.paymentMethods.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save a payment method for faster checkout' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateSavedPaymentMethodDto) {
    return this.paymentMethods.create(userId, dto);
  }

  @Patch(':id/default')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make a saved payment method the default one' })
  setDefault(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentMethods.setDefault(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a saved payment method' })
  remove(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentMethods.remove(userId, id);
  }
}
