import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestStatsService } from './request-stats.service';

@Injectable()
export class RequestStatsMiddleware implements NestMiddleware {
  constructor(private readonly stats: RequestStatsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const started = Date.now();
    this.stats.begin();

    let completed = false;
    const finish = (): void => {
      if (completed) return;
      completed = true;
      this.stats.end();

      const url = req.originalUrl || req.url;
      // Ignore monitoring traffic so dashboard polling does not distort app analytics.
      if (url.includes('/metrics') || url.includes('/monitor/')) return;
      this.stats.record(
        req.method,
        url.split('?')[0] ?? url,
        res.statusCode,
        Date.now() - started,
      );
    };

    res.on('finish', finish);
    res.on('close', finish);
    next();
  }
}
