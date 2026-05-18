import { hkdfSync } from 'node:crypto';
import { EncryptJWT, jwtDecrypt, errors as joseErrors } from 'jose';
import { AuthInvalidStateException } from '../../../domain/exception/auth-invalid-state.exception.js';

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'tukio-access-token',
  REFRESH_TOKEN: 'tukio-refresh-token',
  SESSION_ACTIVE: 'tukio-session-active',
  CSRF_TOKEN: 'tukio-csrf-token',
  PKCE_STATE: 'tukio-pkce-state',
} as const;

const ACCESS_TOKEN_MAX_AGE_SEC = 5 * 60;
const REFRESH_TOKEN_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const SESSION_ACTIVE_MAX_AGE_SEC = REFRESH_TOKEN_MAX_AGE_SEC;
const CSRF_TOKEN_MAX_AGE_SEC = REFRESH_TOKEN_MAX_AGE_SEC;
const PKCE_STATE_MAX_AGE_SEC = 10 * 60;
const REFRESH_TOKEN_PATH = '/v1/auth';

const PKCE_STATE_SECRET_MIN_LENGTH = 32;
// DN2: JWE A256GCM with `dir` algorithm requires a 32-byte content encryption key
const PKCE_STATE_JWE_ALG = 'dir';
const PKCE_STATE_JWE_ENC = 'A256GCM';
const PKCE_STATE_KEY_LENGTH = 32;
const PKCE_STATE_KEY_INFO = 'pkce-state-enc';
const PKCE_STATE_ISSUER = 'tukio-gateway';
const PKCE_STATE_AUDIENCE = 'tukio-pkce-state';
// P4: tolerate 60 s clock skew between gateway-api instances
const PKCE_CLOCK_TOLERANCE_SECONDS = 60;

export interface CookieDeployment {
  /** Cookie Domain attribute. Use `.tukio.one` in prod, omit in localhost dev. */
  domain: string | null;
  /** Toggle the `Secure` flag — set to false only in dev over plain HTTP. */
  secure: boolean;
}

export interface SessionCookieInputs {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface PkceStatePayload {
  verifier: string;
  originalState: string;
  /** OAuth client_id used to initiate the flow — propagated so callback can exchange with the correct client. */
  clientId: string;
}

interface AttributeSet {
  name: string;
  value: string;
  maxAge: number;
  path: string;
  httpOnly: boolean;
  sameSite: 'Lax' | 'Strict';
  secure: boolean;
  domain: string | null;
}

function formatCookie(attrs: AttributeSet): string {
  const parts: string[] = [
    `${attrs.name}=${attrs.value}`,
    `Path=${attrs.path}`,
    `Max-Age=${attrs.maxAge}`,
    `SameSite=${attrs.sameSite}`,
  ];
  if (attrs.httpOnly) parts.push('HttpOnly');
  if (attrs.secure) parts.push('Secure');
  if (attrs.domain) parts.push(`Domain=${attrs.domain}`);
  return parts.join('; ');
}

export function buildSessionCookies(
  inputs: SessionCookieInputs,
  deployment: CookieDeployment,
): string[] {
  const base = {
    secure: deployment.secure,
    domain: deployment.domain,
  };

  return [
    formatCookie({
      ...base,
      name: COOKIE_NAMES.ACCESS_TOKEN,
      value: inputs.accessToken,
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE_SEC,
      httpOnly: true,
      sameSite: 'Lax',
    }),
    formatCookie({
      ...base,
      name: COOKIE_NAMES.REFRESH_TOKEN,
      value: inputs.refreshToken,
      path: REFRESH_TOKEN_PATH,
      maxAge: REFRESH_TOKEN_MAX_AGE_SEC,
      httpOnly: true,
      sameSite: 'Strict',
    }),
    formatCookie({
      ...base,
      name: COOKIE_NAMES.SESSION_ACTIVE,
      value: '1',
      path: '/',
      maxAge: SESSION_ACTIVE_MAX_AGE_SEC,
      httpOnly: false,
      sameSite: 'Lax',
    }),
    formatCookie({
      ...base,
      name: COOKIE_NAMES.CSRF_TOKEN,
      value: inputs.csrfToken,
      path: '/',
      maxAge: CSRF_TOKEN_MAX_AGE_SEC,
      httpOnly: false,
      sameSite: 'Strict',
    }),
  ];
}

export function buildClearCookies(deployment: CookieDeployment): string[] {
  const base = {
    secure: deployment.secure,
    domain: deployment.domain,
    maxAge: 0,
  };
  return [
    formatCookie({
      ...base,
      name: COOKIE_NAMES.ACCESS_TOKEN,
      value: '',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }),
    formatCookie({
      ...base,
      name: COOKIE_NAMES.REFRESH_TOKEN,
      value: '',
      path: REFRESH_TOKEN_PATH,
      httpOnly: true,
      sameSite: 'Strict',
    }),
    formatCookie({
      ...base,
      name: COOKIE_NAMES.SESSION_ACTIVE,
      value: '',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    }),
    formatCookie({
      ...base,
      name: COOKIE_NAMES.CSRF_TOKEN,
      value: '',
      path: '/',
      httpOnly: false,
      sameSite: 'Strict',
    }),
  ];
}

/**
 * Derive a 32-byte AES key from the PKCE cookie HMAC secret via HKDF-SHA256.
 * DN1: uses a separate secret from STATE_JWT_HMAC_SECRET to limit blast-radius.
 * DN2: produces the content encryption key for JWE A256GCM encryption.
 */
function derivePkceEncryptionKey(secret: string): Uint8Array {
  if (secret.length < PKCE_STATE_SECRET_MIN_LENGTH) {
    throw new AuthInvalidStateException(
      `PKCE_COOKIE_HMAC_SECRET must be at least ${PKCE_STATE_SECRET_MIN_LENGTH} characters`,
    );
  }
  return new Uint8Array(
    hkdfSync(
      'sha256',
      Buffer.from(secret, 'utf8'),
      '',
      PKCE_STATE_KEY_INFO,
      PKCE_STATE_KEY_LENGTH,
    ),
  );
}

/**
 * Build the pkce-state Set-Cookie header value.
 * DN2: encrypted using JWE (EncryptJWT A256GCM) so the PKCE verifier is opaque
 * even in server logs — not merely HttpOnly-protected.
 */
export async function buildPkceStateCookie(
  payload: PkceStatePayload,
  secret: string,
  deployment: CookieDeployment,
): Promise<string> {
  const key = derivePkceEncryptionKey(secret);
  const value = await new EncryptJWT({
    verifier: payload.verifier,
    originalState: payload.originalState,
    clientId: payload.clientId,
  })
    .setProtectedHeader({ alg: PKCE_STATE_JWE_ALG, enc: PKCE_STATE_JWE_ENC })
    .setIssuer(PKCE_STATE_ISSUER)
    .setAudience(PKCE_STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${PKCE_STATE_MAX_AGE_SEC}s`)
    .encrypt(key);

  return formatCookie({
    name: COOKIE_NAMES.PKCE_STATE,
    value,
    path: '/',
    maxAge: PKCE_STATE_MAX_AGE_SEC,
    httpOnly: true,
    sameSite: 'Lax',
    secure: deployment.secure,
    domain: deployment.domain,
  });
}

export async function readPkceStateCookie(
  cookieValue: string,
  secret: string,
): Promise<PkceStatePayload> {
  const key = derivePkceEncryptionKey(secret);
  let result;
  try {
    result = await jwtDecrypt(cookieValue, key, {
      issuer: PKCE_STATE_ISSUER,
      audience: PKCE_STATE_AUDIENCE,
      // P4: tolerate clock skew between gateway-api instances
      clockTolerance: PKCE_CLOCK_TOLERANCE_SECONDS,
    });
  } catch (err) {
    if (err instanceof joseErrors.JOSEError) {
      throw new AuthInvalidStateException(
        `pkce-state cookie invalid: ${err.code}`,
      );
    }
    throw new AuthInvalidStateException(
      err instanceof Error ? err.message : 'pkce-state cookie decode error',
    );
  }

  const claims = result.payload as Record<string, unknown>;
  if (typeof claims['verifier'] !== 'string' || claims['verifier'] === '') {
    throw new AuthInvalidStateException('pkce-state cookie missing verifier');
  }
  if (
    typeof claims['originalState'] !== 'string' ||
    claims['originalState'] === ''
  ) {
    throw new AuthInvalidStateException(
      'pkce-state cookie missing originalState',
    );
  }
  if (typeof claims['clientId'] !== 'string' || claims['clientId'] === '') {
    throw new AuthInvalidStateException('pkce-state cookie missing clientId');
  }
  return {
    verifier: claims['verifier'],
    originalState: claims['originalState'],
    clientId: claims['clientId'],
  };
}

/**
 * Resolve cookie deployment attributes from runtime environment.
 * P5: insecure-cookie override restricted to NODE_ENV === 'development' only
 * (was previously also triggered by 'test', which could emit non-Secure cookies
 * in CI integration environments).
 */
export function resolveCookieDeployment(env: {
  nodeEnv: string;
  domain: string | null;
  devInsecureFlag: string | undefined;
}): CookieDeployment {
  const isDev = env.nodeEnv === 'development';
  const secure = !(isDev && env.devInsecureFlag === '1');
  return { domain: env.domain, secure };
}
