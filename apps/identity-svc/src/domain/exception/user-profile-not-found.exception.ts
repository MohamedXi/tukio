import { DomainException } from './domain.exception.js';

export class UserProfileNotFoundException extends DomainException {
  readonly tukioCode = 'USER-NOT-FOUND-001';
  readonly httpStatus = 404;
  readonly title = 'User profile not found';

  constructor(public readonly userId: string) {
    super(`UserProfile with id ${userId} not found`);
  }
}
