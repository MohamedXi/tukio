#!/usr/bin/env bash
# Trigger a DigitalOcean droplet snapshot via doctl.
# Snapshots are full block-storage images of the droplet — RPO ~24h, RTO ~10 min restore.
#
# Usage:
#   ./infra/scripts/do-snapshot.sh <apps|data>
#
# Authenticates via doctl context (configured at droplet init).
# Retains last 7 snapshots per droplet; older snapshots are deleted to
# stay within the DO free snapshot tier (€0.06/GiB-month above quota).
#
# Schedule: 04:00 UTC apps, 04:30 UTC data (see infra/cron/tukio-do-snapshot-*).

set -euo pipefail

ROLE="${1:-}"
case "${ROLE}" in
  apps|data) ;;
  *)
    echo "Usage: $0 <apps|data>" >&2
    exit 1
    ;;
esac

DROPLET_NAME="tukio-${ROLE}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M)"
SNAPSHOT_NAME="${DROPLET_NAME}-${TIMESTAMP}"
RETAIN=7
LOG_TAG="do-snapshot-${ROLE}"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  logger -t "${LOG_TAG}" "$*" || true
}

if ! command -v doctl >/dev/null 2>&1; then
  log "ERROR: doctl not installed — run do-droplet-init.sh first"
  exit 1
fi

# Enforce 600 permissions on the DO token file if present (prevents world-read of DO API key).
DO_ENV_FILE="/etc/tukio/do.env"
if [[ -f "${DO_ENV_FILE}" ]]; then
  chmod 600 "${DO_ENV_FILE}"
  chown root:root "${DO_ENV_FILE}" 2>/dev/null || true
fi

DROPLET_ID="$(doctl compute droplet list --format ID,Name --no-header \
  | awk -v n="${DROPLET_NAME}" '$2==n {print $1}')"

if [[ -z "${DROPLET_ID}" ]]; then
  log "ERROR: droplet '${DROPLET_NAME}' not found in DO account"
  exit 2
fi

log "── triggering snapshot '${SNAPSHOT_NAME}' for droplet ${DROPLET_ID}"
doctl compute droplet-action snapshot "${DROPLET_ID}" \
  --snapshot-name "${SNAPSHOT_NAME}" \
  --wait

log "── snapshot created. Pruning to retain last ${RETAIN}..."

# List snapshots whose name starts with the droplet name, sorted oldest first.
SNAPSHOT_IDS=()
while IFS= read -r line; do
  SNAPSHOT_IDS+=("${line}")
done < <(
  doctl compute snapshot list --resource droplet --format ID,Name,CreatedAt --no-header \
    | awk -v p="${DROPLET_NAME}-" '$2 ~ "^"p { print $0 }' \
    | sort -k3 \
    | awk '{print $1}'
)

count="${#SNAPSHOT_IDS[@]}"
log "── found ${count} snapshots prefixed '${DROPLET_NAME}-'"

if (( count > RETAIN )); then
  to_delete=$(( count - RETAIN ))
  log "── deleting ${to_delete} oldest snapshot(s)"
  for (( i = 0; i < to_delete; i++ )); do
    id="${SNAPSHOT_IDS[$i]}"
    log "   → deleting snapshot id=${id}"
    doctl compute snapshot delete "${id}" --force || \
      log "   WARN: delete failed for ${id}"
  done
else
  log "── no pruning needed (under retention limit)"
fi

log "── done."
