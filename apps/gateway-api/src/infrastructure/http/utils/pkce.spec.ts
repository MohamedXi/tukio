import { createHash } from 'node:crypto';
import { generatePkceMaterials } from './pkce.js';

const BASE64URL_CHARSET = /^[A-Za-z0-9_-]+$/;
const VERIFIER_MIN_LENGTH = 43;

describe('generatePkceMaterials', () => {
  it('produces a challenge equal to base64url(sha256(verifier)) (RFC 7636 S256)', () => {
    const { verifier, challenge } = generatePkceMaterials();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('produces a verifier with sufficient entropy (32 bytes → ≥ 43 base64url chars)', () => {
    const { verifier } = generatePkceMaterials();
    expect(verifier.length).toBeGreaterThanOrEqual(VERIFIER_MIN_LENGTH);
  });

  it('produces verifier and challenge using only base64url characters (RFC 7636 §4.1)', () => {
    const { verifier, challenge } = generatePkceMaterials();
    expect(BASE64URL_CHARSET.test(verifier)).toBe(true);
    expect(BASE64URL_CHARSET.test(challenge)).toBe(true);
  });

  it('returns a fresh verifier on every invocation (no global state)', () => {
    const a = generatePkceMaterials();
    const b = generatePkceMaterials();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });
});
