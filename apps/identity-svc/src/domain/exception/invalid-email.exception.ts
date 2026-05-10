import { DomainException } from './domain.exception.js';

export class InvalidEmailException extends DomainException {
  readonly tukioCode = 'INVALID-EMAIL-001';
  readonly httpStatus = 422;
  readonly title = 'Invalid email address';

  constructor(public readonly raw: string) {
    super(`Invalid email format: ${raw}`);
  }
}
