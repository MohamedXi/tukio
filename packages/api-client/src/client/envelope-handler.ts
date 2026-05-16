import type { ErrorEnvelope, SuccessEnvelope } from '@tukio/contracts/envelope';
import { ApiError } from '../types/api-error.js';

// Extracts the `data` field from a SuccessEnvelope. The return type matches
// the envelope's `data` shape (single resource | collection | null per
// ADR-014). Hook callers usually consume single-resource envelopes; for
// collection responses, hooks narrow with Array.isArray() or wrap the type
// in their own helper.
export function unwrapSuccessEnvelope<TData>(
  envelope: SuccessEnvelope<TData>,
): TData | TData[] | null {
  return envelope.data;
}

// Parses an ErrorEnvelope and throws a typed ApiError. Defensive: optional
// chaining everywhere so a malformed envelope cannot turn into an opaque
// TypeError that masks the original error.
export function throwApiErrorFromEnvelope(
  envelope: ErrorEnvelope,
  correlationId?: string,
  retryAfterSeconds?: number,
): never {
  throw new ApiError(
    envelope.error?.tukioCode ?? 'UNKNOWN-ERROR-001',
    envelope.code,
    envelope.error?.title ?? 'API error',
    envelope.error?.detail ?? '',
    envelope.error?.issues,
    correlationId ?? envelope.meta?.correlationId,
    envelope.error?.instance,
    retryAfterSeconds,
  );
}

// Tight type guard for ErrorEnvelope shape. Requires the full envelope keys
// (method, code, error, meta) AND `error.tukioCode` — prevents misclassifying
// a success envelope shaped `{ data, error: { tukioCode } }` as error, and
// rejects upstream proxy responses that happen to share a `data` field.
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!('method' in v) || !('code' in v) || !('meta' in v) || !('error' in v)) return false;
  const err = v.error as Record<string, unknown> | null;
  return typeof err === 'object' && err !== null && typeof err.tukioCode === 'string';
}
