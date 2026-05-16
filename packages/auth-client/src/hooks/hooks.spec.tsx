import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from '../providers/auth-provider.js';
import { useAuth } from './use-auth.js';
import { useRole } from './use-role.js';
import { useRequireRole } from './use-require-role.js';
import type { AuthState } from '../types/auth-state.js';

const makeState = (overrides: Partial<AuthState> = {}): AuthState => ({
  user: { userId: 'u1', emailVerified: true },
  role: 'client',
  locale: 'fr',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  ...overrides,
});

function wrapper(state: AuthState) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={{ state, keycloakClient: null }}>
        {children}
      </AuthContext.Provider>
    );
  };
}

describe('useAuth', () => {
  it('returns AuthState from context', () => {
    const state = makeState();
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(state) });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('client');
  });

  it('isLoading starts as false when provided', () => {
    const state = makeState({ isLoading: false });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(state) });
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useRole', () => {
  it('returns true when role matches', () => {
    const { result } = renderHook(() => useRole(['client', 'pro']), {
      wrapper: wrapper(makeState()),
    });
    expect(result.current).toBe(true);
  });

  it('returns false when role does not match', () => {
    const { result } = renderHook(() => useRole(['admin-modo']), { wrapper: wrapper(makeState()) });
    expect(result.current).toBe(false);
  });

  it('returns false when no role', () => {
    const { result } = renderHook(() => useRole(['client']), {
      wrapper: wrapper(makeState({ role: null })),
    });
    expect(result.current).toBe(false);
  });
});

describe('useRequireRole', () => {
  it('returns true when role authorized', () => {
    const { result } = renderHook(() => useRequireRole(['client']), {
      wrapper: wrapper(makeState()),
    });
    expect(result.current).toBe(true);
  });

  it('calls onUnauthorized when role not authorized', () => {
    const onUnauthorized = vi.fn();
    renderHook(() => useRequireRole(['admin-super'], { onUnauthorized }), {
      wrapper: wrapper(makeState()),
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
