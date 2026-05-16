// Symbol DI tokens — Pattern Pretre wiring (Story 0.6 AC3).
// Convention: SCREAMING_SNAKE_CASE matching the port name.
// `Symbol(...)` (NOT `Symbol.for(...)`) → unicité absolue, no cross-service collision risk.
export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
export const PRO_PROFILE_REPOSITORY = Symbol('PRO_PROFILE_REPOSITORY');
export const KEYCLOAK_SYNC = Symbol('KEYCLOAK_SYNC');
export const KEYCLOAK_ADMIN = Symbol('KEYCLOAK_ADMIN');
export const EMAIL_VERIFICATION_TOKEN_REPOSITORY = Symbol(
  'EMAIL_VERIFICATION_TOKEN_REPOSITORY',
);
export const INSEE_SIRET_VALIDATOR = Symbol('INSEE_SIRET_VALIDATOR');
export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
export const LOGGER = Symbol('LOGGER');
export const CONFIG_SERVICE = Symbol('CONFIG_SERVICE');
