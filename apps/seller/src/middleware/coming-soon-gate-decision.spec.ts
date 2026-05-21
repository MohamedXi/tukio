import { describe, it, expect } from 'vitest';
import { decideComingSoon, safeLocaleFromPath } from './coming-soon-gate-decision';

/**
 * Story 0.15 — pure unit coverage of the coming-soon-gate decision predicate
 * (seller variant). Tests the framework-free `decideComingSoon` so vitest
 * doesn't have to transform Next.js's edge-runtime modules. Playwright e2e
 * for the live rewrite is in `e2e/coming-soon-gate.spec.ts`.
 */

const LOCALES = ['fr', 'en'] as const;

describe('decideComingSoon — seller app', () => {
  it('case 1 — flag OFF + any path → pass', () => {
    expect(decideComingSoon(false, '/fr/seller/onboarding/identity', LOCALES)).toEqual({
      kind: 'pass',
    });
    expect(decideComingSoon(false, '/en/seller/listings/new', LOCALES)).toEqual({ kind: 'pass' });
  });

  it('case 2 — flag ON + /fr/ → rewrite to /fr/seller-coming-soon', () => {
    expect(decideComingSoon(true, '/fr/', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/seller-coming-soon',
    });
  });

  it('case 3 — flag ON + /en/ → rewrite to /en/seller-coming-soon', () => {
    expect(decideComingSoon(true, '/en/', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'en',
      target: '/en/seller-coming-soon',
    });
  });

  it('case 4 — flag ON + /fr/seller/onboarding/identity → rewrite (Pro wizard gated)', () => {
    expect(decideComingSoon(true, '/fr/seller/onboarding/identity', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/seller-coming-soon',
    });
  });

  it('case 5 — flag ON + /fr/seller-coming-soon → pass (no rewrite loop)', () => {
    expect(decideComingSoon(true, '/fr/seller-coming-soon', LOCALES).kind).toBe('pass');
    expect(decideComingSoon(true, '/fr/seller-coming-soon/success', LOCALES).kind).toBe('pass');
    expect(decideComingSoon(true, '/en/seller-coming-soon', LOCALES).kind).toBe('pass');
  });

  it('case 6 — flag ON + tech bypass routes → pass (defence in depth)', () => {
    for (const path of [
      '/_next/static/chunks/foo.js',
      '/_next/image',
      '/api/health',
      '/robots.txt',
      '/sitemap.xml',
      '/favicon.ico',
      '/.well-known/security.txt',
      '/assets/logo.svg',
      '/og/seller-coming-soon.png',
    ]) {
      expect(decideComingSoon(true, path, LOCALES).kind).toBe('pass');
    }
  });

  it('case 7 — flag ON + invalid locale → fallback fr', () => {
    expect(decideComingSoon(true, '/xx/seller/dashboard', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/seller-coming-soon',
    });
  });

  it('case 8 — flag ON + root path → fallback fr rewrite', () => {
    expect(decideComingSoon(true, '/', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/seller-coming-soon',
    });
  });

  it('case 9 — flag ON + /fr/seller/payouts → rewrite (legacy route still gated)', () => {
    expect(decideComingSoon(true, '/fr/seller/payouts', LOCALES).kind).toBe('rewrite');
  });

  it('case 10 — flag ON + /fr/seller/profile → rewrite (not whitelisted)', () => {
    expect(decideComingSoon(true, '/fr/seller/profile', LOCALES).kind).toBe('rewrite');
  });

  it('case 11 — whitelist regex strictness — /fr/seller-coming-soon-extra (substring) → rewrite', () => {
    // Regex requires (\/|$) after `/seller-coming-soon` so a hyphenated
    // continuation should NOT match the whitelist and be rewritten.
    expect(decideComingSoon(true, '/fr/seller-coming-soon-extra', LOCALES).kind).toBe('rewrite');
  });

  it('case 12 — EN locale routes are rewritten with locale preserved', () => {
    expect(decideComingSoon(true, '/en/seller/listings/new', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'en',
      target: '/en/seller-coming-soon',
    });
  });
});

describe('safeLocaleFromPath — seller app', () => {
  it('returns recognised locale when first segment matches LOCALES', () => {
    expect(safeLocaleFromPath('/fr/anything', LOCALES)).toBe('fr');
    expect(safeLocaleFromPath('/en/foo/bar', LOCALES)).toBe('en');
  });

  it('falls back to fr when first segment is unknown or missing', () => {
    expect(safeLocaleFromPath('/xx/foo', LOCALES)).toBe('fr');
    expect(safeLocaleFromPath('/', LOCALES)).toBe('fr');
    expect(safeLocaleFromPath('', LOCALES)).toBe('fr');
  });
});
