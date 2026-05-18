import { createHash, randomBytes } from 'node:crypto';

const VERIFIER_BYTE_LENGTH = 32;

export interface PkceMaterials {
  verifier: string;
  challenge: string;
}

export function generatePkceMaterials(): PkceMaterials {
  const verifier = randomBytes(VERIFIER_BYTE_LENGTH).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
