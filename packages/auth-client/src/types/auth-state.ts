import type { Role } from './actor.js';

export interface KeycloakUser {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthError {
  code: 'INIT_FAILED' | 'NETWORK' | 'CONFIG_INVALID';
  message: string;
}

export interface AuthState {
  user: KeycloakUser | null;
  role: Role | null;
  locale: 'fr' | 'en';
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}
