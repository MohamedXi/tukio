'use client';

import { useState, type ReactNode } from 'react';
import { QueryProvider, createTukioQueryClient } from '@tukio/api-client/providers';
import { ApiClientProvider } from '@tukio/api-client/providers/api-client-context';
import { createTukioApiClient } from '@tukio/api-client/client';

interface ConversionProvidersProps {
  gatewayUrl: string;
  children: ReactNode;
}

export function ConversionProviders({ gatewayUrl, children }: ConversionProvidersProps) {
  const [queryClient] = useState(() => createTukioQueryClient());
  const [apiClient] = useState(() => createTukioApiClient({ baseURL: gatewayUrl }));
  return (
    <QueryProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryProvider>
  );
}
