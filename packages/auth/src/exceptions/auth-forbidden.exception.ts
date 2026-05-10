import { DomainException } from '@tukio/contracts/exceptions/domain';

export class AuthForbiddenException extends DomainException {
  readonly tukioCode = 'AUTH-FORBIDDEN-001';
  readonly httpStatus = 403;
  readonly title = 'Insufficient role';

  constructor(detail = 'Insufficient role to access this resource') {
    super(detail);
  }
}
