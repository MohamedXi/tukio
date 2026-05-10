import { DomainException } from '@tukio/contracts/exceptions/domain';

export class AuthMfaRequiredException extends DomainException {
  readonly tukioCode = 'AUTH-MFA-REQUIRED-003';
  readonly httpStatus = 401;
  readonly title = 'MFA required';

  constructor(detail = 'Multi-factor authentication is required for this resource') {
    super(detail);
  }
}
