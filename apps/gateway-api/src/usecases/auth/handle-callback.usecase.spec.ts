import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { HandleCallbackUseCase } from './handle-callback.usecase.js';
import { encodeState } from '../../infrastructure/http/utils/state-jwt.js';
import {
  buildPkceStateCookie,
  type CookieDeployment,
} from '../../infrastructure/http/utils/cookie-helpers.js';
import { AuthInvalidStateException } from '../../domain/exception/auth-invalid-state.exception.js';
import {
  KeycloakInvalidGrantError,
  KeycloakUnreachableError,
} from '../../domain/exception/keycloak-oauth.exception.js';
import type { ILoginAuditEventPublisher } from '../../domain/ports/login-audit-event-publisher.port.js';
import type { UserLoggedInV1Payload } from '@tukio/contracts/events/identity/user-logged-in.v1';
import type { ZoneBaseUrls } from '../../infrastructure/http/utils/redirect-resolver.js';

const STATE_SECRET = 'state-jwt-test-secret-32-bytes-min!';
const PKCE_SECRET = 'pkce-cookie-test-secret-32-bytes-ok!';
const deployment: CookieDeployment = { domain: null, secure: true };
const zones: ZoneBaseUrls = {
  public: 'https://tukio.one',
  seller: 'https://seller.tukio.one',
  admin: 'https://admin.tukio.one',
};

interface CallbackHarness {
  useCase: HandleCallbackUseCase;
  exchangeSpy: jest.Mock;
  publisher: jest.Mocked<ILoginAuditEventPublisher>;
}

function buildAccessToken(claims: {
  sub?: string;
  roles?: string[];
  status?: string;
  locale?: string;
  amr?: string[];
}): Promise<string> {
  const key = new TextEncoder().encode('test-jwt-signing-key-32-bytes-min!!');
  return new SignJWT({
    realm_access: { roles: claims.roles ?? ['client'] },
    'tukio:status': claims.status,
    'tukio:locale': claims.locale ?? 'fr',
    amr: claims.amr,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub ?? '00000000-0000-0000-0000-000000000001')
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer('test-keycloak')
    .sign(key);
}

function buildHarness(opts: {
  exchangeImpl?: (input: unknown) => Promise<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
    sessionState: string;
  }>;
}): CallbackHarness {
  const exchangeSpy = jest.fn(
    opts.exchangeImpl ??
      (async () => ({
        accessToken: await buildAccessToken({ roles: ['client'] }),
        refreshToken: 'refresh-jwt',
        idToken: 'id-jwt',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        sessionState: 'sess',
      })),
  );
  const oauthClient = {
    exchangeCodeForTokens: exchangeSpy,
  } as unknown as ConstructorParameters<
    typeof HandleCallbackUseCase
  >[0]['oauthClient'];
  const publisher: jest.Mocked<ILoginAuditEventPublisher> = {
    publishLoggedIn: jest.fn(
      (payload: UserLoggedInV1Payload): Promise<void> => {
        void payload;
        return Promise.resolve();
      },
    ),
  };
  return {
    exchangeSpy,
    publisher,
    useCase: new HandleCallbackUseCase({
      oauthClient,
      auditPublisher: publisher,
      stateJwtSecret: STATE_SECRET,
      pkceCookieSecret: PKCE_SECRET,
      cookieDeployment: deployment,
      zoneBaseUrls: zones,
      isDev: false,
    }),
  };
}

async function buildValidPkceFor(state: string): Promise<string> {
  // strip the cookie-attribute formatting to keep only the value (between
  // `tukio-pkce-state=` and the first `;`).
  const raw = await buildPkceStateCookie(
    {
      verifier: 'verifier-32-bytes-aaaaaaaaaaaaaaaaaaaa',
      originalState: state,
    },
    PKCE_SECRET,
    deployment,
  );
  const value = raw.split(';')[0]!.replace('tukio-pkce-state=', '');
  return value;
}

async function buildValidState(next: string | null = null): Promise<string> {
  return encodeState(
    { next, requestId: randomUUID(), issuedAt: new Date().toISOString() },
    STATE_SECRET,
  );
}

describe('HandleCallbackUseCase (Story 1.4b AC2)', () => {
  it('redirects Customer to /account/dashboard on success', async () => {
    const harness = buildHarness({
      exchangeImpl: async () => ({
        accessToken: await buildAccessToken({ roles: ['client'] }),
        refreshToken: 'rt',
        idToken: 'idt',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        sessionState: 'ss',
      }),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.redirectUrl).toBe('https://tukio.one/fr/account/dashboard');
    expect(out.sessionCookies).toHaveLength(4);
    expect(out.clearPkceCookie).toContain('tukio-pkce-state=');
    expect(out.clearPkceCookie).toContain('Max-Age=0');
  });

  it('redirects Pro pending_admin_review to seller onboarding/pending', async () => {
    const harness = buildHarness({
      exchangeImpl: async () => ({
        accessToken: await buildAccessToken({
          roles: ['client', 'pro'],
          status: 'pending_admin_review',
        }),
        refreshToken: 'rt',
        idToken: 'idt',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        sessionState: 'ss',
      }),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.redirectUrl).toBe(
      'https://seller.tukio.one/fr/seller/onboarding/pending',
    );
  });

  it('redirects Pro active to seller/dashboard', async () => {
    const harness = buildHarness({
      exchangeImpl: async () => ({
        accessToken: await buildAccessToken({
          roles: ['pro'],
          status: 'active',
        }),
        refreshToken: 'rt',
        idToken: 'idt',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        sessionState: 'ss',
      }),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.redirectUrl).toBe(
      'https://seller.tukio.one/fr/seller/dashboard',
    );
  });

  it('redirects Pro rejected to seller/onboarding/rejected', async () => {
    const harness = buildHarness({
      exchangeImpl: async () => ({
        accessToken: await buildAccessToken({
          roles: ['pro'],
          status: 'rejected',
        }),
        refreshToken: 'rt',
        idToken: 'idt',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        sessionState: 'ss',
      }),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.redirectUrl).toBe(
      'https://seller.tukio.one/fr/seller/onboarding/rejected',
    );
  });

  it('redirects Admin with TOTP to admin/dashboard', async () => {
    const harness = buildHarness({
      exchangeImpl: async () => ({
        accessToken: await buildAccessToken({
          roles: ['admin-super'],
          amr: ['pwd', 'totp'],
        }),
        refreshToken: 'rt',
        idToken: 'idt',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        sessionState: 'ss',
      }),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-admin',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.redirectUrl).toBe('https://admin.tukio.one/fr/admin/dashboard');
  });

  it('honors whitelisted next override', async () => {
    const harness = buildHarness({});
    const state = await buildValidState(
      'https://customer.tukio.one/account/messages',
    );
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.redirectUrl).toBe('https://customer.tukio.one/account/messages');
  });

  it('throws AuthInvalidStateException when pkce cookie absent', async () => {
    const harness = buildHarness({});
    const state = await buildValidState();
    await expect(
      harness.useCase.execute({
        code: 'auth-code',
        state,
        locale: 'fr',
        pkceCookie: undefined,
        clientId: 'tukio-web',
        ipHash: 'a'.repeat(64),
        userAgentHash: 'b'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(AuthInvalidStateException);
  });

  it('throws AuthInvalidStateException when pkce cookie tampered', async () => {
    const harness = buildHarness({});
    const state = await buildValidState();
    await expect(
      harness.useCase.execute({
        code: 'auth-code',
        state,
        locale: 'fr',
        pkceCookie: 'totally-not-a-jwe',
        clientId: 'tukio-web',
        ipHash: 'a'.repeat(64),
        userAgentHash: 'b'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(AuthInvalidStateException);
  });

  it('throws AuthInvalidStateException when state mismatches pkce cookie', async () => {
    const harness = buildHarness({});
    const stateA = await buildValidState();
    const stateB = await buildValidState();
    const pkce = await buildValidPkceFor(stateA);
    await expect(
      harness.useCase.execute({
        code: 'auth-code',
        state: stateB,
        locale: 'fr',
        pkceCookie: pkce,
        clientId: 'tukio-web',
        ipHash: 'a'.repeat(64),
        userAgentHash: 'b'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(AuthInvalidStateException);
  });

  it('throws AuthInvalidStateException when state JWT signature invalid', async () => {
    const harness = buildHarness({});
    const goodState = await buildValidState();
    const pkce = await buildValidPkceFor('not-a-jwt');
    await expect(
      harness.useCase.execute({
        code: 'auth-code',
        state: goodState,
        locale: 'fr',
        pkceCookie: pkce,
        clientId: 'tukio-web',
        ipHash: 'a'.repeat(64),
        userAgentHash: 'b'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(AuthInvalidStateException);
  });

  it('propagates KeycloakInvalidGrantError when code is invalid', async () => {
    const harness = buildHarness({
      exchangeImpl: () =>
        Promise.reject(
          new KeycloakInvalidGrantError('invalid authorization code'),
        ),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    await expect(
      harness.useCase.execute({
        code: 'bad-code',
        state,
        locale: 'fr',
        pkceCookie: pkce,
        clientId: 'tukio-web',
        ipHash: 'a'.repeat(64),
        userAgentHash: 'b'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(KeycloakInvalidGrantError);
  });

  it('propagates KeycloakUnreachableError when Keycloak is down', async () => {
    const harness = buildHarness({
      exchangeImpl: () =>
        Promise.reject(new KeycloakUnreachableError('ECONNREFUSED')),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    await expect(
      harness.useCase.execute({
        code: 'auth-code',
        state,
        locale: 'fr',
        pkceCookie: pkce,
        clientId: 'tukio-web',
        ipHash: 'a'.repeat(64),
        userAgentHash: 'b'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  });

  it('fires audit event with sanitized payload', async () => {
    const harness = buildHarness({});
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    // publishLoggedIn is fire-and-forget; await microtask flush.
    await new Promise((r) => setImmediate(r));
    expect(harness.publisher.publishLoggedIn).toHaveBeenCalledTimes(1);
    const payload = harness.publisher.publishLoggedIn.mock.calls[0]![0];
    expect(payload.role).toContain('client');
    expect(payload.locale).toBe('fr');
    expect(payload.ipHash).toBe('a'.repeat(64));
  });

  it('does NOT fail callback when audit publisher throws', async () => {
    const harness = buildHarness({});
    harness.publisher.publishLoggedIn.mockRejectedValueOnce(
      new Error('NATS down'),
    );
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    await expect(
      harness.useCase.execute({
        code: 'auth-code',
        state,
        locale: 'fr',
        pkceCookie: pkce,
        clientId: 'tukio-web',
        ipHash: 'a'.repeat(64),
        userAgentHash: 'b'.repeat(64),
      }),
    ).resolves.toBeDefined();
    await new Promise((r) => setImmediate(r));
  });

  it('sends Secure cookies in non-dev deployment', async () => {
    const harness = buildHarness({});
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.sessionCookies.every((c) => c.includes('Secure'))).toBe(true);
  });

  it('suspended Pro account redirects to login?error=account_suspended', async () => {
    const harness = buildHarness({
      exchangeImpl: async () => ({
        accessToken: await buildAccessToken({
          roles: ['pro'],
          status: 'suspended',
        }),
        refreshToken: 'rt',
        idToken: 'idt',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        sessionState: 'ss',
      }),
    });
    const state = await buildValidState();
    const pkce = await buildValidPkceFor(state);
    const out = await harness.useCase.execute({
      code: 'auth-code',
      state,
      locale: 'fr',
      pkceCookie: pkce,
      clientId: 'tukio-web',
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
    });
    expect(out.redirectUrl).toContain('error=account_suspended');
  });
});
