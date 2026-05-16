import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Story 1.2b — email-verification token persisted alongside `user_profiles`.
 * Custom UUID v4 token with 7-day TTL (Story 1.2 decision §6 — not Keycloak
 * `Required Action: VERIFY_EMAIL`). Story 1.6 consumes the token to flip
 * `email_verified` on the Keycloak user via the Admin API.
 *
 * Migration : `1715230000000-AddCustomerRegistrationFields`.
 *
 * `@Generated('uuid')` makes Postgres fill the column via `gen_random_uuid()`
 * if the caller omits it — defense-in-depth from the 1.2b code-review (review
 * patch P5). The application always passes `randomUUID()` from the use case
 * today, but a future caller bug that forgets the token would otherwise yield
 * a cryptic Postgres NOT NULL violation. `@Generated` lets the DB default
 * absorb the mistake instead.
 */
@Entity({ name: 'email_verification_tokens' })
export class EmailVerificationTokenEntity {
  @PrimaryColumn({ name: 'token', type: 'uuid' })
  @Generated('uuid')
  token!: string;

  @Index('idx_email_verification_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index('idx_email_verification_tokens_expires_at', {
    where: '"used_at" IS NULL',
  })
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
