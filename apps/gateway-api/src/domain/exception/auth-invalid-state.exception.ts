import { AuthErrorCodes } from '@tukio/contracts/types/error-codes';
import { DomainException } from './domain.exception.js';

/**
 * Raised when the state JWT carried in `?state=` on the Keycloak callback is
 * invalid, expired, tampered, or missing required claims. Maps to a generic
 * "Session expired" message client-side (NFR9 anti-enumeration — we never leak
 * the precise failure mode).
 */
export class AuthInvalidStateException extends DomainException {
  readonly tukioCode = AuthErrorCodes.INVALID_STATE;
  readonly httpStatus = 400;
  readonly title = 'Invalid state';

  constructor(reason: string) {
    super(reason);
  }
}
