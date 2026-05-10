import { useAuth } from './use-auth.js';
import type { Role } from '../types/actor.js';

export function useRole(requiredRoles: Role[]): boolean {
  const { role } = useAuth();
  if (!role) return false;
  return requiredRoles.includes(role);
}
