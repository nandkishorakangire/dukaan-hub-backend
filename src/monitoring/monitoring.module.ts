import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MonitorController } from './monitor.controller';

@Module({
  controllers: [MonitorController, MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MonitoringModule {}