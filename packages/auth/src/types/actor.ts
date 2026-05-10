export type { Actor } from '@tukio/contracts/types/Actor.js';

// Backend-augmented Actor with auth-specific claims from Keycloak JWT.
export interface BackendActor {
  userId: string;
  role: import('./role.js').Role;
  locale: 'fr' | 'en';
  email: string;
  emailVerified: boolean;
  amr: string[];
}
