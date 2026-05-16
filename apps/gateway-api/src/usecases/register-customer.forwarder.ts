import type {
  ForwardRegisterCustomerInput,
  IIdentitySvcClient,
} from '../domain/ports/identity-svc.port.js';
import type { RegisterCustomerResponseDto } from '@tukio/contracts/dtos/identity/register-customer';
import {
  IdentityConflictException,
  ValidationFailedException,
} from '../domain/exception/index.js';
import { ExternalServiceException } from '../domain/exception/external-service.exception.js';
import {
  IdentitySvcConflictError,
  IdentitySvcUnreachableError,
  IdentitySvcValidationError,
} from '../domain/ports/identity-svc.errors.js';

/**
 * Pretre forwarder use case (Story 1.2c).
 *
 * Gateway-api owns no aggregates — this forwarder composes :
 *   1. Validation : already done upstream by the global `ZodValidationPipe` on
 *      the controller (input arrives shape-valid).
 *   2. Downstream call : `identitySvcClient.registerCustomer(input)`.
 *   3. Error mapping : library errors → domain exceptions caught by the
 *      `EnvelopeExceptionFilter` and emitted as canonical error envelopes.
 *
 * Kept framework-free so the forwarder is trivially unit-testable.
 */
export class RegisterCustomerForwarder {
  constructor(private readonly identitySvcClient: IIdentitySvcClient) {}

  async execute(
    input: ForwardRegisterCustomerInput,
  ): Promise<RegisterCustomerResponseDto> {
    try {
      return await this.identitySvcClient.registerCustomer(input);
    } catch (err) {
      throw mapError(err);
    }
  }
}

function mapError(err: unknown): Error {
  if (err instanceof IdentitySvcConflictError) {
    return new IdentityConflictException(err.tukioCode, err.detail);
  }
  if (err instanceof IdentitySvcValidationError) {
    return new ValidationFailedException(err.detail, err.issues);
  }
  if (err instanceof IdentitySvcUnreachableError) {
    return new ExternalServiceException(err.detail);
  }
  // Anything else bubbles up to the global filter as INTERNAL-SERVER-ERROR-001.
  if (err instanceof Error) return err;
  return new Error('Unknown forwarder failure');
}
