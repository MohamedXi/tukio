import { useEffect } from 'react';
import { useAuth } from './use-auth.js';
import type { Role } from '../types/actor.js';

export function useRequireRole(
  requiredRoles: Role[],
  options?: { onUnauthorized?: () => void },
): boolean {
  const { role, isAuthenticated, isLoading } = useAuth();
  const hasRole = !!role && requiredRoles.includes(role);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !hasRole)) {
      options?.onUnauthorized?.();
    }
  }, [isLoading, isAuthenticated, hasRole, options]);

  return hasRole;
}
