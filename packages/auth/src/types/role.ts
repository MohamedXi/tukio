export type Role = 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super';

export const TUKIO_ROLES: readonly Role[] = [
  'client',
  'pro',
  'admin-support',
  'admin-modo',
  'admin-super',
] as const;

export const ROLE_PRECEDENCE: Role[] = [
  'admin-super',
  'admin-modo',
  'admin-support',
  'pro',
  'client',
];

// Roles that require MFA (TOTP / WebAuthn / mfa-class amr) — explicit Set is
// safer than role-name string-prefix heuristics ("admin-".startsWith).
export const MFA_REQUIRED_ROLES: ReadonlySet<Role> = new Set([
  'admin-support',
  'admin-modo',
  'admin-super',
]);

// Authentication Methods References (RFC 8176) we accept as MFA evidence.
// `totp` is Keycloak's standard claim for OTP; `mfa`/`otp`/`hwk`/`webauthn`
// are alternative Keycloak claims emitted by some authenticator flows.
export const MFA_AMR_VALUES: readonly string[] = ['totp', 'otp', 'mfa', 'hwk', 'webauthn'];
