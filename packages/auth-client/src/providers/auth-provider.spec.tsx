import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuthContext } from './auth-provider.js';
import { RefreshTokenRotationManager } from '../refresh/refresh-token-rotation.js';
import type { AuthProviderConfig } from '../types/auth-state.js';
import { TUKIO_SESSION_MARKER_COOKIE, TUKIO_CSRF_COOKIE } from '../tokens.js';

function whoamiResponse(data: Record<string, unknown>, statusCode = 200): Response {
  return new Response(JSON.stringify({ method: 'GET', code: 200, data, meta: {} }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_WHOAMI = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'client@example.com',
  role: ['client'],
  status: 'active',
  locale: 'fr',
  emailVerified: true,
  mfaEnabled: false,
};

function setSession(active: boolean): void {
  if (active) {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=1`;
    document.cookie = `${TUKIO_CSRF_COOKIE}=csrf-abc`;
  } else {
    document.cookie = `${TUKIO_SESSION_MARKER_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

function makeConfig(fetchImpl: typeof fetch): AuthProviderConfig {
  return { gatewayBaseUrl: 'https://api.tukio.test', fetchImpl };
}

// Probe component that surfaces the context state for assertions.
function Probe() {
  const { state } = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{String(state.isLoading)}</span>
      <span data-testid="auth">{String(state.isAuthenticated)}</span>
      <span data-testid="role">{state.role ?? 'none'}</span>
      <span data-testid="status">{state.status ?? 'none'}</span>
      <span data-testid="locale">{state.locale}</span>
      <span data-testid="email">{state.user?.email ?? 'none'}</span>
      <span data-testid="error">{state.error?.code ?? 'none'}</span>
    </div>
  );
}

beforeEach(() => {
  setSession(false);
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  setSession(false);
});

describe('AuthProvider (Story 1.4d AC4)', () => {
  it('1. renders children', () => {
    const fetchImpl = vi.fn().mockResolvedValue(whoamiResponse(VALID_WHOAMI));
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <div data-testid="child">hello</div>
      </AuthProvider>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });

  it('2. no session marker → logged-out, no whoami fetch', async () => {
    const fetchImpl = vi.fn();
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('auth')).toHaveTextContent('false');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('3. session marker + whoami 200 → hydrates user/role/status/locale', async () => {
    setSession(true);
    const fetchImpl = vi.fn().mockResolvedValue(whoamiResponse(VALID_WHOAMI));
    vi.spyOn(RefreshTokenRotationManager.prototype, 'start').mockImplementation(() => {});
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'));
    expect(screen.getByTestId('role')).toHaveTextContent('client');
    expect(screen.getByTestId('status')).toHaveTextContent('active');
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    expect(screen.getByTestId('email')).toHaveTextContent('client@example.com');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.tukio.test/v1/auth/whoami',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('4. resolves the primary role by precedence (admin-modo + client → admin-modo)', async () => {
    setSession(true);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(whoamiResponse({ ...VALID_WHOAMI, role: ['client', 'admin-modo'] }));
    vi.spyOn(RefreshTokenRotationManager.prototype, 'start').mockImplementation(() => {});
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('admin-modo'));
  });

  it('5. whoami 401 → clears session marker and is logged-out', async () => {
    setSession(true);
    const fetchImpl = vi.fn().mockResolvedValue(whoamiResponse({}, 401));
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('auth')).toHaveTextContent('false');
    expect(document.cookie.includes(`${TUKIO_SESSION_MARKER_COOKIE}=1`)).toBe(false);
  });

  it('6. whoami network error → error state (code NETWORK), not authenticated', async () => {
    setSession(true);
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('NETWORK'));
    expect(screen.getByTestId('auth')).toHaveTextContent('false');
  });

  it('7. whoami 5xx → throws → error state', async () => {
    setSession(true);
    const fetchImpl = vi.fn().mockResolvedValue(whoamiResponse({}, 503));
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('NETWORK'));
  });

  it('8. starts the refresh-rotation manager after successful hydration', async () => {
    setSession(true);
    const startSpy = vi
      .spyOn(RefreshTokenRotationManager.prototype, 'start')
      .mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(whoamiResponse(VALID_WHOAMI));
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
  });

  it('9. unmount stops the refresh-rotation manager', async () => {
    setSession(true);
    vi.spyOn(RefreshTokenRotationManager.prototype, 'start').mockImplementation(() => {});
    const stopSpy = vi
      .spyOn(RefreshTokenRotationManager.prototype, 'stop')
      .mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(whoamiResponse(VALID_WHOAMI));
    const { unmount } = render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'));
    unmount();
    expect(stopSpy).toHaveBeenCalled();
  });

  it('10. exposes isLoading=true synchronously before hydration resolves', () => {
    setSession(true);
    const fetchImpl = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('11. hydrates a pro account', async () => {
    setSession(true);
    vi.spyOn(RefreshTokenRotationManager.prototype, 'start').mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        whoamiResponse({ ...VALID_WHOAMI, role: ['pro'], status: 'pending_admin_review' }),
      );
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('pro'));
    expect(screen.getByTestId('status')).toHaveTextContent('pending_admin_review');
  });

  it('12. hydrates an admin account (en locale)', async () => {
    setSession(true);
    vi.spyOn(RefreshTokenRotationManager.prototype, 'start').mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(whoamiResponse({ ...VALID_WHOAMI, role: ['admin-super'], locale: 'en' }));
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('admin-super'));
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });

  it('13. tolerates a flat (non-enveloped) whoami body', async () => {
    setSession(true);
    vi.spyOn(RefreshTokenRotationManager.prototype, 'start').mockImplementation(() => {});
    const flat = new Response(JSON.stringify(VALID_WHOAMI), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchImpl = vi.fn().mockResolvedValue(flat);
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'));
  });

  it('14. whoami data without userId → treated as logged-out', async () => {
    setSession(true);
    const fetchImpl = vi.fn().mockResolvedValue(whoamiResponse({ role: ['client'] }));
    render(
      <AuthProvider config={makeConfig(fetchImpl as never)}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('auth')).toHaveTextContent('false');
  });
});
