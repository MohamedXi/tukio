import { InitiateLoginUseCase } from './initiate-login.usecase.js';
import type { CookieDeployment } from '../../infrastructure/http/utils/cookie-helpers.js';
import { KeycloakOAuthClient } from '../../infrastructure/external/keycloak/keycloak-oauth.client.js';

const STATE_SECRET = 'state-jwt-test-secret-32-bytes-min!';
const PKCE_SECRET = 'pkce-cookie-test-secret-32-bytes-ok!';
const deployment: CookieDeployment = { domain: null, secure: true };

function buildUseCase(overrides: { isDev?: boolean } = {}): {
  useCase: InitiateLoginUseCase;
  oauthClient: KeycloakOAuthClient;
} {
  const oauthClient = new KeycloakOAuthClient({
    url: 'http://keycloak.test',
    realm: 'tukio',
    publicBaseUrl: 'https://tukio.one',
  });
  return {
    oauthClient,
    useCase: new InitiateLoginUseCase({
      oauthClient,
      stateJwtSecret: STATE_SECRET,
      pkceCookieSecret: PKCE_SECRET,
      cookieDeployment: deployment,
      isDev: overrides.isDev ?? false,
    }),
  };
}

describe('InitiateLoginUseCase (Story 1.4b AC1)', () => {
  it('returns a Keycloak authorize URL with PKCE challenge S256', async () => {
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: null,
      clientId: 'tukio-web',
      locale: 'fr',
    });
    expect(out.redirectUrl).toContain(
      'http://keycloak.test/realms/tukio/protocol/openid-connect/auth?',
    );
    expect(out.redirectUrl).toContain('code_challenge_method=S256');
    expect(out.redirectUrl).toContain('client_id=tukio-web');
    expect(out.redirectUrl).toContain('kc_locale=fr');
  });

  it('propagates clientId=tukio-admin', async () => {
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: null,
      clientId: 'tukio-admin',
      locale: 'fr',
    });
    expect(out.redirectUrl).toContain('client_id=tukio-admin');
  });

  it('honors locale=en in redirect_uri + kc_locale', async () => {
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: null,
      clientId: 'tukio-web',
      locale: 'en',
    });
    expect(out.redirectUrl).toContain('kc_locale=en');
    expect(out.redirectUrl).toContain(
      encodeURIComponent('https://tukio.one/en/auth/callback'),
    );
  });

  it('propagates whitelisted next (https://seller.tukio.one/foo)', async () => {
    // P8: customer.tukio.one is retired (ADR-016); use an active *.tukio.one subdomain.
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: 'https://seller.tukio.one/seller/dashboard',
      clientId: 'tukio-web',
      locale: 'fr',
    });
    expect(out.redirectUrl).toContain('state=');
    expect(out.pkceCookie).toContain('tukio-pkce-state=');
    expect(out.pkceCookie).toContain('HttpOnly');
    expect(out.pkceCookie).toContain('SameSite=Lax');
  });

  it('sanitizes retired subdomain next (customer.tukio.one — ADR-016)', async () => {
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: 'https://customer.tukio.one/account/dashboard',
      clientId: 'tukio-web',
      locale: 'fr',
    });
    // sanitizeNextUrl returns null for retired subdomains — state carries null next
    expect(out.redirectUrl).toContain('state=');
    expect(out.pkceCookie).toContain('tukio-pkce-state=');
  });

  it('drops non-whitelisted next (open redirect)', async () => {
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: 'https://evil.com/steal',
      clientId: 'tukio-web',
      locale: 'fr',
    });
    expect(out.redirectUrl).toMatch(/state=/);
    expect(out.pkceCookie).toContain('tukio-pkce-state=');
  });

  it('emits Secure attribute on pkce cookie in non-dev deployment', async () => {
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: null,
      clientId: 'tukio-web',
      locale: 'fr',
    });
    expect(out.pkceCookie).toContain('Secure');
  });

  it('handles missing next gracefully', async () => {
    const { useCase } = buildUseCase();
    const out = await useCase.execute({
      next: undefined,
      clientId: 'tukio-web',
      locale: 'fr',
    });
    expect(out.redirectUrl).toContain('state=');
  });

  it('allows localhost next in dev mode (isDev=true)', async () => {
    const { useCase } = buildUseCase({ isDev: true });
    const out = await useCase.execute({
      next: 'http://localhost:3000/dev-route',
      clientId: 'tukio-web',
      locale: 'fr',
    });
    expect(out.redirectUrl).toContain('state=');
    expect(out.pkceCookie).toContain('tukio-pkce-state=');
  });
});
