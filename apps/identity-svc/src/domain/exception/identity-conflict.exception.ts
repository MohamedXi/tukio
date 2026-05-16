import { DomainException } from './domain.exception.js';
import {
  IdentityErrorCodes,
  type IdentityErrorCode,
} from '@tukio/contracts/types/error-codes';

const CONFLICT_CODES: readonly IdentityErrorCode[] = [
  IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
  IdentityErrorCodes.CONFLICT_SIRET_EXISTS,
  IdentityErrorCodes.CONFLICT_ACTIVE_BOOKINGS,
];

export class IdentityConflictException extends DomainException {
  readonly httpStatus = 409;
  readonly title = 'Identity conflict';
  readonly tukioCode: IdentityErrorCode;

  constructor(code: IdentityErrorCode, message: string) {
    super(message);
    if (!CONFLICT_CODES.includes(code)) {
      throw new Error(
        `IdentityConflictException: code ${code} is not a registered conflict code`,
      );
    }
    this.tukioCode = code;
  }
}
