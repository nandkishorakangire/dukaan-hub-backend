import { Module } from '@nestjs/common';
import { MarketplacesModule } from '../marketplaces/marketplaces.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [MarketplacesModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
