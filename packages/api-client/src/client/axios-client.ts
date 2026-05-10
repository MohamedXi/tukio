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
}

// Factory creating a configured axios instance for Tukio gateway-api.
//
// Wired interceptors (in order):
//   - request: correlation-id + CSRF (if configured)
//   - request: X-Tukio-Locale (if getLocale is provided)
//   - response (2xx): unwrap SuccessEnvelope.data → response.data is the DTO nu
//   - response (error): parse ErrorEnvelope → throw ApiError typed
//   - response (error): retry on network errors / 5xx (NFR45)
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
      // SuccessEnvelope unwrap. Defensive — only unwrap if shape matches.
      if (
        response.data &&
        typeof response.data === 'object' &&
        'data' in response.data &&
        'method' in response.data
      ) {
        response.data = unwrapSuccessEnvelope(response.data);
      }
      return response;
    },
    async (error: AxiosError) => {
      const responseData = error.response?.data;

      // 4xx envelope-shaped error → throw typed ApiError immediately, no retry.
      if (isErrorEnvelope(responseData)) {
        throwApiErrorFromEnvelope(responseData);
      }

      // Retry only on network errors or 5xx. 4xx are caller bugs — never retry.
      const status = error.response?.status;
      const isRetryable = !status || status >= 500;
      const cfg = error.config as (typeof error.config & RetryConfig) | undefined;

      if (cfg && isRetryable) {
        cfg.__retryCount = cfg.__retryCount ?? 0;
        if (cfg.__retryCount < maxRetries) {
          const delay =
            RETRY_BACKOFF_MS[cfg.__retryCount] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]!;
          cfg.__retryCount += 1;
          await sleep(delay);
          return client.request(cfg);
        }
      }

      throw error;
    },
  );

  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
