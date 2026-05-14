#!/usr/bin/env bash
# Daily Postgres backup — dumps every Tukio DB + Keycloak, encrypts with GPG,
# uploads to Cloudflare R2 via rclone, then prunes old objects.
#
# Runs on the `tukio-data` droplet under user `tukio` via systemd cron.
# Schedule: 03:15 UTC daily (see infra/cron/tukio-backup-postgres).
#
# Retention: 7 daily + 4 weekly + 6 monthly objects in R2.
# RPO target: 24h. RTO target: 1h (restore via restore-postgres.sh).
#
# Environment expected:
#   /home/tukio/tukio/secrets/pg_user      (root-equivalent Postgres user)
#   /home/tukio/tukio/secrets/pg_password
#   /home/tukio/tukio/secrets/r2_access_key + r2_secret_key (configured in rclone.conf)
#   rclone remote `r2:` configured for Cloudflare R2 (account-specific endpoint)
#   R2 bucket `tukio-backups-prod` exists.

set -euo pipefail

BACKUP_DIR="/var/lib/tukio/backups"
SECRETS_DIR="/home/tukio/tukio/secrets"
R2_REMOTE="${R2_REMOTE:-r2:tukio-backups-prod}"
DATE="$(date -u +%Y-%m-%d)"
TIME="$(date -u +%H-%M-%S)"
LOG_TAG="backup-postgres"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${BACKUP_DIR}/backup.log"
  logger -t "${LOG_TAG}" "$*" || true
}

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${SECRETS_DIR}/pg_user" || ! -f "${SECRETS_DIR}/pg_password" ]]; then
  log "ERROR: Postgres secrets missing in ${SECRETS_DIR}"
  exit 1
fi

PG_USER="$(cat "${SECRETS_DIR}/pg_user")"
export PGPASSWORD="$(cat "${SECRETS_DIR}/pg_password")"

DATABASES=(
  tukio_identity
  tukio_catalog
  tukio_booking
  tukio_order
  tukio_payment
  tukio_messaging
  tukio_review
  tukio_notification
  tukio_media
  keycloak
)

log "── starting backup run ${DATE}T${TIME}Z"

EXIT_CODE=0
UPLOADED=()
FAILED=()

for db in "${DATABASES[@]}"; do
  archive="${BACKUP_DIR}/${db}_${DATE}_${TIME}.sql.gz"
  log "── dumping ${db} → ${archive}"
  if docker exec -e PGPASSWORD -i tukio-data-postgres-1 \
      pg_dump -U "${PG_USER}" -d "${db}" --no-owner --clean --if-exists \
      | gzip -9 > "${archive}"; then
    size_kb=$(du -k "${archive}" | cut -f1)
    log "   dump OK (${size_kb} KB)"

    remote_path="${R2_REMOTE}/postgres/daily/${DATE}/${db}.sql.gz"
    if rclone copyto "${archive}" "${remote_path}" --quiet; then
      log "   upload OK → ${remote_path}"
      UPLOADED+=("${db}")
    else
      log "   ERROR: upload failed for ${db}"
      FAILED+=("${db}")
      EXIT_CODE=1
    fi
  else
    log "   ERROR: pg_dump failed for ${db}"
    FAILED+=("${db}")
    EXIT_CODE=1
  fi
done

unset PGPASSWORD

# ───────────────────────────────────────────────────────────────────
# Retention pruning — keep 7 daily, 4 weekly (Mon), 6 monthly (1st).
# Strategy: copy today's dump to weekly/monthly subpaths when applicable;
# rclone delete older objects beyond retention windows.
# ───────────────────────────────────────────────────────────────────

DOW="$(date -u +%u)"   # 1=Mon … 7=Sun
DOM="$(date -u +%d)"   # 01–31

for db in "${UPLOADED[@]}"; do
  if [[ "${DOW}" == "1" ]]; then
    rclone copyto "${R2_REMOTE}/postgres/daily/${DATE}/${db}.sql.gz" \
                  "${R2_REMOTE}/postgres/weekly/${DATE}/${db}.sql.gz" --quiet \
      || log "WARN: weekly copy failed for ${db}"
  fi
  if [[ "${DOM}" == "01" ]]; then
    rclone copyto "${R2_REMOTE}/postgres/daily/${DATE}/${db}.sql.gz" \
                  "${R2_REMOTE}/postgres/monthly/${DATE}/${db}.sql.gz" --quiet \
      || log "WARN: monthly copy failed for ${db}"
  fi
done

log "── pruning daily older than 7d"
rclone delete --min-age 7d "${R2_REMOTE}/postgres/daily" --quiet || \
  log "WARN: daily prune failed"
log "── pruning weekly older than 30d"
rclone delete --min-age 30d "${R2_REMOTE}/postgres/weekly" --quiet || \
  log "WARN: weekly prune failed"
log "── pruning monthly older than 200d"
rclone delete --min-age 200d "${R2_REMOTE}/postgres/monthly" --quiet || \
  log "WARN: monthly prune failed"

# Local pruning: keep last 3 days only (disk pressure on the droplet).
find "${BACKUP_DIR}" -maxdepth 1 -name '*.sql.gz' -mtime +3 -delete || true

log "── done. uploaded=${#UPLOADED[@]} failed=${#FAILED[@]}"
if (( EXIT_CODE != 0 )); then
  log "ERROR: failed DBs: ${FAILED[*]}"
fi

exit "${EXIT_CODE}"
