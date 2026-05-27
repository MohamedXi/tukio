import { describe, it, expect } from 'vitest';
import { decideAdminAccess, type AdminAccessInput } from './admin-access-decision';

const ADMIN = 'https://admin.tukio.one';
const NOW = Math.floor(Date.now() / 1000);

function makeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: NOW + 3600, iat: NOW, ...claims })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

const ADMIN_TOTP = makeJwt({ realm_access: { roles: ['admin-modo'] }, amr: ['pwd', 'totp'] });
const ADMIN_SUPPORT_TOTP = makeJwt({
  realm_access: { roles: ['admin-support'] },
  amr: ['pwd', 'totp'],
});
const ADMIN_SUPER_NO_TOTP = makeJwt({ realm_access: { roles: ['admin-super'] }, amr: ['pwd'] });
const CLIENT = makeJwt({ realm_access: { roles: ['client'] }, amr: ['pwd'] });
const PRO = makeJwt({ realm_access: { roles: ['pro'] }, amr: ['pwd'] });
const EXPIRED_ADMIN = makeJwt({
  realm_access: { roles: ['admin-modo'] },
  amr: ['totp'],
  exp: NOW - 3600,
});

function input(overrides: Partial<AdminAccessInput>): AdminAccessInput {
  return {
    pathname: '/fr/admin/dashboard',
    accessToken: ADMIN_TOTP,
    adminBaseUrl: ADMIN,
    ...overrides,
  };
}

describe('decideAdminAccess (Story 1.4d AC3)', () => {
  it('1. non-admin path → next', () => {
    expect(decideAdminAccess(input({ pathname: '/fr/auth/totp-setup' })).kind).toBe('next');
  });

  it('2. missing JWT → cross-zone apex login with admin next', () => {
    expect(decideAdminAccess(input({ accessToken: undefined }))).toEqual({
      kind: 'redirect-login',
      locale: 'fr',
      nextUrl: `${ADMIN}/fr/admin/dashboard`,
    });
  });

  it('3. expired JWT → redirect-login', () => {
    expect(decideAdminAccess(input({ accessToken: EXPIRED_ADMIN })).kind).toBe('redirect-login');
  });

  it('4. malformed JWT → redirect-login', () => {
    expect(decideAdminAccess(input({ accessToken: 'not.a.jwt' })).kind).toBe('redirect-login');
  });

  it('5. customer role → redirect-apex (customer-first)', () => {
    expect(decideAdminAccess(input({ accessToken: CLIENT }))).toEqual({
      kind: 'redirect-apex',
      locale: 'fr',
    });
  });

  it('6. pro role → redirect-apex', () => {
    expect(decideAdminAccess(input({ accessToken: PRO })).kind).toBe('redirect-apex');
  });

  it('7. admin-support + totp → next', () => {
    expect(decideAdminAccess(input({ accessToken: ADMIN_SUPPORT_TOTP })).kind).toBe('next');
  });

  it('8. admin-modo + totp → next', () => {
    expect(decideAdminAccess(input({ accessToken: ADMIN_TOTP })).kind).toBe('next');
  });

  it('9. admin-super WITHOUT totp → redirect-totp', () => {
    expect(decideAdminAccess(input({ accessToken: ADMIN_SUPER_NO_TOTP }))).toEqual({
      kind: 'redirect-totp',
      locale: 'fr',
    });
  });

  it('10. EN locale resolves in the redirect target', () => {
    expect(decideAdminAccess(input({ pathname: '/en/admin/users', accessToken: CLIENT }))).toEqual({
      kind: 'redirect-apex',
      locale: 'en',
    });
  });
});
