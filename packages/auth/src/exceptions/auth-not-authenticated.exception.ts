export class AuthNotAuthenticatedException extends Error {
  readonly tukioCode = 'AUTH-NOT-AUTHENTICATED-002';
  readonly httpStatus = 401;
  readonly title = 'Authentication required';

  constructor(detail = 'Missing or invalid JWT token') {
    super(detail);
    this.name = 'AuthNotAuthenticatedException';
    Object.setPrototypeOf(this, AuthNotAuthenticatedException.prototype);
  }
}
