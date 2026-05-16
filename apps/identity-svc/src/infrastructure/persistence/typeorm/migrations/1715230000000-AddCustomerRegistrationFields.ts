import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 1.2b — adds 7 customer-registration columns to `user_profiles` and
 * creates the `email_verification_tokens` table.
 *
 * Columns added :
 *   - tukio_status         : business status (active / pending_admin_review / rejected / suspended)
 *   - email_verified       : FR8/FR17 verification flag (Story 1.6 flips it)
 *   - marketing_opt_in     : RGPD opt-in for newsletters (NFR27)
 *   - accept_terms         : T&Cs accepted at registration (RGPD audit)
 *   - accept_terms_at      : timestamp of T&Cs acceptance (coupled with accept_terms)
 *   - phone                : Story 1.8 profile management (NULL on initial registration)
 *   - acquisition_content  : UTM creative variant (review patch E3 from 1.2a)
 *   - acquisition_term     : UTM paid search keyword (review patch E3)
 *
 * Critical : adds a unique index on `lower(email)` so concurrent registrations
 * fail at the DB layer with Postgres 23505, which the `RegisterCustomerUseCase`
 * catches and translates to `IDENTITY-CONFLICT-001` (review patch P6 from 1.2a).
 */
export class AddCustomerRegistrationFields1715230000000 implements MigrationInterface {
  name = 'AddCustomerRegistrationFields1715230000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the customer-registration columns to user_profiles.
    await queryRunner.query(`
      ALTER TABLE "user_profiles"
        ADD COLUMN "tukio_status" VARCHAR(30) NOT NULL DEFAULT 'active'
          CONSTRAINT "chk_user_profiles_tukio_status"
          CHECK ("tukio_status" IN (
            'active', 'pending_admin_review', 'rejected', 'suspended'
          )),
        ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN "accept_terms" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN "accept_terms_at" TIMESTAMPTZ NULL,
        ADD COLUMN "phone" VARCHAR(20) NULL,
        ADD COLUMN "acquisition_content" TEXT NULL,
        ADD COLUMN "acquisition_term" TEXT NULL
    `);

    // 2. RGPD coherence at the DB layer : either both consent fields are set
    //    or neither (mirrors `UserProfile.create` invariant from 1.2a review P13).
    await queryRunner.query(`
      ALTER TABLE "user_profiles"
        ADD CONSTRAINT "chk_user_profiles_accept_terms_coherence"
        CHECK (
          ("accept_terms" = true AND "accept_terms_at" IS NOT NULL) OR
          ("accept_terms" = false AND "accept_terms_at" IS NULL)
        )
    `);

    // 3. Partial indexes on alive rows for fast tukio_status filter queries
    //    (admin moderation queues Epic 6) and FR17 transactional gating.
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_tukio_status"
        ON "user_profiles" ("tukio_status")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_email_verified"
        ON "user_profiles" ("email_verified")
        WHERE "deleted_at" IS NULL
    `);

    // 4. Unique index on lower(email) — protects concurrent registration race.
    //    The base column already has UNIQUE but case-insensitive lookups need
    //    this expression index. The use case `findByEmail` normalizes via
    //    `email.trim().toLowerCase()` so the lookup hits this index.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_user_profiles_lower_email"
        ON "user_profiles" (LOWER("email"))
        WHERE "deleted_at" IS NULL
    `);

    // 5. Create email_verification_tokens table.
    await queryRunner.query(`
      CREATE TABLE "email_verification_tokens" (
        "token"       UUID NOT NULL,
        "user_id"     UUID NOT NULL,
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "used_at"     TIMESTAMPTZ NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_email_verification_tokens" PRIMARY KEY ("token"),
        CONSTRAINT "fk_email_verification_tokens_user_id"
          FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_verification_tokens_user_id"
        ON "email_verification_tokens" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_verification_tokens_expires_at"
        ON "email_verification_tokens" ("expires_at")
        WHERE "used_at" IS NULL
    `);

    // Review patch P5 (1.2b) — anti token-spam : at most one unused token per
    // user. Story 1.6 issue/resend flow must mark prior tokens as used (or
    // delete) before inserting a new one. Without this constraint, an attacker
    // (or a buggy resend loop) could spam the table with unbounded rows.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_email_verification_tokens_user_id_unused"
        ON "email_verification_tokens" ("user_id")
        WHERE "used_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order — explicit, no IF EXISTS so a botched rollback
    // surfaces loudly instead of leaving partial state.
    await queryRunner.query(
      `DROP INDEX "uq_email_verification_tokens_user_id_unused"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_email_verification_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_email_verification_tokens_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);

    await queryRunner.query(`DROP INDEX "uq_user_profiles_lower_email"`);
    await queryRunner.query(`DROP INDEX "idx_user_profiles_email_verified"`);
    await queryRunner.query(`DROP INDEX "idx_user_profiles_tukio_status"`);

    await queryRunner.query(
      `ALTER TABLE "user_profiles" DROP CONSTRAINT "chk_user_profiles_accept_terms_coherence"`,
    );

    await queryRunner.query(`
      ALTER TABLE "user_profiles"
        DROP COLUMN "acquisition_term",
        DROP COLUMN "acquisition_content",
        DROP COLUMN "phone",
        DROP COLUMN "accept_terms_at",
        DROP COLUMN "accept_terms",
        DROP COLUMN "marketing_opt_in",
        DROP COLUMN "email_verified",
        DROP COLUMN "tukio_status"
    `);
  }
}
