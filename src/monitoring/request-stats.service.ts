import { Injectable } from '@nestjs/common';
import { Counter, Gauge, register } from 'prom-client';

export interface RecentRequest {
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  at: string;
}

@Injectable()
export class RequestStatsService {
  private total = 0;
  private failures = 0;
  private active = 0;
  private readonly status: Record<string, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };
  private readonly methods: Record<string, number> = {};
  private readonly recent: RecentRequest[] = [];
  private latencySum = 0;
  private readonly startedAt = Date.now();

  private readonly requestsCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests handled by the API.',
    labelNames: ['method', 'status'],
    registers: [register],
  });

  private readonly failureCounter = new Counter({
    name: 'http_request_failures_total',
    help: 'Total number of failed (5xx) HTTP responses.',
    registers: [register],
  });

  private readonly activeGauge = new Gauge({
    name: 'http_requests_active',
    help: 'Number of HTTP requests currently in flight.',
    registers: [register],
  });

  /** Called when a request enters the pipeline. */
  begin(): void {
    this.active += 1;
    this.activeGauge.set(this.active);
  }

  /** Called when a request leaves the pipeline (completed or aborted). */
  end(): void {
    this.active = Math.max(0, this.active - 1);
    this.activeGauge.set(this.active);
  }

  record(method: string, path: string, status: number, durationMs: number): void {
    this.total += 1;
    this.latencySum += durationMs;

    const bucket = `${Math.floor(status / 100)}xx`;
    if (bucket in this.status) this.status[bucket] += 1;

    this.methods[method] = (this.methods[method] ?? 0) + 1;

    if (status >= 500) {
      this.failures += 1;
      this.failureCounter.inc();
    }

    this.requestsCounter.inc({ method, status: String(status) });

    this.recent.unshift({
      method,
      path: path.length > 120 ? `${path.slice(0, 117)}...` : path,
      status,
      duration_ms: durationMs,
      at: new Date().toISOString(),
    });
    if (this.recent.length > 20) this.recent.pop();
  }

  snapshot() {
    return {
      total: this.total,
      active: this.active,
      failures: this.failures,
      uptime_seconds: Math.round((Date.now() - this.startedAt) / 1000),
      average_latency_ms: this.total > 0 ? Math.round(this.latencySum / this.total) : 0,
      by_status: { ...this.status },
      by_method: { ...this.methods },
      recent: [...this.recent],
    };
  }
}
