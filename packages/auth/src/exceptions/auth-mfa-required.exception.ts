export class AuthMfaRequiredException extends Error {
  readonly tukioCode = 'AUTH-MFA-REQUIRED-003';
  readonly httpStatus = 401;
  readonly title = 'MFA required';

  constructor(detail = 'Multi-factor authentication is required for this resource') {
    super(detail);
    this.name = 'AuthMfaRequiredException';
    Object.setPrototypeOf(this, AuthMfaRequiredException.prototype);
  }
}
