import { Module } from '@nestjs/common';
import { MarketplacesModule } from '../marketplaces/marketplaces.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [MarketplacesModule, RealtimeModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
