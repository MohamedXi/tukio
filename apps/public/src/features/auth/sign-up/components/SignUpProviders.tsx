'use client';

import { useState, type ReactNode } from 'react';
import { QueryProvider, createTukioQueryClient } from '@tukio/api-client/providers';
import { ApiClientProvider } from '@tukio/api-client/providers/api-client-context';
import { createTukioApiClient } from '@tukio/api-client/client';

interface SignUpProvidersProps {
  gatewayUrl: string;
  children: ReactNode;
}

/**
 * Client-only wrapper that instantiates the TanStack Query + axios clients.
 * The sign-up Server Component cannot call `createTukioQueryClient` directly
 * because it lives in a `'use client'` module — Next.js refuses to invoke
 * client functions from the server boundary. `useState(() => …)` ensures the
 * clients survive re-renders within this provider mount.
 */
export function SignUpProviders({ gatewayUrl, children }: SignUpProvidersProps) {
  const [queryClient] = useState(() => createTukioQueryClient());
  const [apiClient] = useState(() => createTukioApiClient({ baseURL: gatewayUrl }));
  return (
    <QueryProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryProvider>
  );
}
