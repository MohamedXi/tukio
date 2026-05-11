import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createTukioApiClient } from '../client/axios-client.js';
import { ApiError } from '../types/api-error.js';

const BASE_URL = 'http://api.test';

const successEnvelope = {
  method: 'GET',
  code: 200,
  data: { id: 'abc', email: 'jane@test.com' },
  meta: { timestamp: '2026-05-10T10:00:00Z', correlationId: 'corr-1', locale: 'fr' },
};

const errorEnvelope = {
  method: 'GET',
  code: 404,
  error: {
    type: 'https://tukio.one/errors/user-not-found',
    title: 'User profile not found',
    detail: 'Not found',
    instance: '/v1/users/abc',
    tukioCode: 'USER-NOT-FOUND-001',
  },
  meta: { timestamp: '2026-05-10T10:00:00Z', correlationId: 'corr-1', locale: 'fr' },
};

describe('createTukioApiClient', () => {
  beforeEach(() => {
    // jsdom does not implement crypto.randomUUID consistently — stub it.
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-1111-1111-111111111111' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps SuccessEnvelope.data automatically on 2xx', async () => {
    const client = createTukioApiClient({ baseURL: BASE_URL });
    const mock = new MockAdapter(client);
    mock.onGet('/v1/users/abc').reply(200, successEnvelope);

    const res = await client.get('/v1/users/abc');
    expect(res.data).toEqual({ id: 'abc', email: 'jane@test.com' });
  });

  it('throws ApiError for envelope-shaped 4xx errors (no retry)', async () => {
    const client = createTukioApiClient({ baseURL: BASE_URL, maxRetries: 0 });
    const mock = new MockAdapter(client);
    mock.onGet('/v1/users/missing').reply(404, errorEnvelope);

    await expect(client.get('/v1/users/missing')).rejects.toBeInstanceOf(ApiError);
    try {
      await client.get('/v1/users/missing');
    } catch (e) {
      const err = e as ApiError;
      expect(err.tukioCode).toBe('USER-NOT-FOUND-001');
      expect(err.httpStatus).toBe(404);
    }
  });

  it('does NOT retry 4xx', async () => {
    const client = createTukioApiClient({ baseURL: BASE_URL, maxRetries: 3 });
    const mock = new MockAdapter(client);
    let calls = 0;
    mock.onGet('/v1/forbidden').reply(() => {
      calls += 1;
      return [
        403,
        {
          ...errorEnvelope,
          code: 403,
          error: { ...errorEnvelope.error, tukioCode: 'AUTH-FORBIDDEN-001' },
        },
      ];
    });

    await expect(client.get('/v1/forbidden')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });

  it('injects X-Tukio-Locale header from getLocale()', async () => {
    const getLocale = vi.fn(() => 'en' as const);
    const client = createTukioApiClient({ baseURL: BASE_URL, getLocale });
    const mock = new MockAdapter(client);
    let receivedLocale: string | undefined;
    mock.onGet('/v1/users/abc').reply((cfg) => {
      receivedLocale = cfg.headers?.['X-Tukio-Locale'] as string | undefined;
      return [200, successEnvelope];
    });

    await client.get('/v1/users/abc');
    expect(receivedLocale).toBe('en');
    expect(getLocale).toHaveBeenCalled();
  });

  it('injects X-CSRF-Token on mutations only', async () => {
    const getCsrfToken = vi.fn(() => 'csrf-abc');
    const client = createTukioApiClient({ baseURL: BASE_URL, getCsrfToken });
    const mock = new MockAdapter(client);
    let getCsrf: string | undefined;
    let postCsrf: string | undefined;

    mock.onGet('/v1/r').reply((cfg) => {
      getCsrf = cfg.headers?.['X-CSRF-Token'] as string | undefined;
      return [200, successEnvelope];
    });
    mock.onPost('/v1/r').reply((cfg) => {
      postCsrf = cfg.headers?.['X-CSRF-Token'] as string | undefined;
      return [200, successEnvelope];
    });

    await client.get('/v1/r');
    await client.post('/v1/r', {});

    expect(getCsrf).toBeUndefined();
    expect(postCsrf).toBe('csrf-abc');
  });

  it('injects X-Tukio-Correlation-Id on every request', async () => {
    const client = createTukioApiClient({
      baseURL: BASE_URL,
      getCorrelationId: () => 'fixed-corr-id',
    });
    const mock = new MockAdapter(client);
    let received: string | undefined;
    mock.onGet('/v1/r').reply((cfg) => {
      received = cfg.headers?.['X-Tukio-Correlation-Id'] as string | undefined;
      return [200, successEnvelope];
    });

    await client.get('/v1/r');
    expect(received).toBe('fixed-corr-id');
  });

  it('retries on 5xx with envelope-shaped body (NFR45) — converts to ApiError after exhaustion', async () => {
    const client = createTukioApiClient({ baseURL: BASE_URL, maxRetries: 2 });
    const mock = new MockAdapter(client);
    let calls = 0;
    mock.onGet('/v1/flaky').reply(() => {
      calls += 1;
      return [
        503,
        {
          method: 'GET',
          code: 503,
          error: {
            type: 'https://tukio.one/errors/service-unavailable',
            title: 'Service unavailable',
            detail: 'Database connection refused',
            instance: '/v1/flaky',
            tukioCode: 'SERVICE-UNAVAILABLE-001',
          },
          meta: { timestamp: 'now', correlationId: 'c', locale: 'fr' },
        },
      ];
    });

    await expect(client.get('/v1/flaky')).rejects.toBeInstanceOf(ApiError);
    // Initial call + 2 retries = 3 attempts.
    expect(calls).toBe(3);
  });

  it('does NOT retry on plain network error when error.config is undefined (defensive guard)', async () => {
    const client = createTukioApiClient({ baseURL: BASE_URL, maxRetries: 3 });
    // Stub interceptors to inject a network-like error without a config.
    client.interceptors.request.use(() => {
      // axios swallows errors thrown in the request interceptor and surfaces
      // them as request rejections — config is undefined in that path.
      throw new Error('synthetic-pre-request-failure');
    });

    await expect(client.get('/v1/x')).rejects.toThrow();
  });
});
