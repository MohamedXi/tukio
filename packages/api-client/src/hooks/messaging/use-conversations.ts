'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApiClient } from '../../providers/api-client-context.js';
import { QueryKeys } from '../../types/query-keys.js';
import { ApiError } from '../../types/api-error.js';

// TODO: replace with @tukio/contracts/dtos/messaging ConversationResponseDto
// when Story 5.1 (messaging-svc Pretre) lands.
export interface ConversationSummaryDto {
  id: string;
  participantId: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function useConversations(): UseQueryResult<ConversationSummaryDto[], ApiError> {
  const client = useApiClient();
  return useQuery<ConversationSummaryDto[], ApiError>({
    queryKey: QueryKeys.messaging.all,
    queryFn: async () => {
      const response = await client.get<ConversationSummaryDto[]>('/v1/conversations');
      return response.data;
    },
  });
}
