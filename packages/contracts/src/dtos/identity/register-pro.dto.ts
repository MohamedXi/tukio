import { z } from 'zod';
import { AcquisitionInputSchema } from './acquisition.dto.js';
import { siretLuhnCheck } from '../../utils/siret.js';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MIN_LENGTH = 5;
const EMAIL_MAX_LENGTH = 254;
const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 80;
const COMPANY_NAME_MAX_LENGTH = 200;
const STREET_MAX_LENGTH = 200;
const CITY_MAX_LENGTH = 100;

const LocaleSchema = z.enum(['fr', 'en']);

// See `register-customer.dto.ts` for the same Email / Password recipes — the
// Pro flow reuses identical account-layer rules, only the company/address/
// phone fields differ.

const EmailSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.email().min(EMAIL_MIN_LENGTH).max(EMAIL_MAX_LENGTH),
);

const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: 'Password must be at least 12 characters' })
  .max(PASSWORD_MAX_LENGTH)
  .regex(/\p{Ll}/u, { message: 'Password must contain a lowercase letter' })
  .regex(/\p{Lu}/u, { message: 'Password must contain an uppercase letter' })
  .regex(/\d/u, { message: 'Password must contain a digit' })
  .regex(/[^\p{L}\p{N}]/u, { message: 'Password must contain a special character' });

/**
 * SIRET = 14 digits + Luhn checksum. Existence/active check against the INSEE
 * SIRENE register is enforced server-side (`InseeSiretValidatorService`,
 * Story 1.3b) — this schema only catches client-side format errors.
 */
const SiretSchema = z
  .string()
  .regex(/^\d{14}$/, { message: 'SIRET must be exactly 14 digits' })
  .refine(siretLuhnCheck, { message: 'Invalid SIRET (Luhn check failed)' });

/**
 * French intracom VAT number (`FR` + 2-char check key + 9-digit SIREN).
 * The check key is alphanumeric `[0-9A-HJ-NP-Z]` (I and O excluded per EU convention).
 * Examples: `FR12345678901` (numeric key), `FRQU345678901` (alpha key).
 * Normalised to uppercase before validation.
 */
const VatNumberSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
  z.string().regex(/^FR[0-9A-HJ-NP-Z]{2}\d{9}$/, {
    message: 'VAT number must be FR + 2-char check key + 9-digit SIREN',
  }),
);

/**
 * French phone number, accepted as `+33XXXXXXXXX` or `0XXXXXXXXX`. The
 * leading digit (after the country code or 0) must be 1–9. The domain
 * `PhoneNumber` value object (Story 1.3a, identity-svc) is responsible for
 * normalising to E.164 once parsed.
 */
const PhoneSchema = z
  .string()
  .regex(/^(?:\+33|0)[1-9]\d{8}$/, { message: 'Invalid French phone number' });

export const ProAddressSchema = z.object({
  street: z.string().trim().min(1).max(STREET_MAX_LENGTH),
  postalCode: z.string().regex(/^\d{5}$/, { message: 'Postal code must be 5 digits (France MVP)' }),
  city: z.string().trim().min(1).max(CITY_MAX_LENGTH),
  // France-only at MVP. V1 widens to ['FR','BE','CH','LU'] in a follow-up DTO.
  country: z.literal('FR'),
});

export type ProAddressDto = z.infer<typeof ProAddressSchema>;

export const RegisterProInputSchema = z.object({
  // Step 1 — Account
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  lastName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  locale: LocaleSchema,
  acceptTerms: z.literal(true),
  acceptMarketing: z.boolean().default(false),
  // Step 2 — Company
  companyName: z.string().trim().min(1).max(COMPANY_NAME_MAX_LENGTH),
  siret: SiretSchema,
  vatNumber: VatNumberSchema.optional(),
  address: ProAddressSchema,
  contactPhone: PhoneSchema,
  // Cross-cutting
  acquisition: AcquisitionInputSchema.optional(),
  // NB : the three KYC files (idCard, rib, kbisOrInsee) are uploaded as
  // multipart/form-data parts and validated by the gateway-api multer config
  // (Story 1.3c), not by this schema.
});

export type RegisterProInputDto = z.infer<typeof RegisterProInputSchema>;

export const RegisterProResponseSchema = z.object({
  userId: z.uuid(),
  proProfileId: z.uuid(),
  requiresAdminReview: z.literal(true),
  requiresEmailVerification: z.literal(true),
});

export type RegisterProResponseDto = z.infer<typeof RegisterProResponseSchema>;
