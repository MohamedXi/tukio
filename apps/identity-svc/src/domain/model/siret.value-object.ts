import { siretLuhnCheck } from '@tukio/contracts/utils/siret';
import { IdentityValidationException } from '../exception/identity-validation.exception.js';
import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';

/**
 * SIRET value object — 14-digit French establishment identifier.
 *
 * The Luhn checksum and digit-only format are validated at construction. The
 * existence-and-active check against the INSEE SIRENE register is the
 * responsibility of `IInseeSiretValidator` (port), not this VO, so that the
 * domain layer remains free of I/O.
 */
export class Siret {
  private readonly value: string;

  private constructor(normalized: string) {
    this.value = normalized;
  }

  static create(raw: string): Siret {
    if (typeof raw !== 'string') {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_SIRET_INVALID,
        `SIRET must be a string (received ${typeof raw})`,
      );
    }
    const trimmed = raw.trim();
    if (!siretLuhnCheck(trimmed)) {
      throw new IdentityValidationException(
        IdentityErrorCodes.VALIDATION_SIRET_INVALID,
        'SIRET must be 14 digits with a valid Luhn checksum',
      );
    }
    return new Siret(trimmed);
  }

  toString(): string {
    return this.value;
  }

  get asString(): string {
    return this.value;
  }

  /** The 9-digit SIREN prefix (the company identifier without the establishment NIC). */
  get siren(): string {
    return this.value.slice(0, 9);
  }

  /** The 5-digit NIC suffix (the establishment identifier within the company). */
  get nic(): string {
    return this.value.slice(9);
  }

  equals(other: Siret): boolean {
    return other instanceof Siret && other.value === this.value;
  }
}
