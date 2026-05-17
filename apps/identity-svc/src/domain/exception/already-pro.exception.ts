import { DomainException } from './domain.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

/**
 * Thrown by `ConvertCustomerToProUseCase` (Story 1.3b-bis) when the Customer
 * already holds the `pro` realm role in Keycloak. Re-conversion is idempotent
 * at the Keycloak layer but a second ProProfile would violate the 1-per-user
 * unique index — rejecting early avoids a misleading 409 from the DB.
 */
export class AlreadyProException extends DomainException {
  readonly httpStatus = 409;
  readonly title = 'Already a pro';
  readonly tukioCode = IdentityErrorCodes.CONFLICT_ALREADY_PRO;

  constructor() {
    super('This customer account already has the pro role');
  }
}
