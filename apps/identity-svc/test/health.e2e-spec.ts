import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import nock from 'nock';
import { buildTestApp, setupJwksMock } from './helpers/build-test-app.js';

describe('Health E2E', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    nock.cleanAll();
    setupJwksMock();
    app = await buildTestApp({
      userProfileRepo: {
        findById: jest.fn(),
        findByKeycloakUserId: jest.fn(),
        findByEmail: jest.fn(),
        save: jest.fn(),
        runInTransaction: jest.fn(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
  });

  it('GET /v1/health → 200 wrapped in SuccessEnvelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 200,
      data: { status: 'ok' },
      meta: {
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        locale: 'fr',
      },
    });
  });

  it('GET /v1/ready → 503 when no DataSource is wired (envelope error)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/ready' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 503,
      error: { tukioCode: 'HTTP-503-001' },
      meta: { locale: 'fr', correlationId: expect.any(String) },
    });
  });
});
