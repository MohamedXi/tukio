/**
 * Port — email-verification token repository (Pattern Pretre).
 * Token is custom UUID v4 with explicit expiry (Story 1.2 §6 decision : pas Keycloak Required Action).
 * Real impl arrives Story 1.2b (TypeORM repository + migration).
 */
export interface EmailVerificationTokenRecord {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface EmailVerificationTokenLookup {
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface IEmailVerificationTokenRepository {
  save(record: EmailVerificationTokenRecord): Promise<void>;
  findByToken(token: string): Promise<EmailVerificationTokenLookup | null>;
  markUsed(token: string): Promise<void>;
}
