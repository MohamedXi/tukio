#!/usr/bin/env bash
# Restore a Postgres database from a Cloudflare R2 backup.
#
# Usage (on tukio-data droplet as user `tukio`):
#   ./infra/scripts/restore-postgres.sh <database> <date> [--force]
#
# Examples:
#   ./restore-postgres.sh tukio_catalog 2026-05-13           # restore yesterday's catalog DB
#   ./restore-postgres.sh keycloak 2026-05-13 --force        # skip safety prompt
#
# Resolution order:
#   1. daily/<date>/<db>.sql.gz
#   2. weekly/<date>/<db>.sql.gz
#   3. monthly/<date>/<db>.sql.gz
#
# Behavior: downloads dump to /tmp, runs pg_restore via docker exec, returns
# exit code from the restore command. Existing data is DROPPED (the dump
# was created with --clean --if-exists).

set -euo pipefail

DB="${1:-}"
DATE="${2:-}"
FORCE=""
[[ "${3:-}" == "--force" ]] && FORCE=1

if [[ -z "${DB}" || -z "${DATE}" ]]; then
  echo "Usage: $0 <database> <YYYY-MM-DD> [--force]" >&2
  echo "" >&2
  echo "Available databases: tukio_identity, tukio_catalog, tukio_booking," >&2
  echo "  tukio_order, tukio_payment, tukio_messaging, tukio_review," >&2
  echo "  tukio_notification, tukio_media, keycloak" >&2
  exit 1
fi

R2_REMOTE="${R2_REMOTE:-r2:tukio-backups-prod}"
SECRETS_DIR="/home/tukio/tukio/secrets"
WORK_DIR="$(mktemp -d -t tukio-restore-XXXXXX)"
trap 'rm -rf "${WORK_DIR}"' EXIT

archive="${WORK_DIR}/${DB}_${DATE}.sql.gz"

echo "── resolving R2 source for ${DB} @ ${DATE}..."
found=""
for tier in daily weekly monthly; do
  src="${R2_REMOTE}/postgres/${tier}/${DATE}/${DB}.sql.gz"
  if rclone lsf "${src}" --quiet >/dev/null 2>&1; then
    echo "── found in ${tier} tier"
    rclone copyto "${src}" "${archive}" --progress
    found="${tier}"
    break
  fi
done

if [[ -z "${found}" ]]; then
  echo "ERROR: no backup found for ${DB} on ${DATE} in daily/weekly/monthly" >&2
  exit 2
fi

if [[ -z "${FORCE}" ]]; then
  echo ""
  echo "⚠️  This will DROP and recreate the contents of '${DB}' on tukio-data."
  read -rp "    Type the database name to confirm: " confirm
  if [[ "${confirm}" != "${DB}" ]]; then
    echo "ERROR: confirmation mismatch — aborted" >&2
    exit 3
  fi
fi

PG_USER="$(cat "${SECRETS_DIR}/pg_user")"
export PGPASSWORD="$(cat "${SECRETS_DIR}/pg_password")"

# Discover the running postgres container name dynamically.
PG_CONTAINER="$(docker compose -f /home/tukio/tukio/infra/docker-compose/data.prod.yml \
  ps -q postgres 2>/dev/null | head -1)"
if [[ -z "${PG_CONTAINER}" ]]; then
  PG_CONTAINER="tukio-data-postgres-1"
  echo "WARN: could not resolve postgres container via compose — falling back to '${PG_CONTAINER}'"
fi

echo ""
echo "⚠️  IMPORTANT: Stop consumer services BEFORE restoring to avoid 'database being accessed"
echo "    by other users' errors. Recommended:"
echo "      cd ~/tukio-apps && docker compose -f apps.prod.yml stop"
echo "    Then restore, then restart:"
echo "      docker compose -f apps.prod.yml up -d"
echo ""
if [[ -z "${FORCE}" ]]; then
  read -rp "    Have you stopped consumer services? (yes/no): " svc_confirm
  if [[ "${svc_confirm}" != "yes" ]]; then
    echo "ERROR: stop consumer services first, then re-run" >&2
    exit 3
  fi
fi

echo "── restoring ${DB} (container: ${PG_CONTAINER})..."
gunzip -c "${archive}" | docker exec -e PGPASSWORD -i "${PG_CONTAINER}" \
  psql -U "${PG_USER}" -d "${DB}" --quiet --set ON_ERROR_STOP=1

unset PGPASSWORD
echo "✅ Restore complete: ${DB} ← ${found}/${DATE}"
echo ""
echo "Next steps:"
echo "  1. Verify row counts match expectation"
echo "  2. Restart consumer services if needed: docker compose restart"
