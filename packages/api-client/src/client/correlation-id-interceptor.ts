import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const STORAGE_KEY = 'tukio-correlation-id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Fallback v4 UUID for insecure contexts (http://*.preview, browser
// extensions) where `crypto.randomUUID` is undefined or throws.
function fallbackUuidV4(): string {
  const hex = '0123456789abcdef';
  const buf: string[] = [];
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) buf.push('-');
    else if (i === 14) buf.push('4');
    else if (i === 19) buf.push(hex[8 + Math.floor(Math.random() * 4)]!);
    else buf.push(hex[Math.floor(Math.random() * 16)]!);
  }
  return buf.join('');
}

function generateUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // crypto.randomUUID throws on insecure context (non-localhost http://).
  }
  return fallbackUuidV4();
}

// Default correlation-id strategy: persist a single UUID per browser session,
// reused across all requests within that session. Defensive against:
//   - SSR / no sessionStorage → fresh UUID per call
//   - sessionStorage quota exceeded (Safari lockdown, private mode) → fresh
//     UUID without persist
//   - corrupted/non-UUID value already stored → regenerate
//   - crypto.randomUUID unavailable → Math.random fallback
function defaultGetCorrelationId(): string {
  if (typeof sessionStorage === 'undefined') return generateUuid();
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && UUID_RE.test(existing)) return existing;
  } catch {
    // sessionStorage may throw on read in restricted contexts.
  }
  const fresh = generateUuid();
  try {
    sessionStorage.setItem(STORAGE_KEY, fresh);
  } catch {
    // Quota exceeded / lockdown mode — proceed without persist.
  }
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
