import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Story 0.17 — Coming Soon landing page e2e tests (apex).
 *
 * Prerequisites:
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public build
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public start
 *   pnpm --filter=public exec playwright test e2e/coming-soon-landing.spec.ts
 *
 * Per Story 1.2b-d convention, this spec is NOT executed locally by the dev
 * agent. Ismael runs: pnpm --filter=public e2e:pre-launch
 */

test.describe('coming-soon landing /fr/coming-soon', () => {
  test('GET /fr/coming-soon → 200 + H1 + Pill visible', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    await expect(page).toHaveTitle(/tukio\.one/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vos événements,');
    await expect(page.getByText('En construction')).toBeVisible();
  });

  test('GET /en/coming-soon → H1 EN visible', async ({ page }) => {
    await page.goto('/en/coming-soon');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your events,');
    await expect(page.getByText('Under construction')).toBeVisible();
  });

  test('?role=pro pre-checks Professionnel radio', async ({ page }) => {
    await page.goto('/fr/coming-soon?role=pro');
    const radios = page.getByRole('radio');
    await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(radios.nth(0)).toHaveAttribute('aria-checked', 'false');
  });

  test('submit empty form shows 5 validation errors', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    await page.getByRole('button', { name: /Me prévenir/i }).click();
    await expect(page.getByText('Prénom requis')).toBeVisible();
    await expect(page.getByText('Nom requis')).toBeVisible();
    await expect(page.getByText('Email requis')).toBeVisible();
    await expect(page.getByText('Vous devez accepter pour soumettre')).toBeVisible();
  });

  test('submit invalid email shows inline error', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    await page.getByLabel('Prénom').fill('Camille');
    await page.getByLabel('Nom').fill('Renaud');
    await page.getByLabel('Adresse email').fill('not-an-email');
    await page.getByRole('button', { name: /Me prévenir/i }).click();
    await expect(page.getByText('Email invalide')).toBeVisible();
  });

  test('valid submit redirects to /fr/coming-soon/success', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    await page.getByLabel('Prénom').fill('Camille');
    await page.getByLabel('Nom').fill('Renaud');
    await page.getByLabel('Adresse email').fill('camille@test.fr');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: /Me prévenir/i }).click();
    await expect(page).toHaveURL(/\/fr\/coming-soon\/success/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('À très bientôt');
  });

  test('privacy policy link navigates to /fr/confidentialite', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    const link = page.getByRole('link', { name: /politique de confidentialité/i });
    await expect(link).toHaveAttribute('href', '/fr/confidentialite');
  });

  test('axe a11y — 0 violations on landing page', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('axe a11y — 0 violations on success page', async ({ page }) => {
    await page.goto('/fr/coming-soon/success?firstName=Camille&position=247');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});

test.describe('coming-soon landing /en/coming-soon', () => {
  test('GET /en/coming-soon → 200 + H1 EN + form in EN', async ({ page }) => {
    await page.goto('/en/coming-soon');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your events,');
    await expect(page.getByLabel('First name')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
  });

  test('valid EN submit redirects to /en/coming-soon/success', async ({ page }) => {
    await page.goto('/en/coming-soon');
    await page.getByLabel('First name').fill('Camille');
    await page.getByLabel('Last name').fill('Renaud');
    await page.getByLabel('Email address').fill('camille@test.com');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: /Notify me/i }).click();
    await expect(page).toHaveURL(/\/en\/coming-soon\/success/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('See you soon');
  });
});
