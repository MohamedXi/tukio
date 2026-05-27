import { useAuth } from './use-auth.js';
import { toCoarseRole, type CoarseRole } from '../roles.js';

/** Thrown by {@link useRequireRole} when the current role is insufficient. */
export class RoleRequirementError extends Error {
  constructor(
    readonly required: CoarseRole[],
    readonly actual: CoarseRole | null,
  ) {
    super(
      `Access denied: requires role [${required.join(', ')}], got ${actual ?? 'unauthenticated'}`,
    );
    this.name = 'RoleRequirementError';
  }
}

/**
 * Story 1.4d AC5 — component-level role guard (defense in depth; the middleware
 * does the primary enforcement). Throws {@link RoleRequirementError} when the
 * authenticated user's coarse role is not in `required`, surfacing to the
 * nearest Error Boundary. No-op while auth state is still loading.
 *
 * Returns the resolved coarse role on success for convenience.
 */
export function useRequireRole(required: CoarseRole | CoarseRole[]): CoarseRole | null {
  const { isLoading, isAuthenticated, role } = useAuth();
  const current = toCoarseRole(role);
  if (isLoading) return current;

  const allowed = Array.isArray(required) ? required : [required];
  if (!isAuthenticated || !current || !allowed.includes(current)) {
    throw new RoleRequirementError(allowed, current);
  }
  return current;
}
