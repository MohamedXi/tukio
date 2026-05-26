'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { mapPreLaunchError, type PreLaunchApiError } from './map-pre-launch-error.js';

const FETCH_TIMEOUT_MS = 15_000;

export interface PreLaunchSignupInput {
  firstName: string;
  lastName: string;
  email: string;
  role: 'organisateur' | 'professionnel';
  rgpdOptIn: boolean;
  locale: 'fr' | 'en';
}

export interface PreLaunchSignupResult {
  ok: true;
  position: number;
  alreadySubscribed?: boolean;
}

export function useSubmitPreLaunchSignup(): UseMutationResult<
  PreLaunchSignupResult,
  PreLaunchApiError,
  PreLaunchSignupInput
> {
  return useMutation<PreLaunchSignupResult, PreLaunchApiError, PreLaunchSignupInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/pre-launch/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      // P14 — guard against non-JSON server responses (e.g. Cloudflare error HTML)
      const body = await response.json().catch(() => ({}));
      if (!response.ok || (body as { ok?: boolean }).ok === false) {
        throw mapPreLaunchError(response.status, body, response.headers);
      }
      return body as PreLaunchSignupResult;
    },
  });
}
