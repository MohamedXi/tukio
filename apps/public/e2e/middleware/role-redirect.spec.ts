/**
 * Playwright E2E — apps/public middleware role-redirect (Story 1.4d AC10).
 *
 * Asserts the apex auth-gate middleware redirect decisions by hitting the
 * Next.js server with crafted cookies and reading the 307 `Location` header
 * (maxRedirects: 0). The middleware decodes the access token WITHOUT verifying
 * the signature (the gateway JWT guard is the authority), so an unsigned
 * crafted JWT is sufficient to exercise the routing logic — no live Keycloak
 * required.
 *
 * 4 cases × 2 locales = 8:
 *   1. Customer auth-zone, no session            → /{locale}/auth/login
 *   2. Customer transactional, email unverified  → /{locale}/auth/verify-email-required
 *   3. Pro in apex auth-zone                      → seller.tukio.one/{locale}/seller/dashboard
 *   4. Admin in apex auth-zone                    → admin.tukio.one/{locale}/admin/dashboard
 *
 * Requires the apex dev server (`pnpm --filter=public dev`). Cross-zone targets
 * are asserted via the Location header only (not navigated).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';
// Cross-zone base URLs must match what the middleware reads from env (NEXT_PUBLIC_*).
// In dev NEXT_PUBLIC_SELLER_BASE_URL = http://localhost:3002, so 'seller.' is absent.
// Override via PLAYWRIGHT_SELLER_BASE_URL / PLAYWRIGHT_ADMIN_BASE_URL in CI.
const SELLER_BASE_URL = process.env['PLAYWRIGHT_SELLER_BASE_URL'] ?? 'http://localhost:3002';
const ADMIN_BASE_URL = process.env['PLAYWRIGHT_ADMIN_BASE_URL'] ?? 'http://localhost:3003';
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

function cookieHeader(parts: Record<string, string>): string {
  return Object.entries(parts)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function locationFor(
  request: APIRequestContext,
  path: string,
  cookies: Record<string, string>,
): Promise<string | undefined> {
  const res = await request.get(`${BASE_URL}${path}`, {
    headers: { Cookie: cookieHeader(cookies) },
    maxRedirects: 0,
  });
  return res.headers()['location'];
}

for (const locale of ['fr', 'en'] as const) {
  test.describe(`apex middleware role-redirect — ${locale}`, () => {
    test(`1. no session on /${locale}/account → login`, async ({ request }) => {
      const loc = await locationFor(request, `/${locale}/account`, {});
      expect(loc).toContain(`/${locale}/auth/login`);
      // Verify the `next` param carries the exact encoded path so the login
      // page can redirect back to the right route after authentication.
      expect(loc).toContain(`next=${encodeURIComponent(`/${locale}/account`)}`);
    });

    test(`2. unverified customer on /${locale}/cart → verify-email-required`, async ({
      request,
    }) => {
      const loc = await locationFor(request, `/${locale}/cart`, {
        'tukio-session-active': '1',
        'tukio-access-token': jwt({ realm_access: { roles: ['client'] }, email_verified: false }),
      });
      expect(loc).toContain(`/${locale}/auth/verify-email-required`);
    });

    test(`3. pro on /${locale}/account → seller dashboard (cross-zone)`, async ({ request }) => {
      const loc = await locationFor(request, `/${locale}/account`, {
        'tukio-session-active': '1',
        'tukio-access-token': jwt({ realm_access: { roles: ['pro'] }, email_verified: true }),
      });
      // Use SELLER_BASE_URL so assertions pass in both dev (localhost:3002) and
      // production (https://seller.tukio.one) environments.
      expect(loc).toContain(SELLER_BASE_URL);
      expect(loc).toContain(`/${locale}/seller/dashboard`);
    });

    test(`4. admin on /${locale}/account → admin dashboard (cross-zone)`, async ({ request }) => {
      const loc = await locationFor(request, `/${locale}/account`, {
        'tukio-session-active': '1',
        'tukio-access-token': jwt({
          realm_access: { roles: ['admin-modo'] },
          email_verified: true,
        }),
      });
      expect(loc).toContain(ADMIN_BASE_URL);
      expect(loc).toContain(`/${locale}/admin/dashboard`);
    });
  });
}
