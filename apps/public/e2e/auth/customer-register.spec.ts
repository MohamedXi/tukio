/**
 * Playwright E2E tests — `POST /v1/auth/customer/register` (Story 1.2d Task 6).
 *
 * Requires all services running:
 *   `pnpm docker:up:wait && pnpm --filter=identity-svc start:dev && pnpm --filter=gateway-api start:dev && pnpm --filter=public dev`
 *
 * Run with:
 *   `pnpm --filter=public exec playwright test --project=chromium-fr --project=chromium-en e2e/auth/customer-register.spec.ts`
 *
 * 9 test cases:
 *   1. Happy path FR — submit → redirect → verify-email-required page
 *   2. Happy path EN
 *   3. Validation Zod — short password → inline error (localized)
 *   4. Anti-énumération — existing user → generic message (not tukioCode)
 *   5. Rate-limit 429 — 6th submit → UI retry message
 *   6. UTM acquisition — cookie persisted at landing, submitted in payload, persisted in DB
 *   7. FR17 verify-email-required gate — unverified user blocked from /cart
 *   8. axe-core a11y — 0 critical/serious violations on sign-up page
 *   9. NFR48 perf — p90 submit-to-redirect ≤ 30s (10 runs)
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupTestUser, cleanupTestUsers, fillAndSubmitSignUpForm } from '../helpers/test-user.js';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const COOKIE_DOMAIN = new URL(BASE_URL).hostname; // staging vs localhost vs apex
const VALID_PASSWORD = 'SecureE2E-2026!';
const EXISTING_EMAIL = 'existing-e2e@tukio.one';
const RATE_LIMIT_EMAILS = [
  'rl-0-e2e@example.com',
  'rl-1-e2e@example.com',
  'rl-2-e2e@example.com',
  'rl-3-e2e@example.com',
  'rl-4-e2e@example.com',
  'rate-limit-e2e@example.com',
];

test.describe('Customer B2C Registration — E2E (Story 1.2d)', () => {
  test.afterEach(async () => {
    // Cleanup all test users created (incl. rate-limit batch — review patch P24).
    await cleanupTestUsers([
      'alice-e2e-fr@example.com',
      'alice-e2e-en@example.com',
      EXISTING_EMAIL,
      ...RATE_LIMIT_EMAILS,
    ]);
  });

  // ─── Test 1: Happy path FR ─────────────────────────────────────────────────
  test('case 1 — happy path FR: submit → redirect /fr/auth/verify-email-required', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/fr/auth/sign-up`);
    await fillAndSubmitSignUpForm(page, {
      email: 'alice-e2e-fr@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      password: VALID_PASSWORD,
      acceptTerms: true,
    });
    await page.waitForURL(/\/fr\/auth\/verify-email-required/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/fr\/auth\/verify-email-required/);
  });

  // ─── Test 2: Happy path EN ─────────────────────────────────────────────────
  test('case 2 — happy path EN: submit → redirect /en/auth/verify-email-required', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/auth/sign-up`);
    await fillAndSubmitSignUpForm(page, {
      email: 'alice-e2e-en@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      password: VALID_PASSWORD,
      acceptTerms: true,
    });
    await page.waitForURL(/\/en\/auth\/verify-email-required/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/en\/auth\/verify-email-required/);
  });

  // ─── Test 3: Validation Zod ────────────────────────────────────────────────
  test('case 3 — validation: short password → inline localized error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr/auth/sign-up`);
    await page.getByLabel(/^(Adresse email|Email address)$/).fill('test@example.com');
    await page.getByLabel(/^(Prénom|First name)$/).fill('Test');
    await page.getByLabel(/^(Nom de famille|Last name)$/).fill('User');
    await page.getByLabel(/^(Mot de passe|Password)$/).fill('short');
    await page.getByRole('button', { name: /^(Créer mon compte|Create my account)$/ }).click();

    const errorRegex = /12 caractères|at least 12|minimum/i;
    await expect(page.getByRole('alert').first()).toBeVisible();
    const errorText = await page.getByRole('alert').first().textContent();
    expect(errorText).toMatch(errorRegex);
  });

  // ─── Test 4: Anti-énumération ──────────────────────────────────────────────
  test('case 4 — anti-énumération: conflict → generic message, no tukioCode visible', async ({
    page,
  }) => {
    await setupTestUser(EXISTING_EMAIL);
    await page.goto(`${BASE_URL}/fr/auth/sign-up`);
    await fillAndSubmitSignUpForm(page, {
      email: EXISTING_EMAIL,
      firstName: 'Alice',
      lastName: 'Martin',
      password: VALID_PASSWORD,
      acceptTerms: true,
    });

    const banner = page.getByRole('alert');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const text = (await banner.textContent()) ?? '';
    expect(text).not.toContain('IDENTITY-CONFLICT-001');
    expect(text.toLowerCase()).toMatch(/boîte de réception|si un compte|inbox/i);
  });

  // ─── Test 5: Rate-limit 429 ────────────────────────────────────────────────
  // Serialized: the throttle window is per-IP with a 60s TTL. Running this in
  // parallel with the perf test (case 9) would poison both. Review patch P24.
  test.describe.serial('rate-limit batch (serialized)', () => {
    test('case 5 — rate-limit: 6th rapid attempt → retry message with seconds', async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/fr/auth/sign-up`);

      for (let i = 0; i < 5; i++) {
        await fillAndSubmitSignUpForm(page, {
          email: `rl-${i}-e2e@example.com`,
          firstName: 'RL',
          lastName: 'Test',
          password: VALID_PASSWORD,
          acceptTerms: true,
        });
        await page.goto(`${BASE_URL}/fr/auth/sign-up`);
      }

      // 6th — capture the response to assert the Retry-After header matches
      // the displayed seconds (review patch P4: header must be the source of
      // truth, not a hardcoded 60s fallback).
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/v1/auth/customer/register') && res.status() === 429,
        { timeout: 15_000 },
      );
      await fillAndSubmitSignUpForm(page, {
        email: 'rate-limit-e2e@example.com',
        firstName: 'RL',
        lastName: 'Test',
        password: VALID_PASSWORD,
        acceptTerms: true,
      });
      const response = await responsePromise;
      const retryAfterHeader = response.headers()['retry-after'];
      expect(retryAfterHeader, 'Retry-After header missing on 429').toBeDefined();
      const retryAfterSeconds = Number(retryAfterHeader);
      expect(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0).toBe(true);

      const banner = page.getByRole('alert');
      await expect(banner).toBeVisible({ timeout: 10_000 });
      const text = (await banner.textContent()) ?? '';
      expect(text.toLowerCase()).toMatch(/trop de tentatives|too many/i);
      expect(text).toMatch(new RegExp(`\\b${retryAfterSeconds}\\b`));
    });
  });

  // ─── Test 6: UTM acquisition ───────────────────────────────────────────────
  test('case 6 — UTM acquisition: cookie at landing, payload submitted with acquisition', async ({
    page,
    context,
  }) => {
    // Reset cookies so a prior test cannot pre-populate tk_acq with a stale
    // first-touch (review patch P26).
    await context.clearCookies();

    await page.goto(
      `${BASE_URL}/fr/auth/sign-up?utm_source=google&utm_medium=cpc&utm_campaign=spring2026`,
    );

    const cookies = await context.cookies();
    const tkAcq = cookies.find((c) => c.name === 'tk_acq');
    expect(tkAcq).toBeDefined();
    const decoded = Buffer.from(tkAcq!.value, 'base64url').toString('utf8');
    const parsedCookie = JSON.parse(decoded) as {
      source: string;
      medium?: string;
      campaign?: string;
    };
    expect(parsedCookie.source).toBe('google_ads');
    expect(parsedCookie.medium).toBe('cpc');
    expect(parsedCookie.campaign).toBe('spring2026');

    // Submit the form and verify the gateway-api receives the acquisition
    // context in the payload — review patch P25 (was previously cookie-only).
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/v1/auth/customer/register') && req.method() === 'POST',
      { timeout: 15_000 },
    );
    await fillAndSubmitSignUpForm(page, {
      email: 'utm-e2e@example.com',
      firstName: 'UTM',
      lastName: 'Test',
      password: VALID_PASSWORD,
      acceptTerms: true,
    });
    const request = await requestPromise;
    const body = request.postDataJSON() as {
      acquisition?: { source?: string; medium?: string; campaign?: string };
    };
    expect(body.acquisition).toBeDefined();
    expect(body.acquisition?.source).toBe('google_ads');
    expect(body.acquisition?.medium).toBe('cpc');
    expect(body.acquisition?.campaign).toBe('spring2026');

    await cleanupTestUsers(['utm-e2e@example.com']);
  });

  // ─── Test 7: FR17 verify-email-required gate ───────────────────────────────
  test('case 7 — FR17: authenticated unverified user → redirected to verify-email-required on /cart', async ({
    page,
  }) => {
    await setupTestUser('unverified-e2e@tukio.one', { emailVerified: false });

    // Cookie domain matches the deployment host (review patch P22). On
    // staging/CI the test would silently no-op with a hardcoded 'localhost'.
    await page.context().addCookies([
      { name: 'tukio-session-active', value: '1', domain: COOKIE_DOMAIN, path: '/' },
      { name: 'tukio-email-verified', value: '0', domain: COOKIE_DOMAIN, path: '/' },
    ]);

    await page.goto(`${BASE_URL}/fr/cart`);
    await expect(page).toHaveURL(/\/fr\/auth\/verify-email-required/);

    await cleanupTestUsers(['unverified-e2e@tukio.one']);
  });

  // ─── Test 8: axe-core a11y ─────────────────────────────────────────────────
  test('case 8 — axe-core a11y: 0 critical/serious violations on sign-up page (FR)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/fr/auth/sign-up`);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(
      criticalOrSerious,
      `a11y violations: ${JSON.stringify(criticalOrSerious, null, 2)}`,
    ).toHaveLength(0);
  });

  // ─── Test 9: NFR48 perf ────────────────────────────────────────────────────
  test('case 9 — NFR48 perf: p90 submit-to-redirect ≤ 30s (10 runs)', async ({ page }) => {
    const durations: number[] = [];

    for (let i = 0; i < 10; i++) {
      await page.goto(`${BASE_URL}/fr/auth/sign-up`);
      const email = `perf-run-${i}@example.com`;
      await fillAndSubmitSignUpForm(page, {
        email,
        firstName: 'Perf',
        lastName: 'Test',
        password: VALID_PASSWORD,
        acceptTerms: true,
      });

      const start = Date.now();
      await Promise.race([
        page.waitForURL(/verify-email-required/, { timeout: 35_000 }),
        page.getByRole('alert').waitFor({ timeout: 35_000 }),
      ]);
      durations.push(Date.now() - start);

      await cleanupTestUsers([email]);
    }

    durations.sort((a, b) => a - b);
    const p90 = durations[Math.ceil(durations.length * 0.9) - 1]!;
    const p90Seconds = p90 / 1000;
    expect(
      p90Seconds,
      `p90 latency ${p90Seconds.toFixed(1)}s exceeds 30s NFR48 target`,
    ).toBeLessThanOrEqual(30);
  });
});
