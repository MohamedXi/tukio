import type { ValidationIssue } from '@tukio/contracts/envelope';

/**
 * Library-level error classes that the `IIdentitySvcClient` port contract
 * surfaces (Story 1.2c). Kept in `domain/` because they ARE part of the port
 * contract — every implementation (axios today, mock in tests) MUST translate
 * downstream failures into one of these three classes so the forwarder use
 * case can map them to canonical domain exceptions without depending on any
 * concrete HTTP library.
 */

export class IdentitySvcConflictError extends Error {
  constructor(
    /** Stable tukioCode from identity-svc's `error.tukioCode` (e.g. IDENTITY-CONFLICT-001). */
    readonly tukioCode: string,
    /** Human-readable detail forwarded as-is. */
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'IdentitySvcConflictError';
  }
}

export class IdentitySvcValidationError extends Error {
  constructor(
    readonly tukioCode: string,
    readonly detail: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(detail);
    this.name = 'IdentitySvcValidationError';
  }
}

export class IdentitySvcUnreachableError extends Error {
  constructor(
    readonly detail: string,
    /** Underlying axios / network error, if any. Renamed from `cause` to dodge
     *  the built-in `Error.cause` field added in lib.es2022. */
    readonly upstream?: unknown,
  ) {
    super(detail);
    this.name = 'IdentitySvcUnreachableError';
  }
}
