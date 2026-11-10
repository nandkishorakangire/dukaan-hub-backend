import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { OrderPaymentsController, PaymentWebhookController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule],
  controllers: [OrderPaymentsController, PaymentWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
