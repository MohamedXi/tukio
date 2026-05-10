'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApiClient } from '../providers/api-client-context.js';
import { ApiError } from '../types/api-error.js';

// Factorizes the boilerplate every typed query hook needs: read axios from
// context, call GET on the endpoint, return the typed response. Hooks pass:
//   - endpoint: builds the URL from params
//   - queryKey: factory from QueryKeys.<domain>.<op>(params)
//   - extraOptions (optional): pass through to useQuery
//
// Example:
//   export function useBookingDetail({ id }: { id: string }) {
//     return createQueryHook<{ id: string }, BookingResponseDto>(
//       (p) => `/v1/bookings/${p.id}`,
//       (p) => QueryKeys.booking.detail(p.id),
//     )({ id });
//   }
export function createQueryHook<TParams, TResponse>(
  endpoint: (params: TParams) => string,
  queryKey: (params: TParams) => readonly unknown[],
  options: { enabled?: (params: TParams) => boolean } = {},
) {
  return (params: TParams): UseQueryResult<TResponse, ApiError> => {
    const client = useApiClient();
    return useQuery<TResponse, ApiError>({
      queryKey: queryKey(params),
      queryFn: async () => {
        const response = await client.get<TResponse>(endpoint(params));
        return response.data;
      },
      enabled: options.enabled?.(params) ?? true,
    });
  };
}
