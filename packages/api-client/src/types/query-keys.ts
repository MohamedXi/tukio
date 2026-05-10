// Type-safe TanStack Query key factory. Hooks reference QueryKeys.<domain>.…
// rather than hand-writing tuples — keeps invalidation calls type-checked
// and refactor-safe.
//
// Pattern: each domain exposes `all` (root key) + a function per operation
// that returns the readonly tuple. `as const` preserves literal types so
// queryClient.invalidateQueries({ queryKey: QueryKeys.booking.all }) works.

export interface SearchParams {
  q?: string;
  where?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface BookingFilter {
  status?: string;
  cursor?: string;
}

export interface VerificationFilter {
  status?: 'pending' | 'verified' | 'rejected';
}

export const QueryKeys = {
  catalog: {
    listings: {
      all: ['listings'] as const,
      search: (params: SearchParams) => ['listings', 'search', params] as const,
      detail: (id: string) => ['listings', id] as const,
    },
    categories: {
      all: ['categories'] as const,
      tree: ['categories', 'tree'] as const,
    },
  },
  booking: {
    all: ['bookings'] as const,
    list: (filter: BookingFilter) => ['bookings', 'list', filter] as const,
    detail: (id: string) => ['bookings', id] as const,
  },
  payment: {
    all: ['payments'] as const,
    invoices: ['payments', 'invoices'] as const,
    payouts: ['payments', 'payouts'] as const,
  },
  messaging: {
    all: ['conversations'] as const,
    detail: (id: string) => ['conversations', id] as const,
  },
  review: {
    all: ['reviews'] as const,
    forListing: (listingId: string) => ['reviews', 'listing', listingId] as const,
  },
  identity: {
    profile: ['profile'] as const,
    notificationPreferences: ['profile', 'notification-preferences'] as const,
  },
  admin: {
    verifications: (filter: VerificationFilter) => ['admin', 'verifications', filter] as const,
    auditTrail: (cursor?: string) => ['admin', 'audit-trail', cursor] as const,
    disputes: ['admin', 'disputes'] as const,
  },
} as const;
