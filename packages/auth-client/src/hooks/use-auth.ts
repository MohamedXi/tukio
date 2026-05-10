import { useAuthContext } from '../providers/auth-provider.js';
import type { AuthState } from '../types/auth-state.js';

export function useAuth(): AuthState {
  const { state } = useAuthContext();
  return state;
}
