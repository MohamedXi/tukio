'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApiClient } from '../../providers/api-client-context.js';
import { QueryKeys, type VerificationFilter } from '../../types/query-keys.js';
import { ApiError } from '../../types/api-error.js';

// TODO: replace with @tukio/contracts/dtos/admin VerificationResponseDto when
// Story 2.3 (admin verification queue) lands.
export interface VerificationResponseDto {
  id: string;
  proId: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string;
}

export function useVerifications(
  filter: VerificationFilter = {},
): UseQueryResult<VerificationResponseDto[], ApiError> {
  const client = useApiClient();
  return useQuery<VerificationResponseDto[], ApiError>({
    queryKey: QueryKeys.admin.verifications(filter),
    queryFn: async () => {
      const response = await client.get<VerificationResponseDto[]>('/v1/admin/verifications', {
        params: filter,
      });
      return response.data;
    },
  });
}
