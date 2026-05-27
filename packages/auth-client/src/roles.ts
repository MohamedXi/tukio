import type { Role } from './types/actor.js';

// Most-privileged first — the primary role wins when a user holds several.
export const ROLE_PRECEDENCE: readonly Role[] = [
  'admin-super',
  'admin-modo',
  'admin-support',
  'pro',
  'client',
];

/** Coarse role buckets surfaced to UI code (Story 1.4d AC5 `useRole`). */
export type CoarseRole = 'customer' | 'pro' | 'admin';

/**
 * Resolve the primary Tukio role from a JWT/whoami role array using precedence.
 * Returns `null` when the array contains no recognised Tukio role.
 */
export function extractPrimaryRole(roles: readonly string[]): Role | null {
  for (const r of ROLE_PRECEDENCE) {
    if (roles.includes(r)) return r;
  }
  return null;
}

/**
 * Map a fine-grained Tukio role to the coarse UI bucket. `client` → `customer`
 * (the public-facing term), `pro` → `pro`, any `admin-*` → `admin`.
 */
export function toCoarseRole(role: Role | null): CoarseRole | null {
  if (!role) return null;
  if (role === 'client') return 'customer';
  if (role === 'pro') return 'pro';
  return 'admin';
}
