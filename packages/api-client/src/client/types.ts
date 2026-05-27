export interface AxiosClientConfig {
  // gateway-api base URL (e.g. https://api.tukio.one).
  baseURL: string;
  // Default 10_000 ms.
  timeout?: number;
  // Hook to fetch the current locale. The interceptor reads this on every
  // request to inject `X-Tukio-Locale` — apps wire it from useCurrentLocale().
  getLocale?: () => 'fr' | 'en';
  // Hook to fetch the CSRF token from the cookie marker (Story 0.8
  // CookieManager.getCsrfToken). Apps inject it; the lib stays
  // dependency-free of @tukio/auth-client to avoid a circular dep.
  getCsrfToken?: () => string | null;
  // Override the correlation ID generation strategy. Default uses
  // crypto.randomUUID() at first call + persists in sessionStorage.
  getCorrelationId?: () => string;
  // Maximum retries on network/5xx failures. Default 3.
  maxRetries?: number;
  // Story 1.4d AC9 — called on a 401 "not authenticated" response to attempt a
  // silent token refresh. Returns true if the session was refreshed (the
  // original request is then retried once). Apps wire this to
  // RefreshTokenRotationManager.refreshNow() — the lib stays dependency-free of
  // @tukio/auth-client to avoid a circular dependency.
  refreshAuth?: () => Promise<boolean>;
  // tukioCodes that trigger the refresh-then-retry path. Defaults to the
  // gateway's expired/missing access-token code `AUTH-NOT-AUTHENTICATED-002`.
  refreshTriggerCodes?: string[];
}
