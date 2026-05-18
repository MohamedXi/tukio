import { RefreshTokenUseCase } from './refresh-token.usecase.js';
import type { CookieDeployment } from '../../infrastructure/http/utils/cookie-helpers.js';
import {
  KeycloakRefreshExpiredError,
  KeycloakRefreshInvalidError,
  KeycloakRefreshReusedError,
  KeycloakUnreachableError,
} from '../../domain/exception/keycloak-oauth.exception.js';

const deployment: CookieDeployment = { domain: null, secure: true };

const happyTokens = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  expiresIn: 300,
  refreshExpiresIn: 1800,
};

function buildUseCase(refreshImpl: () => Promise<typeof happyTokens>): {
  useCase: RefreshTokenUseCase;
  refreshSpy: jest.Mock;
} {
  const refreshSpy = jest.fn(refreshImpl);
  const oauthClient = {
    refreshTokens: refreshSpy,
  } as unknown as ConstructorParameters<
    typeof RefreshTokenUseCase
  >[0]['oauthClient'];
  return {
    useCase: new RefreshTokenUseCase({
      oauthClient,
      cookieDeployment: deployment,
    }),
    refreshSpy,
  };
}

describe('RefreshTokenUseCase (Story 1.4b AC3)', () => {
  it('rotates tokens + preserves csrf cookie (happy)', async () => {
    const { useCase } = buildUseCase(() => Promise.resolve(happyTokens));
    const out = await useCase.execute({
      refreshToken: 'old-refresh',
      csrfToken: 'csrf-existing',
      clientId: 'tukio-web',
    });
    expect(out.expiresIn).toBe(300);
    expect(out.refreshExpiresIn).toBe(1800);
    expect(out.sessionCookies).toHaveLength(4);
    expect(
      out.sessionCookies.some((c) =>
        c.includes('tukio-csrf-token=csrf-existing'),
      ),
    ).toBe(true);
    expect(
      out.sessionCookies.some((c) =>
        c.includes('tukio-access-token=new-access'),
      ),
    ).toBe(true);
  });

  it('throws KeycloakRefreshExpiredError when Keycloak says refresh expired', async () => {
    const { useCase } = buildUseCase(() =>
      Promise.reject(new KeycloakRefreshExpiredError('Token is not active')),
    );
    await expect(
      useCase.execute({
        refreshToken: 'rt',
        csrfToken: 'csrf',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakRefreshExpiredError);
  });

  it('throws KeycloakRefreshReusedError + logs security warning on reuse', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { useCase } = buildUseCase(() =>
      Promise.reject(new KeycloakRefreshReusedError('Token reuse detected')),
    );
    await expect(
      useCase.execute({
        refreshToken: 'rt',
        csrfToken: 'csrf',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakRefreshReusedError);
    warn.mockRestore();
  });

  it('throws KeycloakUnreachableError when Keycloak is down', async () => {
    const { useCase } = buildUseCase(() =>
      Promise.reject(new KeycloakUnreachableError('ECONNREFUSED')),
    );
    await expect(
      useCase.execute({
        refreshToken: 'rt',
        csrfToken: 'csrf',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  });

  it('throws KeycloakRefreshInvalidError on malformed token', async () => {
    const { useCase } = buildUseCase(() =>
      Promise.reject(new KeycloakRefreshInvalidError('malformed jwt')),
    );
    await expect(
      useCase.execute({
        refreshToken: 'rt',
        csrfToken: 'csrf',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakRefreshInvalidError);
  });

  it('calls refreshTokens with the correct payload', async () => {
    const { useCase, refreshSpy } = buildUseCase(() =>
      Promise.resolve(happyTokens),
    );
    await useCase.execute({
      refreshToken: 'rt',
      csrfToken: 'csrf',
      clientId: 'tukio-admin',
    });
    expect(refreshSpy).toHaveBeenCalledWith({
      refreshToken: 'rt',
      clientId: 'tukio-admin',
    });
  });

  it('respects token TTL boundary (returns Keycloak values verbatim)', async () => {
    const { useCase } = buildUseCase(() =>
      Promise.resolve({ ...happyTokens, expiresIn: 1, refreshExpiresIn: 2 }),
    );
    const out = await useCase.execute({
      refreshToken: 'rt',
      csrfToken: 'csrf',
      clientId: 'tukio-web',
    });
    expect(out.expiresIn).toBe(1);
    expect(out.refreshExpiresIn).toBe(2);
  });

  it('handles concurrent refresh race: 1 success, 1 reuse', async () => {
    let calls = 0;
    const { useCase } = buildUseCase(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve(happyTokens);
      return Promise.reject(new KeycloakRefreshReusedError('stale'));
    });
    const a = useCase.execute({
      refreshToken: 'rt',
      csrfToken: 'csrf',
      clientId: 'tukio-web',
    });
    const b = useCase.execute({
      refreshToken: 'rt',
      csrfToken: 'csrf',
      clientId: 'tukio-web',
    });
    const results = await Promise.allSettled([a, b]);
    expect(results.map((r) => r.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
  });

  it('builds 4 cookies with the new access + refresh values', async () => {
    const { useCase } = buildUseCase(() => Promise.resolve(happyTokens));
    const out = await useCase.execute({
      refreshToken: 'rt',
      csrfToken: 'csrf',
      clientId: 'tukio-web',
    });
    expect(
      out.sessionCookies.find((c) =>
        c.includes('tukio-refresh-token=new-refresh'),
      ),
    ).toBeDefined();
    expect(
      out.sessionCookies.find((c) => c.includes('tukio-session-active=1')),
    ).toBeDefined();
  });
});
