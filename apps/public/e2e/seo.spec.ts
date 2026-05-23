import { test, expect } from '@playwright/test';

// Story 0.21 — SEO foundation acceptance tests.
//
// Run prereqs:
//   NEXT_PUBLIC_COMING_SOON_MODE=true pnpm --filter=public build && pnpm --filter=public start
//   pnpm --filter=public exec playwright test seo.spec.ts
//
// These specs assume the pre-launch flag is ON (Story 0.15) — the 5 public
// pages are exposed and Epic 1+ routes are gated.

const PUBLIC_PAGES = [
  '/coming-soon',
  '/a-propos',
  '/confidentialite',
  '/mentions-legales',
  '/contact',
] as const;

const LOCALES = ['fr', 'en'] as const;

test.describe('robots.txt', () => {
  test('returns 200 with text/plain content-type', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/text\/plain/);
  });

  test('references the sitemap URL', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toMatch(/Sitemap:\s*https?:\/\/[^/\s]+\/sitemap\.xml/);
  });

  test('disallows private transactional paths in both locales', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toContain('/fr/auth/');
    expect(body).toContain('/en/auth/');
    expect(body).toContain('/fr/account/');
    expect(body).toContain('/en/account/');
  });
});

test.describe('sitemap.xml', () => {
  test('returns 200 with xml content-type', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/(text|application)\/xml/);
  });

  test('contains at least 10 entries (5 routes × 2 locales)', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();
    const matches = body.match(/<url>/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(10);
  });

  test('includes hreflang alternates for fr + en + x-default', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();
    expect(body).toContain('hreflang="fr"');
    expect(body).toContain('hreflang="en"');
    expect(body).toContain('hreflang="x-default"');
  });
});

test.describe('OG image route', () => {
  test('GET /og/coming-soon returns a PNG', async ({ request }) => {
    const response = await request.get('/og/coming-soon');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/image\/png/);
    const body = await response.body();
    // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
    expect(body.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  test('GET /og returns 308 redirect to /og/coming-soon', async ({ request }) => {
    const response = await request.get('/og', { maxRedirects: 0 });
    expect([301, 308]).toContain(response.status());
    expect(response.headers()['location'] ?? '').toContain('/og/coming-soon');
  });

  test('GET /og/unknown-slug returns 404', async ({ request }) => {
    const response = await request.get('/og/unknown-slug-not-in-map');
    expect(response.status()).toBe(404);
  });
});

for (const locale of LOCALES) {
  for (const path of PUBLIC_PAGES) {
    test.describe(`meta on ${locale}${path}`, () => {
      test('html lang attribute matches locale', async ({ page }) => {
        await page.goto(`/${locale}${path}`);
        const lang = await page.locator('html').getAttribute('lang');
        expect(lang).toBe(locale);
      });

      test('has non-empty <title>', async ({ page }) => {
        await page.goto(`/${locale}${path}`);
        const title = await page.title();
        expect(title.trim().length).toBeGreaterThan(0);
      });

      test('has meta description ≤ 160 chars', async ({ page }) => {
        await page.goto(`/${locale}${path}`);
        const description = await page
          .locator('meta[name="description"]')
          .first()
          .getAttribute('content');
        expect(description).not.toBeNull();
        expect((description ?? '').length).toBeLessThanOrEqual(160);
      });

      test('has link rel=canonical pointing to a tukio.one URL', async ({ page }) => {
        await page.goto(`/${locale}${path}`);
        const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
        expect(canonical).toMatch(/^https?:\/\/[^/]*tukio\.one/);
      });

      test('JSON-LD Organization is parsable schema.org', async ({ page }) => {
        await page.goto(`/${locale}${path}`);
        const jsonLd = await page
          .locator('script[type="application/ld+json"]')
          .first()
          .textContent();
        expect(jsonLd).not.toBeNull();
        const parsed = JSON.parse(jsonLd ?? '{}') as Record<string, unknown>;
        expect(parsed['@context']).toBe('https://schema.org');
        expect(parsed['@type']).toBe('Organization');
        expect(parsed['name']).toBe('tukio.one');
      });
    });
  }
}

test.describe('outbound link safety', () => {
  test('every external link on /fr/coming-soon has rel=noopener noreferrer', async ({ page }) => {
    await page.goto('/fr/coming-soon');
    const externalLinks = await page.locator('a[href^="http"]:not([href*="tukio.one"])').all();
    for (const link of externalLinks) {
      const rel = (await link.getAttribute('rel')) ?? '';
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    }
  });
});
