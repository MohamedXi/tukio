#!/usr/bin/env bash
# Tukio — bootstrap databases (Story 0.10)
#
# Creates the 10 Tukio service databases plus the Keycloak database
# (idempotent) and runs TypeORM migrations for every service whose
# `migrations/` directory exists.
#
# Pre-req: `pnpm docker:up:wait` (Postgres must be healthy).
# Usage:   bash infra/scripts/bootstrap-databases.sh
#
# Env overrides:
#   PG_HOST (default: localhost)
#   PG_PORT (default: 5432)
#   PG_USER (default: tukio)               — must be a valid PG identifier
#   PG_PASSWORD (default: tukio_dev_password)
#   STRICT_MIGRATIONS=1                    — fail the script if any migration:run fails (CI mode)

set -euo pipefail

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-tukio}"
PG_PASSWORD="${PG_PASSWORD:-tukio_dev_password}"
PG_CONTAINER="${PG_CONTAINER:-tukio_postgres}"
STRICT_MIGRATIONS="${STRICT_MIGRATIONS:-0}"

# Validate PG_USER as a Postgres identifier — interpolated into GRANT below.
# Reject anything outside [A-Za-z_][A-Za-z0-9_]* to prevent SQL injection
# (M15 — review finding).
if ! [[ "$PG_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "❌ PG_USER='$PG_USER' is not a valid Postgres identifier (^[A-Za-z_][A-Za-z0-9_]*$)."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ─── 0. Pre-req check ────────────────────────────────────────────────
# Prefer host psql when available; otherwise fall back to running psql
# inside the postgres container (works on every dev machine without
# requiring `brew install libpq`).
#
# PSQL is a bash array so we never word-split user-controlled strings.
if command -v psql >/dev/null 2>&1; then
  PSQL_MODE="host"
  PSQL=(env "PGPASSWORD=$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER")
  if ! PGPASSWORD="$PG_PASSWORD" pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -q; then
    echo "❌ Postgres not ready at $PG_HOST:$PG_PORT (user=$PG_USER)."
    echo "   Run 'pnpm docker:up:wait' first, then retry."
    exit 1
  fi
  echo "🐘 Postgres reachable at $PG_HOST:$PG_PORT (psql via host)"
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  PSQL_MODE="docker"
  PSQL=(docker exec -i -e "PGPASSWORD=$PG_PASSWORD" "$PG_CONTAINER" psql -U "$PG_USER")
  if ! docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -q; then
    echo "❌ Postgres container '$PG_CONTAINER' is up but not ready yet."
    echo "   Run 'pnpm docker:up:wait' and retry."
    exit 1
  fi
  echo "🐘 Postgres reachable via 'docker exec ${PG_CONTAINER}' (psql client falls back to container)"
else
  echo "❌ Need either a host 'psql' (brew install libpq) OR a running '$PG_CONTAINER' container."
  echo "   Run 'pnpm docker:up:wait' first, or install psql on the host."
  exit 1
fi

# ─── 1. Create databases (idempotent) ────────────────────────────────
DBS=(
  "keycloak"           # Keycloak's own metadata
  "tukio_identity"
  "tukio_catalog"
  "tukio_booking"
  "tukio_order"
  "tukio_payment"
  "tukio_messaging"
  "tukio_review"
  "tukio_notification"
  "tukio_media"
  "tukio_meta"
)

echo ""
echo "📦 Creating databases…"
for db in "${DBS[@]}"; do
  exists="$("${PSQL[@]}" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '${db}'" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ "$exists" = "1" ]; then
    echo "  ⏭️  $db already exists, skipped"
  else
    "${PSQL[@]}" -d postgres -q -c "CREATE DATABASE \"${db}\""
    echo "  ✅ $db created"
  fi
  "${PSQL[@]}" -d postgres -q -c "GRANT ALL PRIVILEGES ON DATABASE \"${db}\" TO ${PG_USER}"
done

# ─── 2. Run TypeORM migrations per service ───────────────────────────
SERVICES=(
  "identity-svc"
  "catalog-svc"
  "booking-svc"
  "order-svc"
  "payment-svc"
  "messaging-svc"
  "review-svc"
  "notification-svc"
  "media-svc"
)

echo ""
echo "🔧 Running migrations…"
declare -i migration_failures=0
for svc in "${SERVICES[@]}"; do
  mig_dir="${REPO_ROOT}/apps/${svc}/src/infrastructure/persistence/typeorm/migrations"
  if [ ! -d "$mig_dir" ] || [ -z "$(ls -A "$mig_dir" 2>/dev/null)" ]; then
    echo "  ⏭️  $svc — no migrations yet, skipped"
    continue
  fi

  # Verify pnpm filter actually resolves the workspace before running, so a
  # rename / typo on $svc surfaces loudly instead of silently skipping.
  if ! (cd "$REPO_ROOT" && pnpm --filter="$svc" --silent exec true >/dev/null 2>&1); then
    echo "  ❌ $svc — pnpm filter does not match a workspace; check the SERVICES array."
    migration_failures=$((migration_failures + 1))
    continue
  fi

  echo "  ⏳ $svc — running migrations…"
  # Capture stderr so we can show it on failure (was '>/dev/null 2>&1' which
  # masked the real error and made debugging painful — H1 review finding).
  log_file="$(mktemp)"
  if (cd "$REPO_ROOT" && pnpm --filter="$svc" run migration:run >"$log_file" 2>&1); then
    echo "  ✅ $svc — migrations applied"
    rm -f "$log_file"
  else
    echo "  ❌ $svc — migration:run failed:"
    sed 's/^/      /' "$log_file"
    rm -f "$log_file"
    migration_failures=$((migration_failures + 1))
  fi
done

echo ""
if [ "$migration_failures" -gt 0 ]; then
  echo "⚠️  $migration_failures migration target(s) failed."
  if [ "$STRICT_MIGRATIONS" = "1" ]; then
    echo "❌ STRICT_MIGRATIONS=1 — exiting non-zero."
    exit 1
  fi
  echo "    (set STRICT_MIGRATIONS=1 to fail-fast in CI)"
fi
echo "✅ Databases bootstrapped successfully"
