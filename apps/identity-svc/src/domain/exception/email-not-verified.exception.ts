import { DomainException } from './domain.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

/**
 * Thrown by `ConvertCustomerToProUseCase` (Story 1.3b-bis) when the Customer
 * account's email is not yet verified in Keycloak. Pro conversion requires
 * a verified email to ensure identity integrity.
 */
export class EmailNotVerifiedException extends DomainException {
  readonly httpStatus = 403;
  readonly title = 'Email not verified';
  readonly tukioCode = IdentityErrorCodes.EMAIL_NOT_VERIFIED;

  constructor() {
    super('Customer email must be verified before converting to a Pro account');
  }
}
