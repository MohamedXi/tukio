import { createZodDto } from 'nestjs-zod';
import { RegisterCustomerInputSchema } from '@tukio/contracts/dtos/identity/register-customer';

/**
 * NestJS Zod DTO wrapping `RegisterCustomerInputSchema` from `@tukio/contracts`
 * (Story 1.2c — `POST /v1/auth/customer/register`). The global
 * `ZodValidationPipe` validates incoming bodies against this class; invalid
 * bodies surface as `ZodError` and the `EnvelopeExceptionFilter` maps them to
 * `422 VALIDATION-FAILED-001`.
 *
 * Same schema as identity-svc's `RegisterCustomerHttpDto` (Story 1.2b) by
 * design — the gateway just forwards a shape-valid payload.
 */
export class RegisterCustomerHttpDto extends createZodDto(
  RegisterCustomerInputSchema,
) {}
