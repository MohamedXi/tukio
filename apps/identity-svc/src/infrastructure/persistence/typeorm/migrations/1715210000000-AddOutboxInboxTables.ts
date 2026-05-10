import type { MigrationInterface, QueryRunner } from 'typeorm';

// Adds outbox + inbox tables to the tukio_identity database (Story 0.7).
// Copied and adapted from @tukio/messaging migration templates.
export class AddOutboxInboxTables1715210000000 implements MigrationInterface {
  name = 'AddOutboxInboxTables1715210000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Outbox table
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

    // Inbox table
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
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_outbox_notify ON "outbox";`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS notify_outbox_new();`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_outbox_status_created";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox";`);
  }
}
