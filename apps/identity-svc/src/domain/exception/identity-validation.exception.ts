import { DomainException } from './domain.exception.js';
import {
  IdentityErrorCodes,
  type IdentityErrorCode,
} from '@tukio/contracts/types/error-codes';

const VALIDATION_CODES: readonly IdentityErrorCode[] = [
  IdentityErrorCodes.VALIDATION_INPUT_INVALID,
  IdentityErrorCodes.VALIDATION_SIRET_INVALID,
  IdentityErrorCodes.VALIDATION_SIRET_INACTIVE,
];

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
    if (!VALIDATION_CODES.includes(code)) {
      throw new Error(
        `IdentityValidationException: code ${code} is not a registered validation code`,
      );
    }
    this.tukioCode = code;
  }
}
