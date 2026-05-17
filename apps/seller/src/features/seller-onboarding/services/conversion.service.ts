import type { ConversionMutationError } from '../hooks/use-register-pro-mutation';

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

export function classifyConversionError(error: ConversionMutationError): ConversionError {
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
