import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/health reports service status', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded)$/),
      database: expect.stringMatching(/^(up|down)$/),
    });
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('GET /api/v1 is public', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1').expect(200);
    expect(response.body.name).toBe('DukaanHub API');
  });

  it('rejects unauthenticated access to protected routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });
});
