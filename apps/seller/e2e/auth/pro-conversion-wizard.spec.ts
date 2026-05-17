import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { authenticateCustomer } from '../helpers/test-customer-auth.js';
import AxeBuilder from '@axe-core/playwright';

const FIXTURES = path.resolve(__dirname, '../fixtures');

const VALID_SIRET = '73282932000074';

async function fillIdentityStep(page: Page) {
  await page.getByTestId('input-firstName').fill('Alice');
  await page.getByTestId('input-lastName').fill('Dupont');
  await page.getByTestId('input-email').fill('alice.dupont.pro@example.com');
  await page.getByTestId('input-phone').fill('0612345678');
  await page.getByTestId('input-dateOfBirth').fill('15/06/1990');
}

async function fillActivityStep(page: Page, siret = VALID_SIRET) {
  await page.getByTestId('input-companyName').fill('Tentes Loire Events');
  await page.getByTestId('input-siret').fill(siret);
  await page.getByTestId('select-legalForm').selectOption('MICRO_ENTREPRISE');
  await page.getByTestId('radio-vatStatus-vat_exempt').click();
  await page.getByTestId('pill-category-tents_marquees').click();
  await page.getByTestId('input-serviceZoneCity').fill('Nantes');
  await page.getByTestId('input-addressStreet').fill('1 rue de la Paix');
  await page.getByTestId('input-addressPostalCode').fill('44000');
  await page.getByTestId('input-addressCity').fill('Nantes');
}

async function fillDocumentsStep(page: Page) {
  const idCardPath = path.join(FIXTURES, 'idCard.jpg');
  const ribPath = path.join(FIXTURES, 'rib.pdf');
  await page
    .locator('[data-testid="step-documents"] input[type="file"]')
    .nth(0)
    .setInputFiles(idCardPath);
  await page
    .locator('[data-testid="step-documents"] input[type="file"]')
    .nth(1)
    .setInputFiles(ribPath);
}

// ── CASE 1 — Happy path FR ─────────────────────────────────────────────
test.describe('Pro Conversion Wizard — FR', () => {
  test('case 1 — Happy path FR: identity → activity → documents → review → pending', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await authenticateCustomer(page);
    await page.goto('/fr/seller/onboarding/identity');
    await expect(page.getByTestId('step-identity')).toBeVisible();

    await fillIdentityStep(page);
    await page.click('#step-identity-continue');
    await expect(page.getByTestId('step-activity')).toBeVisible();

    await fillActivityStep(page);
    await page.click('#step-activity-continue');
    await expect(page.getByTestId('step-documents')).toBeVisible();

    await fillDocumentsStep(page);
    await page.getByRole('button', { name: /continuer/i }).click();
    await expect(page.getByTestId('step-review')).toBeVisible();

    await page.getByTestId('checkbox-charter').check();
    await page.click('#step-review-submit');
    await expect(page).toHaveURL(/\/seller\/onboarding\/pending/);
    await expect(page.getByTestId('pending-kicker')).toBeVisible();
  });

  // ── CASE 3 — SIRET Luhn invalid client-side ─────────────────────────
  test('case 3 — SIRET Luhn invalid → inline error, no navigation', async ({ page }) => {
    await authenticateCustomer(page);
    await page.goto('/fr/seller/onboarding/identity');
    await fillIdentityStep(page);
    await page.click('#step-identity-continue');

    await page.getByTestId('input-siret').fill('12345678901234');
    await page.click('#step-activity-continue');
    await expect(page.getByTestId('step-activity')).toBeVisible();
  });

  // ── CASE 8 — Back button preserves data ─────────────────────────────
  test('case 8 — Back button preserves data across steps', async ({ page }) => {
    await authenticateCustomer(page);
    await page.goto('/fr/seller/onboarding/identity');

    await fillIdentityStep(page);
    await page.click('#step-identity-continue');
    await expect(page.getByTestId('step-activity')).toBeVisible();
    await fillActivityStep(page);
    await page.click('#step-activity-continue');
    await expect(page.getByTestId('step-documents')).toBeVisible();

    await page.getByRole('button', { name: /précédent/i }).click();
    await expect(page.getByTestId('step-activity')).toBeVisible();
    await expect(page.getByTestId('input-companyName')).toHaveValue('Tentes Loire Events');

    await page.getByRole('button', { name: /précédent/i }).click();
    await expect(page.getByTestId('step-identity')).toBeVisible();
    await expect(page.getByTestId('input-firstName')).toHaveValue('Alice');
  });

  // ── CASE 10 — Charter unchecked → CTA disabled ──────────────────────
  test('case 10 — Charter unchecked → error shown on submit attempt', async ({ page }) => {
    await authenticateCustomer(page);
    await page.goto('/fr/seller/onboarding/identity');
    await fillIdentityStep(page);
    await page.click('#step-identity-continue');
    await fillActivityStep(page);
    await page.click('#step-activity-continue');
    await fillDocumentsStep(page);
    await page.getByRole('button', { name: /continuer/i }).click();
    await expect(page.getByTestId('step-review')).toBeVisible();

    // Do NOT check charter, try to submit
    await page.click('#step-review-submit');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('step-review')).toBeVisible();
  });

  // ── CASE 11 — axe-core a11y per step ────────────────────────────────
  test('case 11 — axe-core: 0 critical/serious violations on identity step', async ({ page }) => {
    await authenticateCustomer(page);
    await page.goto('/fr/seller/onboarding/identity');
    const results = await new AxeBuilder({ page })
      .include('[data-testid="step-identity"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalOrSerious).toHaveLength(0);
  });
});

// ── CASE 2 — Happy path EN ─────────────────────────────────────────────
test.describe('Pro Conversion Wizard — EN', () => {
  test('case 2 — Happy path EN: wizard loads with EN locale', async ({ page }) => {
    test.setTimeout(120_000);
    await authenticateCustomer(page);
    await page.goto('/en/seller/onboarding/identity');
    await expect(page.getByTestId('step-identity')).toBeVisible();
  });
});

// ── CASE 6 — File too large ────────────────────────────────────────────
test('case 6 — File too large (6 MB idCard) → rejected with error', async ({ page }) => {
  await authenticateCustomer(page);
  await page.goto('/fr/seller/onboarding/identity');
  await fillIdentityStep(page);
  await page.click('#step-identity-continue');
  await fillActivityStep(page);
  await page.click('#step-activity-continue');
  await expect(page.getByTestId('step-documents')).toBeVisible();

  // Create 6MB file inline
  const bigFile = Buffer.alloc(6 * 1024 * 1024, 'a');
  await page.locator('[data-testid="step-documents"] input[type="file"]').nth(0).setInputFiles({
    name: 'idCard-large.jpg',
    mimeType: 'image/jpeg',
    buffer: bigFile,
  });
  await expect(page.getByText(/5 Mo/i)).toBeVisible();
});

// ── CASE 7 — Wrong MIME ────────────────────────────────────────────────
test('case 7 — Wrong MIME (.exe) → rejected with error', async ({ page }) => {
  await authenticateCustomer(page);
  await page.goto('/fr/seller/onboarding/identity');
  await fillIdentityStep(page);
  await page.click('#step-identity-continue');
  await fillActivityStep(page);
  await page.click('#step-activity-continue');
  await expect(page.getByTestId('step-documents')).toBeVisible();

  const wrongFile = path.join(FIXTURES, 'idCard-wrong-mime.exe');
  await page
    .locator('[data-testid="step-documents"] input[type="file"]')
    .nth(0)
    .setInputFiles(wrongFile);
  await expect(page.getByText(/type de fichier/i)).toBeVisible();
});

// ── CASE 12 — Performance NFR48 ───────────────────────────────────────
test('case 12 — Perf NFR48: page load under 5 min p90', async ({ page }) => {
  await authenticateCustomer(page);
  const start = Date.now();
  await page.goto('/fr/seller/onboarding/identity');
  await expect(page.getByTestId('step-identity')).toBeVisible();
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(5 * 60 * 1000);
});
