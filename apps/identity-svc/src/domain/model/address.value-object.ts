import { IdentityValidationException } from '../exception/identity-validation.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

const POSTAL_CODE_REGEX = /^\d{5}$/;
const STREET_MAX_LENGTH = 200;
const CITY_MAX_LENGTH = 100;

export interface AddressProps {
  street: string;
  postalCode: string;
  city: string;
  country: 'FR'; // MVP France only — V1 widens this union.
}

/**
 * Postal address value object — France-only at MVP. Mirrors
 * `ProAddressSchema` from `@tukio/contracts/dtos/identity/register-pro`.
 *
 * Validation enforces non-empty street, 5-digit French postal code, non-empty
 * city, and the literal country `'FR'`. Geographic widening (BE/CH/LU)
 * happens at V1 and will require a country-specific postal code rule, so the
 * union is kept narrow on purpose.
 */
export class Address {
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: 'FR';

  private constructor(props: AddressProps) {
    this.street = props.street;
    this.postalCode = props.postalCode;
    this.city = props.city;
    this.country = props.country;
  }

  static create(props: AddressProps): Address {
    const street = props.street?.trim() ?? '';
    if (street.length === 0 || street.length > STREET_MAX_LENGTH) {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        `Address street must be 1..${STREET_MAX_LENGTH} characters`,
      );
    }

    const postalCode = props.postalCode?.trim() ?? '';
    if (!POSTAL_CODE_REGEX.test(postalCode)) {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        'Postal code must be 5 digits (France MVP)',
      );
    }

    const city = props.city?.trim() ?? '';
    if (city.length === 0 || city.length > CITY_MAX_LENGTH) {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        `Address city must be 1..${CITY_MAX_LENGTH} characters`,
      );
    }

    if (props.country !== 'FR') {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_INPUT_INVALID,
        `Country '${String(props.country)}' not supported at MVP (France only)`,
      );
    }

    return new Address({ street, postalCode, city, country: 'FR' });
  }

  equals(other: Address): boolean {
    return (
      other instanceof Address &&
      other.street === this.street &&
      other.postalCode === this.postalCode &&
      other.city === this.city &&
      other.country === this.country
    );
  }
}
