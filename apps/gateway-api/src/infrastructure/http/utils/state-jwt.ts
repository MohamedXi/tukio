import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { AuthInvalidStateException } from '../../../domain/exception/auth-invalid-state.exception.js';

const ALG = 'HS256';
const ISSUER = 'tukio-gateway';
const AUDIENCE = 'tukio-auth-callback';
const STATE_TTL_SECONDS = 10 * 60;
const SECRET_MIN_LENGTH = 32;
// P4: 60s clock tolerance handles NTP drift between horizontally-scaled gateway instances
const CLOCK_TOLERANCE_SECONDS = 60;

export interface StatePayload {
  next: string | null;
  requestId: string;
  // P11: issuedAt is derived from JWT `iat` at decode time rather than stored
  // as a redundant custom claim. The field is kept in the interface for API
  // compatibility but callers should not rely on it matching the value passed
  // to encodeState — it will reflect the JWT `iat` claim instead.
  issuedAt: string;
}

function secretToKey(secret: string): Uint8Array {
  if (secret.length < SECRET_MIN_LENGTH) {
    throw new AuthInvalidStateException(
      `STATE_JWT_HMAC_SECRET must be at least ${SECRET_MIN_LENGTH} characters`,
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encodeState(
  payload: StatePayload,
  secret: string,
): Promise<string> {
  const key = secretToKey(secret);
  // P11: do NOT store `issuedAt` as a separate custom claim — it's redundant
  // with the JWT `iat` claim set by jose below. Derive at decode time instead.
  return new SignJWT({
    next: payload.next,
    requestId: payload.requestId,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(key);
}

export async function decodeState(
  token: string,
  secret: string,
): Promise<StatePayload> {
  const key = secretToKey(secret);
  let result;
  try {
    result = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
      // P4: tolerate clock skew up to 60 s between horizontally-scaled instances
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new AuthInvalidStateException('State JWT expired');
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new AuthInvalidStateException('State JWT signature mismatch');
    }
    if (err instanceof joseErrors.JOSEError) {
      throw new AuthInvalidStateException(`State JWT invalid: ${err.code}`);
    }
    throw new AuthInvalidStateException(
      err instanceof Error ? err.message : 'State JWT decode error',
    );
  }

  const claims = result.payload as Record<string, unknown>;
  if (typeof claims['requestId'] !== 'string' || claims['requestId'] === '') {
    throw new AuthInvalidStateException('State JWT missing requestId claim');
  }
  const next = claims['next'];
  if (next !== null && typeof next !== 'string') {
    throw new AuthInvalidStateException(
      'State JWT next claim must be string or null',
    );
  }

  // P11: derive issuedAt from JWT `iat` claim (single source of truth)
  const iat = typeof claims['iat'] === 'number' ? claims['iat'] : 0;
  const issuedAt = new Date(iat * 1000).toISOString();

  return {
    next,
    requestId: claims['requestId'],
    issuedAt,
  };
}
