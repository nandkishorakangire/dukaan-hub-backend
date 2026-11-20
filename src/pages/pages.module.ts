import { Module } from '@nestjs/common';
import { MarketplacesModule } from '../marketplaces/marketplaces.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [MarketplacesModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
