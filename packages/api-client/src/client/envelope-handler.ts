import type { ErrorEnvelope, SuccessEnvelope } from '@tukio/contracts/envelope';
import { ApiError } from '../types/api-error.js';

// Extracts the `data` field from a SuccessEnvelope, returning the typed
// payload directly. Used by the axios response interceptor so that hook
// callers receive the DTO nu (not wrapped) — see ADR-014.
export function unwrapSuccessEnvelope<TData>(
  envelope: SuccessEnvelope<TData>,
): TData | TData[] | null {
  return envelope.data;
}

// Parses an ErrorEnvelope and throws a typed ApiError. Used by the axios
// response error interceptor + by hook callers that want to convert raw
// envelope errors to ApiError manually.
export function throwApiErrorFromEnvelope(envelope: ErrorEnvelope, correlationId?: string): never {
  throw new ApiError(
    envelope.error.tukioCode,
    envelope.code,
    envelope.error.title,
    envelope.error.detail,
    envelope.error.issues,
    correlationId ?? envelope.meta.correlationId,
    envelope.error.instance,
  );
}

// Type guard: distinguishes an ErrorEnvelope from a SuccessEnvelope at runtime.
// Useful when an axios response shape is unknown (e.g. mocked tests).
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    'error' in v &&
    typeof v.error === 'object' &&
    v.error !== null &&
    'tukioCode' in (v.error as Record<string, unknown>)
  );
}
