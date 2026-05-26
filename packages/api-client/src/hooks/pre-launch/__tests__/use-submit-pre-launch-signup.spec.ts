import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useSubmitPreLaunchSignup } from '../use-submit-pre-launch-signup.js';
import { PreLaunchApiError } from '../map-pre-launch-error.js';

const INPUT = {
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@example.com',
  role: 'organisateur' as const,
  rgpdOptIn: true as const,
  locale: 'fr' as const,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function mockFetch(status: number, body: unknown, headers?: HeadersInit) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    }),
  );
}

describe('useSubmitPreLaunchSignup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls /api/pre-launch/signup and returns result on success', async () => {
    mockFetch(200, { ok: true, position: 248 });
    const { result } = renderHook(() => useSubmitPreLaunchSignup(), {
      wrapper: makeWrapper(),
    });
    let successData: { position: number } | undefined;
    await new Promise<void>((resolve) => {
      result.current.mutate(INPUT, {
        onSuccess: (data) => {
          successData = data;
          resolve();
        },
      });
    });
    expect(successData?.position).toBe(248);
  });

  it('returns alreadySubscribed when duplicate', async () => {
    mockFetch(200, { ok: true, position: 200, alreadySubscribed: true });
    const { result } = renderHook(() => useSubmitPreLaunchSignup(), {
      wrapper: makeWrapper(),
    });
    let successData: { alreadySubscribed?: boolean } | undefined;
    await new Promise<void>((resolve) => {
      result.current.mutate(INPUT, {
        onSuccess: (data) => {
          successData = data;
          resolve();
        },
      });
    });
    expect(successData?.alreadySubscribed).toBe(true);
  });

  it('throws PreLaunchApiError on 422 validation error', async () => {
    mockFetch(422, { ok: false, error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001' } });
    const { result } = renderHook(() => useSubmitPreLaunchSignup(), {
      wrapper: makeWrapper(),
    });
    let thrownError: unknown;
    await new Promise<void>((resolve) => {
      result.current.mutate(INPUT, {
        onError: (err) => {
          thrownError = err;
          resolve();
        },
      });
    });
    expect(thrownError).toBeInstanceOf(PreLaunchApiError);
    expect((thrownError as PreLaunchApiError).status).toBe(422);
  });

  it('throws PreLaunchApiError with retryAfterSeconds on 429', async () => {
    mockFetch(
      429,
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-RATE-LIMITED-001' } },
      {
        'retry-after': '45',
      },
    );
    const { result } = renderHook(() => useSubmitPreLaunchSignup(), {
      wrapper: makeWrapper(),
    });
    let thrownError: unknown;
    await new Promise<void>((resolve) => {
      result.current.mutate(INPUT, {
        onError: (err) => {
          thrownError = err;
          resolve();
        },
      });
    });
    expect(thrownError).toBeInstanceOf(PreLaunchApiError);
    expect((thrownError as PreLaunchApiError).status).toBe(429);
    expect((thrownError as PreLaunchApiError).retryAfterSeconds).toBe(45);
  });

  it('throws PreLaunchApiError on 502 external error', async () => {
    mockFetch(502, { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } });
    const { result } = renderHook(() => useSubmitPreLaunchSignup(), {
      wrapper: makeWrapper(),
    });
    let thrownError: unknown;
    await new Promise<void>((resolve) => {
      result.current.mutate(INPUT, {
        onError: (err) => {
          thrownError = err;
          resolve();
        },
      });
    });
    expect(thrownError).toBeInstanceOf(PreLaunchApiError);
    expect((thrownError as PreLaunchApiError).status).toBe(502);
  });

  it('re-throws TypeError on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useSubmitPreLaunchSignup(), {
      wrapper: makeWrapper(),
    });
    let thrownError: unknown;
    await new Promise<void>((resolve) => {
      result.current.mutate(INPUT, {
        onError: (err) => {
          thrownError = err;
          resolve();
        },
      });
    });
    expect(thrownError).toBeInstanceOf(TypeError);
  });

  it('isPending becomes true during mutation', async () => {
    let resolveFetch: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      new Promise<Response>((r) => {
        resolveFetch = r;
      }),
    );
    const { result } = renderHook(() => useSubmitPreLaunchSignup(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate(INPUT);
    await waitFor(() => expect(result.current.isPending).toBe(true));
    resolveFetch!(new Response(JSON.stringify({ ok: true, position: 1 }), { status: 200 }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
