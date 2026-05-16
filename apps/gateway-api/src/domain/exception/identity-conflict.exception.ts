import { DomainException } from './domain.exception.js';

/**
 * Maps a downstream 409 (identity-svc — Story 1.2c) into a gateway-side domain
 * exception. The `tukioCode` is propagated as-is from identity-svc (e.g.
 * `IDENTITY-CONFLICT-001`) so the public envelope stays a stable contract.
 */
export class IdentityConflictException extends DomainException {
  readonly httpStatus = 409;
  readonly title = 'Identity conflict';

  constructor(
    readonly tukioCode: string,
    message: string,
  ) {
    super(message);
  }
}
