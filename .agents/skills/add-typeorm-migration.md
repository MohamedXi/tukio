# Skill: add a TypeORM migration

Use this when changing the schema of a service's logical DB
(`tukio_<svc>`). Migrations are append-only history — never edit an
already-applied migration.

The canonical references are
**`apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/`**.

## Prerequisites

- Story file with the schema change scope clarified.
- The service already follows Pattern Pretre with TypeORM wired (see
  `.agents/skills/add-backend-service.md`).
- `apps/<svc>/src/infrastructure/persistence/typeorm/data-source.ts`
  exists with a **single default export** (TypeORM CLI rejects double
  exports — H2 review finding Story 0.10).
- Read `.agents/context/code-style.md` (naming) and the existing
  migrations to match the style.

## Workflow

### Option A — TypeORM `migration:generate` (preferred for entity-driven changes)

When you've updated a TypeORM entity (added a column, new index, …) and
want TypeORM to diff the entity against the current DB schema:

1. **Update the entity** in
   `apps/<svc>/src/infrastructure/persistence/typeorm/entities/<name>.entity.ts`.
   Add the column / index / constraint / FK.

2. **Generate the migration.** Make sure the dev DB is up to date first
   (no pending migrations):

   ```bash
   pnpm docker:up:wait
   pnpm --filter=<svc> migration:run    # apply existing migrations first
   pnpm --filter=<svc> migration:generate -- -n <PascalCaseName>
   ```

   The migration file lands at
   `apps/<svc>/src/infrastructure/persistence/typeorm/migrations/<timestamp>-<PascalCaseName>.ts`.

3. **Review the generated SQL.** TypeORM is sometimes overzealous (it
   may want to drop / recreate indexes that haven't actually changed,
   or reorder columns). Clean up the migration so it does **only** what
   you intended:
   - Remove no-op `DROP INDEX` + `CREATE INDEX` pairs on unchanged indexes.
   - Remove `ALTER TABLE ... ALTER COLUMN ... TYPE` if the type didn't
     actually change.
   - Keep the `down()` symmetric to `up()`.

### Option B — Manual migration (preferred for raw SQL, triggers, functions, data backfills)

When the change can't be expressed via entity diff (e.g. PostgreSQL
trigger, RLS policy, JSON GIN index, data backfill, schema function):

1. **Author the file directly**. Filename pattern:
   `<timestamp>-<PascalCaseName>.ts`. Timestamp is `Date.now()` (13-digit
   Unix ms). Use a recent timestamp to ensure correct ordering.

   ```ts
   // apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715210000000-AddOutboxInboxTables.ts
   import type { MigrationInterface, QueryRunner } from 'typeorm';

   export class AddOutboxInboxTables1715210000000 implements MigrationInterface {
     name = 'AddOutboxInboxTables1715210000000';

     async up(queryRunner: QueryRunner): Promise<void> {
       await queryRunner.query(`
         CREATE TABLE IF NOT EXISTS "outbox" (
           "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           "event_id" UUID NOT NULL UNIQUE,
           "event_type" TEXT NOT NULL,
           "correlation_id" UUID NOT NULL,
           "payload" JSONB NOT NULL,
           "status" TEXT NOT NULL DEFAULT 'pending',
           "attempts" INTEGER NOT NULL DEFAULT 0,
           "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           "published_at" TIMESTAMPTZ,
           "last_error" TEXT
         );
       `);

       await queryRunner.query(`
         CREATE INDEX IF NOT EXISTS "idx_outbox_pending"
           ON "outbox" ("created_at")
           WHERE "status" = 'pending';
       `);

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

       // … inbox table …
     }

     async down(queryRunner: QueryRunner): Promise<void> {
       await queryRunner.query(`DROP TRIGGER IF EXISTS trg_outbox_notify ON "outbox";`);
       await queryRunner.query(`DROP FUNCTION IF EXISTS notify_outbox_new();`);
       await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_pending";`);
       await queryRunner.query(`DROP TABLE IF EXISTS "outbox";`);
       // … inbox …
     }
   }
   ```

2. **Use `IF NOT EXISTS` / `IF EXISTS` everywhere** that PostgreSQL
   allows. Migration must be safely re-runnable if the runner state
   drifts.

## Naming

- **Class name**: `PascalCase<Name><Timestamp>` —
  `CreateUserProfilesBaseline1715200000000`.
- **File name**: `<timestamp>-<PascalCaseName>.ts` —
  `1715200000000-CreateUserProfilesBaseline.ts`.
- Migrations within a service are **ordered by timestamp**. Don't
  rewrite timestamps after merge — they're part of the apply order
  committed history.

## Apply + verify

```bash
pnpm --filter=<svc> migration:run    # apply
pnpm --filter=<svc> migration:revert # roll back the LATEST migration (testing only)
```

The dev stack persists `migrations` rows in the service's DB, so
`migration:run` is idempotent — already-applied migrations are skipped.

**Verify the schema** via `docker exec`:

```bash
docker exec -i tukio_postgres psql -U tukio -d tukio_<svc> -c "\dt"
docker exec -i tukio_postgres psql -U tukio -d tukio_<svc> -c "\d+ <table>"
```

## Bootstrap script integration

`infra/scripts/bootstrap-databases.sh` iterates `SERVICES` and runs
`migration:run` for each. New services need to be added to that array
(Story 0.10). For a new migration on an existing service, no script
change is needed.

In CI (Story 0.11), set `STRICT_MIGRATIONS=1` so a failed migration
fails the pipeline instead of being swallowed.

## Tests

- **Unit**: not directly testable (migrations are SQL DDL).
- **E2E**: the service's e2e suite (`apps/<svc>/test/*.e2e-spec.ts`)
  should boot against a fresh DB with all migrations applied. If a
  migration changes a table the e2e tests touch, update the test
  fixtures.
- **Chaos**: if the migration adds a trigger / function used by
  outbox/inbox, add a chaos spec asserting the trigger fires under
  load (`test/chaos/<feature>.chaos-spec.ts`).

## Commit + PR

```bash
git add apps/<svc>/src/infrastructure/persistence/typeorm/migrations/<file>
git commit -m "feat(<svc>): add <description> migration — Story <X.Y>"
```

The PR description must include:

- What schema change is applied (`ADD COLUMN x TYPE y`).
- Whether the migration is online-safe (no table lock for long).
- Data backfill plan if needed (separate migration or background job).

## Anti-patterns to refuse

- **Editing an already-applied migration.** Migrations are append-only.
  If a migration is wrong post-merge, write a **new** corrective
  migration; never edit the original (or you break every dev
  environment that already ran it).
- **Skipping the `down()` method.** Always reversible (the test
  team needs `migration:revert`).
- **Using `--all` to revert multiple migrations at once** — TypeORM only
  reverts the latest; multiple reverts must be sequential.
- **Adding `NOT NULL` to an existing column without a default** — locks
  the table on populated DBs. Use a 3-step migration: add nullable
  column → backfill → enforce NOT NULL.
- **Renaming columns** without a 2-step rollout (add new column,
  backfill, drop old in next migration). Otherwise zero-downtime
  deploys break.
- **Doing data migration in TypeORM `up()`** for large tables. Use a
  separate background job or a Story-scoped migration script.
- **Two `export default` data-source files.** TypeORM CLI rejects.
- **Embedding a string with a `$` interpolation in raw SQL** — escape
  carefully or use parameterised `queryRunner.query(sql, [params])`.
