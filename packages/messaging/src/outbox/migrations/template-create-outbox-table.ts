import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migration TEMPLATE — copy to apps/<svc>/src/infrastructure/persistence/typeorm/migrations/
// and rename with a real timestamp prefix, e.g.:
//   <timestamp>-AddOutboxInboxTables.ts
// Then regenerate the timestamp via:
//   pnpm --filter=<svc> typeorm migration:create -- --name AddOutboxInboxTables
export class TemplateCreateOutboxTable implements MigrationInterface {
  name = 'TemplateCreateOutboxTable';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox" (
        "id" UUID PRIMARY KEY,
        "aggregate_type" TEXT NOT NULL,
        "aggregate_id" UUID NOT NULL,
        "event_type" TEXT NOT NULL,
        "event_version" INT NOT NULL,
        "payload" JSONB NOT NULL,
        "correlation_id" UUID NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'published', 'failed')),
        "retry_count" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "published_at" TIMESTAMPTZ,
        "error_message" TEXT
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_outbox_status_created"
       ON "outbox" ("status", "created_at")
       WHERE "status" = 'pending';`,
    );

    // PG LISTEN/NOTIFY trigger — wakes OutboxRelayService immediately on insert.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION notify_outbox_new() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('tukio_outbox_new', NEW.id::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_outbox_notify
        AFTER INSERT ON "outbox"
        FOR EACH ROW EXECUTE FUNCTION notify_outbox_new();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_outbox_notify ON "outbox";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS notify_outbox_new();`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_status_created";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox";`);
  }
}
