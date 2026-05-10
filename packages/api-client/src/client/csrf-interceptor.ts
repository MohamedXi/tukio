import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// Adds X-CSRF-Token header on mutation requests. The token is read from a
// caller-supplied function so the lib stays dependency-free of
// @tukio/auth-client (avoids a circular dep with frontend apps).
export function applyCsrfInterceptor(
  client: AxiosInstance,
  getCsrfToken: () => string | null,
): void {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase();
    if (!MUTATION_METHODS.has(method)) return config;
    const token = getCsrfToken();
    if (token) {
      config.headers.set('X-CSRF-Token', token);
    }
    return config;
  });
}
