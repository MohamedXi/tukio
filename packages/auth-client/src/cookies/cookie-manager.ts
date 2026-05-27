import { TUKIO_SESSION_MARKER_COOKIE, TUKIO_CSRF_COOKIE } from '../tokens.js';

export interface CookieManagerOptions {
  // Domain attribute used when clearing cookies. Must match the value set by
  // gateway-api at login (production: `.tukio.one`). Without this, a cookie
  // set with `Domain=.tukio.one` cannot be cleared by a delete-cookie write
  // that omits the domain — the browser keeps the original.
  domain?: string;
}

// Header bag accepted by addCsrfHeader — either a fetch `Headers` instance or a
// plain record (axios `config.headers` shape). Story 1.4d AC7.
type HeaderBag = Headers | Record<string, string>;

// CookieManager provides helpers for reading session state and CSRF token.
// The access token itself is HttpOnly (not readable by JS) — only the marker
// cookie indicates whether a session exists.
export class CookieManager {
  constructor(private readonly options: CookieManagerOptions = {}) {}

  /** True when the non-HttpOnly session marker cookie is exactly `1`. AC7. */
  isAuthenticated(): boolean {
    if (typeof document === 'undefined') return false;
    // Exact-match on the full `name=value` segment to avoid false positives from
    // similarly-named cookies (e.g. `tukio-session-active=10`) that would satisfy
    // a `startsWith` prefix check.
    return document.cookie.split(';').some((c) => c.trim() === `${TUKIO_SESSION_MARKER_COOKIE}=1`);
  }

  /** @deprecated Story 1.4d renamed this to {@link isAuthenticated}. Kept as an alias. */
  hasSessionCookie(): boolean {
    return this.isAuthenticated();
  }

  getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const cookie = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith(`${TUKIO_CSRF_COOKIE}=`));
    return cookie ? decodeURIComponent(cookie.trim().slice(TUKIO_CSRF_COOKIE.length + 1)) : null;
  }

  /**
   * Adds `X-CSRF-Token` to a header bag when a CSRF cookie is present. Accepts
   * a fetch `Headers` instance or a plain record (axios config). Returns the
   * same bag instance for chaining. AC7.
   */
  addCsrfHeader<T extends HeaderBag>(headers: T): T {
    const token = this.getCsrfToken();
    if (!token) return headers;
    if (headers instanceof Headers) {
      headers.set('X-CSRF-Token', token);
    } else {
      headers['X-CSRF-Token'] = token;
    }
    return headers;
  }

  /** Clears the non-HttpOnly session marker. The HttpOnly access/refresh
   *  cookies are cleared server-side by the gateway logout endpoint. */
  clearSession(): void {
    if (typeof document === 'undefined') return;
    const domainAttr = this.options.domain ? `; domain=${this.options.domain}` : '';
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
  }

  /**
   * No-op for the MVP — there is no in-memory session cache to clear (the
   * AuthProvider derives state from `/v1/auth/whoami` and re-fetches on mount).
   * Exposed per AC7 so callers (logout) have a stable seam if a cache is added
   * later. AC7.
   */
  clearLocalSessionCache(): void {
    // intentional no-op (MVP) — see jsdoc.
  }
}

// Default singleton — apps should construct a CookieManager with `{ domain: '.tukio.one' }`
// in production via the AuthProvider config.
export const cookieManager = new CookieManager();
