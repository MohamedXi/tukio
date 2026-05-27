// @tukio/auth-client barrel root — Actor + Role types only.
// Import components via subpaths: import { AuthProvider } from '@tukio/auth-client/provider'
export type { Actor, Role } from './types/actor.js';
// KeycloakUser / KeycloakConfig intentionally NOT re-exported — the keycloak-js
// adapter (keycloak-client.ts) was removed in Story 1.4d. Consumers that need
// a user shape should import AuthState directly from '@tukio/auth-client/provider'.
export type { AuthState } from './types/auth-state.js';
