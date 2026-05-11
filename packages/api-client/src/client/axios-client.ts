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
          throwApiErrorFromEnvelope(responseData);
        }
        throw error;
      }

      // 4xx (or non-retryable status): convert to ApiError if envelope-shaped.
      if (isErrorEnvelope(responseData)) {
        throwApiErrorFromEnvelope(responseData);
      }
      throw error;
    },
  );

  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
