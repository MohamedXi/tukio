import { IdentityValidationException } from '../exception/identity-validation.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

/**
 * French intracom VAT number: `FR` + 2-char check key + 9-digit SIREN.
 * The check key is `[0-9A-HJ-NP-Z]` (I and O excluded per EU convention).
 * Examples: `FR12345678901` (numeric key `12`), `FRQU345678901` (alpha key `QU`).
 * Optional on Pro registration since micro-entreprises may not be VAT-registered.
 *
 * Normalisation trims whitespace and uppercases the prefix so `'fr12...'` and
 * `' FR12... '` are equivalent.
 */
const FR_VAT_REGEX = /^FR[0-9A-HJ-NP-Z]{2}\d{9}$/;
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
        'VAT number must be FR + 2-char check key + 9-digit SIREN (e.g. FR12345678901)',
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
