import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Story 0.19 — 4 institutional public pages e2e.
 *
 * Prerequisites:
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public build
 *   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public start
 *
 * Per Story 1.2b-d convention, NOT executed locally by the dev agent.
 * Ismael runs manually after deployment.
 */

// ─── FR ──────────────────────────────────────────────────────────────────────

test.describe('public-pages FR', () => {
  test('GET /fr/a-propos → H1 + 5 blocks', async ({ page }) => {
    await page.goto('/fr/a-propos');
    await expect(page).toHaveTitle(/À propos/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Une plateforme');
    await expect(page.getByRole('heading', { name: 'Pourquoi tukio.one' })).toBeVisible();
    await expect(page.getByText("Ce qui change par rapport à l'existant")).toBeVisible();
    await expect(page.getByText('Ancré en Pays de la Loire')).toBeVisible();
    await expect(page.getByText('Notre engagement')).toBeVisible();
  });

  test('GET /fr/confidentialite → H1 + 8 blocks + pre-launch banner', async ({ page }) => {
    await page.goto('/fr/confidentialite');
    await expect(page).toHaveTitle(/confidentialité/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vos données');
    await expect(page.getByText('En phase de pré-lancement')).toBeVisible();
    await expect(page.getByText("1. Qui collecte vos données aujourd'hui")).toBeVisible();
    await expect(page.getByText('8. Réclamation')).toBeVisible();
  });

  test('GET /fr/mentions-legales → H1 + status banner + 6 blocks', async ({ page }) => {
    await page.goto('/fr/mentions-legales');
    await expect(page).toHaveTitle(/Mentions légales/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Un projet');
    await expect(page.getByText('Statut du projet')).toBeVisible();
    await expect(page.getByText('Responsable du projet')).toBeVisible();
    await expect(page.getByText('Propriété intellectuelle')).toBeVisible();
  });

  test('GET /fr/contact → form + 4 channel cards', async ({ page }) => {
    await page.goto('/fr/contact');
    await expect(page).toHaveTitle(/Contact/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('vous écoute');
    await expect(page.getByLabel('Prénom')).toBeVisible();
    await expect(page.getByLabel('Votre message')).toBeVisible();
    await expect(page.getByText('contact@tukio.one')).toBeVisible();
    await expect(page.getByText('dpo@tukio.one')).toBeVisible();
    await expect(page.getByText('signalement@tukio.one')).toBeVisible();
    await expect(page.getByText('presse@tukio.one')).toBeVisible();
  });

  test('Contact form submit happy path → success alert', async ({ page }) => {
    await page.goto('/fr/contact');
    await page.fill('[id="firstName"]', 'Camille');
    await page.fill('[id="lastName"]', 'Renaud');
    await page.fill('[id="email"]', 'camille@exemple.fr');
    await page.selectOption('[id="category"]', 'organisateur');
    await page.selectOption('[id="subject"]', 'general');
    await page.fill(
      '[id="message"]',
      'Bonjour, je souhaite en savoir plus sur la plateforme tukio.',
    );
    await page.click('button[type="submit"]');
    await expect(page.getByRole('alert')).toContainText('Message envoyé');
  });

  test('Contact form validation — empty submit shows required errors', async ({ page }) => {
    await page.goto('/fr/contact');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Prénom requis.')).toBeVisible();
    await expect(page.getByText('Nom requis.')).toBeVisible();
    await expect(page.getByText('Veuillez sélectionner votre profil.')).toBeVisible();
    await expect(page.getByText('Veuillez sélectionner un sujet.')).toBeVisible();
    await expect(page.getByText('Message trop court (10 caractères min).')).toBeVisible();
  });

  test('Footer nav → Mentions légales link navigates correctly', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    await page.locator('footer').getByRole('link', { name: 'Mentions légales' }).click();
    await expect(page).toHaveURL(/mentions-legales/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Un projet');
  });

  test('axe-core 0 violations — /fr/a-propos', async ({ page }) => {
    await page.goto('/fr/a-propos');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('axe-core 0 violations — /fr/confidentialite', async ({ page }) => {
    await page.goto('/fr/confidentialite');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('axe-core 0 violations — /fr/mentions-legales', async ({ page }) => {
    await page.goto('/fr/mentions-legales');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('axe-core 0 violations — /fr/contact', async ({ page }) => {
    await page.goto('/fr/contact');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test.skip('Lighthouse ≥ 95 — /fr/a-propos', async () => {
    // Run via: pnpm dlx @lhci/cli autorun — Story 0.21 wires LHCI into CI.
  });
});

// ─── EN ──────────────────────────────────────────────────────────────────────

test.describe('public-pages EN', () => {
  test('GET /en/a-propos → H1 EN', async ({ page }) => {
    await page.goto('/en/a-propos');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('A platform');
    await expect(page.getByText('Why tukio.one')).toBeVisible();
  });

  test('GET /en/confidentialite → H1 EN + pre-launch banner', async ({ page }) => {
    await page.goto('/en/confidentialite');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your data');
    await expect(page.getByText('In pre-launch phase')).toBeVisible();
  });

  test('GET /en/mentions-legales → H1 EN + status banner', async ({ page }) => {
    await page.goto('/en/mentions-legales');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('A project');
    await expect(page.getByText('Project status')).toBeVisible();
  });

  test('GET /en/contact → form EN + channels', async ({ page }) => {
    await page.goto('/en/contact');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('listening');
    await expect(page.getByLabel('First name')).toBeVisible();
    await expect(page.getByText('contact@tukio.one')).toBeVisible();
  });

  test('Contact form EN → success message in EN', async ({ page }) => {
    await page.goto('/en/contact');
    await page.fill('[id="firstName"]', 'Alex');
    await page.fill('[id="lastName"]', 'Smith');
    await page.fill('[id="email"]', 'alex@example.com');
    await page.selectOption('[id="category"]', 'autre');
    await page.selectOption('[id="subject"]', 'general');
    await page.fill('[id="message"]', 'Hello, I would like to know more about your platform.');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('alert')).toContainText('Message sent');
  });

  test('axe-core 0 violations — /en/a-propos', async ({ page }) => {
    await page.goto('/en/a-propos');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('axe-core 0 violations — /en/confidentialite', async ({ page }) => {
    await page.goto('/en/confidentialite');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('axe-core 0 violations — /en/mentions-legales', async ({ page }) => {
    await page.goto('/en/mentions-legales');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('axe-core 0 violations — /en/contact', async ({ page }) => {
    await page.goto('/en/contact');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test.skip('Lighthouse ≥ 95 — /en/a-propos', async () => {
    // Run via: pnpm dlx @lhci/cli autorun — Story 0.21 wires LHCI into CI.
  });
});
