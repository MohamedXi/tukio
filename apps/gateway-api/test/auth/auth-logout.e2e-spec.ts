/**
 * E2E spec — `POST /v1/auth/logout` (Story 1.4b AC10 logout).
 *
 * Validates the CsrfGuard wiring + idempotent UX (cookies cleared even when
 * Keycloak revoke fails or no refresh cookie is present).
 *
 * Cases:
 *   1. No CSRF → 403 AUTH-CSRF-MISMATCH-001
 *   2. CSRF OK + no refresh cookie → 200 OK + 4 clear cookies (idempotent)
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp } from './build-test-app.js';

describe('POST /v1/auth/logout (E2E — Story 1.4b AC10)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('case 1 — no CSRF → 403 AUTH-CSRF-MISMATCH-001', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/logout' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.tukioCode).toBe('AUTH-CSRF-MISMATCH-001');
  });

  it('case 2 — CSRF OK + no refresh cookie → 200 + 4 clear cookies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {
        'x-csrf-token': 'token-x',
        cookie: 'tukio-csrf-token=token-x',
      },
    });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie!];
    expect(cookies.some((c) => c.includes('tukio-access-token='))).toBe(true);
    expect(cookies.some((c) => c.includes('Max-Age=0'))).toBe(true);
  });
});
