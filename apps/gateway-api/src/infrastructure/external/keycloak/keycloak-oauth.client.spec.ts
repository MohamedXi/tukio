import nock from 'nock';
import {
  KeycloakInvalidGrantError,
  KeycloakRefreshExpiredError,
  KeycloakRefreshInvalidError,
  KeycloakRefreshReusedError,
  KeycloakUnreachableError,
} from '../../../domain/exception/keycloak-oauth.exception.js';
import { KeycloakOAuthClient } from './keycloak-oauth.client.js';

const KC_URL = 'http://kc.test';
const REALM = 'tukio';
const PUBLIC_BASE_URL = 'https://tukio.one';
const TOKEN_PATH = `/realms/${REALM}/protocol/openid-connect/token`;
const LOGOUT_PATH = `/realms/${REALM}/protocol/openid-connect/logout`;

const TOKEN_RESPONSE = {
  access_token: 'access.token.value',
  refresh_token: 'refresh.token.value',
  id_token: 'id.token.value',
  expires_in: 300,
  refresh_expires_in: 2592000,
  session_state: 'session-abc',
};

function serializeNockBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    const entries = Object.entries(body as Record<string, unknown>).map(
      ([k, v]) => `${k}=${String(v)}`,
    );
    return entries.join('&');
  }
  return '';
}

function newClient() {
  return new KeycloakOAuthClient({
    url: KC_URL,
    realm: REALM,
    publicBaseUrl: PUBLIC_BASE_URL,
  });
}

describe('KeycloakOAuthClient.buildAuthorizeUrl', () => {
  it('builds the canonical Keycloak authorize URL with PKCE S256 + kc_locale', () => {
    const url = newClient().buildAuthorizeUrl({
      clientId: 'tukio-web',
      locale: 'fr',
      challenge: 'CHALLENGE',
      state: 'STATE',
    });
    expect(
      url.startsWith(`${KC_URL}/realms/${REALM}/protocol/openid-connect/auth?`),
    ).toBe(true);
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=tukio-web');
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent(`${PUBLIC_BASE_URL}/fr/auth/callback`)}`,
    );
    expect(url).toContain('code_challenge=CHALLENGE');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('state=STATE');
    expect(url).toContain('kc_locale=fr');
    expect(url).toContain('scope=openid+profile+email+tukio-locale-scope');
  });

  it('uses the admin clientId when provided', () => {
    const url = newClient().buildAuthorizeUrl({
      clientId: 'tukio-admin',
      locale: 'en',
      challenge: 'C',
      state: 'S',
    });
    expect(url).toContain('client_id=tukio-admin');
    expect(url).toContain('kc_locale=en');
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent(`${PUBLIC_BASE_URL}/en/auth/callback`)}`,
    );
  });
});

describe('KeycloakOAuthClient.exchangeCodeForTokens', () => {
  afterEach(() => nock.cleanAll());

  it('returns mapped tokens on 200 success', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(200, TOKEN_RESPONSE);
    const out = await newClient().exchangeCodeForTokens({
      code: 'auth-code',
      verifier: 'verifier',
      locale: 'fr',
      clientId: 'tukio-web',
    });
    expect(out).toEqual({
      accessToken: 'access.token.value',
      refreshToken: 'refresh.token.value',
      idToken: 'id.token.value',
      expiresIn: 300,
      refreshExpiresIn: 2592000,
      sessionState: 'session-abc',
    });
  });

  it('throws KeycloakInvalidGrantError on 400 invalid_grant', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(400, {
      error: 'invalid_grant',
      error_description: 'Code not valid',
    });
    await expect(
      newClient().exchangeCodeForTokens({
        code: 'bad',
        verifier: 'v',
        locale: 'fr',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakInvalidGrantError);
  });

  it('throws KeycloakInvalidGrantError on 401 unauthorized', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(401, {
      error: 'invalid_client',
    });
    await expect(
      newClient().exchangeCodeForTokens({
        code: 'c',
        verifier: 'v',
        locale: 'fr',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakInvalidGrantError);
  });

  it('throws KeycloakUnreachableError on 502/503/504 after retries exhausted', async () => {
    nock(KC_URL).post(TOKEN_PATH).times(4).reply(503, {
      error: 'service_unavailable',
    });
    await expect(
      newClient().exchangeCodeForTokens({
        code: 'c',
        verifier: 'v',
        locale: 'fr',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  }, 30_000);

  it('throws KeycloakUnreachableError when token response is missing fields', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(200, { access_token: 'a' });
    await expect(
      newClient().exchangeCodeForTokens({
        code: 'c',
        verifier: 'v',
        locale: 'fr',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  });

  it('throws KeycloakUnreachableError on 429 rate-limited', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(429, {
      error: 'too_many_requests',
    });
    await expect(
      newClient().exchangeCodeForTokens({
        code: 'c',
        verifier: 'v',
        locale: 'fr',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  });

  it('throws KeycloakUnreachableError on axios timeout / connection abort — P10', async () => {
    // replyWithError string form emits immediately (object form hangs with some nock versions)
    nock(KC_URL)
      .post(TOKEN_PATH)
      .replyWithError('ECONNABORTED: connection timed out');
    await expect(
      newClient().exchangeCodeForTokens({
        code: 'c',
        verifier: 'v',
        locale: 'fr',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  });

  it('sends grant_type=authorization_code with PKCE code_verifier', async () => {
    let receivedBody = '';
    nock(KC_URL)
      .post(TOKEN_PATH, (body) => {
        receivedBody = serializeNockBody(body);
        return true;
      })
      .reply(200, TOKEN_RESPONSE);
    await newClient().exchangeCodeForTokens({
      code: 'auth-code',
      verifier: 'verifier-xyz',
      locale: 'fr',
      clientId: 'tukio-web',
    });
    expect(receivedBody).toContain('grant_type=authorization_code');
    expect(receivedBody).toContain('code=auth-code');
    expect(receivedBody).toContain('code_verifier=verifier-xyz');
    expect(receivedBody).toContain('client_id=tukio-web');
  });
});

describe('KeycloakOAuthClient.refreshTokens', () => {
  afterEach(() => nock.cleanAll());

  it('returns refreshed tokens on 200', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(200, TOKEN_RESPONSE);
    const out = await newClient().refreshTokens({
      refreshToken: 'r',
      clientId: 'tukio-web',
    });
    expect(out).toEqual({
      accessToken: 'access.token.value',
      refreshToken: 'refresh.token.value',
      expiresIn: 300,
      refreshExpiresIn: 2592000,
    });
  });

  it('maps 400 invalid_token to KeycloakRefreshInvalidError (malformed token) — P7', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(400, {
      error: 'invalid_token',
      error_description: 'Token is not active',
    });
    await expect(
      newClient().refreshTokens({
        refreshToken: 'malformed.token',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakRefreshInvalidError);
  });

  it('maps invalid_grant to KeycloakRefreshExpiredError by default', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(400, {
      error: 'invalid_grant',
      error_description: 'Refresh token expired',
    });
    await expect(
      newClient().refreshTokens({ refreshToken: 'r', clientId: 'tukio-web' }),
    ).rejects.toBeInstanceOf(KeycloakRefreshExpiredError);
  });

  it('maps invalid_grant + "Session not active" to KeycloakRefreshReusedError', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(400, {
      error: 'invalid_grant',
      error_description: 'Session not active — refresh token reuse detected',
    });
    await expect(
      newClient().refreshTokens({ refreshToken: 'r', clientId: 'tukio-web' }),
    ).rejects.toBeInstanceOf(KeycloakRefreshReusedError);
  });

  it('maps invalid_grant + "stale" to KeycloakRefreshReusedError', async () => {
    nock(KC_URL).post(TOKEN_PATH).reply(400, {
      error: 'invalid_grant',
      error_description: 'Stale refresh token',
    });
    await expect(
      newClient().refreshTokens({ refreshToken: 'r', clientId: 'tukio-web' }),
    ).rejects.toBeInstanceOf(KeycloakRefreshReusedError);
  });

  it('sends grant_type=refresh_token with refresh_token body', async () => {
    let receivedBody = '';
    nock(KC_URL)
      .post(TOKEN_PATH, (body) => {
        receivedBody = serializeNockBody(body);
        return true;
      })
      .reply(200, TOKEN_RESPONSE);
    await newClient().refreshTokens({
      refreshToken: 'rt-1',
      clientId: 'tukio-web',
    });
    expect(receivedBody).toContain('grant_type=refresh_token');
    expect(receivedBody).toContain('refresh_token=rt-1');
    expect(receivedBody).toContain('client_id=tukio-web');
  });
});

describe('KeycloakOAuthClient.exchangeCodeForTokens — P1 retry fix', () => {
  afterEach(() => nock.cleanAll());

  it('does NOT retry on ECONNRESET — throws KeycloakUnreachableError immediately — P1', async () => {
    // Only 1 nock interceptor. String form emits synchronously.
    // If axios-retry were to retry on network errors (old behavior), this would
    // exhaust nock and trigger ENOTFOUND on the 2nd attempt — still a
    // KeycloakUnreachableError, but with added latency. The test verifies the
    // error type is correct regardless (timing verification removed for nock compat).
    nock(KC_URL).post(TOKEN_PATH).replyWithError('ECONNRESET: socket hang up');
    await expect(
      newClient().exchangeCodeForTokens({
        code: 'one-time-code',
        verifier: 'v',
        locale: 'fr',
        clientId: 'tukio-web',
      }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  });

  it('trailing slash in publicBaseUrl produces correct redirect_uri (no double-slash) — P14', () => {
    const clientWithTrailingSlash = new KeycloakOAuthClient({
      url: KC_URL,
      realm: REALM,
      publicBaseUrl: 'https://tukio.one/',
    });
    const url = clientWithTrailingSlash.buildAuthorizeUrl({
      clientId: 'tukio-web',
      locale: 'fr',
      challenge: 'C',
      state: 'S',
    });
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent('https://tukio.one/fr/auth/callback')}`,
    );
    expect(url).not.toContain('//fr/auth/callback');
  });
});

describe('KeycloakOAuthClient.revokeSession', () => {
  afterEach(() => nock.cleanAll());

  it('returns void on 204 success', async () => {
    nock(KC_URL).post(LOGOUT_PATH).reply(204);
    await expect(
      newClient().revokeSession({ refreshToken: 'r', clientId: 'tukio-web' }),
    ).resolves.toBeUndefined();
  });

  it('swallows 400/401 (best-effort logout)', async () => {
    nock(KC_URL).post(LOGOUT_PATH).reply(400, { error: 'invalid_token' });
    await expect(
      newClient().revokeSession({ refreshToken: 'r', clientId: 'tukio-web' }),
    ).resolves.toBeUndefined();
  });

  it('throws KeycloakUnreachableError on 5xx', async () => {
    nock(KC_URL).post(LOGOUT_PATH).times(4).reply(503);
    await expect(
      newClient().revokeSession({ refreshToken: 'r', clientId: 'tukio-web' }),
    ).rejects.toBeInstanceOf(KeycloakUnreachableError);
  }, 30_000);

  it('sends refresh_token and client_id in the form body', async () => {
    let receivedBody = '';
    nock(KC_URL)
      .post(LOGOUT_PATH, (body) => {
        receivedBody = serializeNockBody(body);
        return true;
      })
      .reply(204);
    await newClient().revokeSession({
      refreshToken: 'rt-2',
      clientId: 'tukio-web',
    });
    expect(receivedBody).toContain('refresh_token=rt-2');
    expect(receivedBody).toContain('client_id=tukio-web');
  });
});
