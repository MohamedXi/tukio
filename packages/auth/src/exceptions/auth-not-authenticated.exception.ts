import { DomainException } from '@tukio/contracts/exceptions/domain';

export class AuthNotAuthenticatedException extends DomainException {
  readonly tukioCode = 'AUTH-NOT-AUTHENTICATED-002';
  readonly httpStatus = 401;
  readonly title = 'Authentication required';

  constructor(detail = 'Missing or invalid JWT token') {
    super(detail);
  }
}
