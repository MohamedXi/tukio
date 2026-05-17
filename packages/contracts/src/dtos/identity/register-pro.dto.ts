import { z } from 'zod';
import { AcquisitionInputSchema } from './acquisition.dto.js';
import { siretLuhnCheck } from '../../utils/siret.js';

const EMAIL_MIN_LENGTH = 5;
const EMAIL_MAX_LENGTH = 254;
const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 80;
const COMPANY_NAME_MAX_LENGTH = 200;
const STREET_MAX_LENGTH = 200;
const CITY_MAX_LENGTH = 100;
const SERVICE_ZONE_RADIUS_MIN_KM = 1;
const SERVICE_ZONE_RADIUS_MAX_KM = 200;
const MIN_AGE_YEARS = 18;

const LocaleSchema = z.enum(['fr', 'en']);

// See `register-customer.dto.ts` for the same Email recipe — both flows share
// account-layer rules so the user can run the conversion wizard with the same
// email expectations.
const EmailSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.email().min(EMAIL_MIN_LENGTH).max(EMAIL_MAX_LENGTH),
);

/**
 * SIRET = 14 digits + Luhn checksum. Existence/active check against the INSEE
 * SIRENE register is enforced server-side (`InseeSiretValidatorService`,
 * Story 1.3b/1.3b-bis) — this schema only catches client-side format errors.
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
 * `PhoneNumber` value object (Story 1.3a/b, identity-svc) is responsible for
 * normalising to E.164 once parsed.
 */
const PhoneSchema = z
  .string()
  .regex(/^(?:\+33|0)[1-9]\d{8}$/, { message: 'Invalid French phone number' });

/**
 * Date of birth as ISO `YYYY-MM-DD`. The Pro must be at least 18 years old at
 * the moment of submission (legal capacity to contract under FR law) and the
 * date cannot be in the future. Time zone irrelevant here — the comparison is
 * day-resolution against system UTC. Refinements use `Date.UTC` so daylight
 * savings can't shift the boundary by a day.
 */
const DateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, { message: 'Date of birth must be ISO format YYYY-MM-DD' })
  .refine(
    (value) => {
      const [y, m, d] = value.split('-').map(Number) as [number, number, number];
      // Date.UTC never returns NaN for numeric inputs; the round-trip check
      // catches overflows (e.g. Feb 31 silently becomes March 2/3).
      const parsed = Date.UTC(y, m - 1, d);
      const date = new Date(parsed);
      return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    },
    { message: 'Date of birth is not a valid calendar date' },
  )
  .refine(
    (value) => {
      const [y, m, d] = value.split('-').map(Number) as [number, number, number];
      return Date.UTC(y, m - 1, d) <= Date.now();
    },
    { message: 'Date of birth cannot be in the future' },
  )
  .refine(
    (value) => {
      const [y, m, d] = value.split('-').map(Number) as [number, number, number];
      const today = new Date();
      let age = today.getUTCFullYear() - y;
      // Subtract a year if the birthday hasn't passed yet this year.
      const monthDelta = today.getUTCMonth() + 1 - m;
      if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < d)) {
        age -= 1;
      }
      return age >= MIN_AGE_YEARS;
    },
    { message: `Pro must be at least ${MIN_AGE_YEARS} years old` },
  );

/**
 * Legal form (forme juridique) — fixed set for the FR market MVP.
 * Source: Cloud Design `mvp-pro-onboarding.jsx` Step 2 Activité select.
 */
export const LegalFormEnum = z.enum([
  'SAS_SASU',
  'EURL_SARL',
  'MICRO_ENTREPRISE',
  'AUTO_ENTREPRENEUR',
  'ASSO_1901',
]);
export type LegalForm = z.infer<typeof LegalFormEnum>;

/**
 * VAT registration status — drives how prices are displayed on the public
 * listing AND the vatNumber cross-field rule (see superRefine below:
 * `vat_exempt` must NOT carry a vatNumber).
 *
 * `vat_registered` = assujetti à la TVA (art. 256 A CGI).
 * `vat_exempt`     = franchise en base de TVA (art. 293 B CGI).
 */
export const VatStatusEnum = z.enum(['vat_registered', 'vat_exempt']);
export type VatStatus = z.infer<typeof VatStatusEnum>;

/**
 * Categories of activity — MVP whitelist (6 categories for the Pays de la
 * Loire pilot). Pro picks 1-2 max in the wizard via Pill toggles.
 */
export const CategoryEnum = z.enum([
  'tents_marquees',
  'event_furniture',
  'decoration',
  'lighting_sound',
  'catering',
  'entertainment',
]);
export type Category = z.infer<typeof CategoryEnum>;

export const ProAddressSchema = z.object({
  street: z.string().trim().min(1).max(STREET_MAX_LENGTH),
  postalCode: z.string().regex(/^\d{5}$/, { message: 'Postal code must be 5 digits (France MVP)' }),
  city: z.string().trim().min(1).max(CITY_MAX_LENGTH),
  // France-only at MVP. V1 widens to ['FR','BE','CH','LU'] in a follow-up DTO.
  country: z.literal('FR'),
});

export type ProAddressDto = z.infer<typeof ProAddressSchema>;

export const ServiceZoneSchema = z.object({
  city: z.string().trim().min(1).max(CITY_MAX_LENGTH),
  radiusKm: z.number().int().min(SERVICE_ZONE_RADIUS_MIN_KM).max(SERVICE_ZONE_RADIUS_MAX_KM),
});

export type ServiceZoneDto = z.infer<typeof ServiceZoneSchema>;

/**
 * `RegisterProInputSchema` — payload submitted by the Customer→Pro conversion
 * wizard (Story 1.3d v2, frontend on `seller.tukio.one/{locale}/seller/onboarding/{step}`).
 *
 * Story 1.3 was re-cadrée 2026-05-17 (sprint-change-proposal-2026-05-17.md) —
 * the flow is no longer a separate Pro registration at signup. The Customer
 * account already exists (auth via JWT). This payload carries ONLY the data
 * the wizard collects: identity refinements, business info, KYC consent.
 *
 * Removed vs Story 1.3a v1: `password` (no password to set; user already
 * authenticated), `acceptTerms` (accepted on Customer signup Story 1.2a).
 *
 * Added vs Story 1.3a v1: `dateOfBirth`, `legalForm`, `vatStatus`,
 * `categories`, `serviceZone`, `acceptCharter`.
 *
 * Cross-field rule: when `vatStatus === 'vat_exempt'`, `vatNumber` MUST be
 * undefined (a VAT-exempt company cannot carry a VAT number).
 */
export const RegisterProInputSchema = z
  .object({
    // Step 1 — Identity (most fields pre-filled from Customer account but
    // editable; the wizard always submits them so identity-svc can persist any
    // changes onto the new ProProfile aggregate).
    email: EmailSchema,
    firstName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
    lastName: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
    locale: LocaleSchema,
    dateOfBirth: DateOfBirthSchema,
    contactPhone: PhoneSchema,
    acceptMarketing: z.boolean().default(false),
    // Step 2 — Activity
    companyName: z.string().trim().min(1).max(COMPANY_NAME_MAX_LENGTH),
    siret: SiretSchema,
    vatNumber: VatNumberSchema.optional(),
    legalForm: LegalFormEnum,
    vatStatus: VatStatusEnum,
    categories: z
      .array(CategoryEnum)
      .min(1)
      .max(2)
      .refine((cats) => new Set(cats).size === cats.length, {
        message: 'Categories must be unique',
      }),
    serviceZone: ServiceZoneSchema,
    address: ProAddressSchema,
    // Step 4 — Summary (charter acceptance, literal true to force explicit consent)
    acceptCharter: z.literal(true),
    // Cross-cutting
    acquisition: AcquisitionInputSchema.optional(),
    // NB : the three KYC files (idCard, rib, kbisOrInsee) are uploaded as
    // multipart/form-data parts and validated by the gateway-api multer config
    // (Story 1.3c), not by this schema.
  })
  .superRefine((data, ctx) => {
    if (data.vatStatus === 'vat_exempt' && data.vatNumber !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['vatNumber'],
        message: 'vatNumber must be omitted when vatStatus is vat_exempt',
      });
    }
  });

export type RegisterProInputDto = z.infer<typeof RegisterProInputSchema>;

export const RegisterProResponseSchema = z.object({
  userId: z.uuid(),
  proProfileId: z.uuid(),
  requiresAdminReview: z.literal(true),
  requiresEmailVerification: z.literal(false),
});

export type RegisterProResponseDto = z.infer<typeof RegisterProResponseSchema>;
