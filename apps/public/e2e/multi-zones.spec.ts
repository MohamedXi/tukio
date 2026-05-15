/**
 * Multi-zones navigation smoke tests (Story 0.13).
 *
 * All tests are skipped — they require a live multi-app environment (DO droplet
 * with all 4 Next.js apps running and DNS configured).
 *
 * TODO: Activate in Story Epic 1+ staging smoke suite:
 *   1. Install @playwright/test as devDependency.
 *   2. Configure playwright.config.ts with baseURL pointing to staging.
 *   3. Remove the .skip() calls below.
 *
 * Test scenarios documented below as pseudo-code for future implementation.
 */

// Placeholder — Playwright not installed at Sprint 0. Tests documented as comments.
// When activating: `pnpm add -D @playwright/test` in this workspace.

if (false) {
  /**
   * /{locale}/account/* → customer.tukio.one (or localhost:3001 in dev)
   *
   * In local dev (NEXT_PUBLIC_CUSTOMER_HOST=http://localhost:3001):
   *   await page.goto('http://localhost:3000/fr/account/bookings');
   *   expect(page.url()).toContain('localhost:3000/fr/account/bookings');
   *   await expect(page.locator('[data-testid="booking-list"]')).toBeVisible();
   */
  void 0; // account rewrite placeholder

  /**
   * /{locale}/seller/* → seller.tukio.one (or localhost:3002 in dev)
   *
   *   await page.goto('http://localhost:3000/fr/seller/listings');
   *   expect(page.url()).toContain('localhost:3000/fr/seller/listings');
   *   await expect(page.locator('[data-testid="listing-table"]')).toBeVisible();
   */
  void 0; // seller rewrite placeholder

  /**
   * /{locale}/cart/* → customer app
   *
   *   await page.goto('http://localhost:3000/fr/cart');
   *   expect(page.url()).toContain('localhost:3000/fr/cart');
   */
  void 0; // cart rewrite placeholder

  /**
   * admin.tukio.one is NOT rewritten — isolated subdomain by design (ADR-0013).
   *
   *   await page.goto('http://localhost:3000/fr/admin');
   *   expect(page.url()).not.toContain('localhost:3003');
   */
  void 0; // admin isolation placeholder
}

export {};
