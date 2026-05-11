'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { AxiosInstance } from 'axios';

const ApiClientContext = createContext<AxiosInstance | null>(null);

export interface ApiClientProviderProps {
  client: AxiosInstance;
  children: ReactNode;
}

// Provides the axios instance to every TanStack Query hook in the tree. Apps
// create a single instance via `createTukioApiClient(...)` and wire it here.
//
// The `client` prop is passed straight through (no useState lock). It is the
// caller's responsibility to memoize the instance with `useMemo` or a
// module-level const so it stays stable across re-renders — but legitimate
// swaps (auth refresh changing baseURL, locale-aware getCsrfToken closures
// rebuilding) propagate immediately to every hook.
export function ApiClientProvider({ client, children }: ApiClientProviderProps) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

// Hook used by every TanStack Query hook in @tukio/api-client/hooks/*.
// Throws if no <ApiClientProvider> wrapped the tree — fail-loud so the
// developer sees the misconfiguration immediately instead of silent 401s.
export function useApiClient(): AxiosInstance {
  const client = useContext(ApiClientContext);
  if (!client) {
    throw new Error(
      '[useApiClient] No ApiClientProvider in tree. Wrap your app in <ApiClientProvider client={createTukioApiClient(...)}>.',
    );
  }
  return client;
}
