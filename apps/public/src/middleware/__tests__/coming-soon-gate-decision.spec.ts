import { describe, it, expect } from 'vitest';
import { decideComingSoon, safeLocaleFromPath } from '../coming-soon-gate-decision';

/**
 * Story 0.15 — pure unit coverage of the coming-soon-gate decision predicate.
 * Tests the framework-free `decideComingSoon` so vitest doesn't have to
 * transform Next.js's edge-runtime modules. Playwright e2e for the live
 * rewrite across the dev stack is in `e2e/coming-soon-gate.spec.ts`.
 */

const LOCALES = ['fr', 'en'] as const;

describe('decideComingSoon — public app', () => {
  it('case 1 — flag OFF + any path → pass', () => {
    expect(decideComingSoon(false, '/fr/auth/sign-up', LOCALES)).toEqual({ kind: 'pass' });
    expect(decideComingSoon(false, '/en/account/messages', LOCALES)).toEqual({ kind: 'pass' });
    expect(decideComingSoon(false, '/', LOCALES)).toEqual({ kind: 'pass' });
  });

  it('case 2 — flag ON + /fr/ → rewrite to /fr/coming-soon', () => {
    expect(decideComingSoon(true, '/fr/', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/coming-soon',
    });
  });

  it('case 3 — flag ON + /en/ → rewrite to /en/coming-soon', () => {
    expect(decideComingSoon(true, '/en/', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'en',
      target: '/en/coming-soon',
    });
  });

  it('case 4 — flag ON + /fr/auth/sign-up → rewrite (Epic 1 route gated)', () => {
    expect(decideComingSoon(true, '/fr/auth/sign-up', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/coming-soon',
    });
  });

  it('case 5 — flag ON + whitelist public pages → pass', () => {
    for (const path of [
      '/fr/a-propos',
      '/fr/confidentialite',
      '/fr/mentions-legales',
      '/fr/contact',
      '/fr/devenir-pro',
      '/en/a-propos',
      '/en/contact',
    ]) {
      expect(decideComingSoon(true, path, LOCALES).kind).toBe('pass');
    }
  });

  it('case 6 — flag ON + /fr/coming-soon → pass (no rewrite loop)', () => {
    expect(decideComingSoon(true, '/fr/coming-soon', LOCALES).kind).toBe('pass');
    expect(decideComingSoon(true, '/fr/coming-soon/success', LOCALES).kind).toBe('pass');
  });

  it('case 7 — flag ON + tech bypass routes → pass (defence in depth)', () => {
    for (const path of [
      '/_next/static/chunks/foo.js',
      '/_next/image',
      '/api/pre-launch/signup',
      '/api/auth/sync-email-verified',
      '/robots.txt',
      '/sitemap.xml',
      '/favicon.ico',
      '/.well-known/security.txt',
      '/assets/logo.svg',
      '/og/coming-soon.png',
    ]) {
      expect(decideComingSoon(true, path, LOCALES).kind).toBe('pass');
    }
  });

  it('case 8 — flag ON + invalid locale → fallback en', () => {
    expect(decideComingSoon(true, '/xx/whatever', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'en',
      target: '/en/coming-soon',
    });
  });

  it('case 9 — flag ON + root path → fallback en rewrite', () => {
    expect(decideComingSoon(true, '/', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'en',
      target: '/en/coming-soon',
    });
  });

  it('case 10 — flag ON + /fr/account/messages → rewrite (authenticated route gated)', () => {
    expect(decideComingSoon(true, '/fr/account/messages', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/coming-soon',
    });
  });

  it('case 11 — flag ON + /fr/cart → rewrite (transactional route gated)', () => {
    expect(decideComingSoon(true, '/fr/cart', LOCALES)).toEqual({
      kind: 'rewrite',
      locale: 'fr',
      target: '/fr/coming-soon',
    });
  });

  it('case 12 — whitelist regex strictness — /fr/a-proposition (substring) → rewrite', () => {
    // The whitelist regex requires (\/|$) after `/a-propos`, so
    // `/fr/a-proposition` should NOT match the whitelist and be rewritten.
    expect(decideComingSoon(true, '/fr/a-proposition', LOCALES).kind).toBe('rewrite');
  });

  it('case 13 — flag ON + /fr/devenir-pro/something → pass (nested whitelist)', () => {
    expect(decideComingSoon(true, '/fr/devenir-pro/cta', LOCALES).kind).toBe('pass');
  });
});

describe('safeLocaleFromPath — public app', () => {
  it('returns recognised locale when first segment matches LOCALES', () => {
    expect(safeLocaleFromPath('/fr/anything', LOCALES)).toBe('fr');
    expect(safeLocaleFromPath('/en/foo/bar', LOCALES)).toBe('en');
  });

  it('falls back to en when first segment is unknown or missing', () => {
    expect(safeLocaleFromPath('/xx/foo', LOCALES)).toBe('en');
    expect(safeLocaleFromPath('/', LOCALES)).toBe('en');
    expect(safeLocaleFromPath('', LOCALES)).toBe('en');
  });
});
