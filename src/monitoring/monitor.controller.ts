import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RequestStatsService } from './request-stats.service';

@Controller('monitor')
export class MonitorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: RequestStatsService,
  ) {}

  @Public()
  @Get('status')
  async status() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    const analytics = this.stats.snapshot();

    return {
      status: database === 'up' && analytics.failures === 0 ? 'ok' : 'degraded',
      database,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      system: {
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      analytics,
    };
  }

  @Public()
  @Get('health')
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}