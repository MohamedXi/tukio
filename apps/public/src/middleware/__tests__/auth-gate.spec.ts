import { describe, it, expect } from 'vitest';
import { decideAuthGate, type AuthGateInput } from '../auth-gate-decision';

const SELLER = 'https://seller.tukio.one';
const ADMIN = 'https://admin.tukio.one';
const NOW = Math.floor(Date.now() / 1000);

function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function jwt(claims: Record<string, unknown>): string {
  return `h.${base64url(JSON.stringify({ exp: NOW + 300, iat: NOW, ...claims }))}.sig`;
}

function input(overrides: Partial<AuthGateInput>): AuthGateInput {
  return {
    pathname: '/fr/account',
    search: '',
    sessionMarker: '1',
    accessToken: jwt({ realm_access: { roles: ['client'] }, email_verified: true }),
    sellerBaseUrl: SELLER,
    adminBaseUrl: ADMIN,
    ...overrides,
  };
}

describe('decideAuthGate (Story 1.4d AC1)', () => {
  it('1. ungated public route → next', () => {
    expect(decideAuthGate(input({ pathname: '/fr/services/marquees' })).kind).toBe('next');
  });

  it('2. apex root → next', () => {
    expect(decideAuthGate(input({ pathname: '/fr' })).kind).toBe('next');
  });

  it('3. gated route, no session marker → redirect /auth/login with next param', () => {
    const d = decideAuthGate(input({ sessionMarker: undefined }));
    expect(d).toEqual({ kind: 'redirect', url: '/fr/auth/login?next=%2Ffr%2Faccount' });
  });

  it('4. session marker "0" is treated as unauthenticated', () => {
    const d = decideAuthGate(input({ sessionMarker: '0' }));
    expect(d.kind).toBe('redirect');
    expect((d as { url: string }).url).toContain('/fr/auth/login');
  });

  it('5. transactional route, no session → login (session-first, not verify-email)', () => {
    const d = decideAuthGate(input({ pathname: '/fr/cart', sessionMarker: undefined }));
    expect((d as { url: string }).url).toContain('/fr/auth/login');
  });

  it('6. gated route, session, customer role → next', () => {
    expect(decideAuthGate(input({})).kind).toBe('next');
  });

  it('7. gated route, session, PRO role → cross-zone redirect to seller dashboard', () => {
    const d = decideAuthGate(
      input({ accessToken: jwt({ realm_access: { roles: ['pro'] }, email_verified: true }) }),
    );
    expect(d).toEqual({ kind: 'redirect', url: `${SELLER}/fr/seller/dashboard` });
  });

  it('8. gated route, session, ADMIN-MODO role → cross-zone redirect to admin dashboard', () => {
    const d = decideAuthGate(
      input({
        accessToken: jwt({ realm_access: { roles: ['admin-modo'] }, email_verified: true }),
      }),
    );
    expect(d).toEqual({ kind: 'redirect', url: `${ADMIN}/fr/admin/dashboard` });
  });

  it('9. gated route, session, ADMIN-SUPER role → admin dashboard', () => {
    const d = decideAuthGate(
      input({
        accessToken: jwt({ realm_access: { roles: ['admin-super'] }, email_verified: true }),
      }),
    );
    expect((d as { url: string }).url).toBe(`${ADMIN}/fr/admin/dashboard`);
  });

  it('10. transactional route, customer, email verified → next', () => {
    const d = decideAuthGate(
      input({
        pathname: '/fr/cart',
        accessToken: jwt({ realm_access: { roles: ['client'] }, email_verified: true }),
      }),
    );
    expect(d.kind).toBe('next');
  });

  it('11. transactional route, customer, email NOT verified → verify-email-required', () => {
    const d = decideAuthGate(
      input({
        pathname: '/fr/cart',
        accessToken: jwt({ realm_access: { roles: ['client'] }, email_verified: false }),
      }),
    );
    expect(d).toEqual({ kind: 'redirect', url: '/fr/auth/verify-email-required' });
  });

  it('12. en-locale gated route uses the en login path + preserves query in next', () => {
    const d = decideAuthGate(
      input({ pathname: '/en/bookings', search: '?from=cart', sessionMarker: undefined }),
    );
    expect(d).toEqual({
      kind: 'redirect',
      url: '/en/auth/login?next=%2Fen%2Fbookings%3Ffrom%3Dcart',
    });
  });

  it('13. session present but access token unreadable → next (rely on 401 refresh)', () => {
    const d = decideAuthGate(input({ accessToken: 'garbage' }));
    expect(d.kind).toBe('next');
  });

  it('14. PRO on a transactional route is redirected to seller (role check precedes email gate)', () => {
    const d = decideAuthGate(
      input({
        pathname: '/fr/cart',
        accessToken: jwt({ realm_access: { roles: ['pro'] }, email_verified: false }),
      }),
    );
    expect((d as { url: string }).url).toBe(`${SELLER}/fr/seller/dashboard`);
  });

  it('15. session present but EXPIRED pro token → next (no double-redirect; api-client 401 refresh handles it)', () => {
    const expiredProToken = `h.${base64url(JSON.stringify({ exp: NOW - 60, iat: NOW - 360, realm_access: { roles: ['pro'] }, email_verified: true }))}.sig`;
    const d = decideAuthGate(input({ accessToken: expiredProToken }));
    // Expired roles must NOT trigger cross-zone redirect; let the 401 interceptor re-auth.
    expect(d.kind).toBe('next');
  });
});
