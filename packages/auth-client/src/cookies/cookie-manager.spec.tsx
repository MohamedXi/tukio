import { describe, it, expect, beforeEach } from 'vitest';
import { CookieManager } from './cookie-manager.js';
import { TUKIO_SESSION_MARKER_COOKIE, TUKIO_CSRF_COOKIE } from '../tokens.js';

describe('CookieManager (Story 1.4d AC7)', () => {
  let mgr: CookieManager;

  beforeEach(() => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = `${TUKIO_CSRF_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    mgr = new CookieManager();
  });

  it('isAuthenticated returns false when no session cookie', () => {
    expect(mgr.isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when session marker = 1', () => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=1`;
    expect(mgr.isAuthenticated()).toBe(true);
  });

  it('hasSessionCookie alias mirrors isAuthenticated', () => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=1`;
    expect(mgr.hasSessionCookie()).toBe(mgr.isAuthenticated());
  });

  it('getCsrfToken returns null when no cookie', () => {
    expect(mgr.getCsrfToken()).toBeNull();
  });

  it('getCsrfToken returns token when cookie is set', () => {
    document.cookie = `${TUKIO_CSRF_COOKIE}=abc123`;
    expect(mgr.getCsrfToken()).toBe('abc123');
  });

  it('addCsrfHeader sets X-CSRF-Token on a Headers instance', () => {
    document.cookie = `${TUKIO_CSRF_COOKIE}=my-csrf`;
    const headers = mgr.addCsrfHeader(new Headers());
    expect(headers.get('X-CSRF-Token')).toBe('my-csrf');
  });

  it('addCsrfHeader sets X-CSRF-Token on a plain record (axios shape)', () => {
    document.cookie = `${TUKIO_CSRF_COOKIE}=rec-csrf`;
    const headers = mgr.addCsrfHeader<Record<string, string>>({});
    expect(headers['X-CSRF-Token']).toBe('rec-csrf');
  });

  it('addCsrfHeader is a no-op when no CSRF cookie present', () => {
    const headers = mgr.addCsrfHeader(new Headers());
    expect(headers.get('X-CSRF-Token')).toBeNull();
  });

  it('clearSession removes the session marker cookie', () => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=1`;
    expect(mgr.isAuthenticated()).toBe(true);
    mgr.clearSession();
    expect(mgr.isAuthenticated()).toBe(false);
  });

  it('clearLocalSessionCache is a safe no-op', () => {
    expect(() => mgr.clearLocalSessionCache()).not.toThrow();
  });
});
