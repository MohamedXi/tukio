'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApiClient } from '../../providers/api-client-context.js';
import { QueryKeys } from '../../types/query-keys.js';
import { ApiError } from '../../types/api-error.js';

// TODO: replace with @tukio/contracts/dtos/review ReviewResponseDto when
// Story 5.5 (review-svc Pretre) lands.
export interface ReviewResponseDto {
  id: string;
  authorId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export function useReviews({
  listingId,
}: {
  listingId: string;
}): UseQueryResult<ReviewResponseDto[], ApiError> {
  const client = useApiClient();
  return useQuery<ReviewResponseDto[], ApiError>({
    queryKey: QueryKeys.review.forListing(listingId),
    queryFn: async () => {
      const response = await client.get<ReviewResponseDto[]>(`/v1/listings/${listingId}/reviews`);
      return response.data;
    },
    enabled: Boolean(listingId),
  });
}
