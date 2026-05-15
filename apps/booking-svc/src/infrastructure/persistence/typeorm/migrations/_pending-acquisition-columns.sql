-- Pending: acquisition_* columns for the `bookings` table.
-- Deferred to Story 4.1 (booking-svc Pretre + saga state machine baseline).
--
-- CONTEXT (Story 0.13):
-- The `bookings` table does not yet exist in booking-svc (no baseline migration at Sprint 0
-- scaffolding). Story 4.1 creates the `bookings` table via TypeORM migration. This SQL
-- must be integrated into that baseline migration or a subsequent migration in Story 4.1.
--
-- RATIONALE (NFR64 — K-04 critical):
-- Acquisition tracking at the booking level allows multi-touch attribution analysis:
-- a user whose first acquisition was 'organic' may convert via 'meta_ads' retargeting
-- at booking time. Tracking both the user-level (identity-svc) and booking-level
-- (booking-svc) acquisition contexts enables cohort analysis in Story 7.5 (V1+).
--
-- HOW TO USE (Story 4.1 developer):
-- 1. Copy the ALTER TABLE below into the `up()` method of the booking-svc baseline
--    migration (after the CREATE TABLE bookings statement).
-- 2. Copy the DROP COLUMN statements into the `down()` method.
-- 3. Remove this placeholder file and replace with the TypeORM migration file.
-- 4. Update sprint-status.yaml Story 4.1 annotation (see below).

-- ──────────────────────────────────────────────────────────────────────────────
-- UP: Add acquisition columns to bookings table
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "bookings"
  ADD COLUMN "acquisition_source" TEXT NOT NULL DEFAULT 'unknown'
    CONSTRAINT "chk_bookings_acquisition_source"
    CHECK ("acquisition_source" IN (
      'organic', 'google_ads', 'meta_ads', 'referral', 'direct', 'partner', 'unknown'
    )),
  ADD COLUMN "acquisition_medium" TEXT,
  ADD COLUMN "acquisition_campaign" TEXT,
  ADD COLUMN "acquisition_referral_id" UUID,
  ADD COLUMN "acquisition_first_touch" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN "acquisition_last_touch" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX "idx_bookings_acquisition_source"
  ON "bookings" ("acquisition_source");

CREATE INDEX "idx_bookings_acquisition_campaign"
  ON "bookings" ("acquisition_campaign")
  WHERE "acquisition_campaign" IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- DOWN: Remove acquisition columns from bookings table
-- ──────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS "idx_bookings_acquisition_campaign";
DROP INDEX IF EXISTS "idx_bookings_acquisition_source";

ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "acquisition_last_touch",
  DROP COLUMN IF EXISTS "acquisition_first_touch",
  DROP COLUMN IF EXISTS "acquisition_referral_id",
  DROP COLUMN IF EXISTS "acquisition_campaign",
  DROP COLUMN IF EXISTS "acquisition_medium",
  DROP COLUMN IF EXISTS "acquisition_source";

-- ──────────────────────────────────────────────────────────────────────────────
-- Sprint-status annotation for Story 4.1:
-- Add this comment to sprint-status.yaml development_status for Story 4.1:
--
-- # NOTE (Story 0.13): integrate _pending-acquisition-columns.sql into
-- #   the Story 4.1 CreateBookingsBaseline TypeORM migration.
-- ──────────────────────────────────────────────────────────────────────────────
