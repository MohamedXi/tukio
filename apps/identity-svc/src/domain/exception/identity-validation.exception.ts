import { DomainException } from './domain.exception.js';
import { type IdentityErrorCode } from '@tukio/contracts/types/error-codes';

/**
 * Business-rule validation failure (HTTP 422). Used for inputs that pass the
 * transport-level Zod schema (correct shape, types and basic regex) but fail
 * downstream validations such as Luhn checksums, external registry lookups,
 * or cross-field invariants.
 *
 * For pure shape/format violations caught at the transport boundary, the
 * existing `ZodValidationException` (`@tukio/contracts/exceptions`) emits
 * `VALIDATION-FAILED-001` instead.
 */
export class IdentityValidationException extends DomainException {
  readonly httpStatus = 422;
  readonly title = 'Identity validation failed';
  readonly tukioCode: IdentityErrorCode;

  constructor(code: IdentityErrorCode, message: string) {
    super(message);
    this.tukioCode = code;
  }
}
