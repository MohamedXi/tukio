'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useApiClient } from '../../providers/api-client-context.js';
import { ApiError } from '../../types/api-error.js';
import type {
  RegisterCustomerInputDto,
  RegisterCustomerResponseDto,
} from '@tukio/contracts/dtos/identity/register-customer';

/**
 * TanStack Query mutation hook — POST `/v1/auth/customer/register` (Story 1.2c endpoint).
 *
 * On success the gateway-api returns `{ userId, requiresEmailVerification: true }`.
 * On error the ApiError carries the tukioCode:
 *   - `IDENTITY-CONFLICT-001` → email already registered (display generic anti-enum message)
 *   - `VALIDATION-FAILED-001` → schema validation failed (should not happen if client validates)
 *   - `RATE-LIMIT-EXCEEDED-001` → 6th attempt / minute — carry `retryAfter` seconds
 *   - `IDENTITY-EXTERNAL-001` → identity-svc unreachable (502)
 */
export function useRegisterCustomer(): UseMutationResult<
  RegisterCustomerResponseDto,
  ApiError,
  RegisterCustomerInputDto
> {
  const client = useApiClient();
  return useMutation<RegisterCustomerResponseDto, ApiError, RegisterCustomerInputDto>({
    mutationFn: async (input) => {
      const response = await client.post<RegisterCustomerResponseDto>(
        '/v1/auth/customer/register',
        input,
      );
      return response.data;
    },
  });
}
