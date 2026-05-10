import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { z, ZodError } from 'zod';
import nock from 'nock';
import {
  buildTestApp,
  generateTestJwt,
  setupJwksMock,
} from './helpers/build-test-app.js';
import type { IUserProfileRepository } from '../src/domain/ports/user-profile.repository.port.js';

const FOUND_ID = '00000000-0000-0000-0000-000000000000';

describe('Envelope ADR-014 E2E', () => {
  let app: NestFastifyApplication;
  let adminJwt: string;

  beforeAll(async () => {
    nock.cleanAll();
    setupJwksMock();
    const repo: IUserProfileRepository = {
      findById: jest.fn(() => {
        const Schema = z.object({ userId: z.string().uuid() }).strict();
        Schema.parse({ userId: 'definitely-not-a-uuid' });
        return Promise.resolve(null);
      }),
      findByKeycloakUserId: jest.fn(),
      save: jest.fn(),
    };
    app = await buildTestApp({ userProfileRepo: repo });
    adminJwt = generateTestJwt({
      sub: 'admin-uuid',
      roles: ['admin-super'],
      amr: ['totp'],
    });
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
  });

  it('ZodError → 422 VALIDATION-FAILED-001 with issues[]', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${FOUND_ID}`,
      headers: { Authorization: `Bearer ${adminJwt}` },
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
    expect(ZodError).toBeDefined();
  });

  it('invalid UUID on :id → 400 (ParseUUIDPipe via EnvelopeExceptionFilter)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/not-a-uuid',
      headers: { Authorization: `Bearer ${adminJwt}` },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 400,
      error: { tukioCode: 'HTTP-400-001' },
    });
  });

  it('GET /v1/health → SuccessEnvelope shape stable (public, no JWT needed)', async () => {
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
});
