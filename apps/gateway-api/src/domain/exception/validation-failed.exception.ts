import type { ValidationIssue } from '@tukio/contracts/envelope';
import { DomainException } from './domain.exception.js';

/**
 * Carries downstream Zod-validation failures (HTTP 422) back to the caller in
 * the canonical envelope shape. Used when identity-svc rejects a body the
 * gateway's local Zod pipe somehow let through (drift between schemas or
 * stricter downstream check).
 */
export class ValidationFailedException extends DomainException {
  readonly tukioCode = 'VALIDATION-FAILED-001';
  readonly httpStatus = 422;
  readonly title = 'Validation failed';

  constructor(
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
  }
}
