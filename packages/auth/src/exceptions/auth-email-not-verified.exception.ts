export class AuthEmailNotVerifiedException extends Error {
  readonly tukioCode = 'AUTH-EMAIL-NOT-VERIFIED-004';
  readonly httpStatus = 403;
  readonly title = 'Email not verified';

  constructor(detail = 'Email address must be verified to access this resource') {
    super(detail);
    this.name = 'AuthEmailNotVerifiedException';
    Object.setPrototypeOf(this, AuthEmailNotVerifiedException.prototype);
  }
}
