/**
 * Playwright E2E — apps/seller middleware status-redirect (Story 1.4d AC10).
 *
 * Asserts the seller-access middleware decisions via crafted cookies + the 307
 * `Location` header (maxRedirects: 0). Decode-only middleware → unsigned crafted
 * JWTs suffice (no live Keycloak).
 *
 * 4 cases × 2 locales = 8:
 *   1. Pro pending_admin_review on /seller/dashboard → /{locale}/seller/onboarding/pending
 *   2. Pro active on /seller/dashboard               → no status redirect (passes through)
 *   3. Pro rejected on /seller/dashboard             → /{locale}/seller/onboarding/rejected
 *   4. Pro suspended on /seller/dashboard            → cross-zone apex /auth/login (redirect-login)
 *
 * Case 4 is the only path in seller-access.ts that emits a cross-zone redirect-login
 * (suspended / deleted / unknown status). Must be covered to validate the NextResponse
 * wrapper cross-zone branch.
 *
 * Requires the seller dev server (`pnpm --filter=seller dev`, port 3002).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3002';
// Apex base URL for cross-zone redirect assertions (case 4: suspended → apex login).
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
  status: string,
): Promise<string | undefined> {
  const token = jwt({ realm_access: { roles: ['pro'] }, 'tukio:status': status });
  const res = await request.get(`${BASE_URL}${path}`, {
    headers: { Cookie: `tukio-access-token=${token}` },
    maxRedirects: 0,
  });
  return res.headers()['location'];
}

for (const locale of ['fr', 'en'] as const) {
  test.describe(`seller middleware status-redirect — ${locale}`, () => {
    test(`1. pending on /${locale}/seller/dashboard → onboarding/pending`, async ({ request }) => {
      const loc = await locationFor(request, `/${locale}/seller/dashboard`, 'pending_admin_review');
      expect(loc).toContain(`/${locale}/seller/onboarding/pending`);
    });

    test(`2. active on /${locale}/seller/dashboard → no status redirect`, async ({ request }) => {
      const token = jwt({ realm_access: { roles: ['pro'] }, 'tukio:status': 'active' });
      const res = await request.get(`${BASE_URL}/${locale}/seller/dashboard`, {
        headers: { Cookie: `tukio-access-token=${token}` },
        maxRedirects: 0,
      });
      // Middleware must pass through (not emit a 307/302). Status may be 200 or
      // 404 depending on whether the dashboard page is implemented — both confirm
      // the middleware did not redirect.
      expect(res.status()).not.toBe(307);
      expect(res.status()).not.toBe(302);
      expect(res.headers()['location'] ?? '').not.toContain('/seller/onboarding/pending');
    });

    test(`3. rejected on /${locale}/seller/dashboard → onboarding/rejected`, async ({
      request,
    }) => {
      const loc = await locationFor(request, `/${locale}/seller/dashboard`, 'rejected');
      expect(loc).toContain(`/${locale}/seller/onboarding/rejected`);
    });

    test(`4. suspended on /${locale}/seller/dashboard → apex login (cross-zone)`, async ({
      request,
    }) => {
      const loc = await locationFor(request, `/${locale}/seller/dashboard`, 'suspended');
      // suspended → cross-zone redirect-login: seller-access.ts emits an absolute
      // apex URL with ?next=<seller-url>. Verify it lands at the apex login.
      expect(loc).toContain(APEX_BASE_URL);
      expect(loc).toContain('/auth/login');
    });
  });
}
