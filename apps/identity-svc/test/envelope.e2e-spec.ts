import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { z, ZodError } from 'zod';
import { buildTestApp } from './helpers/build-test-app.js';
import type { IUserProfileRepository } from '../src/domain/ports/user-profile.repository.port.js';

// Reuse the GET /v1/users/:id route — but force the use case to throw a ZodError
// by having the mock repository throw one. The EnvelopeExceptionFilter must map
// it to a 422 + tukioCode VALIDATION-FAILED-001 + populated `error.issues`.
describe('Envelope ADR-014 E2E', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const repo: IUserProfileRepository = {
      findById: jest.fn(() => {
        // Trigger a real ZodError by parsing invalid input.
        const Schema = z.object({ userId: z.string().uuid() }).strict();
        Schema.parse({ userId: 'definitely-not-a-uuid' });
        return Promise.resolve(null);
      }),
      findByKeycloakUserId: jest.fn(),
      save: jest.fn(),
    };
    app = await buildTestApp({ userProfileRepo: repo });
  });

  afterAll(async () => {
    await app.close();
  });

  it('ZodError → 422 VALIDATION-FAILED-001 with issues[]', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/whatever',
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 422,
      error: {
        tukioCode: 'VALIDATION-FAILED-001',
        title: 'Validation failed',
        type: 'https://tukio.one/errors/validation-failed',
      },
      meta: { locale: 'fr', correlationId: expect.any(String) },
    });
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(body.error.issues.length).toBeGreaterThanOrEqual(1);
    expect(body.error.issues[0]).toMatchObject({
      path: 'userId',
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('GET /health → SuccessEnvelope shape stable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
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
    // ZodError import is real
    expect(ZodError).toBeDefined();
  });
});
