import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
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
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  app.enableShutdownHooks();

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
}

void bootstrap();
