import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from '../providers/auth-provider.js';
import { useAuth } from './use-auth.js';
import { useRole } from './use-role.js';
import { useRequireRole, RoleRequirementError } from './use-require-role.js';
import { useLogout } from './use-logout.js';
import { AUTH_BROADCAST_CHANNEL } from '../refresh/refresh-token-rotation.js';
import type { AuthState } from '../types/auth-state.js';
import { TUKIO_SESSION_MARKER_COOKIE, TUKIO_CSRF_COOKIE } from '../tokens.js';

const makeState = (overrides: Partial<AuthState> = {}): AuthState => ({
  user: { userId: 'u1', email: 'u@example.com', emailVerified: true },
  role: 'client',
  status: 'active',
  locale: 'fr',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  ...overrides,
});

function wrapper(state: AuthState, gatewayBaseUrl = 'https://api.tukio.test') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={{ state, gatewayBaseUrl }}>{children}</AuthContext.Provider>
    );
  };
}

describe('useAuth (AC5)', () => {
  it('returns AuthState from context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(makeState()) });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('client');
  });

  it('exposes the status field (AC4)', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: wrapper(makeState({ status: 'pending_admin_review' })),
    });
    expect(result.current.status).toBe('pending_admin_review');
  });

  it('reflects isLoading from context', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: wrapper(makeState({ isLoading: true })),
    });
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useRole (AC5) — coarse role bucket', () => {
  it('client → customer', () => {
    const { result } = renderHook(() => useRole(), { wrapper: wrapper(makeState()) });
    expect(result.current).toBe('customer');
  });

  it('pro → pro', () => {
    const { result } = renderHook(() => useRole(), {
      wrapper: wrapper(makeState({ role: 'pro' })),
    });
    expect(result.current).toBe('pro');
  });

  it('admin-modo → admin', () => {
    const { result } = renderHook(() => useRole(), {
      wrapper: wrapper(makeState({ role: 'admin-modo' })),
    });
    expect(result.current).toBe('admin');
  });

  it('admin-super → admin', () => {
    const { result } = renderHook(() => useRole(), {
      wrapper: wrapper(makeState({ role: 'admin-super' })),
    });
    expect(result.current).toBe('admin');
  });

  it('admin-support → admin', () => {
    const { result } = renderHook(() => useRole(), {
      wrapper: wrapper(makeState({ role: 'admin-support' })),
    });
    expect(result.current).toBe('admin');
  });

  it('no role → null', () => {
    const { result } = renderHook(() => useRole(), {
      wrapper: wrapper(makeState({ role: null, isAuthenticated: false })),
    });
    expect(result.current).toBeNull();
  });
});

describe('useRequireRole (AC5) — throws when insufficient', () => {
  it('returns role when authorized (single)', () => {
    const { result } = renderHook(() => useRequireRole('customer'), {
      wrapper: wrapper(makeState()),
    });
    expect(result.current).toBe('customer');
  });

  it('returns role when authorized (array)', () => {
    const { result } = renderHook(() => useRequireRole(['admin', 'pro']), {
      wrapper: wrapper(makeState({ role: 'pro' })),
    });
    expect(result.current).toBe('pro');
  });

  it('throws RoleRequirementError when role not in required set', () => {
    expect(() =>
      renderHook(() => useRequireRole('admin'), { wrapper: wrapper(makeState()) }),
    ).toThrow(RoleRequirementError);
  });

  it('throws when unauthenticated', () => {
    expect(() =>
      renderHook(() => useRequireRole('customer'), {
        wrapper: wrapper(makeState({ isAuthenticated: false, role: null })),
      }),
    ).toThrow(RoleRequirementError);
  });

  it('does NOT throw while auth state is loading', () => {
    expect(() =>
      renderHook(() => useRequireRole('admin'), {
        wrapper: wrapper(makeState({ isLoading: true, role: null, isAuthenticated: false })),
      }),
    ).not.toThrow();
  });
});

describe('useLogout (AC5)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=1`;
    document.cookie = `${TUKIO_CSRF_COOKIE}=csrf-xyz`;
    fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = `${TUKIO_CSRF_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  it('POSTs /v1/auth/logout with X-CSRF-Token + credentials', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper: wrapper(makeState()) });
    await act(async () => {
      await result.current();
    });
    const logoutCall = fetchSpy.mock.calls.find((c) => String(c[0]).endsWith('/v1/auth/logout'));
    expect(logoutCall).toBeDefined();
    const init = logoutCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect((init.headers as Headers).get('X-CSRF-Token')).toBe('csrf-xyz');
  });

  it('clears the session marker cookie', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper: wrapper(makeState()) });
    await act(async () => {
      await result.current();
    });
    expect(document.cookie.includes(`${TUKIO_SESSION_MARKER_COOKIE}=1`)).toBe(false);
  });

  it('calls DELETE /api/auth/sync-email-verified', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper: wrapper(makeState()) });
    await act(async () => {
      await result.current();
    });
    const del = fetchSpy.mock.calls.find(
      (c) =>
        String(c[0]).includes('/api/auth/sync-email-verified') &&
        (c[1] as RequestInit)?.method === 'DELETE',
    );
    expect(del).toBeDefined();
  });

  it('broadcasts loggedOut on the tukio-auth channel', async () => {
    const received: unknown[] = [];
    const listener = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    listener.onmessage = (e) => received.push(e.data);
    const { result } = renderHook(() => useLogout(), { wrapper: wrapper(makeState()) });
    await act(async () => {
      await result.current();
    });
    await vi.waitFor(() =>
      expect(received.some((m) => (m as { type: string }).type === 'loggedOut')).toBe(true),
    );
    listener.close();
  });

  it('is non-fatal when the logout request rejects', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useLogout(), { wrapper: wrapper(makeState()) });
    await expect(
      act(async () => {
        await result.current();
      }),
    ).resolves.not.toThrow();
    // Session is still cleared locally.
    expect(document.cookie.includes(`${TUKIO_SESSION_MARKER_COOKIE}=1`)).toBe(false);
  });

  it('targets the gateway base URL from context', async () => {
    const { result } = renderHook(() => useLogout(), {
      wrapper: wrapper(makeState(), 'https://gw.example.com'),
    });
    await act(async () => {
      await result.current();
    });
    expect(fetchSpy.mock.calls.some((c) => c[0] === 'https://gw.example.com/v1/auth/logout')).toBe(
      true,
    );
  });
});
