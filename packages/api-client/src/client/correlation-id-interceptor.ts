import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const STORAGE_KEY = 'tukio-correlation-id';

// Default correlation-id strategy: persist a single UUID per browser session,
// reused across all requests within that session. This makes server-side log
// search trivial — one ID matches every operation a single tab triggered.
function defaultGetCorrelationId(): string {
  if (typeof sessionStorage === 'undefined') {
    // SSR / non-browser environment — generate a fresh ID per call.
    return crypto.randomUUID();
  }
  const existing = sessionStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  sessionStorage.setItem(STORAGE_KEY, fresh);
  return fresh;
}

export function applyCorrelationIdInterceptor(
  client: AxiosInstance,
  getCorrelationId: () => string = defaultGetCorrelationId,
): void {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.headers.set('X-Tukio-Correlation-Id', getCorrelationId());
    return config;
  });
}
