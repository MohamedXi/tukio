import { describe, it, expect, beforeEach } from 'vitest';
import { CookieManager } from './cookie-manager.js';
import { TUKIO_SESSION_MARKER_COOKIE, TUKIO_CSRF_COOKIE } from '../tokens.js';

describe('CookieManager', () => {
  let mgr: CookieManager;

  beforeEach(() => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = `${TUKIO_CSRF_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    mgr = new CookieManager();
  });

  it('hasSessionCookie returns false when no cookie', () => {
    expect(mgr.hasSessionCookie()).toBe(false);
  });

  it('hasSessionCookie returns true when cookie is set', () => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=1`;
    expect(mgr.hasSessionCookie()).toBe(true);
  });

  it('getCsrfToken returns null when no cookie', () => {
    expect(mgr.getCsrfToken()).toBeNull();
  });

  it('getCsrfToken returns token when cookie is set', () => {
    document.cookie = `${TUKIO_CSRF_COOKIE}=abc123`;
    expect(mgr.getCsrfToken()).toBe('abc123');
  });

  it('addCsrfHeader adds X-CSRF-Token header when token available', () => {
    document.cookie = `${TUKIO_CSRF_COOKIE}=my-csrf`;
    const headers = mgr.addCsrfHeader(new Headers());
    expect(headers.get('X-CSRF-Token')).toBe('my-csrf');
  });

  it('clearSession removes the session marker cookie', () => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=1`;
    expect(mgr.hasSessionCookie()).toBe(true);
    mgr.clearSession();
    expect(mgr.hasSessionCookie()).toBe(false);
  });
});
