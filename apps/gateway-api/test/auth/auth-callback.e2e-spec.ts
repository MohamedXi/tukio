/**
 * E2E spec — `GET /v1/auth/callback` (Story 1.4b AC10 callback).
 *
 * Light path validation only — Keycloak-backed happy + invalid_grant + DOWN
 * cases require the testcontainer fixture and are documented in
 * `keycloak-testcontainer.fixture.ts` for the Story 1.4d observability sprint.
 *
 * Cases here:
 *   1. Missing `code` query → 302 to /<locale>/auth/login?error=invalid_request
 *   2. Missing `state` query → 302 to /<locale>/auth/login?error=invalid_request
 *   3. Missing pkce-state cookie → 400 INVALID_STATE (P9 patch: comment fixed)
 *   4. locale=en propagated to error redirect
 *   5. P3: Keycloak ?error=access_denied (user cancels) → redirect + clear pkce cookie
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp, TEST_PUBLIC_BASE } from './build-test-app.js';

describe('GET /v1/auth/callback (E2E — Story 1.4b AC10)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('case 1 — missing code redirects to login error page', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/callback?state=some-state',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBe(
      `${TEST_PUBLIC_BASE}/fr/auth/login?error=invalid_request`,
    );
  });

  it('case 2 — missing state redirects to login error page', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/callback?code=some-code',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toContain('error=invalid_request');
  });

  it('case 3 — missing pkce cookie → 400 INVALID_STATE envelope', async () => {
    // P9 patch: comment now says 400 directly (old wording said "500 … confirmed below").
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/callback?code=x&state=y',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.tukioCode).toBe('AUTH-INVALID-STATE-001');
  });

  it('case 4 — locale=en propagated to error redirect', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/callback?locale=en',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toContain('/en/auth/login');
  });

  it('case 5 — P3: Keycloak ?error=access_denied (user cancels) → redirect with that error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/callback?error=access_denied',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toContain('error=access_denied');
    // pkce-state clear cookie should be emitted (Max-Age=0)
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie.join('\n')
      : String(setCookie ?? '');
    expect(cookies).toMatch(/tukio-pkce-state=.*Max-Age=0/);
  });
});
