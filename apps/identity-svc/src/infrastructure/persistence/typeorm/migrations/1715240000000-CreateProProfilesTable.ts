import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProProfilesTable1715240000000 implements MigrationInterface {
  name = 'CreateProProfilesTable1715240000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE pro_profiles (
        id UUID PRIMARY KEY,
        user_profile_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
        company_name VARCHAR(200) NOT NULL,
        siret VARCHAR(14) NOT NULL,
        vat_number VARCHAR(20) NULL,
        address JSONB NOT NULL,
        contact_phone VARCHAR(20) NOT NULL,
        kyc_id_card_r2_key VARCHAR(500) NOT NULL,
        kyc_rib_r2_key VARCHAR(500) NOT NULL,
        kyc_kbis_r2_key VARCHAR(500) NULL,
        kyc_status VARCHAR(30) NOT NULL DEFAULT 'pending_review'
          CHECK (kyc_status IN ('pending_review', 'under_review', 'approved', 'rejected')),
        kyc_decision_at TIMESTAMPTZ NULL,
        kyc_decision_by UUID NULL,
        kyc_decision_reason TEXT NULL,
        insee_denomination VARCHAR(200) NULL,
        -- Story 1.3b review D3: incorporation_date is DATE (was VARCHAR(10))
        -- so we can index/range-query without parsing strings.
        insee_incorporation_date DATE NULL,
        insee_legal_category VARCHAR(10) NULL,
        -- Story 1.3b review D3: NAF activity code (5-char) — needed by AC10
        -- metrics dashboard from parent Story 1.3 (dropped in initial impl,
        -- restored after review).
        insee_naf VARCHAR(10) NULL,
        insee_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL
      )
    `);

    // FR16 anti-doublon: unique SIRET among non-soft-deleted Pro accounts.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_pro_profiles_siret
        ON pro_profiles (siret)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_pro_profiles_kyc_status
        ON pro_profiles (kyc_status)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_pro_profiles_insee_checked_at
        ON pro_profiles (insee_checked_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_pro_profiles_insee_checked_at`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pro_profiles_kyc_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_pro_profiles_siret`);
    await queryRunner.query(`DROP TABLE IF EXISTS pro_profiles`);
  }
}
