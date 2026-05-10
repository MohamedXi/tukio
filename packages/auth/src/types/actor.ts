export type { Actor } from '@tukio/contracts/types/Actor.js';

import type { Role } from './role.js';

// Backend-augmented Actor with auth-specific claims from Keycloak JWT.
// Holds the FULL role set from `realm_access.roles` (after Tukio role filter)
// so RolesGuard can do least-privilege checks (a user with both `admin-modo`
// and `admin-support` matches `@Roles('admin-support')` without collapsing).
// `role` is the precedence-derived primary role (admin-super > admin-modo >
// admin-support > pro > client) used for tracing / X-Tukio-Actor header.
export interface BackendActor {
  userId: string;
  role: Role;
  roles: Role[];
  locale: 'fr' | 'en';
  email: string;
  emailVerified: boolean;
  amr: string[];
  acr?: string;
}
