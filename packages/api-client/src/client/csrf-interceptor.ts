import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// Adds X-CSRF-Token header on mutation requests. The token is read from a
// caller-supplied function so the lib stays dependency-free of
// @tukio/auth-client (avoids a circular dep with frontend apps).
//
// If a mutation request is made without a CSRF token available, we warn but
// still send the request — gateway-api will reject with 403, downstream code
// converts to ApiError. We deliberately do not throw client-side because some
// setups (tests, dev mode) bypass CSRF.
export function applyCsrfInterceptor(
  client: AxiosInstance,
  getCsrfToken: () => string | null,
): void {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = String(config.method ?? 'get')
      .toLowerCase()
      .trim();
    if (!MUTATION_METHODS.has(method)) return config;
    const token = getCsrfToken();
    if (token) {
      config.headers.set('X-CSRF-Token', token);
    } else if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[csrfInterceptor] ${method.toUpperCase()} ${config.url ?? ''} sent without CSRF token — gateway-api will likely 403.`,
      );
    }
    return config;
  });
}
