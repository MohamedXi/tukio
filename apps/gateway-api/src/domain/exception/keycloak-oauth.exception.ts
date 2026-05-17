import { AuthErrorCodes } from '@tukio/contracts/types/error-codes';
import { DomainException } from './domain.exception.js';

export class KeycloakUnreachableError extends DomainException {
  readonly tukioCode = AuthErrorCodes.EXTERNAL;
  readonly httpStatus = 502;
  readonly title = 'Authentication service unreachable';

  constructor(detail: string, cause?: unknown) {
    super(detail);
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class KeycloakInvalidGrantError extends DomainException {
  readonly tukioCode = AuthErrorCodes.INVALID_CODE;
  readonly httpStatus = 400;
  readonly title = 'Invalid authorization grant';

  constructor(detail: string) {
    super(detail);
  }
}

export class KeycloakRefreshExpiredError extends DomainException {
  readonly tukioCode = AuthErrorCodes.REFRESH_EXPIRED;
  readonly httpStatus = 401;
  readonly title = 'Refresh token expired';

  constructor(detail: string) {
    super(detail);
  }
}

export class KeycloakRefreshReusedError extends DomainException {
  readonly tukioCode = AuthErrorCodes.REFRESH_REUSED;
  readonly httpStatus = 401;
  readonly title = 'Refresh token reuse detected';

  constructor(detail: string) {
    super(detail);
  }
}
