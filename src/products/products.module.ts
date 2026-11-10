import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [BusinessesModule, RealtimeModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
