import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { z, ZodError } from 'zod';
import { buildTestApp } from './helpers/build-test-app.js';
import type { IUserProfileRepository } from '../src/domain/ports/user-profile.repository.port.js';

// This spec tests the EnvelopeExceptionFilter's ZodError → 422 mapping directly
// by injecting a mock repository that throws a ZodError. This validates the filter's
// ZodError branch independent of any specific endpoint body schema.
// The ZodValidationPipe wired in main.ts provides the production trigger for future
// POST/PATCH endpoints; this test covers the filter behaviour in isolation.
describe('Envelope ADR-014 E2E', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const repo: IUserProfileRepository = {
      findById: jest.fn(() => {
        // Trigger a real ZodError to exercise the filter's 422 branch.
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
    // Use a valid UUID so ParseUUIDPipe passes before the mock throws the ZodError.
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/00000000-0000-0000-0000-000000000000',
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

  it('invalid UUID on :id → 400 (ParseUUIDPipe via EnvelopeExceptionFilter)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/not-a-uuid',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 400,
      error: { tukioCode: 'HTTP-400-001' },
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
    // ZodError import is real (not a mock)
    expect(ZodError).toBeDefined();
  });
});
