import { describe, expect, it } from 'vitest';
import { JwtMalformedError, decodeJwt, isJwtExpired, tryDecodeJwt } from './decode-jwt.js';

// Build a compact JWS-shaped string `header.payload.signature` where the
// payload is a base64url-encoded JSON object. We do NOT sign — decodeJwt does
// not verify signatures, so any non-empty signature segment works.
function makeJwt(payload: Record<string, unknown>, signature = 'sig'): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.${signature}`;
}

function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const NOW_S = Math.floor(Date.now() / 1000);

describe('decodeJwt (AC8)', () => {
  it('1. happy path — decodes a full Tukio access token to typed claims', () => {
    const token = makeJwt({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'client@example.com',
      realm_access: { roles: ['client', 'offline_access'] },
      'tukio:locale': 'en',
      'tukio:status': 'active',
      email_verified: true,
      amr: ['pwd'],
      exp: NOW_S + 300,
      iat: NOW_S,
    });

    const claims = decodeJwt(token);

    expect(claims.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(claims.email).toBe('client@example.com');
    expect(claims.realm_access.roles).toEqual(['client', 'offline_access']);
    expect(claims['tukio:locale']).toBe('en');
    expect(claims['tukio:status']).toBe('active');
    expect(claims.email_verified).toBe(true);
    expect(claims.amr).toEqual(['pwd']);
    expect(claims.exp).toBe(NOW_S + 300);
    expect(claims.iat).toBe(NOW_S);
  });

  it('2. malformed — throws JwtMalformedError when not 3 segments', () => {
    expect(() => decodeJwt('not-a-jwt')).toThrow(JwtMalformedError);
    expect(() => decodeJwt('only.two')).toThrow(JwtMalformedError);
    expect(() => decodeJwt('')).toThrow(JwtMalformedError);
  });

  it('3. missing claims — normalises to safe defaults (roles:[], amr:[], locale:fr)', () => {
    const token = makeJwt({ sub: 'abc', exp: NOW_S + 60 });
    const claims = decodeJwt(token);

    expect(claims.sub).toBe('abc');
    expect(claims.email).toBe('');
    expect(claims.realm_access.roles).toEqual([]);
    expect(claims['tukio:locale']).toBe('fr');
    expect(claims['tukio:status']).toBe('');
    expect(claims.email_verified).toBe(false);
    expect(claims.amr).toEqual([]);
    expect(claims.iat).toBe(0);
  });

  it('4. expired — decodes but isJwtExpired() reports true', () => {
    const token = makeJwt({ sub: 'abc', exp: NOW_S - 10, iat: NOW_S - 310 });
    const claims = decodeJwt(token);

    expect(claims.exp).toBe(NOW_S - 10);
    expect(isJwtExpired(claims)).toBe(true);
    // A future token is not expired.
    expect(isJwtExpired({ exp: NOW_S + 300 })).toBe(false);
    // exp=0 (missing-claim sentinel) → treated as non-expired; the gateway is
    // authoritative. Avoids silently blocking valid offline tokens that omit exp.
    expect(isJwtExpired({ exp: 0 })).toBe(false);
  });

  it('5. invalid base64 — throws JwtMalformedError when payload is not valid base64url', () => {
    // `@@@` is outside the base64url alphabet → atob rejects it.
    expect(() => decodeJwt('header.@@@invalid@@@.sig')).toThrow(JwtMalformedError);
  });

  it('6. tampered payload — throws JwtMalformedError when payload is not JSON', () => {
    // Valid base64url segment, but the decoded bytes are not JSON.
    const notJson = base64url('this is not json {');
    expect(() => decodeJwt(`header.${notJson}.sig`)).toThrow(JwtMalformedError);
  });

  it('tryDecodeJwt — returns null instead of throwing on bad/empty input', () => {
    expect(tryDecodeJwt(undefined)).toBeNull();
    expect(tryDecodeJwt(null)).toBeNull();
    expect(tryDecodeJwt('garbage')).toBeNull();
    const ok = tryDecodeJwt(makeJwt({ sub: 'x', exp: NOW_S + 60 }));
    expect(ok?.sub).toBe('x');
  });
});
