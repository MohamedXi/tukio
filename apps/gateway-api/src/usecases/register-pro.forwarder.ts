import type {
  ForwardRegisterProInput,
  IIdentitySvcClient,
} from '../domain/ports/identity-svc.port.js';
import type { RegisterProResponseDto } from '@tukio/contracts/dtos/identity/register-pro';
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
import {
  proRegistrationAttempts,
  proRegistrationDuration,
} from '../infrastructure/metrics/pro-registration.metrics.js';

/**
 * Pretre forwarder use case (Story 1.3c).
 *
 * Gateway-api owns no aggregates — this forwarder composes :
 *   1. Validation : already done upstream by the multipart parser
 *      (`parseMultipartProRegister`) on the controller via
 *      `RegisterProInputSchema.safeParse` against the `payload` JSON field.
 *      File MIME/size checks happen at `@fastify/multipart` registration time
 *      and inside the parser.
 *   2. Downstream call : `identitySvcClient.registerPro(input)` — multipart
 *      forward with HMAC-signed sentinel (Story 1.3b code-review D1).
 *   3. Error mapping : library errors → domain exceptions caught by the
 *      `EnvelopeExceptionFilter` and emitted as canonical error envelopes.
 *
 * Kept framework-free so the forwarder is trivially unit-testable.
 */
export class RegisterProForwarder {
  constructor(private readonly identitySvcClient: IIdentitySvcClient) {}

  async execute(
    input: ForwardRegisterProInput,
  ): Promise<RegisterProResponseDto> {
    const end = proRegistrationDuration.startTimer();
    try {
      const result = await this.identitySvcClient.registerPro(input);
      proRegistrationAttempts.inc({ outcome: 'success' });
      end({ outcome: 'success' });
      return result;
    } catch (err) {
      const mapped = mapError(err);
      const outcome = classifyOutcome(mapped);
      proRegistrationAttempts.inc({ outcome });
      end({ outcome });
      throw mapped;
    }
  }
}

function classifyOutcome(err: Error): string {
  if (err instanceof IdentityConflictException) return 'conflict';
  if (err instanceof ValidationFailedException) return 'validation_failed';
  if (err instanceof ExternalServiceException) return 'external_unreachable';
  return 'validation_failed';
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
  if (err instanceof Error) return err;
  return new Error('Unknown forwarder failure');
}
