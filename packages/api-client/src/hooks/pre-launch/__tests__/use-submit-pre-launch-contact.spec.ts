import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useSubmitPreLaunchContact } from '../use-submit-pre-launch-contact.js';
import { PreLaunchApiError } from '../map-pre-launch-error.js';

const INPUT = {
  firstName: 'Jean',
  lastName: 'Martin',
  email: 'jean@example.com',
  category: 'organisateur' as const,
  subject: 'general' as const,
  message: 'Bonjour, ceci est un message de test.',
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

describe('useSubmitPreLaunchContact', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls /api/pre-launch/contact and returns ok:true on success', async () => {
    mockFetch(200, { ok: true });
    const { result } = renderHook(() => useSubmitPreLaunchContact(), {
      wrapper: makeWrapper(),
    });
    let successData: { ok: boolean } | undefined;
    await new Promise<void>((resolve) => {
      result.current.mutate(INPUT, {
        onSuccess: (data) => {
          successData = data;
          resolve();
        },
      });
    });
    expect(successData?.ok).toBe(true);
  });

  it('throws PreLaunchApiError on 422 validation error', async () => {
    mockFetch(422, { ok: false, error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001' } });
    const { result } = renderHook(() => useSubmitPreLaunchContact(), {
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
        'retry-after': '30',
      },
    );
    const { result } = renderHook(() => useSubmitPreLaunchContact(), {
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
    expect((thrownError as PreLaunchApiError).retryAfterSeconds).toBe(30);
  });

  it('throws PreLaunchApiError on 502', async () => {
    mockFetch(502, { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } });
    const { result } = renderHook(() => useSubmitPreLaunchContact(), {
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
    const { result } = renderHook(() => useSubmitPreLaunchContact(), {
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
    const { result } = renderHook(() => useSubmitPreLaunchContact(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate(INPUT);
    await waitFor(() => expect(result.current.isPending).toBe(true));
    resolveFetch!(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
