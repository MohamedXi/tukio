import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp } from './helpers/build-test-app.js';

describe('Health E2E', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp({
      userProfileRepo: {
        findById: jest.fn(),
        findByKeycloakUserId: jest.fn(),
        save: jest.fn(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 wrapped in SuccessEnvelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 200,
      data: { status: 'ok' },
      meta: {
        locale: 'fr',
        correlationId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('GET /ready → 503 when no DataSource is wired (envelope error)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 503,
      error: {
        tukioCode: 'HTTP-503-001',
        instance: '/ready',
      },
    });
  });
});
