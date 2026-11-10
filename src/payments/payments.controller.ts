import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ConfirmPaymentDto, PaymentIntentDto, PaymentWebhookDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('orders/:order_id/payments')
@ApiBearerAuth()
export class OrderPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('intent')
  @ApiOperation({ summary: 'Create a payment intent for an internal payment' })
  intent(
    @Param('order_id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PaymentIntentDto,
  ) {
    return this.payments.createIntent(orderId, user, dto);
  }

  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm a payment (seller for external QR payments; buyer in auto-confirm mode)',
  })
  confirm(
    @Param('order_id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.payments.confirm(orderId, user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List payment attempts for an order' })
  list(
    @Param('order_id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.list(orderId, user);
  }
}

@ApiTags('payments')
@Controller('payments')
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-dukaanhub-signature') signature: string | undefined,
    @Body() dto: PaymentWebhookDto,
  ) {
    return this.payments.handleWebhook(request.rawBody, signature, dto);
  }
}
