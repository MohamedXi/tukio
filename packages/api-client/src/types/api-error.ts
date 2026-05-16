import type { ValidationIssue } from '@tukio/contracts/envelope';

// Typed Error thrown by axios envelope-error interceptor + by manual envelope
// unwrap helpers. Consumers can narrow with `instanceof ApiError` and use the
// type-safe helpers (isValidationError, isNotFound, …) instead of comparing
// status codes directly.
export class ApiError extends Error {
  constructor(
    public readonly tukioCode: string,
    public readonly httpStatus: number,
    public readonly title: string,
    public readonly detail: string,
    public readonly issues?: ValidationIssue[],
    public readonly correlationId?: string,
    public readonly instance?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    // Defensive: malformed envelopes can reach here with empty title/detail.
    // Avoid the eyesore `[X] undefined: undefined` in logs / Sentry.
    const renderedTitle = title || 'API error';
    const renderedDetail = detail || '<no detail>';
    super(`[${tukioCode}] ${renderedTitle}: ${renderedDetail}`);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  isValidationError(): boolean {
    return this.tukioCode === 'VALIDATION-FAILED-001' || this.httpStatus === 422;
  }

  isNotFound(): boolean {
    return this.httpStatus === 404;
  }

  isUnauthorized(): boolean {
    return this.httpStatus === 401;
  }

  isForbidden(): boolean {
    return this.httpStatus === 403;
  }

  isConflict(): boolean {
    return this.httpStatus === 409;
  }

  isServerError(): boolean {
    return this.httpStatus >= 500;
  }

  isRateLimited(): boolean {
    return this.httpStatus === 429;
  }
}
