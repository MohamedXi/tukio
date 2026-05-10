'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApiClient } from '../../providers/api-client-context.js';
import { QueryKeys } from '../../types/query-keys.js';
import { ApiError } from '../../types/api-error.js';

// TODO: replace with @tukio/contracts/dtos/identity UserProfileResponseDto
// when DTO is exported (Story 0.6 has it but it isn't yet in @tukio/contracts).
export interface UserProfileResponseDto {
  id: string;
  keycloakUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super';
  locale: 'fr' | 'en';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function useProfile(): UseQueryResult<UserProfileResponseDto, ApiError> {
  const client = useApiClient();
  return useQuery<UserProfileResponseDto, ApiError>({
    queryKey: QueryKeys.identity.profile,
    queryFn: async () => {
      const response = await client.get<UserProfileResponseDto>('/v1/users/me');
      return response.data;
    },
  });
}
