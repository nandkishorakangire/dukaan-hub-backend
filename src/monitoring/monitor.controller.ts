import {
  Controller,
  Get,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('status')
  async status() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'up',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      system: {
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };
  }

  @Get('health')
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'up',
      };
    } catch {
      return {
        status: 'degraded',
        database: 'down',
      };
    }
  }
}