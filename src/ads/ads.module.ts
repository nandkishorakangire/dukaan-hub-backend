import { Module } from '@nestjs/common';
import { MarketplacesModule } from '../marketplaces/marketplaces.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [MarketplacesModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
