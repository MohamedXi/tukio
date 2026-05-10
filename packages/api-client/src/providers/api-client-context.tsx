'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AxiosInstance } from 'axios';

const ApiClientContext = createContext<AxiosInstance | null>(null);

export interface ApiClientProviderProps {
  client: AxiosInstance;
  children: ReactNode;
}

// Provides the axios instance to every TanStack Query hook in the tree. Apps
// create a single instance via `createTukioApiClient(...)` and wire it here.
export function ApiClientProvider({ client, children }: ApiClientProviderProps) {
  // Wrap in useState to keep the instance stable across re-renders even if a
  // parent recomputes the client prop unnecessarily.
  const [stable] = useState(() => client);
  return <ApiClientContext.Provider value={stable}>{children}</ApiClientContext.Provider>;
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
