import { useAuth } from './use-auth.js';
import { toCoarseRole, type CoarseRole } from '../roles.js';

/**
 * Story 1.4d AC5 — returns the current user's coarse role bucket
 * (`'customer' | 'pro' | 'admin'`) or `null` when unauthenticated.
 * `client` maps to the public-facing `customer`; any `admin-*` collapses
 * to `admin`.
 */
export function useRole(): CoarseRole | null {
  const { role } = useAuth();
  return toCoarseRole(role);
}
