import { describe, it, expect } from 'vitest';
import { decidePendingRedirect } from './pending-admin-review-decision';

/**
 * Story 1.3d AC2 — pure unit coverage of the pending-admin-review middleware
 * predicate. Tests the framework-free `decidePendingRedirect` so we don't
 * have to teach Vite how to transform Next.js's edge-runtime modules.
 * Playwright e2e for the live redirect across the dev stack is deferred to
 * the broader Story 1.4 / 1.10 milestone once apps/seller has a Playwright
 * harness (see Change Log).
 */

function makeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.sig`;
}

const PENDING_TOKEN = makeJwt({
  'tukio:status': 'pending_admin_review',
  exp: Math.floor(Date.now() / 1000) + 3600,
});
const ACTIVE_TOKEN = makeJwt({
  'tukio:status': 'active',
  exp: Math.floor(Date.now() / 1000) + 3600,
});
const EXPIRED_TOKEN = makeJwt({
  'tukio:status': 'pending_admin_review',
  exp: Math.floor(Date.now() / 1000) - 3600,
});

describe('decidePendingRedirect', () => {
  it('case 1 — JWT pending + /seller/listings/new → redirect to /fr/onboarding/pending', () => {
    const result = decidePendingRedirect('/fr/seller/listings/new', PENDING_TOKEN);
    expect(result).toEqual({ redirect: true, locale: 'fr' });
  });

  it('case 2 — JWT pending + /seller/onboarding/profile → no redirect (allowed)', () => {
    const result = decidePendingRedirect('/fr/seller/onboarding/profile', PENDING_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 2b — JWT pending + /seller/profile → no redirect (allowed)', () => {
    const result = decidePendingRedirect('/fr/seller/profile', PENDING_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 2c — JWT pending + /seller/messaging → no redirect (allowed)', () => {
    const result = decidePendingRedirect('/fr/seller/messaging/conversations', PENDING_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 3 — JWT active + /seller/listings/new → no redirect', () => {
    const result = decidePendingRedirect('/fr/seller/listings/new', ACTIVE_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 4 — no JWT cookie → no redirect (Story 1.4 future: login)', () => {
    const result = decidePendingRedirect('/fr/seller/listings/new', undefined);
    expect(result.redirect).toBe(false);
  });

  it('case 5 — expired JWT → ignore claim, no redirect', () => {
    const result = decidePendingRedirect('/fr/seller/listings/new', EXPIRED_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 6 — malformed JWT → no crash, no redirect', () => {
    const result = decidePendingRedirect('/fr/seller/listings/new', 'not.a.jwt');
    expect(result.redirect).toBe(false);
  });

  it('case 7 — non-seller path /fr/dashboard → no match, no redirect', () => {
    const result = decidePendingRedirect('/fr/dashboard', PENDING_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 8 — EN locale resolves correctly in redirect target', () => {
    const result = decidePendingRedirect('/en/seller/payouts', PENDING_TOKEN);
    expect(result).toEqual({ redirect: true, locale: 'en' });
  });

  it('case 9b — JWT pending + /seller/onboarding/identity → no redirect (allowed)', () => {
    const result = decidePendingRedirect('/fr/seller/onboarding/identity', PENDING_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 9c — JWT pending + /seller/onboarding/documents → no redirect (allowed)', () => {
    const result = decidePendingRedirect('/fr/seller/onboarding/documents', PENDING_TOKEN);
    expect(result.redirect).toBe(false);
  });

  it('case 9 — over-2KB JWT payload → safe rejection, no crash', () => {
    const overSized = makeJwt({
      'tukio:status': 'pending_admin_review',
      filler: 'x'.repeat(4000),
    });
    const result = decidePendingRedirect('/fr/seller/listings/new', overSized);
    expect(result.redirect).toBe(false);
  });
});
