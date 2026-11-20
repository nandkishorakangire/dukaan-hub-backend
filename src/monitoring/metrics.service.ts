import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  onModuleInit() {
    // Collect default Node.js process metrics (CPU, memory, event loop, GC, etc.)
    // Guard against double-registration (e.g. in tests that create multiple apps)
    if (!register.getSingleMetric('process_cpu_user_seconds_total')) {
      collectDefaultMetrics({ register });
    }
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}