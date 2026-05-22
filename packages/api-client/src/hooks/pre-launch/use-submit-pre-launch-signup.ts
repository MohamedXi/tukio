'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { mapPreLaunchError, type PreLaunchApiError } from './map-pre-launch-error.js';

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
      });
      const body = await response.json();
      if (!response.ok || (body as { ok?: boolean }).ok === false) {
        throw mapPreLaunchError(response.status, body, response.headers);
      }
      return body as PreLaunchSignupResult;
    },
  });
}
