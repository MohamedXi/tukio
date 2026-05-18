/**
 * E2E spec — `POST /v1/auth/refresh` (Story 1.4b AC10 refresh).
 *
 * Validates the CsrfGuard wiring; the happy-path token rotation requires a
 * real Keycloak testcontainer (see fixture for Story 1.4d).
 *
 * Cases:
 *   1. No CSRF header + no cookie → 403 AUTH-CSRF-MISMATCH-001
 *   2. CSRF header + matching cookie + no refresh cookie → 403 (defensive)
 *   3. CSRF mismatch (header ≠ cookie) → 403
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp } from './build-test-app.js';

describe('POST /v1/auth/refresh (E2E — Story 1.4b AC10)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('case 1 — no CSRF → 403 AUTH-CSRF-MISMATCH-001', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh' });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.tukioCode).toBe('AUTH-CSRF-MISMATCH-001');
  });

  it('case 2 — CSRF mismatch (header ≠ cookie) → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-csrf-token': 'token-a',
        cookie: 'tukio-csrf-token=token-b',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.tukioCode).toBe('AUTH-CSRF-MISMATCH-001');
  });

  it('case 3 — CSRF match but no refresh cookie → 403 AUTH-CSRF-MISMATCH-001', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-csrf-token': 'token-x',
        cookie: 'tukio-csrf-token=token-x',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.tukioCode).toBe('AUTH-CSRF-MISMATCH-001');
  });
});
