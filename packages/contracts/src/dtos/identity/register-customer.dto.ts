import { z } from 'zod';
import { AcquisitionInputSchema } from './acquisition.dto.js';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MIN_LENGTH = 5;
const EMAIL_MAX_LENGTH = 254;
const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 80;

const LocaleSchema = z.enum(['fr', 'en']);

/**
 * Email preprocessor : trim + lowercase BEFORE running `z.email()` validation.
 * Without this, `z.email()` would reject `'  Alice@Example.COM '` outright —
 * the contract here is case-insensitive email comparison (NFR9 anti-enumeration),
 * so we normalize at the schema boundary instead of relying on downstream
 * Email value-object normalization which would be unreachable.
 */
const EmailSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.email().min(EMAIL_MIN_LENGTH).max(EMAIL_MAX_LENGTH),
);

/**
 * Password complexity (NFR9). "Special character" = any non-alphanumeric Unicode
 * character — Unicode-aware so French / German / other accented characters
 * count as alphanumeric and we don't accidentally reject `Façade-2026!` from FR
 * users. This is broader than the parent spec's literal char class
 * `[!@#$%^&*(),.?":{}|<>]` and is documented in Story 1.2a review findings.
 */
const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: 'Password must be at least 12 characters' })
  .max(PASSWORD_MAX_LENGTH)
  .regex(/\p{Ll}/u, { message: 'Password must contain a lowercase letter' })
  .regex(/\p{Lu}/u, { message: 'Password must contain an uppercase letter' })
  .regex(/\d/u, { message: 'Password must contain a digit' })
  .regex(/[^\p{L}\p{N}]/u, { message: 'Password must contain a special character' });

export const RegisterCustomerInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  lastName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  locale: LocaleSchema,
  acceptTerms: z.literal(true),
  acceptMarketing: z.boolean().default(false),
  acquisition: AcquisitionInputSchema.optional(),
});

export type RegisterCustomerInputDto = z.infer<typeof RegisterCustomerInputSchema>;

export const RegisterCustomerResponseSchema = z.object({
  userId: z.uuid(),
  requiresEmailVerification: z.literal(true),
});

export type RegisterCustomerResponseDto = z.infer<typeof RegisterCustomerResponseSchema>;
