export class AuthForbiddenException extends Error {
  readonly tukioCode = 'AUTH-FORBIDDEN-001';
  readonly httpStatus = 403;
  readonly title = 'Insufficient role';

  constructor(detail = 'Insufficient role to access this resource') {
    super(detail);
    this.name = 'AuthForbiddenException';
    Object.setPrototypeOf(this, AuthForbiddenException.prototype);
  }
}
