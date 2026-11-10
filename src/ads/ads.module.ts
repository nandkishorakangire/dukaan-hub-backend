import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [BusinessesModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
