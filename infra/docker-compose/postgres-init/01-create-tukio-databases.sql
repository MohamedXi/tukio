-- Tukio — Postgres init script (Story 0.10)
-- Runs once at first container init (Postgres entrypoint: /docker-entrypoint-initdb.d/).
-- Creates the Keycloak DB + the 10 Tukio service DBs so dependent services
-- (Keycloak especially) can boot without waiting for `bootstrap-databases.sh`.
--
-- All databases are owned by the default POSTGRES_USER ("tukio"). Re-running
-- bootstrap-databases.sh remains idempotent.
--
-- NOTE: Postgres doesn't support `CREATE DATABASE IF NOT EXISTS` and CREATE
-- DATABASE cannot run inside a transaction/DO block. The `\gexec` meta-command
-- (executed by psql, which runs `.sql` files in the entrypoint init dir)
-- pre-generates the CREATE statement only when the DB is missing — making
-- the file safe to replay if anyone ever runs it outside the entrypoint flow
-- (Story 0.10 / H4 review finding).

SELECT 'CREATE DATABASE ' || quote_ident(d)
FROM unnest(ARRAY[
  'keycloak',
  'tukio_identity',
  'tukio_catalog',
  'tukio_booking',
  'tukio_order',
  'tukio_payment',
  'tukio_messaging',
  'tukio_review',
  'tukio_notification',
  'tukio_media'
]) AS d
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = d)
\gexec

-- tukio_meta is POSTGRES_DB, already created by the entrypoint.
