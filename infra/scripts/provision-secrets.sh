#!/usr/bin/env bash
# Interactive secrets provisioning for a Tukio droplet.
# Prompts for each missing secret and writes it to /home/tukio/tukio/secrets/<name>
# with mode 600 and ownership tukio:tukio.
#
# Idempotent — re-running skips secrets that already exist (unless --rotate is set).
#
# Usage (on the droplet, as `tukio` user):
#   ./infra/scripts/provision-secrets.sh apps
#   ./infra/scripts/provision-secrets.sh data
#   ./infra/scripts/provision-secrets.sh apps --rotate stripe_secret  # force re-prompt

set -euo pipefail

ROLE="${1:-}"
shift || true
ROTATE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate) ROTATE="${2:-}"; shift 2 ;;
    *) echo "ERROR: unknown arg '$1'" >&2; exit 1 ;;
  esac
done

if [[ "$ROLE" != "apps" && "$ROLE" != "data" ]]; then
  echo "ERROR: role must be 'apps' or 'data' (got: '$ROLE')" >&2
  echo "Usage: $0 <apps|data> [--rotate <secret-name>]" >&2
  exit 1
fi

SECRETS_DIR="/home/tukio/tukio/secrets"

# Verify we're running as `tukio` (not root).
if [[ "$(id -un)" != "tukio" ]]; then
  echo "ERROR: must run as 'tukio' user (not $(id -un))" >&2
  echo "  sudo -u tukio $0 $ROLE $*" >&2
  exit 1
fi

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Required secrets per role.
declare -A SECRETS_APPS=(
  [pg_user]="Postgres app user (matches data droplet)"
  [pg_password]="Postgres app password"
  [meili_key]="Meilisearch master key (32+ chars hex)"
  [stripe_secret]="Stripe secret key (sk_live_... or sk_test_...)"
  [resend_api_key]="Resend API key (re_...)"
  [r2_access_key]="Cloudflare R2 access key ID"
  [r2_secret_key]="Cloudflare R2 secret access key"
  # Story 0.20 — pre-launch handlers in apps/public consume these via
  # process.env directly (Next.js Route Handlers have no _FILE loader, so
  # the deploy script `export VAR=$(cat …)`s them before `docker compose up`).
  # Co-locating non-sensitive values (audience id / from / inbox) here keeps
  # provisioning to a single channel; the secrets dir is mode 700 so it's safe.
  [upstash_redis_url]="Upstash Redis REST URL (https://<endpoint>.upstash.io)"
  [upstash_redis_token]="Upstash Redis REST token (gQAAAAAA...)"
  [resend_pre_launch_audience_id]="Resend Audience UUID for pre-launch signups"
  [resend_from_address]="Resend From address for contact notifications (e.g. hello@tukio.one)"
  [contact_inbox]="Inbox that receives contact form notifications (e.g. ismael.mohamed@tukio.one)"
  # Story 1.13 (ADR-0018) — social IdP brokering. Register the OAuth apps first:
  # Google → Google Cloud Console (OAuth 2.0 Client ID, Web) ; Microsoft → Azure
  # Entra ID app registration. Redirect URI: https://auth.tukio.one/realms/tukio/broker/<google|microsoft>/endpoint
  [google_client_id]="Google OAuth client ID (…apps.googleusercontent.com)"
  [google_client_secret]="Google OAuth client secret"
  [microsoft_client_id]="Microsoft (Azure Entra) application (client) ID"
  [microsoft_client_secret]="Microsoft (Azure Entra) client secret value"
)

declare -A SECRETS_DATA=(
  [pg_user]="Postgres app user (e.g. 'tukio')"
  [pg_password]="Postgres app password"
  [kc_admin_password]="Keycloak admin user password"
  # Keycloak KC_DB_USERNAME/KC_DB_PASSWORD do not support the _FILE env suffix.
  # These are provisioned as secret files and exported manually before docker compose up:
  #   export KC_DB_USERNAME=$(cat secrets/kc_db_username)
  #   export KC_DB_PASSWORD=$(cat secrets/kc_db_password)
  [kc_db_username]="Keycloak DB username (usually same value as pg_user)"
  [kc_db_password]="Keycloak DB password (usually same value as pg_password)"
  # Story 1.1 — realm-level secrets consumed by bootstrap-keycloak-realm.sh
  [kc_client_secret_tukio_api]="Keycloak confidential client secret for tukio-api (M2M)"
  [kc_client_secret_smoke_test]="Keycloak confidential client secret for tukio-smoke-test (CI)"
  [kc_webhook_secret]="HMAC shared secret for Phasetwo LOGIN_ERROR webhook → identity-svc"
  [meili_key]="Meilisearch master key (32+ chars hex)"
  [r2_access_key]="Cloudflare R2 access key ID (for backups)"
  [r2_secret_key]="Cloudflare R2 secret access key (for backups)"
)

# Pick set based on role.
if [[ "$ROLE" == "apps" ]]; then
  declare -n SECRETS_REF=SECRETS_APPS
else
  declare -n SECRETS_REF=SECRETS_DATA
fi

echo "──────────────────────────────────────────────────────────────"
echo "  Provisioning $ROLE droplet secrets"
echo "  Directory: $SECRETS_DIR"
echo "──────────────────────────────────────────────────────────────"

provision_secret() {
  local name="$1"
  local description="$2"
  local file="$SECRETS_DIR/$name"

  if [[ -f "$file" && -s "$file" && "$ROTATE" != "$name" ]]; then
    echo "[✓] $name — already provisioned (use --rotate $name to replace)"
    return 0
  fi

  if [[ "$ROTATE" == "$name" ]]; then
    echo "[↻] Rotating $name"
  else
    echo "[?] Missing $name"
  fi
  echo "    $description"
  read -rsp "    Enter value (input hidden): " value
  echo ""

  if [[ -z "$value" ]]; then
    echo "    ERROR: empty value rejected" >&2
    return 1
  fi

  # Strip trailing newline only (preserve internal whitespace if any).
  printf '%s' "$value" > "$file"
  chmod 600 "$file"
  echo "[✓] $name → $file ($(stat -c '%a' "$file"))"
}

# Iterate the associative array.
for name in "${!SECRETS_REF[@]}"; do
  provision_secret "$name" "${SECRETS_REF[$name]}"
done

# Sanity check ownership.
chown -R tukio:tukio "$SECRETS_DIR" 2>/dev/null || sudo chown -R tukio:tukio "$SECRETS_DIR"

echo ""
echo "──────────────────────────────────────────────────────────────"
echo "  ✅ $ROLE secrets ready"
ls -lh "$SECRETS_DIR" | tail -n +2
echo "──────────────────────────────────────────────────────────────"
echo ""
echo "  Next:"
if [[ "$ROLE" == "data" ]]; then
  echo "    1. Configure rclone for R2 (uses r2_access_key/r2_secret_key):"
  echo "         rclone config"
  echo "         > New remote: r2"
  echo "         > Storage: s3"
  echo "         > Provider: Cloudflare"
  echo "         > access_key_id: <paste r2_access_key content>"
  echo "         > secret_access_key: <paste r2_secret_key content>"
  echo "         > endpoint: https://<account-id>.r2.cloudflarestorage.com"
  echo "    2. Start data stack: docker compose -f infra/docker-compose/data.prod.yml up -d --wait"
else
  echo "    1. Login GHCR: docker login ghcr.io -u MohamedXi"
  echo "    2. Start apps stack: docker compose -f infra/docker-compose/apps.prod.yml up -d --wait"
fi
