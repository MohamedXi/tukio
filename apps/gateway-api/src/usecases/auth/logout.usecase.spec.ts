import { LogoutUseCase } from './logout.usecase.js';
import type { CookieDeployment } from '../../infrastructure/http/utils/cookie-helpers.js';
import { KeycloakUnreachableError } from '../../domain/exception/keycloak-oauth.exception.js';

const deployment: CookieDeployment = { domain: null, secure: true };

function buildUseCase(opts: { revokeImpl?: () => Promise<void> }): {
  useCase: LogoutUseCase;
  revokeSpy: jest.Mock;
} {
  const revokeSpy = jest.fn(opts.revokeImpl ?? (() => Promise.resolve()));
  const oauthClient = {
    revokeSession: revokeSpy,
  } as unknown as ConstructorParameters<typeof LogoutUseCase>[0]['oauthClient'];
  return {
    useCase: new LogoutUseCase({ oauthClient, cookieDeployment: deployment }),
    revokeSpy,
  };
}

describe('LogoutUseCase (Story 1.4b AC4)', () => {
  it('revokes session at Keycloak and clears 4 cookies (happy)', async () => {
    const { useCase, revokeSpy } = buildUseCase({});
    const out = await useCase.execute({
      refreshToken: 'rt',
      clientId: 'tukio-web',
    });
    expect(revokeSpy).toHaveBeenCalledWith({
      refreshToken: 'rt',
      clientId: 'tukio-web',
    });
    expect(out.clearCookies).toHaveLength(4);
    expect(
      out.clearCookies.some((c) => c.includes('tukio-access-token=')),
    ).toBe(true);
  });

  it('skips Keycloak call when refresh token absent (idempotent)', async () => {
    const { useCase, revokeSpy } = buildUseCase({});
    const out = await useCase.execute({
      refreshToken: undefined,
      clientId: 'tukio-web',
    });
    expect(revokeSpy).not.toHaveBeenCalled();
    expect(out.clearCookies).toHaveLength(4);
  });

  it('clears cookies even when Keycloak is unreachable', async () => {
    const { useCase, revokeSpy } = buildUseCase({
      revokeImpl: () =>
        Promise.reject(new KeycloakUnreachableError('connection refused')),
    });
    const out = await useCase.execute({
      refreshToken: 'rt',
      clientId: 'tukio-web',
    });
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(out.clearCookies).toHaveLength(4);
  });

  it('still returns Max-Age=0 cookies on revoke success', async () => {
    const { useCase } = buildUseCase({});
    const out = await useCase.execute({
      refreshToken: 'rt',
      clientId: 'tukio-web',
    });
    expect(out.clearCookies.every((c) => c.includes('Max-Age=0'))).toBe(true);
  });
});
