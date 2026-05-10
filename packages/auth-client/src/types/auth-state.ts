import type { Role } from './actor.js';

export interface KeycloakUser {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthState {
  user: KeycloakUser | null;
  role: Role | null;
  locale: 'fr' | 'en';
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}
