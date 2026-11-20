import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  const uploadDir = resolve(process.cwd(), config.get<string>('uploadDir') ?? 'uploads');
  const corsOrigins = config.get<string[]>('corsOrigins') ?? ['*'];

  mkdirSync(uploadDir, { recursive: true });

  app.setGlobalPrefix('api/v1');

  // Strict CSP for API responses. The static Next.js dashboard relies on inline
  // bootstrap scripts, so it gets a slightly relaxed policy scoped to /monitor.
  const apiHelmet = helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } });
  const dashboardHelmet = helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const policy = req.path.startsWith('/monitor') ? dashboardHelmet : apiHelmet;
    policy(req, res, next);
  });

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  app.enableShutdownHooks();

  // Serve the statically exported Next.js dashboard at /monitor/.
  const dashboardDir = resolve(process.cwd(), 'monitor-ui/out');
  if (existsSync(resolve(dashboardDir, 'index.html'))) {
    app.use('/monitor', (req: Request, res: Response, next: NextFunction) => {
      if (req.originalUrl === '/monitor') {
        res.redirect(302, '/monitor/');
        return;
      }
      next();
    });
    app.useStaticAssets(dashboardDir, { prefix: '/monitor/' });
  } else {
    new Logger('Bootstrap').warn(
      'Dashboard not built - run `npm run build:dashboard` to enable /monitor',
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DukaanHub API')
    .setDescription(
      'Multi-vendor commerce API for DukaanHub: storefronts, catalog, orders, payments, chat, pages, ads and realtime.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addServer('/api/v1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`DukaanHub API listening on http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
  logger.log(`Monitoring dashboard at http://localhost:${port}/monitor`);
}

void bootstrap();
