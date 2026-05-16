import { DomainException } from './domain.exception.js';

export class InvalidProProfileException extends DomainException {
  readonly tukioCode = 'INVALID-PRO-PROFILE-001';
  readonly httpStatus = 422;
  readonly title = 'Invalid pro profile';

  constructor(reason: string) {
    super(`Invalid ProProfile: ${reason}`);
  }
}
