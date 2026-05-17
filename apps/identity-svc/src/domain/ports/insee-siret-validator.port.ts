import type { Siret } from '../model/siret.value-object.js';

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
 * INSEE returned 401/403 — apiKey is misconfigured or revoked. Distinct from
 * `InseeUnreachableError` so the use case can surface a different tukioCode
 * (`IDENTITY-EXTERNAL-AUTH_FAILED`) and ops alerting can page on
 * "INSEE creds bad" without it drowning in transient outage noise
 * (Story 1.3b code-review P5).
 */
export class InseeAuthFailedError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`INSEE SIRENE API authentication failed (status ${status})`);
    this.name = 'InseeAuthFailedError';
    this.status = status;
    Object.setPrototypeOf(this, InseeAuthFailedError.prototype);
  }
}

/**
 * Administrative status of a legal entity in the INSEE SIRENE register.
 * Mapped from the raw French API value `etatAdministratifUniteLegale`:
 *   `'A'` (actif) → `'active'`, `'C'` (cessé) → `'ceased'`.
 * Pro registration only accepts `'active'`.
 */
export type InseeAdministrativeStatus = 'active' | 'ceased';

export interface InseeSiretSnapshot {
  administrativeStatus: InseeAdministrativeStatus;
  /** Legal company name (`denominationUniteLegale`). Null if not available. */
  legalName: string | null;
  /** ISO date `YYYY-MM-DD` when the legal entity was incorporated (`dateCreationUniteLegale`). */
  incorporationDate: string | null;
  /** INSEE legal category code e.g. `'5710'` = SAS (`categorieJuridiqueUniteLegale`). */
  legalCategory: string | null;
  /**
   * NAF activity code e.g. `'5310Z'` = postal services (`activitePrincipaleUniteLegale`).
   * Needed by AC10 metrics dashboard (parent Story 1.3). Added in Story 1.3b code-review D3.
   */
  naf: string | null;
}

/**
 * Port — INSEE SIRENE V3.11 SIRET lookup (Pattern Pretre).
 *
 * Implementations are responsible for transport-level concerns (auth header,
 * timeout, retry on transient 5xx) and for translating wire errors to the
 * domain errors declared above.
 *
 * INSEE auth: `X-INSEE-Api-Key-Integration` header (apiKey, not OAuth2).
 * Rate limit: 30 req/min on the integration endpoint.
 */
export interface IInseeSiretValidator {
  validate(siret: Siret): Promise<InseeSiretSnapshot>;
}
