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
#   PG_USER (default: tukio)
#   PG_PASSWORD (default: tukio_dev_password)

set -euo pipefail

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-tukio}"
PG_PASSWORD="${PG_PASSWORD:-tukio_dev_password}"
PG_CONTAINER="${PG_CONTAINER:-tukio_postgres}"
export PGPASSWORD="$PG_PASSWORD"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ─── 0. Pre-req check ────────────────────────────────────────────────
# Prefer host psql when available; otherwise fall back to running psql
# inside the postgres container (works on every dev machine without
# requiring `brew install libpq`).
if command -v psql >/dev/null 2>&1; then
  PSQL_MODE="host"
  PSQL="psql -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER}"
  if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -q; then
    echo "❌ Postgres not ready at $PG_HOST:$PG_PORT (user=$PG_USER)."
    echo "   Run 'pnpm docker:up:wait' first, then retry."
    exit 1
  fi
  echo "🐘 Postgres reachable at $PG_HOST:$PG_PORT (psql via host)"
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  PSQL_MODE="docker"
  PSQL="docker exec -i -e PGPASSWORD=${PG_PASSWORD} ${PG_CONTAINER} psql -U ${PG_USER}"
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
  exists="$($PSQL -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '${db}'" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ "$exists" = "1" ]; then
    echo "  ⏭️  $db already exists, skipped"
  else
    $PSQL -d postgres -q -c "CREATE DATABASE \"${db}\""
    echo "  ✅ $db created"
  fi
  $PSQL -d postgres -q -c "GRANT ALL PRIVILEGES ON DATABASE \"${db}\" TO ${PG_USER}"
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
for svc in "${SERVICES[@]}"; do
  mig_dir="${REPO_ROOT}/apps/${svc}/src/infrastructure/persistence/typeorm/migrations"
  if [ -d "$mig_dir" ] && [ -n "$(ls -A "$mig_dir" 2>/dev/null)" ]; then
    echo "  ⏳ $svc — running migrations…"
    if (cd "$REPO_ROOT" && pnpm --filter="$svc" run migration:run >/dev/null 2>&1); then
      echo "  ✅ $svc — migrations applied"
    else
      echo "  ⚠️  $svc — migration:run failed (continuing). Run 'pnpm --filter=$svc migration:run' to see details."
    fi
  else
    echo "  ⏭️  $svc — no migrations yet, skipped"
  fi
done

echo ""
echo "✅ Databases bootstrapped successfully"
