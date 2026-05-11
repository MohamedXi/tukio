import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTukioQueryClient, QueryProvider } from '../providers/query-provider.js';
import { ApiError } from '../types/api-error.js';

describe('createTukioQueryClient', () => {
  it('creates a QueryClient with Tukio defaults', () => {
    const client = createTukioQueryClient();
    expect(client).toBeInstanceOf(QueryClient);
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(60_000);
    expect(defaults.queries?.gcTime).toBe(5 * 60_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it('queries do NOT retry on 4xx ApiError', () => {
    const client = createTukioQueryClient();
    const retry = client.getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe('function');
    if (typeof retry !== 'function') return;
    const apiError = new ApiError('USER-NOT-FOUND-001', 404, 'Not found', 'x');
    expect(retry(0, apiError)).toBe(false);
  });

  it('queries retry up to 2x on 5xx ApiError', () => {
    const client = createTukioQueryClient();
    const retry = client.getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') {
      throw new Error('retry default should be a function');
    }
    const apiError = new ApiError('INTERNAL', 500, 'Server error', 'x');
    expect(retry(0, apiError)).toBe(true);
    expect(retry(1, apiError)).toBe(true);
    expect(retry(2, apiError)).toBe(false);
  });

  it('queries retry on non-ApiError up to 2x (network errors etc.)', () => {
    const client = createTukioQueryClient();
    const retry = client.getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') {
      throw new Error('retry default should be a function');
    }
    const networkError = new Error('Network down');
    expect(retry(0, networkError)).toBe(true);
    expect(retry(1, networkError)).toBe(true);
    expect(retry(2, networkError)).toBe(false);
  });

  it('renderHook with the client works (smoke test)', () => {
    const client = createTukioQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => 'ok', { wrapper });
    expect(result.current).toBe('ok');
  });

  it('mutations.onError logs structured 5xx ApiError without payload (PII safe)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = createTukioQueryClient();
    const onError = client.getDefaultOptions().mutations?.onError;
    expect(typeof onError).toBe('function');
    if (typeof onError !== 'function') return;

    onError(
      new ApiError('INTERNAL-001', 500, 'Internal', 'should-not-leak') as Error,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    expect(errSpy).toHaveBeenCalled();
    const callArgs = errSpy.mock.calls[0]!;
    // Logged object should contain tukioCode + correlationId, NOT detail.
    expect(JSON.stringify(callArgs)).toContain('INTERNAL-001');
    expect(JSON.stringify(callArgs)).not.toContain('should-not-leak');
    errSpy.mockRestore();
  });

  it('mutations.onError ignores 4xx ApiError (no log)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = createTukioQueryClient();
    const onError = client.getDefaultOptions().mutations?.onError;
    if (typeof onError !== 'function') return;
    onError(
      new ApiError('VAL-001', 422, 'Validation', 'x') as Error,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('mutations.onError ignores non-ApiError', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = createTukioQueryClient();
    const onError = client.getDefaultOptions().mutations?.onError;
    if (typeof onError !== 'function') return;
    onError(new Error('boom') as Error, undefined as never, undefined as never, undefined as never);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('<QueryProvider> mounts children with a fresh client', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryProvider>{children}</QueryProvider>
    );
    const { result } = renderHook(() => 'mounted', { wrapper });
    expect(result.current).toBe('mounted');
  });

  it('<QueryProvider> accepts a caller-supplied client', () => {
    const custom = createTukioQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryProvider client={custom}>{children}</QueryProvider>
    );
    const { result } = renderHook(() => 'mounted-custom', { wrapper });
    expect(result.current).toBe('mounted-custom');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
