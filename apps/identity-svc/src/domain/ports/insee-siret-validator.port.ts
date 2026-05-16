import type { Siret } from '../model/siret.value-object.js';
import type { AddressProps } from '../model/address.value-object.js';

/**
 * Domain-level error types thrown by `IInseeSiretValidator` implementations.
 * The infrastructure adapter (Story 1.3b `InseeSiretValidatorService`) maps
 * API-level errors (404, 429, 5xx) to these so use cases never have to know
 * about HTTP status codes.
 */
export class InseeSiretNotFoundError extends Error {
  constructor(siret: string) {
    super(`SIRET ${siret} not found in the INSEE SIRENE register`);
    this.name = 'InseeSiretNotFoundError';
    Object.setPrototypeOf(this, InseeSiretNotFoundError.prototype);
  }
}

export class InseeRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`INSEE API rate limit reached, retry after ${retryAfterMs} ms`);
    this.name = 'InseeRateLimitError';
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, InseeRateLimitError.prototype);
  }
}

export class InseeUnreachableError extends Error {
  readonly underlyingError?: unknown;
  constructor(message: string, underlyingError?: unknown) {
    super(message);
    this.name = 'InseeUnreachableError';
    this.underlyingError = underlyingError;
    Object.setPrototypeOf(this, InseeUnreachableError.prototype);
  }
}

/**
 * `etatAdministratifUniteLegale` from the INSEE SIRENE V3.11 schema. `'A'`
 * means active (declared and not ceased); `'C'` means ceased. Pro
 * registration accepts only `'A'`.
 */
export type InseeEtatAdministratif = 'A' | 'C';

export interface InseeSiretSnapshot {
  etatAdministratif: InseeEtatAdministratif;
  /** Legal company name returned by INSEE (`denominationUniteLegale`). */
  denomination: string | null;
  /** ISO date `YYYY-MM-DD` when the legal entity was created. */
  dateCreation: string | null;
  /** INSEE legal category code (e.g. `'5710'` = SAS). */
  categorieJuridique: string | null;
  /** Canonical address as returned by INSEE — used to seed the Pro profile. */
  address: AddressProps;
}

/**
 * Port — INSEE SIRENE V3.11 SIRET lookup (Pattern Pretre).
 *
 * Implementations are responsible for transport-level concerns (auth header,
 * timeout, retry on transient 5xx) and for translating wire errors to the
 * domain errors declared above.
 */
export interface IInseeSiretValidator {
  validate(siret: Siret): Promise<InseeSiretSnapshot>;
}
