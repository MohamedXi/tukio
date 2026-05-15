import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAcquisitionColumns1715220000000 implements MigrationInterface {
  name = 'AddAcquisitionColumns1715220000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add acquisition tracking columns to user_profiles.
    // acquisition_source uses a CHECK constraint instead of a PG ENUM to allow
    // adding new sources via a migration without requiring a full ENUM ALTER.
    await queryRunner.query(`
      ALTER TABLE "user_profiles"
        ADD COLUMN "acquisition_source" TEXT NOT NULL DEFAULT 'unknown'
          CONSTRAINT "chk_user_profiles_acquisition_source"
          CHECK ("acquisition_source" IN (
            'organic', 'google_ads', 'meta_ads', 'referral', 'direct', 'partner', 'unknown'
          )),
        ADD COLUMN "acquisition_medium" TEXT,
        ADD COLUMN "acquisition_campaign" TEXT,
        ADD COLUMN "acquisition_referral_id" UUID,
        ADD COLUMN "acquisition_first_touch" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN "acquisition_last_touch" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    // Analytics indexes — partial index on campaign keeps size small for NULL rows.
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_acquisition_source"
        ON "user_profiles" ("acquisition_source")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_acquisition_campaign"
        ON "user_profiles" ("acquisition_campaign")
        WHERE "acquisition_campaign" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_acquisition_first_touch"
        ON "user_profiles" ("acquisition_first_touch")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // No IF EXISTS — rollback failures must be explicit (not silently swallowed).
    await queryRunner.query(
      `DROP INDEX "idx_user_profiles_acquisition_first_touch"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_user_profiles_acquisition_campaign"`,
    );
    await queryRunner.query(
      `DROP INDEX "idx_user_profiles_acquisition_source"`,
    );
    await queryRunner.query(`
      ALTER TABLE "user_profiles"
        DROP COLUMN "acquisition_last_touch",
        DROP COLUMN "acquisition_first_touch",
        DROP COLUMN "acquisition_referral_id",
        DROP COLUMN "acquisition_campaign",
        DROP COLUMN "acquisition_medium",
        DROP COLUMN "acquisition_source"
    `);
  }
}
