import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MonitorController } from './monitor.controller';
import { RequestStatsService } from './request-stats.service';

@Module({
  controllers: [MonitorController, MetricsController],
  providers: [MetricsService, RequestStatsService],
  exports: [MetricsService, RequestStatsService],
})
export class MonitoringModule {}