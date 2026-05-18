import { AuthErrorCodes } from '@tukio/contracts/types/error-codes';
import { DomainException } from './domain.exception.js';

/**
 * Raised by `CsrfGuard` when the `X-CSRF-Token` header is absent or does not
 * match the `tukio-csrf-token` cookie. Implements the double-submit cookie
 * defense for state-changing endpoints (POST /v1/auth/refresh + logout).
 */
export class AuthCsrfMismatchException extends DomainException {
  readonly tukioCode = AuthErrorCodes.CSRF_MISMATCH;
  readonly httpStatus = 403;
  readonly title = 'CSRF token mismatch';

  constructor(detail = 'CSRF token missing or mismatched') {
    super(detail);
  }
}
