import axios, { type AxiosError, type AxiosInstance } from 'axios';
import {
  isErrorEnvelope,
  throwApiErrorFromEnvelope,
  unwrapSuccessEnvelope,
} from './envelope-handler.js';
import { applyCorrelationIdInterceptor } from './correlation-id-interceptor.js';
import { applyCsrfInterceptor } from './csrf-interceptor.js';
import type { AxiosClientConfig } from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
// Exponential backoff: 200ms → 500ms → 1500ms.
const RETRY_BACKOFF_MS = [200, 500, 1500];

interface RetryConfig {
  __retryCount?: number;
  // Story 1.4d AC9 — guards the single refresh-then-retry attempt per request.
  __authRetried?: boolean;
}

const DEFAULT_REFRESH_TRIGGER_CODES = ['AUTH-NOT-AUTHENTICATED-002'];

// Factory creating a configured axios instance for Tukio gateway-api.
//
// Wired interceptors (in order):
//   - request: correlation-id + CSRF (if configured)
//   - request: X-Tukio-Locale (if getLocale is provided)
//   - response (2xx): unwrap SuccessEnvelope.data → response.data is the DTO nu
//   - response (error): retry on network errors / 5xx FIRST, only convert to
//     ApiError after retries are exhausted. NFR45.
export function createTukioApiClient(config: AxiosClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    withCredentials: true,
    timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  applyCorrelationIdInterceptor(client, config.getCorrelationId);

  if (config.getCsrfToken) {
    applyCsrfInterceptor(client, config.getCsrfToken);
  }

  if (config.getLocale) {
    client.interceptors.request.use((req) => {
      req.headers.set('X-Tukio-Locale', config.getLocale!());
      return req;
    });
  }

  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  client.interceptors.response.use(
    (response) => {
      // SuccessEnvelope unwrap. Defensive — only unwrap if FULL envelope shape
      // matches (method + code + data + meta), not just any object with
      // `data`+`method` keys (which an upstream proxy could mirror).
      if (
        response.data &&
        typeof response.data === 'object' &&
        'data' in response.data &&
        'method' in response.data &&
        'code' in response.data &&
        'meta' in response.data
      ) {
        response.data = unwrapSuccessEnvelope(response.data);
      }
      return response;
    },
    async (error: AxiosError) => {
      // Decision order matters here:
      // 1. Retry FIRST on network errors / 5xx (envelope-shaped or not) — NFR45
      //    requires retry on 5xx and the gateway-api wraps 5xx in error
      //    envelopes (so retry-before-throw was previously skipped).
      // 2. Only convert to ApiError after retries exhausted OR for 4xx.
      const status = error.response?.status;
      const responseData = error.response?.data;
      const isRetryable = !status || status === 0 || status >= 500;
      const cfg = error.config as (typeof error.config & RetryConfig) | undefined;
      const retryAfterSeconds = parseRetryAfter(error.response?.headers);

      // AC9 — silent refresh on 401 expired/missing access token. Attempt one
      // refresh via the injected `refreshAuth` callback, then retry the original
      // request exactly once (the `__authRetried` flag prevents an infinite
      // refresh→401→refresh loop when the refresh itself doesn't restore auth).
      if (status === 401 && config.refreshAuth && cfg && !cfg.__authRetried) {
        const code = isErrorEnvelope(responseData) ? responseData.error?.tukioCode : undefined;
        const triggers = config.refreshTriggerCodes ?? DEFAULT_REFRESH_TRIGGER_CODES;
        // `code === undefined` covers two cases: (a) the gateway returned an
        // error envelope without a tukioCode (shouldn't happen, but defensive),
        // and (b) a proxy/WAF in front of the gateway returned a bare 401 before
        // the request reached application logic. In both cases we attempt one
        // refresh as belt-and-suspenders — the worst outcome is a single extra
        // POST /v1/auth/refresh followed by a second 401 that surfaces normally.
        if (code === undefined || triggers.includes(code)) {
          cfg.__authRetried = true;
          let refreshed = false;
          try {
            refreshed = await config.refreshAuth();
          } catch {
            refreshed = false;
          }
          if (refreshed) return client.request(cfg);
          // Refresh failed → fall through to the normal ApiError conversion.
        }
      }

      if (isRetryable) {
        if (cfg) {
          cfg.__retryCount = cfg.__retryCount ?? 0;
          if (cfg.__retryCount < maxRetries) {
            const delay =
              RETRY_BACKOFF_MS[cfg.__retryCount] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]!;
            cfg.__retryCount += 1;
            await sleep(delay);
            return client.request(cfg);
          }
        }
        // Retries exhausted (or no config to retry with): if envelope-shaped,
        // throw typed ApiError; else propagate raw axios error.
        if (isErrorEnvelope(responseData)) {
          throwApiErrorFromEnvelope(responseData, undefined, retryAfterSeconds);
        }
        throw error;
      }

      // 4xx (or non-retryable status): convert to ApiError if envelope-shaped.
      if (isErrorEnvelope(responseData)) {
        throwApiErrorFromEnvelope(responseData, undefined, retryAfterSeconds);
      }
      throw error;
    },
  );

  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// RFC 7231 Retry-After: delta-seconds OR HTTP-date. Returns seconds or
// undefined when the header is missing/unparseable. axios normalises header
// names to lowercase but tolerates either casing on the raw headers object.
function parseRetryAfter(headers: unknown): number | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const h = headers as Record<string, unknown>;
  const raw = h['retry-after'] ?? h['Retry-After'];
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const value = String(raw).trim();
  if (value === '') return undefined;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return n > 0 ? n : undefined;
  }
  const epochMs = Date.parse(value);
  if (Number.isNaN(epochMs)) return undefined;
  const delta = Math.ceil((epochMs - Date.now()) / 1000);
  return delta > 0 ? delta : undefined;
}
