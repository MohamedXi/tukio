import {
  resolvePostLoginRedirect,
  sanitizeNextUrl,
  type DecodedJwtClaims,
  type ZoneBaseUrls,
} from './redirect-resolver.js';

const ZONES: ZoneBaseUrls = {
  public: 'https://tukio.one',
  seller: 'https://seller.tukio.one',
  admin: 'https://admin.tukio.one',
};

const CUSTOMER: DecodedJwtClaims = {
  realmAccess: { roles: ['client'] },
  tukioStatus: 'active',
};
const PRO_PENDING: DecodedJwtClaims = {
  realmAccess: { roles: ['client', 'pro'] },
  tukioStatus: 'pending_admin_review',
};
const PRO_ACTIVE: DecodedJwtClaims = {
  realmAccess: { roles: ['client', 'pro'] },
  tukioStatus: 'active',
};
const PRO_REJECTED: DecodedJwtClaims = {
  realmAccess: { roles: ['client', 'pro'] },
  tukioStatus: 'rejected',
};
const ADMIN_WITH_TOTP: DecodedJwtClaims = {
  realmAccess: { roles: ['admin-modo'] },
  amr: ['pwd', 'totp'],
};
const ADMIN_NO_TOTP: DecodedJwtClaims = {
  realmAccess: { roles: ['admin-super'] },
  amr: ['pwd'],
};

describe('resolvePostLoginRedirect — role/status matrix', () => {
  it('Customer FR → tukio.one/fr/account/dashboard', () => {
    expect(
      resolvePostLoginRedirect({
        claims: CUSTOMER,
        locale: 'fr',
        next: null,
        zones: ZONES,
      }),
    ).toBe('https://tukio.one/fr/account/dashboard');
  });

  it('Customer EN → tukio.one/en/account/dashboard', () => {
    expect(
      resolvePostLoginRedirect({
        claims: CUSTOMER,
        locale: 'en',
        next: null,
        zones: ZONES,
      }),
    ).toBe('https://tukio.one/en/account/dashboard');
  });

  it('Pro pending_admin_review FR → seller.tukio.one/fr/seller/onboarding/pending (FR17)', () => {
    expect(
      resolvePostLoginRedirect({
        claims: PRO_PENDING,
        locale: 'fr',
        next: null,
        zones: ZONES,
      }),
    ).toBe('https://seller.tukio.one/fr/seller/onboarding/pending');
  });

  it('Pro active EN → seller.tukio.one/en/seller/dashboard', () => {
    expect(
      resolvePostLoginRedirect({
        claims: PRO_ACTIVE,
        locale: 'en',
        next: null,
        zones: ZONES,
      }),
    ).toBe('https://seller.tukio.one/en/seller/dashboard');
  });

  it('Pro rejected FR → seller.tukio.one/fr/seller/onboarding/rejected', () => {
    expect(
      resolvePostLoginRedirect({
        claims: PRO_REJECTED,
        locale: 'fr',
        next: null,
        zones: ZONES,
      }),
    ).toBe('https://seller.tukio.one/fr/seller/onboarding/rejected');
  });

  it('Admin with TOTP → admin.tukio.one/fr/admin/dashboard', () => {
    expect(
      resolvePostLoginRedirect({
        claims: ADMIN_WITH_TOTP,
        locale: 'fr',
        next: null,
        zones: ZONES,
      }),
    ).toBe('https://admin.tukio.one/fr/admin/dashboard');
  });

  it('Admin without TOTP → admin.tukio.one/fr/auth/totp-setup (Story 1.7 placeholder)', () => {
    expect(
      resolvePostLoginRedirect({
        claims: ADMIN_NO_TOTP,
        locale: 'fr',
        next: null,
        zones: ZONES,
      }),
    ).toBe('https://admin.tukio.one/fr/auth/totp-setup');
  });
});

describe('sanitizeNextUrl — open-redirect protection', () => {
  it('accepts a Tukio apex absolute URL', () => {
    expect(sanitizeNextUrl('https://tukio.one/fr/account/bookings/123')).toBe(
      'https://tukio.one/fr/account/bookings/123',
    );
  });

  it('accepts a Tukio sub-zone absolute URL', () => {
    expect(
      sanitizeNextUrl('https://seller.tukio.one/en/seller/dashboard'),
    ).toBe('https://seller.tukio.one/en/seller/dashboard');
  });

  it('accepts a localhost URL for dev', () => {
    expect(sanitizeNextUrl('http://localhost:3000/fr/account/dashboard')).toBe(
      'http://localhost:3000/fr/account/dashboard',
    );
  });

  it('rejects javascript: protocol (XSS)', () => {
    expect(sanitizeNextUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects data: URI (XSS)', () => {
    expect(
      sanitizeNextUrl('data:text/html,<script>alert(1)</script>'),
    ).toBeNull();
  });

  it('rejects an external evil.com host', () => {
    expect(sanitizeNextUrl('https://evil.com/phish')).toBeNull();
  });

  it('rejects a subdomain spoof like tukio.one.evil.com', () => {
    expect(sanitizeNextUrl('https://tukio.one.evil.com/')).toBeNull();
  });

  it('rejects a relative URL (no hostname to validate)', () => {
    expect(sanitizeNextUrl('/fr/account/dashboard')).toBeNull();
  });

  it('rejects an empty string and null and non-string input', () => {
    expect(sanitizeNextUrl('')).toBeNull();
    expect(sanitizeNextUrl(null)).toBeNull();
    expect(sanitizeNextUrl(undefined)).toBeNull();
  });

  it('rejects malformed URL string', () => {
    expect(sanitizeNextUrl('not a url at all !@#')).toBeNull();
  });
});

describe('resolvePostLoginRedirect — next-param override behaviour', () => {
  it('uses sanitized next when provided and whitelisted', () => {
    expect(
      resolvePostLoginRedirect({
        claims: CUSTOMER,
        locale: 'fr',
        next: 'https://tukio.one/fr/account/bookings/checkout?cartId=abc',
        zones: ZONES,
      }),
    ).toBe('https://tukio.one/fr/account/bookings/checkout?cartId=abc');
  });

  it('falls back to default redirect when next is malicious (open-redirect)', () => {
    expect(
      resolvePostLoginRedirect({
        claims: CUSTOMER,
        locale: 'fr',
        next: 'https://evil.com/',
        zones: ZONES,
      }),
    ).toBe('https://tukio.one/fr/account/dashboard');
  });

  it('falls back to default redirect when next is javascript: (XSS)', () => {
    expect(
      resolvePostLoginRedirect({
        claims: CUSTOMER,
        locale: 'fr',
        next: 'javascript:alert(1)',
        zones: ZONES,
      }),
    ).toBe('https://tukio.one/fr/account/dashboard');
  });
});
