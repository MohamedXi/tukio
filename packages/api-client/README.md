# @tukio/api-client

Typed HTTP client wrapping `gateway-api` endpoints with envelope-handler ADR-014 + TanStack Query 5.x hooks.

## What's inside

- **`createTukioApiClient(config)`** — axios factory with built-in interceptors:
  - automatic envelope unwrap on 2xx (`response.data` is the DTO directly)
  - typed `ApiError` thrown on 4xx/5xx
  - CSRF header injection on mutations (POST/PUT/PATCH/DELETE)
  - correlation ID propagated cross-tab via `sessionStorage`
  - exponential retry on network errors / 5xx (NFR45)
- **`<QueryProvider>`** — TanStack Query 5.x wrapper with Tukio defaults (1 min staleTime, 5 min gcTime, no retry on 4xx, 2 retries on 5xx).
- **`<ApiClientProvider>`** — exposes the axios instance to every hook in the tree.
- **7 hook templates** (1 per domain): `useSearchListings`, `useBookingDetail`, `useCheckout`, `useConversations`, `useReviews`, `useProfile`, `useVerifications`. Stories Epic 1+ extend.
- **`QueryKeys` factory** — type-safe query keys for invalidation (`QueryKeys.booking.detail(id)`).

## Usage

```tsx
// apps/customer/src/app/[locale]/layout.tsx
'use client';
import { createTukioApiClient, ApiClientProvider, QueryProvider } from '@tukio/api-client';
import { cookieManager } from '@tukio/auth-client/cookies';

const apiClient = createTukioApiClient({
  baseURL: process.env.NEXT_PUBLIC_GATEWAY_API_URL!,
  getCsrfToken: () => cookieManager.getCsrfToken(),
});

export default function RootLayout({ children }) {
  return (
    <QueryProvider>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryProvider>
  );
}
```

```tsx
// apps/customer/src/app/[locale]/account/booking/[id]/page.tsx
'use client';
import { useBookingDetail } from '@tukio/api-client/hooks/booking/use-booking-detail';

export default function BookingPage({ params }: { params: { id: string } }) {
  const { data, isPending, error } = useBookingDetail({ id: params.id });
  if (isPending) return <Spinner />;
  if (error?.isNotFound()) return <NotFound />;
  if (error) throw error;
  return <BookingCard booking={data} />;
}
```

## Subpath imports (anti-barrel)

Always import via subpath, never the root barrel:

```ts
// ✅ tree-shake friendly
import { useBookingDetail } from '@tukio/api-client/hooks/booking/use-booking-detail';

// ❌ pulls every hook + provider into bundle
import { useBookingDetail } from '@tukio/api-client';
```

## Error handling

```ts
import { ApiError } from '@tukio/api-client';

try {
  await mutation.mutateAsync({ ... });
} catch (e) {
  if (e instanceof ApiError) {
    if (e.isValidationError()) showZodIssues(e.issues);
    else if (e.isUnauthorized()) redirectToLogin();
    else if (e.isServerError()) showGenericError(e.correlationId);
  }
}
```

## See also

- ADR-014 envelope contract: `packages/contracts/src/envelope/`
- Story 0.8 `cookieManager` for CSRF + session marker
- Story 0.10 `gateway-api` for cookie-set on login
