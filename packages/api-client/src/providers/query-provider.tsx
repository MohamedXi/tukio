'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../types/api-error.js';

const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;
const QUERY_RETRY_LIMIT = 2;

// Tukio-default QueryClient defaults.
//
// Decisions baked in:
// - 1 min staleTime → background refetches when data is older + tab focus,
//   keeps UX snappy without refetching every render.
// - 5 min gcTime (TanStack Query 5.x renamed from cacheTime) → cached
//   results survive route changes within a session.
// - 4xx errors are NEVER retried (caller bug, not transient).
// - 5xx errors retry up to 2 times (network blip / transient gateway error).
// - mutations never retry (idempotence not guaranteed at gateway).
// - mutations.onError wires a placeholder for Story 0.12 Sentry integration.
function createTukioQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.httpStatus < 500) return false;
          return failureCount < QUERY_RETRY_LIMIT;
        },
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
        onError: (error) => {
          // Story 0.12 will wire Sentry here. For now, just structured logs
          // (without payloads — PII risk).
          if (error instanceof ApiError && error.isServerError()) {
            console.error('[ApiError 5xx]', {
              tukioCode: error.tukioCode,
              correlationId: error.correlationId,
            });
          }
        },
      },
    },
  });
}

export interface QueryProviderProps {
  children: ReactNode;
  // Optional override — useful for tests that want a fresh client per test.
  client?: QueryClient;
}

export function QueryProvider({ children, client }: QueryProviderProps) {
  // useState ensures the client survives re-renders (cf. TanStack Query SSR
  // recommendations). One client per provider mount.
  const [queryClient] = useState(() => client ?? createTukioQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Re-export the factory for tests/apps that want a bare client without the
// provider wrapper (e.g. SSR pre-fetch).
export { createTukioQueryClient };
