import { DomainException } from './domain.exception.js';
import {
  IdentityErrorCodes,
  type IdentityErrorCode,
} from '@tukio/contracts/types/error-codes';

const EXTERNAL_CODES: readonly IdentityErrorCode[] = [
  IdentityErrorCodes.EXTERNAL_KEYCLOAK_DOWN,
  IdentityErrorCodes.EXTERNAL_INSEE_DOWN,
];

export class ExternalServiceException extends DomainException {
  readonly httpStatus = 502;
  readonly title = 'External service unavailable';
  readonly tukioCode: IdentityErrorCode;

  constructor(code: IdentityErrorCode, message: string) {
    super(message);
    if (!EXTERNAL_CODES.includes(code)) {
      throw new Error(
        `ExternalServiceException: code ${code} is not a registered external code`,
      );
    }
    this.tukioCode = code;
  }
}
