import { ApiError } from '@tukio/api-client';

/**
 * Anti-énumération (NFR9): NEVER expose `IDENTITY-CONFLICT-001` to the UI.
 * Conflicts surface as the same generic message as other errors.
 */

export type ValidationIssue = { path: string; message: string };

export type SignUpFailure =
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'validation'; issues: ValidationIssue[] }
  | { kind: 'network' }
  | { kind: 'generic' };

const DEFAULT_RATE_LIMIT_FALLBACK_SECONDS = 60;

export function classifySignUpError(error: unknown): SignUpFailure {
  if (error instanceof ApiError) {
    if (error.tukioCode === 'RATE-LIMIT-EXCEEDED-001' || error.isRateLimited()) {
      return {
        kind: 'rate_limited',
        retryAfterSeconds: error.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_FALLBACK_SECONDS,
      };
    }
    if (error.isValidationError() && Array.isArray(error.issues)) {
      return {
        kind: 'validation',
        issues: error.issues.map((i) => ({
          path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
          message: i.message,
        })),
      };
    }
    // IDENTITY-CONFLICT-001 + all other tukioCodes → generic anti-enum message
    return { kind: 'generic' };
  }
  if (isNetworkError(error)) {
    return { kind: 'network' };
  }
  return { kind: 'generic' };
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; name?: string };
  if (e.code === 'ECONNABORTED' || e.code === 'ERR_NETWORK' || e.code === 'ETIMEDOUT') return true;
  if (e.name === 'AbortError' || e.name === 'TypeError') {
    return /fetch|network|cors|failed/i.test(e.message ?? '');
  }
  return false;
}
