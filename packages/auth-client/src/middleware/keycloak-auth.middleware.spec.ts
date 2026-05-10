import { describe, it, expect } from 'vitest';
import { createKeycloakAuthMiddleware } from './keycloak-auth.middleware.js';
import { TUKIO_SESSION_MARKER_COOKIE } from '../tokens.js';

// Minimal mock of NextRequest / NextResponse for edge runtime middleware tests
function mockRequest(path: string, hasCookie = false) {
  const cookies = {
    get: (name: string) =>
      hasCookie && name === TUKIO_SESSION_MARKER_COOKIE ? { value: '1' } : undefined,
  };
  return {
    nextUrl: { pathname: path, toString: () => `https://tukio.one${path}` },
    cookies,
  };
}

// Vitest mocks for next/server
vi.mock('next/server.js', () => ({
  NextResponse: {
    next: () => ({ _type: 'next' }),
    redirect: (url: URL) => ({ _type: 'redirect', url: url.toString() }),
  },
}));

import { vi } from 'vitest';

const config = {
  protectedPaths: ['/account', '/cart'],
  loginRedirectUri: 'https://auth.tukio.one/realms/tukio/protocol/openid-connect/auth',
};

describe('createKeycloakAuthMiddleware', () => {
  const middleware = createKeycloakAuthMiddleware(config);

  it('passes through unprotected paths', () => {
    const res = middleware(mockRequest('/public') as never);
    expect((res as unknown as { _type: string })._type).toBe('next');
  });

  it('passes through when session cookie present on protected path', () => {
    const res = middleware(mockRequest('/account/dashboard', true) as never);
    expect((res as unknown as { _type: string })._type).toBe('next');
  });

  it('redirects when no session cookie on protected path', () => {
    const res = middleware(mockRequest('/account/dashboard', false) as never);
    expect((res as unknown as { _type: string })._type).toBe('redirect');
    expect((res as unknown as { url: string }).url).toContain('auth.tukio.one');
  });

  it('includes redirect_uri in the login redirect URL', () => {
    const res = middleware(mockRequest('/cart', false) as never) as unknown as { url: string };
    expect(res.url).toContain('redirect_uri=');
  });
});
