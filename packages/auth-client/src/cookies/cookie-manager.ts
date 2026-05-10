import { TUKIO_SESSION_MARKER_COOKIE, TUKIO_CSRF_COOKIE } from '../tokens.js';

// CookieManager provides helpers for reading session state and CSRF token.
// The access token itself is HttpOnly (not readable by JS) — only the marker
// cookie indicates whether a session exists.
export class CookieManager {
  hasSessionCookie(): boolean {
    if (typeof document === 'undefined') return false;
    return document.cookie
      .split(';')
      .some((c) => c.trim().startsWith(`${TUKIO_SESSION_MARKER_COOKIE}=1`));
  }

  getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const cookie = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith(`${TUKIO_CSRF_COOKIE}=`));
    return cookie ? decodeURIComponent(cookie.trim().slice(TUKIO_CSRF_COOKIE.length + 1)) : null;
  }

  addCsrfHeader(headers: Headers): Headers {
    const token = this.getCsrfToken();
    if (token) headers.set('X-CSRF-Token', token);
    return headers;
  }

  clearSession(): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

export const cookieManager = new CookieManager();
