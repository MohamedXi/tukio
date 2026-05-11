'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApiClient } from '../../providers/api-client-context.js';
import { QueryKeys, type SearchParams } from '../../types/query-keys.js';
import { ApiError } from '../../types/api-error.js';

// TODO: replace with @tukio/contracts/dtos/catalog ListingResponseDto when
// Story 3.2 (catalog-svc Pretre) lands.
export interface ListingSearchResultDto {
  id: string;
  categorySlug: string;
  title: string;
  slug: string;
  basePrice: { amount: number; currency: 'EUR' };
  thumbnailUrl?: string;
  proName: string;
  proRating?: number;
}

export interface SearchListingsResponse {
  results: ListingSearchResultDto[];
  pagination?: { nextCursor?: string };
}

export function useSearchListings(
  params: SearchParams,
): UseQueryResult<SearchListingsResponse, ApiError> {
  const client = useApiClient();
  return useQuery<SearchListingsResponse, ApiError>({
    queryKey: QueryKeys.catalog.listings.search(params),
    queryFn: async () => {
      const response = await client.get<SearchListingsResponse>('/v1/listings/search', {
        params,
      });
      return response.data;
    },
    enabled: Boolean(params.q || params.where),
  });
}
