import { DomainException } from './domain.exception.js';

export class InvalidUserProfileException extends DomainException {
  readonly tukioCode = 'INVALID-USER-PROFILE-001';
  readonly httpStatus = 422;
  readonly title = 'Invalid user profile';

  constructor(reason: string) {
    super(`Invalid UserProfile: ${reason}`);
  }
}
