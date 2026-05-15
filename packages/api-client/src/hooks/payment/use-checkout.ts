'use client';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { PaymentIntentResponseDto } from '@tukio/contracts/dtos/payment';
import { useApiClient } from '../../providers/api-client-context.js';
import { ApiError } from '../../types/api-error.js';

// TODO Story 4.5: replace with @tukio/contracts/dtos/payment CreatePaymentIntentDto
export interface CreatePaymentIntentInput {
  bookingId: string;
  amountInCents: number;
  currency: 'EUR';
}

export function useCheckout(): UseMutationResult<
  PaymentIntentResponseDto,
  ApiError,
  CreatePaymentIntentInput
> {
  const client = useApiClient();
  return useMutation<PaymentIntentResponseDto, ApiError, CreatePaymentIntentInput>({
    mutationFn: async (input) => {
      const response = await client.post<PaymentIntentResponseDto>('/v1/payments/checkout', input);
      return response.data;
    },
  });
}
