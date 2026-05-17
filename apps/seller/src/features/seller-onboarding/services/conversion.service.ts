import { ApiError } from '@tukio/api-client/types/api-error';
import type { RegisterProMutationInput } from '@tukio/api-client/hooks/identity/use-register-pro';
import type { RegisterProInputDto } from '@tukio/contracts/dtos/identity/register-pro';
import type { WizardState } from '../wizard-state';

export type ConversionErrorKind =
  | 'rate_limited'
  | 'siret_conflict'
  | 'siret_inactive'
  | 'external'
  | 'network'
  | 'validation'
  | 'generic';

export interface ConversionError {
  kind: ConversionErrorKind;
  retryAfterSeconds?: number;
}

const IDENTITY_CONFLICT_SIRET = 'IDENTITY-CONFLICT-002';
const IDENTITY_VALIDATION_INSEE = 'IDENTITY-VALIDATION-003';
const RATE_LIMIT_EXCEEDED = 'RATE-LIMIT-EXCEEDED-001';
const EXTERNAL_CODES = ['EXTERNAL-002', 'EXTERNAL-003'];

export function classifyConversionError(error: ApiError): ConversionError {
  const code = error.tukioCode ?? '';
  if (error.httpStatus === 429 || code === RATE_LIMIT_EXCEEDED) {
    return { kind: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
  }
  if (code === IDENTITY_CONFLICT_SIRET) return { kind: 'siret_conflict' };
  if (code === IDENTITY_VALIDATION_INSEE) return { kind: 'siret_inactive' };
  if (EXTERNAL_CODES.includes(code) || error.httpStatus === 502) return { kind: 'external' };
  if (error.httpStatus === 0 || !error.httpStatus) return { kind: 'network' };
  if (error.httpStatus === 422) return { kind: 'validation' };
  return { kind: 'generic' };
}

export function buildRegisterProInput(
  state: WizardState,
  locale: 'fr' | 'en',
  acquisitionContext?: RegisterProInputDto['acquisition'],
): RegisterProMutationInput | null {
  const { identity, activity, documents } = state;
  if (!identity || !activity || !documents.idCard || !documents.rib) return null;

  const input: RegisterProInputDto = {
    email: identity.email,
    firstName: identity.firstName,
    lastName: identity.lastName,
    locale,
    dateOfBirth: identity.dateOfBirth,
    contactPhone: identity.contactPhone,
    acceptMarketing: identity.acceptMarketing,
    companyName: activity.companyName,
    siret: activity.siret,
    vatNumber: activity.vatNumber,
    legalForm: activity.legalForm,
    vatStatus: activity.vatStatus,
    categories: activity.categories,
    serviceZone: activity.serviceZone,
    address: activity.address,
    acceptCharter: true,
    ...(acquisitionContext ? { acquisition: acquisitionContext } : {}),
  };

  return {
    input,
    files: {
      idCard: documents.idCard,
      rib: documents.rib,
      ...(documents.kbisOrInsee ? { kbisOrInsee: documents.kbisOrInsee } : {}),
    },
  };
}
