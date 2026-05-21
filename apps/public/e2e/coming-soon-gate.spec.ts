import { test, expect } from '@playwright/test';

/**
 * Story 0.15 — Playwright e2e for the pre-launch coming-soon-gate (apex).
 *
 * The gate is build-time gated by `NEXT_PUBLIC_COMING_SOON_MODE`, so we cannot
 * toggle the flag at test time. The strategy:
 *
 *  - The "flag ON" cases live in this file and run by default (gate is the
 *    pre-launch posture during dev).
 *  - The "flag OFF" cases live below tagged `@flag-off` and are skipped unless
 *    `PLAYWRIGHT_FLAG_OFF=1` is exported (operator runs them after rebuilding
 *    the app with `NEXT_PUBLIC_COMING_SOON_MODE=false`).
 *
 * Run prereqs (mode ON, default):
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public build
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public start
 *   pnpm --filter=public exec playwright test e2e/coming-soon-gate.spec.ts
 *
 * Run flag-off cases:
 *   NEXT_PUBLIC_COMING_SOON_MODE=false pnpm --filter=public build
 *   NEXT_PUBLIC_COMING_SOON_MODE=false pnpm --filter=public start
 *   PLAYWRIGHT_FLAG_OFF=1 pnpm --filter=public exec playwright test e2e/coming-soon-gate.spec.ts
 */

const FLAG_OFF = process.env['PLAYWRIGHT_FLAG_OFF'] === '1';

test.describe('coming-soon-gate — flag ON (pre-launch default)', () => {
  test.skip(FLAG_OFF, 'PLAYWRIGHT_FLAG_OFF=1 is set; flag-OFF cases run instead.');

  test('GET /fr/ → rewrites to coming-soon placeholder, URL preserved', async ({ page }) => {
    const response = await page.goto('/fr/');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /bient[oô]t en pays de la loire/i }),
    ).toBeVisible();
    expect(page.url()).toMatch(/\/fr\/?$/);
  });

  test('GET /en/ → rewrites to coming-soon placeholder', async ({ page }) => {
    const response = await page.goto('/en/');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /bient[oô]t|coming soon|pays de la loire/i }),
    ).toBeVisible();
  });

  test('GET /fr/auth/sign-up → rewritten to coming-soon, URL preserved (rewrite not redirect)', async ({
    page,
  }) => {
    await page.goto('/fr/auth/sign-up');
    await expect(page.getByRole('heading', { name: /bient[oô]t/i })).toBeVisible();
    expect(page.url()).toMatch(/\/fr\/auth\/sign-up$/);
  });

  test('GET /fr/a-propos → whitelisted, renders About placeholder', async ({ page }) => {
    await page.goto('/fr/a-propos');
    await expect(page.getByRole('heading', { name: /à propos/i })).toBeVisible();
  });

  test('GET /fr/confidentialite → whitelisted', async ({ page }) => {
    await page.goto('/fr/confidentialite');
    await expect(page.getByRole('heading', { name: /confidentialit[eé]/i })).toBeVisible();
  });

  test('GET /fr/mentions-legales → whitelisted', async ({ page }) => {
    await page.goto('/fr/mentions-legales');
    await expect(page.getByRole('heading', { name: /mentions l[eé]gales/i })).toBeVisible();
  });

  test('GET /fr/contact → whitelisted', async ({ page }) => {
    await page.goto('/fr/contact');
    await expect(page.getByRole('heading', { name: /contact/i })).toBeVisible();
  });

  test('GET /fr/devenir-pro → whitelisted', async ({ page }) => {
    await page.goto('/fr/devenir-pro');
    await expect(page.getByRole('heading', { name: /devenir pro/i })).toBeVisible();
  });

  test('GET /robots.txt → 200 + plain-text content-type, sitemap reference', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    const body = await response.text();
    expect(body).toContain('Sitemap:');
  });

  test('GET /sitemap.xml → 200 + application/xml content-type', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);
  });

  test('GET /en/auth/sign-up → also rewritten (en locale handled)', async ({ page }) => {
    await page.goto('/en/auth/sign-up');
    await expect(page.getByRole('heading', { name: /bient[oô]t|coming soon/i })).toBeVisible();
    expect(page.url()).toMatch(/\/en\/auth\/sign-up$/);
  });
});

test.describe('coming-soon-gate — flag OFF (reversibility regression)', () => {
  test.skip(!FLAG_OFF, 'Set PLAYWRIGHT_FLAG_OFF=1 + rebuild with COMING_SOON_MODE=false to run.');

  test('GET /fr/ → renders the real home (Sprint 0 placeholder, NOT coming-soon)', async ({
    page,
  }) => {
    await page.goto('/fr/');
    // Story 0.15 must NOT leak coming-soon content into the off-flag build.
    await expect(page.locator('body')).not.toContainText(/bient[oô]t en pays de la loire/i);
  });

  test('AC13 reversibility — GET /fr/auth/sign-up renders the SignUpForm (Story 1.2d intact)', async ({
    page,
  }) => {
    await page.goto('/fr/auth/sign-up');
    await expect(page.getByRole('heading', { name: /sign up|inscription|cr[eé]er/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password|mot de passe/i)).toBeVisible();
  });

  test('GET /fr/coming-soon → placeholder still reachable (not gated)', async ({ page }) => {
    const response = await page.goto('/fr/coming-soon');
    expect(response?.status()).toBe(200);
  });
});
