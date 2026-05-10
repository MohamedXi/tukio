'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { BookingResponseDto } from '@tukio/contracts/dtos/booking';
import { useApiClient } from '../../providers/api-client-context.js';
import { QueryKeys } from '../../types/query-keys.js';
import { ApiError } from '../../types/api-error.js';

export function useBookingDetail({
  id,
}: {
  id: string;
}): UseQueryResult<BookingResponseDto, ApiError> {
  const client = useApiClient();
  return useQuery<BookingResponseDto, ApiError>({
    queryKey: QueryKeys.booking.detail(id),
    queryFn: async () => {
      const response = await client.get<BookingResponseDto>(`/v1/bookings/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}
