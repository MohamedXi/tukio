import { DomainException } from './domain.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

export class InvalidProProfileException extends DomainException {
  readonly tukioCode = IdentityErrorCodes.INVALID_PRO_PROFILE;
  readonly httpStatus = 422;
  readonly title = 'Invalid pro profile';

  constructor(reason: string) {
    super(`Invalid ProProfile: ${reason}`);
  }
}
