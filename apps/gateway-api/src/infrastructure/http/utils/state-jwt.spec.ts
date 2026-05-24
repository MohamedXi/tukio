import { SignJWT } from 'jose';
import { decodeState, encodeState, type StatePayload } from './state-jwt.js';
import { AuthInvalidStateException } from '../../../domain/exception/auth-invalid-state.exception.js';

const SECRET = 'unit-test-secret-32-bytes-min-length!!';
const OTHER_SECRET = 'a-totally-different-secret-also-32-chars!';

const ALG = 'HS256';
const ISSUER = 'tukio-gateway';
const AUDIENCE = 'tukio-auth-callback';

function basePayload(overrides: Partial<StatePayload> = {}): StatePayload {
  return {
    next: 'https://tukio.one/fr/account/dashboard',
    requestId: 'req-123',
    issuedAt: '2026-05-17T12:00:00Z', // caller-supplied, overridden at decode with JWT iat
    ...overrides,
  };
}

describe('state-jwt — encode / decode roundtrip (8 cases)', () => {
  it('roundtrips a typical Customer post-login next URL', async () => {
    const token = await encodeState(basePayload(), SECRET);
    const decoded = await decodeState(token, SECRET);
    expect(decoded.next).toBe(basePayload().next);
    expect(decoded.requestId).toBe(basePayload().requestId);
    // P11: issuedAt is derived from JWT iat, not from caller-supplied value
    expect(decoded.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('roundtrips with null next (default dashboard)', async () => {
    const payload = basePayload({ next: null });
    const token = await encodeState(payload, SECRET);
    const decoded = await decodeState(token, SECRET);
    expect(decoded.next).toBeNull();
  });

  it('preserves the original requestId verbatim', async () => {
    const payload = basePayload({
      requestId: '7f4f3d7c-6c0e-4a3b-9c01-0123456789ab',
    });
    const token = await encodeState(payload, SECRET);
    const decoded = await decodeState(token, SECRET);
    expect(decoded.requestId).toBe(payload.requestId);
  });

  it('issuedAt is derived from JWT iat (ISO string) — P11', async () => {
    const before = Date.now();
    const token = await encodeState(basePayload(), SECRET);
    const after = Date.now();
    const decoded = await decodeState(token, SECRET);
    const decodedMs = new Date(decoded.issuedAt).getTime();
    expect(decodedMs).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    expect(decodedMs).toBeLessThanOrEqual(after + 1000);
  });

  it('accepts a non-ASCII next URL (URL-encoded path segments)', async () => {
    const next = 'https://tukio.one/fr/services/d%C3%A9co-mariage';
    const token = await encodeState(basePayload({ next }), SECRET);
    const decoded = await decodeState(token, SECRET);
    expect(decoded.next).toBe(next);
  });

  it('produces a different token on each encode (iat differs)', async () => {
    const a = await encodeState(basePayload(), SECRET);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const b = await encodeState(basePayload(), SECRET);
    expect(a).not.toBe(b);
  });

  it('returns identical payload regardless of secret length above the floor', async () => {
    const longSecret = SECRET + '-extra-padding-bytes-for-fun-and-profit';
    const token = await encodeState(basePayload(), longSecret);
    const decoded = await decodeState(token, longSecret);
    expect(decoded.next).toBe(basePayload().next);
    expect(decoded.requestId).toBe(basePayload().requestId);
  });

  it('decodes a token signed within the TTL window', async () => {
    const token = await encodeState(basePayload(), SECRET);
    const decoded = await decodeState(token, SECRET);
    expect(decoded).toBeDefined();
  });
});

describe('state-jwt — error paths', () => {
  it('rejects an expired token (manually crafted with exp in the past)', async () => {
    const key = new TextEncoder().encode(SECRET);
    const token = await new SignJWT({
      next: null,
      requestId: 'req-1',
    })
      .setProtectedHeader({ alg: ALG })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    await expect(decodeState(token, SECRET)).rejects.toBeInstanceOf(
      AuthInvalidStateException,
    );
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await encodeState(basePayload(), OTHER_SECRET);
    await expect(decodeState(token, SECRET)).rejects.toBeInstanceOf(
      AuthInvalidStateException,
    );
  });

  it('rejects a tampered payload (modified char in signature segment)', async () => {
    const token = await encodeState(basePayload(), SECRET);
    const parts = token.split('.');
    // Modify a character in the middle of the signature — the last character of
    // a 43-char base64url HMAC-SHA256 signature carries only 2 significant bits
    // (the remaining 4 are ignored during decode), so flipping it is unreliable.
    const sig = parts[2]!;
    const pos = Math.floor(sig.length / 2);
    parts[2] =
      sig.slice(0, pos) + (sig[pos] === 'A' ? 'B' : 'A') + sig.slice(pos + 1);
    const tampered = parts.join('.');
    await expect(decodeState(tampered, SECRET)).rejects.toBeInstanceOf(
      AuthInvalidStateException,
    );
  });

  it('rejects a token missing requestId claim', async () => {
    const key = new TextEncoder().encode(SECRET);
    const token = await new SignJWT({ next: null })
      .setProtectedHeader({ alg: ALG })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(key);
    await expect(decodeState(token, SECRET)).rejects.toBeInstanceOf(
      AuthInvalidStateException,
    );
  });

  it('rejects a token with malformed next claim (object instead of string|null)', async () => {
    const key = new TextEncoder().encode(SECRET);
    const token = await new SignJWT({
      next: { weird: true },
      requestId: 'req-1',
    })
      .setProtectedHeader({ alg: ALG })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(key);
    await expect(decodeState(token, SECRET)).rejects.toBeInstanceOf(
      AuthInvalidStateException,
    );
  });

  it('rejects encode() with a too-short secret', async () => {
    await expect(
      encodeState(basePayload(), 'too-short'),
    ).rejects.toBeInstanceOf(AuthInvalidStateException);
  });

  it('rejects a pkce-state cookie JWT (audience mismatch) when verified as state JWT — P13', async () => {
    // The pkce-state audience is `tukio-pkce-state`; decodeState expects `tukio-auth-callback`.
    // This verifies that the two JWT roles cannot be cross-accepted even with the same secret family.
    const key = new TextEncoder().encode(SECRET);
    const pkceStateToken = await new SignJWT({
      verifier: 'v',
      originalState: 's',
    })
      .setProtectedHeader({ alg: ALG })
      .setIssuer(ISSUER)
      .setAudience('tukio-pkce-state')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(key);
    await expect(decodeState(pkceStateToken, SECRET)).rejects.toBeInstanceOf(
      AuthInvalidStateException,
    );
  });
});
