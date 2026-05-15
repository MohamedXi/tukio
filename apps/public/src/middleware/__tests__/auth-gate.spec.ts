import { describe, it, expect, vi } from 'vitest';
import { authGateMiddleware } from '../auth-gate.js';

vi.mock('next/server', () => {
  class MockNextResponse {
    constructor(
      public readonly status: number,
      public readonly url?: URL,
    ) {}
    static redirect(url: URL) {
      return new MockNextResponse(307, url);
    }
  }
  return { NextResponse: MockNextResponse };
});

function buildRequest(pathname: string, sessionMarker?: string, search = ''): unknown {
  const url = new URL(`https://tukio.one${pathname}${search}`);
  const cookies = new Map<string, { value: string }>();
  if (sessionMarker !== undefined) {
    cookies.set('tukio-session-active', { value: sessionMarker });
  }
  return {
    nextUrl: url,
    url: url.toString(),
    cookies: { get: (name: string) => cookies.get(name) },
  };
}

describe('authGateMiddleware', () => {
  describe('public routes (not auth-gated)', () => {
    it('returns undefined for landing /fr/', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/fr/') as any);
      expect(result).toBeUndefined();
    });

    it('returns undefined for /fr/login', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/fr/login') as any);
      expect(result).toBeUndefined();
    });

    it('returns undefined for /en/services/marquees', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/en/services/marquees') as any);
      expect(result).toBeUndefined();
    });

    it('returns undefined for the apex root /', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/') as any);
      expect(result).toBeUndefined();
    });
  });

  describe('auth-gated routes', () => {
    const gated = [
      '/fr/account',
      '/fr/account/profile',
      '/fr/bookings',
      '/fr/bookings/checkout',
      '/fr/favorites',
      '/fr/messages',
      '/en/account',
      '/en/bookings/abc-123',
    ];

    it.each(gated)('redirects to /login when no session marker cookie is present (%s)', (path) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest(path) as any) as
        | { status: number; url: URL }
        | undefined;
      expect(result).toBeDefined();
      expect(result!.status).toBe(307);
      expect(result!.url.pathname).toBe(`/${path.split('/')[1]}/login`);
      expect(result!.url.searchParams.get('callback')).toBe(path);
    });

    it('redirects when the session marker cookie is set to "0"', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/fr/account', '0') as any) as
        | { status: number }
        | undefined;
      expect(result).toBeDefined();
      expect(result!.status).toBe(307);
    });

    it('preserves query string in the callback parameter', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(
        buildRequest('/fr/account', undefined, '?from=cart') as any,
      ) as { status: number; url: URL } | undefined;
      expect(result).toBeDefined();
      expect(result!.url.searchParams.get('callback')).toBe('/fr/account?from=cart');
    });

    it('lets the request through when the session marker cookie is "1"', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/fr/account', '1') as any);
      expect(result).toBeUndefined();
    });
  });

  describe('locale routing', () => {
    it('uses the locale from the URL when redirecting (en)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/en/bookings') as any) as
        | { url: URL }
        | undefined;
      expect(result!.url.pathname).toBe('/en/login');
    });

    it('does not gate routes that share a prefix outside the gated list', () => {
      // /fr/accounts (plural) is not in the AUTH_GATED set.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = authGateMiddleware(buildRequest('/fr/accounts') as any);
      expect(result).toBeUndefined();
    });
  });
});
