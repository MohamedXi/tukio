import {
  buildClearCookies,
  buildPkceStateCookie,
  buildSessionCookies,
  COOKIE_NAMES,
  readPkceStateCookie,
  resolveCookieDeployment,
  type CookieDeployment,
} from './cookie-helpers.js';
import { AuthInvalidStateException } from '../../../domain/exception/auth-invalid-state.exception.js';

const SECRET = 'unit-test-secret-32-bytes-min-length!!';

const SESSION_INPUTS = {
  accessToken: 'kc.access.token',
  refreshToken: 'kc.refresh.token',
  csrfToken: 'csrf-1234',
};

const PROD: CookieDeployment = { domain: '.tukio.one', secure: true };
const DEV_SECURE: CookieDeployment = { domain: null, secure: true };
const DEV_INSECURE: CookieDeployment = { domain: null, secure: false };

function pick(cookies: string[], name: string): string {
  const c = cookies.find((s) => s.startsWith(`${name}=`));
  if (!c)
    throw new Error(`cookie ${name} not found in ${JSON.stringify(cookies)}`);
  return c;
}

describe('buildSessionCookies — 4 cookies × prod/dev-secure/dev-insecure attribute matrix', () => {
  it.each([
    ['prod', PROD],
    ['dev-secure', DEV_SECURE],
    ['dev-insecure', DEV_INSECURE],
  ] as const)('emits 4 named cookies in %s mode', (_label, deployment) => {
    const cookies = buildSessionCookies(SESSION_INPUTS, deployment);
    expect(cookies).toHaveLength(4);
    expect(pick(cookies, COOKIE_NAMES.ACCESS_TOKEN)).toContain('HttpOnly');
    expect(pick(cookies, COOKIE_NAMES.REFRESH_TOKEN)).toContain('HttpOnly');
    expect(pick(cookies, COOKIE_NAMES.SESSION_ACTIVE)).not.toContain(
      'HttpOnly',
    );
    expect(pick(cookies, COOKIE_NAMES.CSRF_TOKEN)).not.toContain('HttpOnly');
  });

  it.each([
    ['prod', PROD, true],
    ['dev-secure', DEV_SECURE, true],
    ['dev-insecure', DEV_INSECURE, false],
  ] as const)(
    'applies Secure flag correctly in %s mode',
    (_label, deployment, expectSecure) => {
      const cookies = buildSessionCookies(SESSION_INPUTS, deployment);
      for (const c of cookies) {
        if (expectSecure) expect(c).toContain('Secure');
        else expect(c).not.toContain('Secure');
      }
    },
  );

  it.each([
    ['prod has Domain', PROD, true],
    ['dev-secure has no Domain', DEV_SECURE, false],
    ['dev-insecure has no Domain', DEV_INSECURE, false],
  ] as const)(
    'emits Domain attribute correctly (%s)',
    (_label, deployment, hasDomain) => {
      const cookies = buildSessionCookies(SESSION_INPUTS, deployment);
      for (const c of cookies) {
        if (hasDomain) expect(c).toContain('Domain=.tukio.one');
        else expect(c).not.toContain('Domain=');
      }
    },
  );

  it('sets SameSite=Lax on access + session-active, SameSite=Strict on refresh + csrf', () => {
    const cookies = buildSessionCookies(SESSION_INPUTS, PROD);
    expect(pick(cookies, COOKIE_NAMES.ACCESS_TOKEN)).toContain('SameSite=Lax');
    expect(pick(cookies, COOKIE_NAMES.SESSION_ACTIVE)).toContain(
      'SameSite=Lax',
    );
    expect(pick(cookies, COOKIE_NAMES.REFRESH_TOKEN)).toContain(
      'SameSite=Strict',
    );
    expect(pick(cookies, COOKIE_NAMES.CSRF_TOKEN)).toContain('SameSite=Strict');
  });

  it('scopes refresh-token to /v1/auth and others to /', () => {
    const cookies = buildSessionCookies(SESSION_INPUTS, PROD);
    expect(pick(cookies, COOKIE_NAMES.REFRESH_TOKEN)).toContain(
      'Path=/v1/auth',
    );
    expect(pick(cookies, COOKIE_NAMES.ACCESS_TOKEN)).toContain('Path=/');
    expect(pick(cookies, COOKIE_NAMES.SESSION_ACTIVE)).toContain('Path=/');
    expect(pick(cookies, COOKIE_NAMES.CSRF_TOKEN)).toContain('Path=/');
  });

  it('applies the canonical Max-Age windows (300s access / 2592000s refresh+session+csrf)', () => {
    const cookies = buildSessionCookies(SESSION_INPUTS, PROD);
    expect(pick(cookies, COOKIE_NAMES.ACCESS_TOKEN)).toContain('Max-Age=300');
    expect(pick(cookies, COOKIE_NAMES.REFRESH_TOKEN)).toContain(
      'Max-Age=2592000',
    );
    expect(pick(cookies, COOKIE_NAMES.SESSION_ACTIVE)).toContain(
      'Max-Age=2592000',
    );
    expect(pick(cookies, COOKIE_NAMES.CSRF_TOKEN)).toContain('Max-Age=2592000');
  });

  it('embeds the supplied token values verbatim', () => {
    const cookies = buildSessionCookies(SESSION_INPUTS, PROD);
    expect(pick(cookies, COOKIE_NAMES.ACCESS_TOKEN)).toContain(
      '=kc.access.token;',
    );
    expect(pick(cookies, COOKIE_NAMES.REFRESH_TOKEN)).toContain(
      '=kc.refresh.token;',
    );
    expect(pick(cookies, COOKIE_NAMES.CSRF_TOKEN)).toContain('=csrf-1234;');
  });
});

describe('buildClearCookies', () => {
  it('returns 4 Set-Cookie strings with Max-Age=0', () => {
    const cookies = buildClearCookies(PROD);
    expect(cookies).toHaveLength(4);
    for (const c of cookies) {
      expect(c).toContain('Max-Age=0');
    }
  });

  it('preserves the canonical name/Path/Domain so each Set-Cookie overrides the live one', () => {
    const cookies = buildClearCookies(PROD);
    expect(pick(cookies, COOKIE_NAMES.REFRESH_TOKEN)).toContain(
      'Path=/v1/auth',
    );
    expect(pick(cookies, COOKIE_NAMES.ACCESS_TOKEN)).toContain(
      'Domain=.tukio.one',
    );
  });
});

describe('buildPkceStateCookie + readPkceStateCookie — DN2 (JWE A256GCM)', () => {
  it('produces a HttpOnly+SameSite=Lax cookie with Max-Age=600', async () => {
    const cookie = await buildPkceStateCookie(
      {
        verifier: 'verifier-abc',
        originalState: 'state-xyz',
        clientId: 'tukio-web',
      },
      SECRET,
      PROD,
    );
    expect(cookie).toContain(`${COOKIE_NAMES.PKCE_STATE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=600');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Domain=.tukio.one');
  });

  it('JWE token has 5 dot-separated parts (compact serialization) — DN2', async () => {
    const cookie = await buildPkceStateCookie(
      { verifier: 'v', originalState: 's', clientId: 'tukio-web' },
      SECRET,
      PROD,
    );
    const value = cookie.split(';')[0]!.split('=').slice(1).join('=');
    expect(value.split('.').length).toBe(5);
  });

  it('JWE is opaque — verifier not readable in plaintext — DN2', async () => {
    const cookie = await buildPkceStateCookie(
      {
        verifier: 'my-sensitive-verifier',
        originalState: 's',
        clientId: 'tukio-web',
      },
      SECRET,
      PROD,
    );
    const value = cookie.split(';')[0]!.split('=').slice(1).join('=');
    expect(value).not.toContain('my-sensitive-verifier');
  });

  it('roundtrips verifier + originalState through JWE encrypt/decrypt', async () => {
    const cookie = await buildPkceStateCookie(
      { verifier: 'v1', originalState: 'state-1', clientId: 'tukio-web' },
      SECRET,
      PROD,
    );
    const value = cookie.split(';')[0]!.split('=').slice(1).join('=');
    const decoded = await readPkceStateCookie(value, SECRET);
    expect(decoded).toEqual({
      verifier: 'v1',
      originalState: 'state-1',
      clientId: 'tukio-web',
    });
  });

  it('rejects encode with too-short secret (PKCE_COOKIE_HMAC_SECRET < 32)', async () => {
    await expect(
      buildPkceStateCookie(
        { verifier: 'v', originalState: 's', clientId: 'tukio-web' },
        'short',
        PROD,
      ),
    ).rejects.toBeInstanceOf(AuthInvalidStateException);
  });

  it('rejects read with tampered ciphertext (auth tag mismatch)', async () => {
    const cookie = await buildPkceStateCookie(
      { verifier: 'v', originalState: 's', clientId: 'tukio-web' },
      SECRET,
      PROD,
    );
    const parts = cookie
      .split(';')[0]!
      .split('=')
      .slice(1)
      .join('=')
      .split('.');
    // Replace the entire auth tag with a fixed garbage string — single-char
    // replacement can occasionally survive GCM auth-tag verification in some
    // environments (tag bit pattern survives a 1-char base64url swap). Full
    // replacement is guaranteed to fail.
    parts[4] = 'AAAAAAAAAAAAAAAAAAAAAA';
    const tampered = parts.join('.');
    await expect(readPkceStateCookie(tampered, SECRET)).rejects.toBeInstanceOf(
      AuthInvalidStateException,
    );
  });
});

describe('resolveCookieDeployment', () => {
  it('returns secure=true in production regardless of insecure flag', () => {
    expect(
      resolveCookieDeployment({
        nodeEnv: 'production',
        domain: '.tukio.one',
        devInsecureFlag: '1',
      }),
    ).toEqual({ domain: '.tukio.one', secure: true });
  });

  it('returns secure=true in development when insecure flag is unset', () => {
    expect(
      resolveCookieDeployment({
        nodeEnv: 'development',
        domain: null,
        devInsecureFlag: undefined,
      }),
    ).toEqual({ domain: null, secure: true });
  });

  it('drops Secure only in NODE_ENV=development with TUKIO_DEV_INSECURE_COOKIES=1 — P5', () => {
    expect(
      resolveCookieDeployment({
        nodeEnv: 'development',
        domain: null,
        devInsecureFlag: '1',
      }),
    ).toEqual({ domain: null, secure: false });
  });

  it('keeps Secure in NODE_ENV=test even with TUKIO_DEV_INSECURE_COOKIES=1 — P5', () => {
    expect(
      resolveCookieDeployment({
        nodeEnv: 'test',
        domain: null,
        devInsecureFlag: '1',
      }),
    ).toEqual({ domain: null, secure: true });
  });
});
