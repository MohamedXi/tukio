import { DomainException } from '@tukio/contracts/exceptions/domain';

export class AuthEmailNotVerifiedException extends DomainException {
  readonly tukioCode = 'AUTH-EMAIL-NOT-VERIFIED-004';
  readonly httpStatus = 403;
  readonly title = 'Email not verified';

  constructor(detail = 'Email address must be verified to access this resource') {
    super(detail);
  }
}
