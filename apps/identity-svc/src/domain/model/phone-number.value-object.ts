import { IdentityValidationException } from '../exception/identity-validation.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

const FR_PHONE_REGEX = /^(?:\+33|0)[1-9]\d{8}$/;

/**
 * French phone number value object — accepts both national (`0XXXXXXXXX`)
 * and international (`+33XXXXXXXXX`) formats at construction, but stores
 * the value normalised to E.164 (`+33XXXXXXXXX`).
 *
 * Mobile/landline are not distinguished because both are valid contact
 * numbers for a pro account at MVP. Foreign numbers are rejected at this
 * boundary; widening to BE/CH/LU follows when `Address.country` accepts
 * those codes (V1).
 */
export class PhoneNumber {
  private readonly value: string;

  private constructor(e164: string) {
    this.value = e164;
  }

  static create(raw: string): PhoneNumber {
    if (typeof raw !== 'string') {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        `Phone number must be a string (received ${typeof raw})`,
      );
    }
    const trimmed = raw.trim();
    if (!FR_PHONE_REGEX.test(trimmed)) {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        'Phone number must be a French number (+33 or 0 prefix)',
      );
    }
    // Normalise: replace leading `0` with `+33` so storage is always E.164.
    const e164 = trimmed.startsWith('+33') ? trimmed : `+33${trimmed.slice(1)}`;
    return new PhoneNumber(e164);
  }

  toString(): string {
    return this.value;
  }

  get asString(): string {
    return this.value;
  }

  equals(other: PhoneNumber): boolean {
    return other instanceof PhoneNumber && other.value === this.value;
  }
}
