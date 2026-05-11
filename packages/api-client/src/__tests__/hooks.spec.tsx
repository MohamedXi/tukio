import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { createTukioApiClient } from '../client/axios-client.js';
import { ApiClientProvider } from '../providers/api-client-context.js';
import { useBookingDetail } from '../hooks/booking/use-booking-detail.js';
import { useProfile } from '../hooks/identity/use-profile.js';
import { useSearchListings } from '../hooks/catalog/use-search-listings.js';
import { useCheckout } from '../hooks/payment/use-checkout.js';
import { useConversations } from '../hooks/messaging/use-conversations.js';
import { useReviews } from '../hooks/review/use-reviews.js';
import { useVerifications } from '../hooks/admin/use-verifications.js';
import type { ReactNode } from 'react';

function setupClient() {
  const axiosClient = createTukioApiClient({ baseURL: 'http://api.test', maxRetries: 0 });
  const mock = new MockAdapter(axiosClient);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={axiosClient}>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
  return { axiosClient, mock, queryClient, wrapper };
}

const successEnvelope = (data: unknown) => ({
  method: 'GET',
  code: 200,
  data,
  meta: { timestamp: '2026-05-10T10:00:00Z', correlationId: 'c', locale: 'fr' },
});

beforeEach(() => {
  vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-1111-1111-111111111111' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useBookingDetail', () => {
  it('fetches GET /v1/bookings/:id and returns BookingResponseDto', async () => {
    const { mock, wrapper } = setupClient();
    mock.onGet('/v1/bookings/booking-1').reply(
      200,
      successEnvelope({
        id: 'booking-1',
        status: 'pending_pro_acceptance',
        customerId: 'c1',
        providerId: 'p1',
        listingId: 'l1',
        requestedDate: '2026-06-15',
        totalAmount: { amount: 80000, currency: 'EUR' },
        createdAt: '2026-05-10T10:00:00Z',
      }),
    );
    const { result } = renderHook(() => useBookingDetail({ id: 'booking-1' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('booking-1');
  });

  it('does not fire when id is empty', () => {
    const { wrapper } = setupClient();
    const { result } = renderHook(() => useBookingDetail({ id: '' }), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useProfile', () => {
  it('fetches GET /v1/users/me', async () => {
    const { mock, wrapper } = setupClient();
    mock.onGet('/v1/users/me').reply(
      200,
      successEnvelope({
        id: '11111111-1111-1111-1111-111111111111',
        keycloakUserId: '22222222-2222-2222-2222-222222222222',
        email: 'jane@tukio.one',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'client',
        locale: 'fr',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      }),
    );
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.email).toBe('jane@tukio.one');
  });
});

describe('useSearchListings', () => {
  it('fetches GET /v1/listings/search with params', async () => {
    const { mock, wrapper } = setupClient();
    mock.onGet('/v1/listings/search').reply(
      200,
      successEnvelope({
        results: [
          {
            id: 'l1',
            categorySlug: 'photographer',
            title: 'Portrait',
            slug: 'portrait',
            basePrice: { amount: 80000, currency: 'EUR' },
            proName: 'Jane',
          },
        ],
      }),
    );
    const { result } = renderHook(() => useSearchListings({ q: 'portrait', where: 'Nantes' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.results).toHaveLength(1);
  });

  it('does not fire when no q nor where', () => {
    const { wrapper } = setupClient();
    const { result } = renderHook(() => useSearchListings({}), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCheckout', () => {
  it('mutates POST /v1/payments/checkout', async () => {
    const { mock, wrapper } = setupClient();
    mock.onPost('/v1/payments/checkout').reply(
      200,
      successEnvelope({
        paymentIntentId: 'pi_1',
        clientSecret: 'pi_1_secret',
        amount: { amount: 80000, currency: 'EUR' },
        status: 'requires_action',
      }),
    );
    const { result } = renderHook(() => useCheckout(), { wrapper });
    result.current.mutate({
      bookingId: 'b1',
      amountInCents: 80000,
      currency: 'EUR',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.paymentIntentId).toBe('pi_1');
  });
});

describe('useConversations', () => {
  it('fetches GET /v1/conversations', async () => {
    const { mock, wrapper } = setupClient();
    mock.onGet('/v1/conversations').reply(
      200,
      successEnvelope([
        {
          id: 'conv-1',
          participantId: 'p1',
          lastMessageAt: '2026-05-10T10:00:00Z',
          unreadCount: 2,
        },
      ]),
    );
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useReviews', () => {
  it('fetches GET /v1/listings/:listingId/reviews', async () => {
    const { mock, wrapper } = setupClient();
    mock.onGet('/v1/listings/listing-1/reviews').reply(
      200,
      successEnvelope([
        {
          id: 'review-1',
          authorId: 'u1',
          rating: 5,
          comment: 'Great',
          createdAt: '2026-05-10T10:00:00Z',
        },
      ]),
    );
    const { result } = renderHook(() => useReviews({ listingId: 'listing-1' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.rating).toBe(5);
  });
});

describe('useVerifications', () => {
  it('fetches GET /v1/admin/verifications', async () => {
    const { mock, wrapper } = setupClient();
    mock.onGet('/v1/admin/verifications').reply(
      200,
      successEnvelope([
        {
          id: 'v1',
          proId: 'pro-1',
          status: 'pending',
          submittedAt: '2026-05-10T10:00:00Z',
        },
      ]),
    );
    const { result } = renderHook(() => useVerifications({ status: 'pending' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useApiClient outside provider', () => {
  it('throws a clear error when no provider in tree', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    expect(() => renderHook(() => useProfile(), { wrapper })).toThrow(/ApiClientProvider/);
  });
});
