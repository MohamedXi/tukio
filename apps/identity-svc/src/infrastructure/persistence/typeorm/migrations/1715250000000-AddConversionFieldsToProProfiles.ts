import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 1.3b-bis — adds conversion-wizard columns to `pro_profiles`.
 * These fields are collected by the Customer→Pro conversion wizard
 * (`mvp-pro-onboarding.jsx`) and stored for the admin review queue (Story 2.3).
 *
 * All columns are NOT NULL because they are required by `RegisterProInputSchema`
 * (Story 1.3a-bis). No backfill needed — no `pro_profiles` rows exist in prod
 * before this story (Story 1.3b v1 was not deployed publicly, AC6).
 */
export class AddConversionFieldsToProProfiles1715250000000 implements MigrationInterface {
  name = 'AddConversionFieldsToProProfiles1715250000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ISO YYYY-MM-DD date of birth (≥ 18 years, validated by DTO).
    await queryRunner.query(
      `ALTER TABLE pro_profiles ADD COLUMN date_of_birth VARCHAR(10) NOT NULL DEFAULT ''`,
    );

    // Legal form (business structure): SAS_SASU | EURL_SARL | MICRO_ENTREPRISE | AUTO_ENTREPRENEUR | ASSO_1901.
    await queryRunner.query(
      `ALTER TABLE pro_profiles ADD COLUMN legal_form VARCHAR(30) NOT NULL DEFAULT ''`,
    );

    // VAT registration status: vat_registered | vat_exempt.
    await queryRunner.query(
      `ALTER TABLE pro_profiles ADD COLUMN vat_status VARCHAR(30) NOT NULL DEFAULT ''`,
    );

    // MVP activity categories: array of 1-2 whitelist strings.
    await queryRunner.query(
      `ALTER TABLE pro_profiles ADD COLUMN categories JSONB NOT NULL DEFAULT '[]'::jsonb`,
    );

    // Intervention zone: { city, radiusKm }.
    await queryRunner.query(
      `ALTER TABLE pro_profiles ADD COLUMN service_zone JSONB NOT NULL DEFAULT '{}'::jsonb`,
    );

    // Remove the sentinel DEFAULT values — new rows must supply real data.
    await queryRunner.query(
      `ALTER TABLE pro_profiles ALTER COLUMN date_of_birth DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE pro_profiles ALTER COLUMN legal_form DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE pro_profiles ALTER COLUMN vat_status DROP DEFAULT`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE pro_profiles DROP COLUMN IF EXISTS service_zone`,
    );
    await queryRunner.query(
      `ALTER TABLE pro_profiles DROP COLUMN IF EXISTS categories`,
    );
    await queryRunner.query(
      `ALTER TABLE pro_profiles DROP COLUMN IF EXISTS vat_status`,
    );
    await queryRunner.query(
      `ALTER TABLE pro_profiles DROP COLUMN IF EXISTS legal_form`,
    );
    await queryRunner.query(
      `ALTER TABLE pro_profiles DROP COLUMN IF EXISTS date_of_birth`,
    );
  }
}
