export type { KeycloakConfig } from '../types/auth-state.js';

export class KeycloakInitError extends Error {
  constructor(message = 'Keycloak initialization failed') {
    super(message);
    this.name = 'KeycloakInitError';
    Object.setPrototypeOf(this, KeycloakInitError.prototype);
  }
}
