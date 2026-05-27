import { describe, it, expect } from 'vitest';
import { decideSellerAccess, type SellerAccessInput } from './seller-access-decision';

const SELLER = 'https://seller.tukio.one';
const NOW = Math.floor(Date.now() / 1000);

function makeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: NOW + 3600, iat: NOW, ...claims })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

const PENDING = makeJwt({ 'tukio:status': 'pending_admin_review' });
const ACTIVE = makeJwt({ 'tukio:status': 'active' });
const REJECTED = makeJwt({ 'tukio:status': 'rejected' });
const SUSPENDED = makeJwt({ 'tukio:status': 'suspended' });
const EXPIRED = makeJwt({ 'tukio:status': 'pending_admin_review', exp: NOW - 3600 });

function input(overrides: Partial<SellerAccessInput>): SellerAccessInput {
  return {
    pathname: '/fr/seller/listings/new',
    accessToken: PENDING,
    sellerBaseUrl: SELLER,
    ...overrides,
  };
}

describe('decideSellerAccess (Story 1.4d AC2)', () => {
  it('non-seller path → next', () => {
    expect(decideSellerAccess(input({ pathname: '/fr/dashboard' })).kind).toBe('next');
  });

  it('pending + /seller/listings/new → redirect to onboarding/pending', () => {
    expect(decideSellerAccess(input({}))).toEqual({
      kind: 'redirect-internal',
      path: '/fr/seller/onboarding/pending',
    });
  });

  it('pending + /seller/onboarding/profile → next (whitelisted)', () => {
    expect(decideSellerAccess(input({ pathname: '/fr/seller/onboarding/profile' })).kind).toBe(
      'next',
    );
  });

  it('pending + /seller/profile → next (whitelisted)', () => {
    expect(decideSellerAccess(input({ pathname: '/fr/seller/profile' })).kind).toBe('next');
  });

  it('pending + /seller/messaging/conversations → next (whitelisted)', () => {
    expect(decideSellerAccess(input({ pathname: '/fr/seller/messaging/conversations' })).kind).toBe(
      'next',
    );
  });

  it('active + /seller/listings/new → next', () => {
    expect(decideSellerAccess(input({ accessToken: ACTIVE })).kind).toBe('next');
  });

  it('rejected + /seller/dashboard → redirect to onboarding/rejected', () => {
    expect(
      decideSellerAccess(input({ pathname: '/fr/seller/dashboard', accessToken: REJECTED })),
    ).toEqual({ kind: 'redirect-internal', path: '/fr/seller/onboarding/rejected' });
  });

  it('suspended → cross-zone login redirect', () => {
    const d = decideSellerAccess(input({ accessToken: SUSPENDED }));
    expect(d).toEqual({
      kind: 'redirect-login',
      nextUrl: `${SELLER}/fr/seller/listings/new`,
    });
  });

  it('no JWT cookie → cross-zone login redirect (AC2 evolution from 1.3d)', () => {
    const d = decideSellerAccess(input({ accessToken: undefined }));
    expect(d.kind).toBe('redirect-login');
    expect((d as { nextUrl: string }).nextUrl).toBe(`${SELLER}/fr/seller/listings/new`);
  });

  it('expired JWT → cross-zone login redirect (claim ignored)', () => {
    expect(decideSellerAccess(input({ accessToken: EXPIRED })).kind).toBe('redirect-login');
  });

  it('malformed JWT → cross-zone login redirect, no crash', () => {
    expect(decideSellerAccess(input({ accessToken: 'not.a.jwt' })).kind).toBe('redirect-login');
  });

  it('EN locale resolves in the redirect target', () => {
    expect(
      decideSellerAccess(input({ pathname: '/en/seller/payouts', accessToken: PENDING })),
    ).toEqual({ kind: 'redirect-internal', path: '/en/seller/onboarding/pending' });
  });

  it('pending + /seller/onboarding/identity → next (whitelisted)', () => {
    expect(decideSellerAccess(input({ pathname: '/fr/seller/onboarding/identity' })).kind).toBe(
      'next',
    );
  });

  it('pending + /seller/onboarding/documents → next (whitelisted)', () => {
    expect(decideSellerAccess(input({ pathname: '/fr/seller/onboarding/documents' })).kind).toBe(
      'next',
    );
  });
});
