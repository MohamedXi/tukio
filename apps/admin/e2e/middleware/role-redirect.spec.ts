/**
 * Playwright E2E — apps/admin middleware role+TOTP redirect (Story 1.4d AC10).
 *
 * Asserts the admin-access middleware decisions via crafted cookies + the 307
 * `Location` header (maxRedirects: 0). Decode-only middleware → unsigned crafted
 * JWTs suffice (no live Keycloak).
 *
 * 3 cases × 2 locales = 6:
 *   1. Customer on /admin              → apex home (tukio.one/{locale}/)
 *   2. Admin without TOTP in amr       → /{locale}/auth/totp-setup
 *   3. Admin with TOTP                 → no auth redirect (passes through)
 *
 * Requires the admin dev server (`pnpm --filter=admin dev`, port 3003).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3003';
// Apex base URL for cross-zone redirect assertions. In dev NEXT_PUBLIC_BASE_URL is
// http://localhost:3000 — asserting 'tukio.one' would fail. Override via
// PLAYWRIGHT_APEX_BASE_URL in CI where the real domains are used.
const APEX_BASE_URL = process.env['PLAYWRIGHT_APEX_BASE_URL'] ?? 'http://localhost:3000';
const NOW = Math.floor(Date.now() / 1000);

function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function jwt(claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ exp: NOW + 300, iat: NOW, ...claims }));
  return `${header}.${payload}.sig`;
}

async function locationFor(
  request: APIRequestContext,
  path: string,
  token: string,
): Promise<string | undefined> {
  const res = await request.get(`${BASE_URL}${path}`, {
    headers: { Cookie: `tukio-session-active=1; tukio-access-token=${token}` },
    maxRedirects: 0,
  });
  return res.headers()['location'];
}

for (const locale of ['fr', 'en'] as const) {
  test.describe(`admin middleware role+TOTP redirect — ${locale}`, () => {
    test(`1. customer on /${locale}/admin/dashboard → apex home`, async ({ request }) => {
      const loc = await locationFor(
        request,
        `/${locale}/admin/dashboard`,
        jwt({ realm_access: { roles: ['client'] }, amr: ['pwd'] }),
      );
      // Use APEX_BASE_URL so this passes in both dev (localhost:3000) and
      // production (https://tukio.one) environments.
      expect(loc).toContain(APEX_BASE_URL);
      expect(loc).toContain(`/${locale}/`);
      // Must NOT redirect back to an admin or auth path.
      expect(loc).not.toContain('/admin/');
      expect(loc).not.toContain('/auth/login');
    });

    test(`2. admin without TOTP on /${locale}/admin/dashboard → totp-setup`, async ({
      request,
    }) => {
      const loc = await locationFor(
        request,
        `/${locale}/admin/dashboard`,
        jwt({ realm_access: { roles: ['admin-super'] }, amr: ['pwd'] }),
      );
      expect(loc).toContain(`/${locale}/auth/totp-setup`);
    });

    test(`3. admin with TOTP on /${locale}/admin/dashboard → no auth redirect`, async ({
      request,
    }) => {
      const token = jwt({ realm_access: { roles: ['admin-modo'] }, amr: ['pwd', 'totp'] });
      const res = await request.get(`${BASE_URL}/${locale}/admin/dashboard`, {
        headers: { Cookie: `tukio-session-active=1; tukio-access-token=${token}` },
        maxRedirects: 0,
      });
      // Middleware must pass through (not emit a 307/302). Status may be 200 or
      // 404 depending on whether the dashboard page is implemented — both confirm
      // the middleware did not redirect.
      expect(res.status()).not.toBe(307);
      expect(res.status()).not.toBe(302);
      const loc = res.headers()['location'] ?? '';
      expect(loc).not.toContain('/auth/totp-setup');
      expect(loc).not.toContain('/auth/login');
    });
  });
}
