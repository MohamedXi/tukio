'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { mapPreLaunchError, type PreLaunchApiError } from './map-pre-launch-error.js';

const FETCH_TIMEOUT_MS = 15_000;

export interface PreLaunchContactInput {
  firstName: string;
  lastName: string;
  email: string;
  category: 'organisateur' | 'professionnel' | 'journaliste' | 'partenaire' | 'autre';
  subject: 'general' | 'devenirPro' | 'technique' | 'partenariat' | 'presse';
  message: string;
  locale: 'fr' | 'en';
}

export interface PreLaunchContactResult {
  ok: true;
}

export function useSubmitPreLaunchContact(): UseMutationResult<
  PreLaunchContactResult,
  PreLaunchApiError,
  PreLaunchContactInput
> {
  return useMutation<PreLaunchContactResult, PreLaunchApiError, PreLaunchContactInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/pre-launch/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || (body as { ok?: boolean }).ok === false) {
        throw mapPreLaunchError(response.status, body, response.headers);
      }
      return body as PreLaunchContactResult;
    },
  });
}
