// Symbol DI tokens — Pattern Pretre wiring (Story 0.6 AC3).
// Gateway-api is a BFF — only depends on downstream service client ports.
//
// Convention: SCREAMING_SNAKE_CASE matching the port name.
// `Symbol(...)` (NOT `Symbol.for(...)`) → unicité absolue, no cross-service collision risk.
export const LOGGER = Symbol('LOGGER');
export const CONFIG_SERVICE = Symbol('CONFIG_SERVICE');
export const IDENTITY_SVC_CLIENT = Symbol('IDENTITY_SVC_CLIENT');
