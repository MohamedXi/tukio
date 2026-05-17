'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useGatewayUrl } from '../components/ConversionProviders';
import type { WizardState } from '../wizard-state';

export interface ConversionMutationInput {
  state: WizardState;
  locale: 'fr' | 'en';
  acquisition?: Record<string, string>;
  accessToken?: string;
}

export interface ConversionMutationResult {
  userId: string;
  proProfileId: string;
  requiresAdminReview: true;
  requiresEmailVerification: false;
}

export interface ConversionMutationError {
  tukioCode: string;
  httpStatus: number;
  title: string;
  retryAfterSeconds?: number;
}

async function submitConversion(
  gatewayUrl: string,
  input: ConversionMutationInput,
): Promise<ConversionMutationResult> {
  const { state, locale, acquisition } = input;
  if (!state.identity || !state.activity || !state.documents.idCard || !state.documents.rib) {
    throw { tukioCode: 'CLIENT-ERROR', httpStatus: 400, title: 'Incomplete wizard state' };
  }

  const payload = {
    email: state.identity.email,
    firstName: state.identity.firstName,
    lastName: state.identity.lastName,
    locale,
    dateOfBirth: state.identity.dateOfBirth,
    contactPhone: state.identity.contactPhone,
    acceptMarketing: state.identity.acceptMarketing,
    companyName: state.activity.companyName,
    siret: state.activity.siret,
    vatNumber: state.activity.vatNumber,
    legalForm: state.activity.legalForm,
    vatStatus: state.activity.vatStatus,
    categories: state.activity.categories,
    serviceZone: state.activity.serviceZone,
    address: state.activity.address,
    acceptCharter: true,
    ...(acquisition ? { acquisition } : {}),
  };

  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('idCard', state.documents.idCard);
  form.append('rib', state.documents.rib);
  if (state.documents.kbisOrInsee) {
    form.append('kbisOrInsee', state.documents.kbisOrInsee);
  }

  const res = await fetch(`${gatewayUrl}/v1/auth/pro/register`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  const json = (await res.json()) as {
    code?: string;
    data?: ConversionMutationResult;
    error?: { tukioCode: string; title: string };
    headers?: Record<string, string>;
  };

  if (!res.ok) {
    const retryAfter = res.headers.get('retry-after');
    throw {
      tukioCode: json.error?.tukioCode ?? 'UNKNOWN',
      httpStatus: res.status,
      title: json.error?.title ?? res.statusText,
      retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) : undefined,
    } satisfies ConversionMutationError;
  }

  return json.data as ConversionMutationResult;
}

export function useRegisterProMutation(): UseMutationResult<
  ConversionMutationResult,
  ConversionMutationError,
  ConversionMutationInput
> {
  const gatewayUrl = useGatewayUrl();
  return useMutation<ConversionMutationResult, ConversionMutationError, ConversionMutationInput>({
    mutationFn: (input) => submitConversion(gatewayUrl, input),
  });
}
