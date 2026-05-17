/**
 * Canonical tukioCode constants emitted by services and surfaced in the REST
 * envelope `error.tukioCode` field (ADR-014). Frontend uses these stable codes
 * to map errors to localized UI messages without relying on server-side strings.
 *
 * Convention: `<DOMAIN>-<CATEGORY>-<NNN>`, three-digit zero-padded counter.
 */

export const IdentityErrorCodes = {
  VALIDATION_INPUT_INVALID: 'IDENTITY-VALIDATION-001',
  VALIDATION_SIRET_INVALID: 'IDENTITY-VALIDATION-002',
  VALIDATION_SIRET_INACTIVE: 'IDENTITY-VALIDATION-003',
  CONFLICT_EMAIL_EXISTS: 'IDENTITY-CONFLICT-001',
  CONFLICT_SIRET_EXISTS: 'IDENTITY-CONFLICT-002',
  CONFLICT_ACTIVE_BOOKINGS: 'IDENTITY-CONFLICT-003',
  NOT_FOUND_USER: 'IDENTITY-NOT-FOUND-001',
  FORBIDDEN_KEYCLOAK_FAIL: 'IDENTITY-FORBIDDEN-001',
  INVALID_PRO_PROFILE: 'IDENTITY-INVALID-001',
  EXTERNAL_KEYCLOAK_DOWN: 'IDENTITY-EXTERNAL-001',
  EXTERNAL_INSEE_UNREACHABLE: 'IDENTITY-EXTERNAL-002',
  EXTERNAL_R2_UPLOAD_FAILED: 'IDENTITY-EXTERNAL-003',
  /** INSEE returned 401/403 — apiKey misconfigured or revoked (Story 1.3b review P5). */
  EXTERNAL_INSEE_AUTH_FAILED: 'IDENTITY-EXTERNAL-004',
} as const;

export type IdentityErrorCode = (typeof IdentityErrorCodes)[keyof typeof IdentityErrorCodes];

export const AuthErrorCodes = {
  NOT_AUTHENTICATED: 'AUTH-NOT-AUTHENTICATED-001',
  TOKEN_EXPIRED: 'AUTH-NOT-AUTHENTICATED-002',
  FORBIDDEN_ROLE: 'AUTH-FORBIDDEN-001',
  FORBIDDEN_INTERNAL: 'AUTH-FORBIDDEN-002',
  MFA_REQUIRED: 'AUTH-MFA-REQUIRED-001',
} as const;

export type AuthErrorCode = (typeof AuthErrorCodes)[keyof typeof AuthErrorCodes];

export const ValidationErrorCodes = {
  FAILED: 'VALIDATION-FAILED-001',
} as const;

export type ValidationErrorCode = (typeof ValidationErrorCodes)[keyof typeof ValidationErrorCodes];

export const RateLimitErrorCodes = {
  EXCEEDED: 'RATE-LIMIT-EXCEEDED-001',
} as const;

export type RateLimitErrorCode = (typeof RateLimitErrorCodes)[keyof typeof RateLimitErrorCodes];
