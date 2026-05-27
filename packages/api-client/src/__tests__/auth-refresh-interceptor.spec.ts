import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createTukioApiClient } from '../client/axios-client.js';
import { ApiError } from '../types/api-error.js';

function expiredEnvelope(code = 'AUTH-NOT-AUTHENTICATED-002') {
  return {
    method: 'GET',
    code: 401,
    error: { tukioCode: code, title: 'Not authenticated', detail: 'Access token expired' },
    meta: { correlationId: 'corr-1' },
  };
}

function successEnvelope(data: unknown) {
  return { method: 'GET', code: 200, data, meta: { correlationId: 'corr-1' } };
}

describe('axios 401 → refresh interceptor (Story 1.4d AC9)', () => {
  let client: ReturnType<typeof createTukioApiClient>;
  let mock: MockAdapter;
  let refreshAuth: Mock<() => Promise<boolean>>;

  beforeEach(() => {
    refreshAuth = vi.fn<() => Promise<boolean>>();
  });

  afterEach(() => {
    mock?.restore();
    vi.restoreAllMocks();
  });

  it('1. refreshes then retries the original request once on 401 AUTH-NOT-AUTHENTICATED-002', async () => {
    refreshAuth.mockResolvedValue(true);
    client = createTukioApiClient({ baseURL: 'http://gw.test', refreshAuth, maxRetries: 0 });
    mock = new MockAdapter(client);
    mock
      .onGet('/v1/me')
      .replyOnce(401, expiredEnvelope())
      .onGet('/v1/me')
      .replyOnce(200, successEnvelope({ id: 'u1' }));

    const res = await client.get('/v1/me');
    expect(refreshAuth).toHaveBeenCalledTimes(1);
    expect(res.data).toEqual({ id: 'u1' });
  });

  it('2. throws ApiError when refresh fails (returns false)', async () => {
    refreshAuth.mockResolvedValue(false);
    client = createTukioApiClient({ baseURL: 'http://gw.test', refreshAuth, maxRetries: 0 });
    mock = new MockAdapter(client);
    mock.onGet('/v1/me').reply(401, expiredEnvelope());

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(refreshAuth).toHaveBeenCalledTimes(1);
  });

  it('3. retries at most once (no infinite loop when retry also 401s)', async () => {
    refreshAuth.mockResolvedValue(true);
    client = createTukioApiClient({ baseURL: 'http://gw.test', refreshAuth, maxRetries: 0 });
    mock = new MockAdapter(client);
    mock.onGet('/v1/me').reply(401, expiredEnvelope());

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(refreshAuth).toHaveBeenCalledTimes(1); // not called again on the retry's 401
  });

  it('4. does NOT trigger refresh when no refreshAuth configured', async () => {
    client = createTukioApiClient({ baseURL: 'http://gw.test', maxRetries: 0 });
    mock = new MockAdapter(client);
    mock.onGet('/v1/me').reply(401, expiredEnvelope());

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
  });

  it('5. does NOT trigger refresh on a 401 with a non-trigger tukioCode', async () => {
    refreshAuth.mockResolvedValue(true);
    client = createTukioApiClient({ baseURL: 'http://gw.test', refreshAuth, maxRetries: 0 });
    mock = new MockAdapter(client);
    mock.onGet('/v1/me').reply(401, expiredEnvelope('AUTH-FORBIDDEN-001'));

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(refreshAuth).not.toHaveBeenCalled();
  });

  it('6. honours a custom refreshTriggerCodes list', async () => {
    refreshAuth.mockResolvedValue(true);
    client = createTukioApiClient({
      baseURL: 'http://gw.test',
      refreshAuth,
      refreshTriggerCodes: ['CUSTOM-EXPIRED-009'],
      maxRetries: 0,
    });
    mock = new MockAdapter(client);
    mock
      .onGet('/v1/me')
      .replyOnce(401, expiredEnvelope('CUSTOM-EXPIRED-009'))
      .onGet('/v1/me')
      .replyOnce(200, successEnvelope({ id: 'u2' }));

    const res = await client.get('/v1/me');
    expect(refreshAuth).toHaveBeenCalledTimes(1);
    expect(res.data).toEqual({ id: 'u2' });
  });

  it('7. continues to throw when refreshAuth itself rejects', async () => {
    refreshAuth.mockRejectedValue(new Error('refresh boom'));
    client = createTukioApiClient({ baseURL: 'http://gw.test', refreshAuth, maxRetries: 0 });
    mock = new MockAdapter(client);
    mock.onGet('/v1/me').reply(401, expiredEnvelope());

    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(refreshAuth).toHaveBeenCalledTimes(1);
  });

  it('8. leaves non-401 errors (404) untouched by the refresh path', async () => {
    refreshAuth.mockResolvedValue(true);
    client = createTukioApiClient({ baseURL: 'http://gw.test', refreshAuth, maxRetries: 0 });
    mock = new MockAdapter(client);
    mock.onGet('/v1/missing').reply(404, {
      method: 'GET',
      code: 404,
      error: { tukioCode: 'NOT-FOUND-001', title: 'Not found', detail: 'x' },
      meta: {},
    });

    await expect(client.get('/v1/missing')).rejects.toBeInstanceOf(ApiError);
    expect(refreshAuth).not.toHaveBeenCalled();
  });
});
