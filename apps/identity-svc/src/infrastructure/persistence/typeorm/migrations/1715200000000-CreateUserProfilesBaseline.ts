import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserProfilesBaseline1715200000000 implements MigrationInterface {
  name = 'CreateUserProfilesBaseline1715200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" UUID PRIMARY KEY,
        "keycloak_user_id" UUID NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(80) NOT NULL,
        "last_name" VARCHAR(80) NOT NULL,
        "role" VARCHAR(20) NOT NULL,
        "locale" VARCHAR(2) NOT NULL DEFAULT 'fr',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "chk_user_profiles_role" CHECK ("role" IN ('client', 'pro', 'admin-support', 'admin-modo', 'admin-super')),
        CONSTRAINT "chk_user_profiles_locale" CHECK ("locale" IN ('fr', 'en'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_user_profiles_keycloak_user_id" ON "user_profiles" ("keycloak_user_id");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_user_profiles_email_active" ON "user_profiles" ("email") WHERE "deleted_at" IS NULL;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_profiles_email_active";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_profiles_keycloak_user_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_profiles";`);
  }
}
