import { IdentityValidationException } from '../exception/identity-validation.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

const FR_VAT_REGEX = /^FR\d{11}$/;

/**
 * French intracom VAT number (`FR` followed by 11 digits). Optional on Pro
 * registration since some small structures (micro-entreprises) are not
 * VAT-registered.
 *
 * Normalisation trims surrounding whitespace and uppercases the `FR` prefix
 * so `'fr12345678901'` and `' FR12345678901 '` are equivalent.
 */
export class VatNumber {
  private readonly value: string;

  private constructor(normalized: string) {
    this.value = normalized;
  }

  static create(raw: string): VatNumber {
    if (typeof raw !== 'string') {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        `VAT number must be a string (received ${typeof raw})`,
      );
    }
    const normalized = raw.trim().toUpperCase();
    if (!FR_VAT_REGEX.test(normalized)) {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        'VAT number must match the FR + 11 digits pattern',
      );
    }
    return new VatNumber(normalized);
  }

  toString(): string {
    return this.value;
  }

  get asString(): string {
    return this.value;
  }

  equals(other: VatNumber): boolean {
    return other instanceof VatNumber && other.value === this.value;
  }
}
