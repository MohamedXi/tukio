import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migration TEMPLATE — copy alongside the outbox migration in the same file,
// or as a standalone migration. Adjust timestamp prefix accordingly.
export class TemplateCreateInboxTable implements MigrationInterface {
  name = 'TemplateCreateInboxTable';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inbox" (
        "event_id" UUID PRIMARY KEY,
        "event_type" TEXT NOT NULL,
        "correlation_id" UUID NOT NULL,
        "received_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "processed_at" TIMESTAMPTZ,
        "payload" JSONB NOT NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_inbox_received"
       ON "inbox" ("received_at")
       WHERE "processed_at" IS NULL;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_inbox_received";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inbox";`);
  }
}
