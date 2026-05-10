import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTukioQueryClient } from '../providers/query-provider.js';
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
});
