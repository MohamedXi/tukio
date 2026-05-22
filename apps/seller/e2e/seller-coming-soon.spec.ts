import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Story 0.18 — Seller Coming Soon landing page e2e tests.
 *
 * Prerequisites:
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=seller build
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=seller start
 *   pnpm --filter=seller exec playwright test e2e/seller-coming-soon.spec.ts
 *
 * Per Story 1.2b-d convention, this spec is NOT executed locally by the dev
 * agent. Ismael runs it manually after deployment.
 */

test.describe('seller-coming-soon /fr/seller-coming-soon', () => {
  test('GET /fr/seller-coming-soon → H1 + banner pre-launch visible', async ({ page }) => {
    await page.goto('/fr/seller-coming-soon');
    await expect(page).toHaveTitle(/tukio\.one/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Comment fonctionne tukio.one',
    );
    await expect(page.getByText("tukio.one n'est pas encore ouverte")).toBeVisible();
  });

  test('GET /en/seller-coming-soon → H1 EN visible', async ({ page }) => {
    await page.goto('/en/seller-coming-soon');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('How tukio.one works');
    await expect(page.getByText('tukio.one is not open yet')).toBeVisible();
  });

  test('scrolls to dark Payments section and shows Stripe partner', async ({ page }) => {
    await page.goto('/fr/seller-coming-soon');
    const stripe = page.getByText('Stripe gère les paiements, pas tukio');
    await stripe.scrollIntoViewIfNeeded();
    await expect(stripe).toBeVisible();
  });

  test('CTA primary "Être prévenu·e à l\'ouverture" links cross-zone with ?role=pro', async ({
    page,
  }) => {
    await page.goto('/fr/seller-coming-soon');
    const cta = page.getByRole('link', { name: /Être prévenu·e à l'ouverture/i }).last();
    const href = await cta.getAttribute('href');
    expect(href).toMatch(/tukio\.one\/fr\/coming-soon\?role=pro/);
  });

  test('all 8 sections render (kickers visible)', async ({ page }) => {
    await page.goto('/fr/seller-coming-soon');
    await expect(page.getByText('Pour les professionnels')).toBeVisible();
    await expect(page.getByText('Pour qui')).toBeVisible();
    await expect(page.getByText('Le parcours pro')).toBeVisible();
    await expect(page.getByText("Ce qu'il faut prévoir")).toBeVisible();
    await expect(page.getByText('Paiements et reversements')).toBeVisible();
    await expect(page.getByText('Tarification')).toBeVisible();
    await expect(page.getByText('Pourquoi nous rejoindre')).toBeVisible();
    await expect(page.getByText('En préparation')).toBeVisible();
  });

  test('axe a11y — 0 violations on full landing page', async ({ page }) => {
    await page.goto('/fr/seller-coming-soon');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
