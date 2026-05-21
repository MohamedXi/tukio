import { test, expect } from '@playwright/test';

/**
 * Story 0.15 — Playwright e2e for the pre-launch coming-soon-gate (seller).
 *
 * `NEXT_PUBLIC_COMING_SOON_MODE` is build-time gated — see the matching apex
 * spec for the toggle protocol. By default this file exercises the flag-ON
 * posture; `PLAYWRIGHT_FLAG_OFF=1` runs the reversibility cases instead.
 */

const FLAG_OFF = process.env['PLAYWRIGHT_FLAG_OFF'] === '1';

test.describe('coming-soon-gate — seller — flag ON (pre-launch default)', () => {
  test.skip(FLAG_OFF, 'PLAYWRIGHT_FLAG_OFF=1 is set; flag-OFF cases run instead.');

  test('GET /fr/ → rewrites to seller-coming-soon placeholder', async ({ page }) => {
    const response = await page.goto('/fr/');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /seller\.tukio\.one|bient[oô]t/i }),
    ).toBeVisible();
  });

  test('GET /fr/seller/onboarding/identity → rewritten (Pro wizard gated)', async ({ page }) => {
    await page.goto('/fr/seller/onboarding/identity');
    await expect(
      page.getByRole('heading', { name: /seller\.tukio\.one|bient[oô]t/i }),
    ).toBeVisible();
    expect(page.url()).toMatch(/\/fr\/seller\/onboarding\/identity$/);
  });

  test('GET /fr/seller-coming-soon → not rewritten (whitelist match)', async ({ page }) => {
    const response = await page.goto('/fr/seller-coming-soon');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /seller\.tukio\.one|bient[oô]t/i }),
    ).toBeVisible();
  });

  test('GET /en/seller/listings/new → rewritten (en locale handled)', async ({ page }) => {
    await page.goto('/en/seller/listings/new');
    await expect(
      page.getByRole('heading', { name: /seller\.tukio\.one|bient[oô]t/i }),
    ).toBeVisible();
  });

  test('GET /robots.txt → 200 + sitemap reference', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    const body = await response.text();
    expect(body).toContain('Sitemap:');
  });

  test('GET /sitemap.xml → 200 + XML content-type', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);
  });

  test('GET /fr/seller-coming-soon/success → not rewritten', async ({ page }) => {
    const response = await page.goto('/fr/seller-coming-soon/success');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /merci/i })).toBeVisible();
  });

  test('GET /favicon.ico → tech bypass (defence in depth)', async ({ request }) => {
    const response = await request.get('/favicon.ico');
    // Whatever the favicon resolves to (ICO bytes, 404, redirect to assets),
    // it must NOT be the coming-soon HTML — that's the whole point of the bypass.
    expect(response.headers()['content-type']).not.toContain('text/html');
  });
});

test.describe('coming-soon-gate — seller — flag OFF (reversibility regression)', () => {
  test.skip(!FLAG_OFF, 'Set PLAYWRIGHT_FLAG_OFF=1 + rebuild with COMING_SOON_MODE=false to run.');

  test('GET /fr/ → renders the real seller home (Sprint 0 placeholder)', async ({ page }) => {
    await page.goto('/fr/');
    await expect(page.locator('body')).not.toContainText(/seller\.tukio\.one — bient[oô]t/i);
  });

  test('AC13 — Story 1.3d pending-admin-review redirect fires on /seller path with pending cookie', async ({
    page,
    context,
  }) => {
    // Forge a JWT-like cookie with `tukio:status=pending_admin_review` in the
    // payload (header.payload.signature, base64url, signature ignored by the
    // pure-decision logic). Story 1.3d redirects any non-whitelisted /seller
    // path to /${locale}/seller/onboarding/pending.
    const claims = {
      'tukio:status': 'pending_admin_review',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const b64url = (s: string) =>
      Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(
      JSON.stringify(claims),
    )}.sig`;
    await context.addCookies([
      {
        name: 'tukio-access-token',
        value: token,
        url: 'http://localhost:3002',
      },
    ]);

    // Visiting a non-whitelisted /seller/* path MUST land on /onboarding/pending,
    // proving the Story 1.3d middleware still runs when the gate is off.
    const response = await page.goto('/fr/seller/listings/new');
    expect(response?.status()).toBe(200);
    expect(page.url()).toMatch(/\/fr\/seller\/onboarding\/pending$/);
  });
});
