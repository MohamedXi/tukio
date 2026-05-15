import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquisitionCookieMiddleware } from '../acquisition-cookie.js';

// Mock next/server — Next.js uses platform-specific internals that don't run in jsdom.
vi.mock('next/server', () => {
  class MockNextResponse {
    cookies = {
      _jar: new Map<string, Record<string, unknown>>(),
      set(cookie: Record<string, unknown> | string) {
        const name = typeof cookie === 'string' ? cookie : (cookie as { name: string }).name;
        this._jar.set(name, typeof cookie === 'string' ? {} : (cookie as Record<string, unknown>));
      },
      get(name: string) {
        return this._jar.get(name);
      },
      getAll() {
        return [...this._jar.values()];
      },
    };
    static next() {
      return new MockNextResponse();
    }
  }
  return { NextResponse: MockNextResponse };
});

function buildRequest(url: string, existingCookie?: string, referer?: string): Request {
  const headers = new Headers();
  if (existingCookie) {
    headers.set('cookie', `tukio-acquisition=${encodeURIComponent(existingCookie)}`);
  }
  if (referer) {
    headers.set('referer', referer);
  }
  return {
    nextUrl: new URL(url),
    url,
    headers,
    cookies: {
      get: (name: string) => {
        if (name === 'tukio-acquisition' && existingCookie) {
          return { value: encodeURIComponent(existingCookie) };
        }
        return undefined;
      },
    },
  } as unknown as Request;
}

describe('acquisitionCookieMiddleware', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets acquisition cookie from UTM params (google)', () => {
    const req = buildRequest(
      'https://tukio.one/fr/?utm_source=google&utm_medium=cpc&utm_campaign=spring2026',
    );
    const res = acquisitionCookieMiddleware(req as never);

    const cookieSet = (
      res.cookies as unknown as { _jar: Map<string, Record<string, unknown>> }
    )._jar.get('tukio-acquisition');
    expect(cookieSet).toBeDefined();
    const value = JSON.parse(decodeURIComponent(cookieSet!['value'] as string));
    expect(value.source).toBe('google_ads');
    expect(value.medium).toBe('cpc');
    expect(value.campaign).toBe('spring2026');
    expect(value.firstTouch).toBeTruthy();
    expect(value.lastTouch).toBeTruthy();
  });

  it('maps facebook UTM source to meta_ads', () => {
    const req = buildRequest('https://tukio.one/fr/?utm_source=facebook');
    const res = acquisitionCookieMiddleware(req as never);

    const cookieSet = (
      res.cookies as unknown as { _jar: Map<string, Record<string, unknown>> }
    )._jar.get('tukio-acquisition');
    expect(cookieSet).toBeDefined();
    const value = JSON.parse(decodeURIComponent(cookieSet!['value'] as string));
    expect(value.source).toBe('meta_ads');
  });

  it('sets direct source when no UTM and no referer', () => {
    const req = buildRequest('https://tukio.one/fr/');
    const res = acquisitionCookieMiddleware(req as never);

    const cookieSet = (
      res.cookies as unknown as { _jar: Map<string, Record<string, unknown>> }
    )._jar.get('tukio-acquisition');
    expect(cookieSet).toBeDefined();
    const value = JSON.parse(decodeURIComponent(cookieSet!['value'] as string));
    expect(value.source).toBe('direct');
  });

  it('sets unknown source when referer is present but no UTM', () => {
    const req = buildRequest('https://tukio.one/fr/', undefined, 'https://google.com');
    const res = acquisitionCookieMiddleware(req as never);

    const cookieSet = (
      res.cookies as unknown as { _jar: Map<string, Record<string, unknown>> }
    )._jar.get('tukio-acquisition');
    expect(cookieSet).toBeDefined();
    const value = JSON.parse(decodeURIComponent(cookieSet!['value'] as string));
    expect(value.source).toBe('unknown');
  });

  it('does not modify cookie when existing cookie and no UTM params', () => {
    const existing = JSON.stringify({
      source: 'google_ads',
      firstTouch: '2026-01-01T00:00:00.000Z',
      lastTouch: '2026-01-01T00:00:00.000Z',
    });
    const req = buildRequest('https://tukio.one/fr/marquees', existing);
    const res = acquisitionCookieMiddleware(req as never);

    // Cookie jar should be empty — no update when no UTM and cookie exists
    const cookieSet = (
      res.cookies as unknown as { _jar: Map<string, Record<string, unknown>> }
    )._jar.get('tukio-acquisition');
    expect(cookieSet).toBeUndefined();
  });

  it('preserves firstTouch and updates lastTouch on new UTM (multi-touch)', () => {
    const firstTouch = '2026-01-01T00:00:00.000Z';
    const existing = JSON.stringify({
      source: 'unknown',
      firstTouch,
      lastTouch: firstTouch,
    });
    const req = buildRequest(
      'https://tukio.one/fr/?utm_source=google&utm_campaign=retargeting',
      existing,
    );
    const res = acquisitionCookieMiddleware(req as never);

    const cookieSet = (
      res.cookies as unknown as { _jar: Map<string, Record<string, unknown>> }
    )._jar.get('tukio-acquisition');
    expect(cookieSet).toBeDefined();
    const value = JSON.parse(decodeURIComponent(cookieSet!['value'] as string));
    expect(value.source).toBe('google_ads');
    expect(value.campaign).toBe('retargeting');
    expect(value.firstTouch).toBe(firstTouch); // preserved
    expect(value.lastTouch).not.toBe(firstTouch); // updated
  });
});
