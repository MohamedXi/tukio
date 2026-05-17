import type { ConversionMutationError } from '../hooks/use-register-pro-mutation';

export type ConversionErrorKind =
  | 'rate_limited'
  | 'siret_conflict'
  | 'siret_inactive'
  | 'already_pro'
  | 'email_not_verified'
  | 'external'
  | 'network'
  | 'validation'
  | 'generic';

export interface ConversionError {
  kind: ConversionErrorKind;
  retryAfterSeconds?: number;
}

const IDENTITY_CONFLICT_SIRET = 'IDENTITY-CONFLICT-002';
const IDENTITY_CONFLICT_ALREADY_PRO = 'IDENTITY-CONFLICT-004';
const IDENTITY_VALIDATION_INSEE = 'IDENTITY-VALIDATION-003';
const IDENTITY_EMAIL_NOT_VERIFIED = 'IDENTITY-EMAIL-NOT-VERIFIED-001';
const RATE_LIMIT_EXCEEDED = 'RATE-LIMIT-EXCEEDED-001';
// Gateway-api surfaces identity-svc external errors as IDENTITY-EXTERNAL-* codes.
const EXTERNAL_IDENTITY_PREFIX = 'IDENTITY-EXTERNAL-';

export function classifyConversionError(error: ConversionMutationError): ConversionError {
  const code = error.tukioCode ?? '';
  if (error.httpStatus === 429 || code === RATE_LIMIT_EXCEEDED) {
    return { kind: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
  }
  if (code === IDENTITY_CONFLICT_SIRET) return { kind: 'siret_conflict' };
  if (code === IDENTITY_CONFLICT_ALREADY_PRO) return { kind: 'already_pro' };
  if (code === IDENTITY_VALIDATION_INSEE) return { kind: 'siret_inactive' };
  if (code === IDENTITY_EMAIL_NOT_VERIFIED || error.httpStatus === 403) {
    return { kind: 'email_not_verified' };
  }
  if (code.startsWith(EXTERNAL_IDENTITY_PREFIX) || error.httpStatus === 502) {
    return { kind: 'external' };
  }
  if (error.httpStatus === 0 || !error.httpStatus) return { kind: 'network' };
  if (error.httpStatus === 422) return { kind: 'validation' };
  return { kind: 'generic' };
}
