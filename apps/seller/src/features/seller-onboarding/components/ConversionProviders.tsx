'use client';

import { useState, createContext, useContext, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, gcTime: GC_TIME_MS, retry: 1 },
      mutations: { retry: 0 },
    },
  });
}

const GatewayUrlContext = createContext<string>('http://localhost:4000');

export function useGatewayUrl(): string {
  return useContext(GatewayUrlContext);
}

interface ConversionProvidersProps {
  gatewayUrl: string;
  children: ReactNode;
}

export function ConversionProviders({ gatewayUrl, children }: ConversionProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <GatewayUrlContext.Provider value={gatewayUrl}>{children}</GatewayUrlContext.Provider>
    </QueryClientProvider>
  );
}
