import { createZodDto } from 'nestjs-zod';
import { RegisterCustomerInputSchema } from '@tukio/contracts/dtos/identity/register-customer';

/**
 * NestJS Zod DTO wrapping `RegisterCustomerInputSchema` from `@tukio/contracts`.
 * The global `ZodValidationPipe` (main.ts) validates incoming request bodies
 * against this class; invalid bodies surface as `ZodError` which the
 * `EnvelopeExceptionFilter` maps to `422 VALIDATION-FAILED-001`.
 *
 * Story 1.2b — `POST /internal/customers` body shape.
 */
export class RegisterCustomerHttpDto extends createZodDto(
  RegisterCustomerInputSchema,
) {}
