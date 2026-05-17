'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useApiClient } from '../../providers/api-client-context.js';
import { ApiError } from '../../types/api-error.js';
import type {
  RegisterProInputDto,
  RegisterProResponseDto,
} from '@tukio/contracts/dtos/identity/register-pro';

export interface RegisterProFiles {
  idCard: File;
  rib: File;
  kbisOrInsee?: File;
}

export interface RegisterProMutationInput {
  input: RegisterProInputDto;
  files: RegisterProFiles;
}

/**
 * TanStack Query mutation hook — POST `/v1/auth/pro/register` (Story 1.3c endpoint).
 *
 * Sends a `multipart/form-data` body with one JSON part (`payload`) carrying
 * the validated `RegisterProInputDto` and three binary file parts
 * (`idCard`, `rib`, optional `kbisOrInsee`). The field name `payload` and the
 * file field names match identity-svc Story 1.3b internal contract — the
 * gateway-api forwarder (Story 1.3c) passes them through unchanged.
 *
 * On success the gateway-api returns
 * `{ userId, proProfileId, requiresAdminReview: true, requiresEmailVerification: true }`.
 *
 * On error the ApiError carries the tukioCode (handled by `classifyProSignUpError`
 * in the feature layer to map to inline / global messages):
 *   - `IDENTITY-CONFLICT-002` → SIRET already used (Story 1.3b)
 *   - `IDENTITY-VALIDATION-003` → SIRET inactive in INSEE register (Story 1.3b)
 *   - `VALIDATION-FAILED-001` → schema validation failed (should not happen if client validates)
 *   - `RATE-LIMIT-EXCEEDED-001` → 4th attempt / minute — carry `retryAfter` seconds
 *   - `EXTERNAL-002` / `EXTERNAL-003` → INSEE / R2 unreachable (502)
 */
export function useRegisterPro(): UseMutationResult<
  RegisterProResponseDto,
  ApiError,
  RegisterProMutationInput
> {
  const client = useApiClient();
  return useMutation<RegisterProResponseDto, ApiError, RegisterProMutationInput>({
    mutationFn: async ({ input, files }) => {
      const form = new FormData();
      form.append('payload', JSON.stringify(input));
      form.append('idCard', files.idCard);
      form.append('rib', files.rib);
      if (files.kbisOrInsee) {
        form.append('kbisOrInsee', files.kbisOrInsee);
      }
      const response = await client.post<RegisterProResponseDto>('/v1/auth/pro/register', form, {
        // Setting Content-Type to 'multipart/form-data' (without boundary)
        // tells axios v1+ to compute the proper boundary itself from the
        // FormData body and overwrite the instance default Content-Type.
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  });
}
