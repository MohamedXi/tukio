import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { applyCorrelationIdInterceptor } from '../client/correlation-id-interceptor.js';
import { applyCsrfInterceptor } from '../client/csrf-interceptor.js';

describe('applyCorrelationIdInterceptor — defensive paths', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses default getCorrelationId when not supplied — persists to sessionStorage', async () => {
    const client = axios.create();
    const mock = new MockAdapter(client);
    let captured: string | undefined;
    mock.onGet('/x').reply((cfg) => {
      captured = cfg.headers?.['X-Tukio-Correlation-Id'] as string | undefined;
      return [200, {}];
    });

    applyCorrelationIdInterceptor(client);
    await client.get('/x');
    expect(captured).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('falls back to Math.random UUID when crypto.randomUUID throws', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new Error('insecure context');
      },
    });
    const client = axios.create();
    const mock = new MockAdapter(client);
    let captured: string | undefined;
    mock.onGet('/x').reply((cfg) => {
      captured = cfg.headers?.['X-Tukio-Correlation-Id'] as string | undefined;
      return [200, {}];
    });

    applyCorrelationIdInterceptor(client);
    await client.get('/x');
    expect(captured).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('proceeds without persist when sessionStorage.setItem throws (quota)', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }),
      removeItem: vi.fn(),
    });

    const client = axios.create();
    const mock = new MockAdapter(client);
    let captured: string | undefined;
    mock.onGet('/x').reply((cfg) => {
      captured = cfg.headers?.['X-Tukio-Correlation-Id'] as string | undefined;
      return [200, {}];
    });

    applyCorrelationIdInterceptor(client);
    await expect(client.get('/x')).resolves.toBeDefined();
    expect(captured).toBeTruthy();
  });

  it('regenerates when sessionStorage holds a non-UUID value', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => 'not-a-uuid'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const client = axios.create();
    const mock = new MockAdapter(client);
    let captured: string | undefined;
    mock.onGet('/x').reply((cfg) => {
      captured = cfg.headers?.['X-Tukio-Correlation-Id'] as string | undefined;
      return [200, {}];
    });

    applyCorrelationIdInterceptor(client);
    await client.get('/x');
    expect(captured).not.toBe('not-a-uuid');
    expect(captured).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses a valid UUID stored in sessionStorage', async () => {
    const stored = '11111111-1111-4111-a111-111111111111';
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => stored),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const client = axios.create();
    const mock = new MockAdapter(client);
    let captured: string | undefined;
    mock.onGet('/x').reply((cfg) => {
      captured = cfg.headers?.['X-Tukio-Correlation-Id'] as string | undefined;
      return [200, {}];
    });

    applyCorrelationIdInterceptor(client);
    await client.get('/x');
    expect(captured).toBe(stored);
  });

  it('falls back to single-call UUID when sessionStorage is absent (SSR)', async () => {
    vi.stubGlobal('sessionStorage', undefined);

    const client = axios.create();
    const mock = new MockAdapter(client);
    let captured: string | undefined;
    mock.onGet('/x').reply((cfg) => {
      captured = cfg.headers?.['X-Tukio-Correlation-Id'] as string | undefined;
      return [200, {}];
    });

    applyCorrelationIdInterceptor(client);
    await client.get('/x');
    expect(captured).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('applyCsrfInterceptor', () => {
  it('warns when mutation sent without CSRF token', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = axios.create();
    const mock = new MockAdapter(client);
    mock.onPost('/r').reply(200, {});

    applyCsrfInterceptor(client, () => null);
    await client.post('/r', {});
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]![0]).toMatch(/CSRF/);
    warnSpy.mockRestore();
  });

  it('does NOT warn on GET requests without token', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = axios.create();
    const mock = new MockAdapter(client);
    mock.onGet('/r').reply(200, {});

    applyCsrfInterceptor(client, () => null);
    await client.get('/r');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles uppercase method strings', async () => {
    const client = axios.create();
    const mock = new MockAdapter(client);
    let captured: string | undefined;
    mock.onPost('/r').reply((cfg) => {
      captured = cfg.headers?.['X-CSRF-Token'] as string | undefined;
      return [200, {}];
    });
    applyCsrfInterceptor(client, () => 'token-abc');
    // axios normalises but call with explicit uppercase config.
    await client.request({ method: 'POST', url: '/r', data: {} });
    expect(captured).toBe('token-abc');
  });
});
