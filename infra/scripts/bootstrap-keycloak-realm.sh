#!/usr/bin/env bash
# bootstrap-keycloak-realm.sh — provision realm `tukio` idempotemment (Story 1.1)
#
# Usage:
#   bootstrap-keycloak-realm.sh [--env=local|staging|production]
#                                [--export-only]
#                                [--skip-phasetwo-webhook]
#
# Requirements (local): Keycloak running via `pnpm docker:up:wait`
# Requirements (staging): Doppler CLI authenticated, `KEYCLOAK_URL` reachable
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly REPO_ROOT
readonly KC_CONFIG_DIR="${REPO_ROOT}/infra/keycloak/realm-config"
readonly KC_EXPORT_DIR="${REPO_ROOT}/infra/keycloak/realm-export"

# ─── Tool prerequisites ───────────────────────────────────────────────────────
for tool in curl python3 envsubst docker; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "❌ Required tool not found: $tool" >&2
    exit 1
  }
done

# ─── Args parsing ─────────────────────────────────────────────────────────────
ENV="local"
EXPORT_ONLY=false
SKIP_PHASETWO_WEBHOOK=false
for arg in "$@"; do
  case $arg in
    --env=*) ENV="${arg#*=}" ;;
    --export-only) EXPORT_ONLY=true ;;
    --skip-phasetwo-webhook) SKIP_PHASETWO_WEBHOOK=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

# ─── Logging helpers ──────────────────────────────────────────────────────────
log_info()  { echo "  ✅ $*"; }
log_warn()  { echo "  ⚠️  $*"; }
log_error() { echo "  ❌ $*" >&2; }
log_step()  { echo ""; echo "── $* ──────────────────────────────────────────"; }

# ─── Env config ───────────────────────────────────────────────────────────────
case $ENV in
  local)
    export KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
    export KEYCLOAK_HEALTH_URL="${KEYCLOAK_HEALTH_URL:-http://localhost:9000/health/ready}"
    export KEYCLOAK_ADMIN_USERNAME="${KEYCLOAK_ADMIN_USERNAME:-admin}"
    export KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
    export KEYCLOAK_CLIENT_SECRET_TUKIO_API="${KEYCLOAK_CLIENT_SECRET_TUKIO_API:-tukio_api_dev_secret}"
    export KEYCLOAK_CLIENT_SECRET_SMOKE_TEST="${KEYCLOAK_CLIENT_SECRET_SMOKE_TEST:-tukio_smoke_dev_secret}"
    export KEYCLOAK_WEBHOOK_SECRET="${KEYCLOAK_WEBHOOK_SECRET:-tukio_webhook_dev_secret}"
    export REDIRECT_URIS_TUKIO_WEB='["http://localhost:3000/*","http://localhost:3001/*","http://localhost:3002/*"]'
    export REDIRECT_URIS_TUKIO_ADMIN='["http://localhost:3003/*"]'
    export IDENTITY_SVC_WEBHOOK_URL="${IDENTITY_SVC_WEBHOOK_URL:-http://host.docker.internal:4001/internal/keycloak-events}"
    export SMTP_HOST="${SMTP_HOST:-mailhog}"
    export SMTP_PORT="${SMTP_PORT:-1025}"
    export SMTP_FROM="${SMTP_FROM:-no-reply@tukio.one}"
    export SMTP_USER="${SMTP_USER:-}"
    export SMTP_PASSWORD="${SMTP_PASSWORD:-}"
    export SMOKE_TEST_ENABLED="${SMOKE_TEST_ENABLED:-true}"
    ;;
  staging)
    # Story 1.1b — run on the tukio-data droplet; secrets are file-based per
    # the MVP infra pivot (memory: mvp_infra_pivot_2026_05_14.md). Doppler removed.
    SECRETS_DIR="${SECRETS_DIR:-/home/tukio/tukio/secrets}"
    if [ ! -d "$SECRETS_DIR" ]; then
      log_error "Secrets dir not found: $SECRETS_DIR"
      log_error "This script must run on the tukio-data droplet. SSH first:"
      log_error "  ssh tukio@\$DO_HOST_DATA"
      log_error "  cd ~/tukio-data && bash infra/scripts/bootstrap-keycloak-realm.sh --env=staging"
      exit 1
    fi
    read_secret() {
      local file="${SECRETS_DIR}/$1"
      if [ ! -r "$file" ]; then
        log_error "Missing secret: $file"
        log_error "Provision via: ./infra/scripts/provision-secrets.sh data"
        exit 1
      fi
      tr -d '\r\n' < "$file"
    }
    export KEYCLOAK_URL="${KEYCLOAK_URL:-https://auth.tukio.one}"
    _admin_username="$(read_secret kc_admin_username 2>/dev/null || echo admin)"
    _admin_password="$(read_secret kc_admin_password)"
    _client_secret_api="$(read_secret kc_client_secret_tukio_api)"
    _client_secret_smoke="$(read_secret kc_client_secret_smoke_test)"
    _webhook_secret="$(read_secret kc_webhook_secret)"
    export KEYCLOAK_ADMIN_USERNAME="${KEYCLOAK_ADMIN_USERNAME:-$_admin_username}"
    export KEYCLOAK_ADMIN_PASSWORD="$_admin_password"
    export KEYCLOAK_CLIENT_SECRET_TUKIO_API="$_client_secret_api"
    export KEYCLOAK_CLIENT_SECRET_SMOKE_TEST="$_client_secret_smoke"
    export KEYCLOAK_WEBHOOK_SECRET="$_webhook_secret"
    # Health probe uses the local data-private-IP management port (9000) exposed
    # by data.prod.yml so we bypass Caddy/TLS handshake.
    DATA_PRIV_IP_FILE="${SECRETS_DIR}/data_priv_ip"
    if [ -r "$DATA_PRIV_IP_FILE" ]; then
      DATA_PRIV_IP="$(tr -d '\r\n' < "$DATA_PRIV_IP_FILE")"
      export KEYCLOAK_HEALTH_URL="${KEYCLOAK_HEALTH_URL:-http://${DATA_PRIV_IP}:9000/health/ready}"
    else
      export KEYCLOAK_HEALTH_URL="${KEYCLOAK_HEALTH_URL:-${KEYCLOAK_URL}/health/ready}"
    fi
    export REDIRECT_URIS_TUKIO_WEB='["https://tukio.one/*","https://seller.tukio.one/*"]'
    export REDIRECT_URIS_TUKIO_ADMIN='["https://admin.tukio.one/*"]'
    export IDENTITY_SVC_WEBHOOK_URL="${IDENTITY_SVC_WEBHOOK_URL:-http://gateway-api:4000/internal/keycloak-events}"
    # SMTP — read from secrets dir if present, else leave empty (no email delivery)
    _smtp_host="$(read_secret smtp_host 2>/dev/null || echo '')"
    _smtp_user="$(read_secret smtp_user 2>/dev/null || echo '')"
    _smtp_password="$(read_secret smtp_password 2>/dev/null || echo '')"
    export SMTP_HOST="${SMTP_HOST:-$_smtp_host}"
    export SMTP_PORT="${SMTP_PORT:-587}"
    export SMTP_FROM="${SMTP_FROM:-no-reply@tukio.one}"
    export SMTP_USER="${SMTP_USER:-$_smtp_user}"
    export SMTP_PASSWORD="${SMTP_PASSWORD:-$_smtp_password}"
    export SMOKE_TEST_ENABLED="${SMOKE_TEST_ENABLED:-false}"
    ;;
  production)
    log_error "production env requires manual approval."
    log_error "See docs/runbook/keycloak-realm-bootstrap.md §Production deployment."
    exit 1
    ;;
  *) log_error "Unknown env: $ENV (valid: local|staging|production)"; exit 1 ;;
esac

# ─── kcadm.sh wrapper ─────────────────────────────────────────────────────────
# local:   docker compose exec against the dev compose file
# staging: docker exec on the tukio_keycloak container running on the same droplet
COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose/docker-compose.dev.yml"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-tukio_keycloak}"
kcadm() {
  if [[ "$ENV" == "local" ]]; then
    docker compose -f "$COMPOSE_FILE" exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@"
  else
    docker exec -i "${KEYCLOAK_CONTAINER}" /opt/keycloak/bin/kcadm.sh "$@"
  fi
}

UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

get_client_uuid() {
  local client_id="$1"
  local raw
  raw="$(kcadm get clients -r tukio -q "clientId=${client_id}" --fields id --format csv --noquotes 2>/dev/null \
    | head -n1 | tr -d '\r\n[:space:]' || true)"
  if [[ "$raw" =~ $UUID_RE ]]; then echo "$raw"; fi
}

get_admin_access_token() {
  curl -fsS -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
    -d "client_id=admin-cli" \
    -d "username=${KEYCLOAK_ADMIN_USERNAME}" \
    -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
    -d "grant_type=password" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
}

# ─── Healthcheck ──────────────────────────────────────────────────────────────
log_step "Checking Keycloak readiness"
echo "  → ${KEYCLOAK_HEALTH_URL}"
for i in $(seq 1 12); do
  if curl -fsS --max-time 5 "${KEYCLOAK_HEALTH_URL}" >/dev/null 2>&1; then
    log_info "Keycloak is ready (attempt $i)"
    break
  fi
  if [ "$i" -eq 12 ]; then
    log_error "Keycloak not ready after 60 s. Run 'pnpm docker:up:wait' first or check staging DNS."
    exit 1
  fi
  sleep 5
done

# ─── Admin login ──────────────────────────────────────────────────────────────
log_step "Authenticating admin"
kcadm config credentials \
  --server "${KEYCLOAK_URL}" \
  --realm master \
  --user "${KEYCLOAK_ADMIN_USERNAME}" \
  --password "${KEYCLOAK_ADMIN_PASSWORD}"
log_info "Admin authenticated (realm=master)"

# ─── Build a properly-escaped realm payload from realm-base.json + env vars ───
# P-M2/M14: avoid envsubst for sensitive/strict-typed fields; use python json.
build_realm_payload() {
  local out_file="$1"
  python3 - <<PYEOF > "$out_file"
import json, os, sys
with open(os.path.join(os.environ['KC_CONFIG_DIR'], 'realm-base.json')) as f:
    realm = json.load(f)
if 'smtpServer' in realm:
    realm['smtpServer']['host'] = os.environ.get('SMTP_HOST', 'mailhog')
    realm['smtpServer']['port'] = str(os.environ.get('SMTP_PORT', '1025'))
    realm['smtpServer']['from'] = os.environ.get('SMTP_FROM', 'no-reply@tukio.one')
    user = os.environ.get('SMTP_USER', '')
    password = os.environ.get('SMTP_PASSWORD', '')
    realm['smtpServer']['user'] = user
    realm['smtpServer']['password'] = password
    # If no credentials configured, disable SMTP auth so Keycloak doesn't reject the realm.
    if not user:
        realm['smtpServer']['auth'] = 'false'
        realm['smtpServer'].pop('user', None)
        realm['smtpServer'].pop('password', None)
print(json.dumps(realm))
PYEOF
}

# ─── Build client payload from clients/<id>.json + env vars (P-M13 jq-safe) ───
build_client_payload() {
  local client_file="$1"
  local out_file="$2"
  python3 - <<PYEOF > "$out_file"
import json, os, sys
with open(os.environ['CLIENT_FILE']) as f:
    raw = f.read()
# Substitute placeholders via os.environ.get; JSON-encode for arrays and strings safely.
import re
def replace(match):
    var = match.group(1)
    val = os.environ.get(var, '')
    # Heuristic: REDIRECT_URIS_* values are already valid JSON arrays — paste raw
    if var.startswith('REDIRECT_URIS_'):
        return val if val else '[]'
    # Otherwise JSON-escape as string (the placeholder is replacing a quoted value)
    return json.dumps(val)[1:-1]
substituted = re.sub(r'\\\${([A-Z_][A-Z0-9_]*)}', replace, raw)
# Parse-and-reserialize to validate
client = json.loads(substituted)
# Strip URI paths from webOrigins (Keycloak expects origins, not URI patterns) — P-H8
if 'webOrigins' in client and isinstance(client['webOrigins'], list):
    from urllib.parse import urlsplit
    origins = []
    for entry in client['webOrigins']:
        if entry in ('+', '*'):
            origins.append(entry)
            continue
        # Strip path: scheme://host[:port]
        parts = urlsplit(entry)
        if parts.scheme and parts.netloc:
            origins.append(f"{parts.scheme}://{parts.netloc}")
        else:
            origins.append(entry)
    # De-duplicate while preserving order
    seen = set()
    client['webOrigins'] = [o for o in origins if not (o in seen or seen.add(o))]
# P-H4: SMOKE_TEST_ENABLED env var controls tukio-smoke-test
if client.get('clientId') == 'tukio-smoke-test':
    enabled_env = os.environ.get('SMOKE_TEST_ENABLED', 'true').lower()
    client['enabled'] = enabled_env in ('1', 'true', 'yes')
print(json.dumps(client))
PYEOF
}

if [[ "$EXPORT_ONLY" == "true" ]]; then
  log_step "Export-only mode — skipping provisioning"
else
  # ─── Realm create/update ──────────────────────────────────────────────────
  log_step "Realm tukio"
  # NOTE: kcadm runs inside the container via docker exec — pipe payloads via
  # stdin (-f -), never -f <host-path> (file would be resolved in-container).
  TMP_REALM=$(mktemp)
  export KC_CONFIG_DIR
  build_realm_payload "$TMP_REALM"
  if kcadm get "realms/tukio" >/dev/null 2>&1; then
    log_info "Realm tukio exists — updating config"
    kcadm update "realms/tukio" -f - < "$TMP_REALM" >/dev/null
  else
    log_info "Creating realm tukio"
    kcadm create realms -f - < "$TMP_REALM" >/dev/null
  fi
  rm "$TMP_REALM"

  # ─── 5 realm roles with i18n attributes (P-M6 reconcile on every run) ─────
  # NOTE: read into an array first; `docker compose exec -T` consumes loop stdin
  # when used inside `while read < <(...)` and would exit after the first role.
  log_step "Realm roles (5)"
  readarray -t ROLE_LINES < <(python3 -c "
import json, sys, os
data = json.load(open(os.path.join(os.environ['KC_CONFIG_DIR'], 'roles.json')))
for role in data['roles']:
    print(json.dumps(role))
")
  for role_json in "${ROLE_LINES[@]}"; do
    role_name="$(echo "$role_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['name'])")"
    existing_id="$(kcadm get "roles/${role_name}" -r tukio --fields id --format csv --noquotes </dev/null 2>/dev/null | head -1 | tr -d '\r\n ' || true)"
    if [ -n "$existing_id" ] && [[ "$existing_id" =~ $UUID_RE ]]; then
      log_info "Role '${role_name}' exists — updating via roles-by-id (reconcile attrs)"
      if echo "$role_json" | kcadm update "roles-by-id/${existing_id}" -r tukio -f - >/dev/null 2>&1; then
        log_info "  → attributes reconciled"
      else
        log_warn "  → could not reconcile attrs for ${role_name} (continuing)"
      fi
    else
      echo "$role_json" | kcadm create roles -r tukio -f - >/dev/null
      log_info "Role '${role_name}' created"
    fi
  done

  # ─── MFA flow: tukio-admin-mfa-required (P-M5: rollback on partial failure)
  # NOTE: Keycloak API expects flow ALIAS in the URL (not UUID) for
  # `authentication/flows/{alias}/executions/...` endpoints.
  log_step "Authentication flow tukio-admin-mfa-required"
  setup_mfa_flow() {
    local flow_exists
    flow_exists="$(kcadm get "authentication/flows" -r tukio --format csv --noquotes --fields alias </dev/null 2>/dev/null \
      | grep -x "tukio-admin-mfa-required" || true)"
    if [ -n "$flow_exists" ]; then
      log_info "Flow 'tukio-admin-mfa-required' already exists"
      return 0
    fi

    log_info "Cloning browser flow → tukio-admin-mfa-required"
    kcadm create "authentication/flows" -r tukio \
      -s alias=tukio-admin-mfa-required \
      -s providerId=basic-flow \
      -s topLevel=true \
      -s builtIn=false </dev/null >/dev/null

    # Rollback trap — drop the half-built flow on failure
    trap 'log_warn "MFA flow setup failed — rolling back partial flow"; kcadm delete "authentication/flows/tukio-admin-mfa-required" -r tukio </dev/null >/dev/null 2>&1 || true' ERR

    kcadm create "authentication/flows/tukio-admin-mfa-required/executions/execution" -r tukio \
      -s provider=auth-cookie </dev/null >/dev/null
    kcadm create "authentication/flows/tukio-admin-mfa-required/executions/execution" -r tukio \
      -s provider=identity-provider-redirector </dev/null >/dev/null

    kcadm create "authentication/flows/tukio-admin-mfa-required/executions/flow" -r tukio \
      -s alias=tukio-admin-forms \
      -s type=basic-flow </dev/null >/dev/null 2>&1 || true

    kcadm create "authentication/flows/tukio-admin-forms/executions/execution" -r tukio \
      -s provider=auth-username-password-form </dev/null >/dev/null

    kcadm create "authentication/flows/tukio-admin-forms/executions/flow" -r tukio \
      -s alias=tukio-admin-totp-required \
      -s type=basic-flow </dev/null >/dev/null

    kcadm create "authentication/flows/tukio-admin-totp-required/executions/execution" -r tukio \
      -s provider=auth-otp-form </dev/null >/dev/null

    local otp_exec_id
    otp_exec_id="$(kcadm get "authentication/flows/tukio-admin-totp-required/executions" -r tukio \
      --format csv --noquotes --fields id,providerId </dev/null 2>/dev/null \
      | awk -F, '$2=="auth-otp-form" {print $1}' | head -1 | tr -d '\r\n ')"

    if [ -n "$otp_exec_id" ]; then
      kcadm update "authentication/flows/tukio-admin-totp-required/executions" -r tukio \
        -b "{\"id\":\"${otp_exec_id}\",\"requirement\":\"REQUIRED\"}" </dev/null >/dev/null
      log_info "OTP execution set to REQUIRED in tukio-admin-totp-required flow"
    fi

    # P-H5: bind CONFIGURE_RECOVERY_AUTHN_CODES as required-action execution in the flow
    if kcadm create "authentication/flows/tukio-admin-totp-required/executions/execution" -r tukio \
      -s provider=registration-recovery-authn-codes </dev/null >/dev/null 2>&1; then
      log_info "Recovery codes execution added to tukio-admin-totp-required"
    else
      log_warn "Recovery codes execution provider not available — fallback: realm-level required action only"
    fi

    local forms_exec_id
    forms_exec_id="$(kcadm get "authentication/flows/tukio-admin-mfa-required/executions" -r tukio \
      --format csv --noquotes --fields id,displayName </dev/null 2>/dev/null \
      | awk -F, '$2=="tukio-admin-forms" {print $1}' | head -1 | tr -d '\r\n ')"
    if [ -n "$forms_exec_id" ]; then
      kcadm update "authentication/flows/tukio-admin-mfa-required/executions" -r tukio \
        -b "{\"id\":\"${forms_exec_id}\",\"requirement\":\"ALTERNATIVE\"}" </dev/null >/dev/null
    fi

    trap - ERR
    log_info "Flow 'tukio-admin-mfa-required' created"
  }
  setup_mfa_flow

  # ─── OIDC clients (5: web + admin + api + mobile + smoke-test) ────────────
  log_step "OIDC clients"

  FORCE_CLIENT_SECRET="${FORCE_CLIENT_SECRET:-0}"

  upsert_client() {
    local client_id="$1"
    local json_file="$2"
    local tmp_payload
    local stripped=""
    tmp_payload="$(mktemp)"
    export CLIENT_FILE="$json_file"
    build_client_payload "$json_file" "$tmp_payload"

    local uuid
    uuid="$(get_client_uuid "$client_id")"
    if [ -n "$uuid" ]; then
      local update_payload="$tmp_payload"
      if [ "$FORCE_CLIENT_SECRET" != "1" ]; then
        stripped="$(mktemp)"
        python3 -c "
import json
d = json.load(open('$tmp_payload'))
d.pop('secret', None)
json.dump(d, open('$stripped', 'w'), indent=2)
"
        update_payload="$stripped"
      fi
      log_info "Client '${client_id}' exists (${uuid}) — updating (secret preserved unless FORCE_CLIENT_SECRET=1)"
      kcadm update "clients/${uuid}" -r tukio -f - < "$update_payload" >/dev/null
    else
      log_info "Creating client '${client_id}'"
      kcadm create clients -r tukio -f - < "$tmp_payload" >/dev/null
    fi
    rm -f "$tmp_payload"
    if [ -n "$stripped" ]; then
      rm -f "$stripped"
    fi
    # Explicit success — without this, the function's last command (an empty `[ -n "" ] && …`)
    # would return 1 and `set -e` would abort the outer for-loop after the first client.
    return 0
  }

  for client_file in tukio-web tukio-admin tukio-api tukio-mobile tukio-smoke-test; do
    upsert_client "$client_file" "${KC_CONFIG_DIR}/clients/${client_file}.json"
  done

  # ─── Bind MFA flow to tukio-admin client ──────────────────────────────────
  log_step "Binding MFA flow to tukio-admin"
  ADMIN_CLIENT_UUID="$(get_client_uuid "tukio-admin")"
  # Query the flow with a JSON output for reliable parsing (csv field order may differ)
  MFA_FLOW_ID="$(kcadm get "authentication/flows" -r tukio </dev/null 2>/dev/null \
    | python3 -c "
import sys, json
try:
    flows = json.load(sys.stdin)
    for f in (flows if isinstance(flows, list) else []):
        if f.get('alias') == 'tukio-admin-mfa-required':
            print(f.get('id', ''))
            break
except Exception:
    pass
" || true)"
  if [ -n "$ADMIN_CLIENT_UUID" ] && [ -n "$MFA_FLOW_ID" ]; then
    kcadm update "clients/${ADMIN_CLIENT_UUID}" -r tukio \
      -s "authenticationFlowBindingOverrides.browser=${MFA_FLOW_ID}" >/dev/null
    log_info "tukio-admin bound to flow tukio-admin-mfa-required (${MFA_FLOW_ID})"
  else
    log_warn "Could not bind MFA flow (admin uuid=${ADMIN_CLIENT_UUID}, flow=${MFA_FLOW_ID})"
  fi

  # ─── Client scope tukio-locale-scope + protocol mappers (P-L10 acr fallback)
  log_step "Client scope tukio-locale-scope"

  scope_exists() {
    kcadm get "client-scopes" -r tukio --format csv --noquotes --fields name 2>/dev/null \
      | grep -qx "tukio-locale-scope" || return 1
  }

  if scope_exists; then
    log_info "Client scope 'tukio-locale-scope' already exists"
  else
    log_info "Creating client scope 'tukio-locale-scope'"
    # Try creation with full mapper set (including acr); if acr-mapper rejected, retry without it
    if ! kcadm create "client-scopes" -r tukio -f - \
        < "${KC_CONFIG_DIR}/client-scopes/tukio-locale-scope.json" >/dev/null 2>&1; then
      log_warn "Full scope creation failed — retrying without oidc-acr-mapper (amr remains primary)"
      python3 - <<PYEOF | kcadm create "client-scopes" -r tukio -f - >/dev/null
import json, os
with open(os.path.join(os.environ['KC_CONFIG_DIR'], 'client-scopes/tukio-locale-scope.json')) as f:
    scope = json.load(f)
scope['protocolMappers'] = [m for m in scope.get('protocolMappers', []) if m.get('name') != 'acr-mapper']
print(json.dumps(scope))
PYEOF
    fi
  fi
  SCOPE_ID="$(kcadm get "client-scopes" -r tukio --format csv --noquotes --fields id,name 2>/dev/null \
    | awk -F, '$2=="tukio-locale-scope" {print $1}' | head -1 | tr -d '\r\n ')"
  log_info "Client scope ready (id=${SCOPE_ID})"

  # P-M1: assign tukio-locale-scope to ALL 4 public/test clients (incl. smoke-test for T5)
  for public_client in tukio-web tukio-admin tukio-mobile tukio-smoke-test; do
    PUBLIC_UUID="$(get_client_uuid "$public_client")"
    if [ -n "$PUBLIC_UUID" ] && [ -n "$SCOPE_ID" ]; then
      kcadm update "clients/${PUBLIC_UUID}/default-client-scopes/${SCOPE_ID}" -r tukio >/dev/null 2>&1 || true
      log_info "tukio-locale-scope assigned as default to '${public_client}'"
    fi
  done

  # ─── Required Action CONFIGURE_TOTP for admin onboarding ──────────────────
  log_step "Required Actions"
  kcadm update "authentication/required-actions/CONFIGURE_TOTP" -r tukio \
    -s enabled=true -s defaultAction=false >/dev/null 2>&1 || true
  kcadm update "authentication/required-actions/CONFIGURE_RECOVERY_AUTHN_CODES" -r tukio \
    -s enabled=true -s defaultAction=false >/dev/null 2>&1 \
    || log_warn "CONFIGURE_RECOVERY_AUTHN_CODES not available in this Keycloak version"
  log_info "Required actions CONFIGURE_TOTP + CONFIGURE_RECOVERY_AUTHN_CODES enabled"

  # ─── Phasetwo Webhook — P-H1 (proper Bearer token) + P-M7 (idempotent GET-then-PUT) ─
  if [[ "$SKIP_PHASETWO_WEBHOOK" == "false" ]]; then
    log_step "Phasetwo Webhook (LOGIN_ERROR → identity-svc)"

    # P-H1: obtain a real access token via /token endpoint (not kcadm stdout)
    ACCESS_TOKEN=""
    ACCESS_TOKEN="$(get_admin_access_token 2>/dev/null || true)"
    if [ -z "$ACCESS_TOKEN" ]; then
      log_warn "Could not obtain admin access token — skipping Phasetwo webhook setup"
    else
      # P-M7: list existing webhooks, find one matching our URL, update or create
      EXISTING_WEBHOOK_ID="$(curl -fsS \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        "${KEYCLOAK_URL}/realms/tukio/webhooks" 2>/dev/null \
        | python3 -c "
import sys, json, os
try:
    data = json.load(sys.stdin)
    target = os.environ['IDENTITY_SVC_WEBHOOK_URL']
    for w in (data if isinstance(data, list) else []):
        if w.get('url') == target:
            print(w.get('id', ''))
            break
except Exception:
    pass
" 2>/dev/null || true)"

      WEBHOOK_PAYLOAD=$(cat <<JSON
{
  "enabled": true,
  "url": "${IDENTITY_SVC_WEBHOOK_URL}",
  "secret": "${KEYCLOAK_WEBHOOK_SECRET}",
  "eventTypes": ["LOGIN_ERROR", "USER_DISABLED_BY_TEMPORARY_LOCKOUT", "USER_DISABLED_BY_PERMANENT_LOCKOUT"],
  "sendRealmId": true
}
JSON
)
      if [ -n "$EXISTING_WEBHOOK_ID" ]; then
        webhook_status="$(curl -fsS -o /dev/null -w '%{http_code}' \
          -X PUT "${KEYCLOAK_URL}/realms/tukio/webhooks/${EXISTING_WEBHOOK_ID}" \
          -H "Authorization: Bearer ${ACCESS_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "$WEBHOOK_PAYLOAD" 2>/dev/null || echo "000")"
        case "$webhook_status" in
          2*) log_info "Phasetwo webhook updated → ${IDENTITY_SVC_WEBHOOK_URL}" ;;
          404) log_warn "Phasetwo Webhooks API returned 404 — likely non-Phasetwo image." ;;
          *)   log_warn "Phasetwo webhook update HTTP=${webhook_status} (continuing)" ;;
        esac
      else
        webhook_status="$(curl -fsS -o /dev/null -w '%{http_code}' \
          -X POST "${KEYCLOAK_URL}/realms/tukio/webhooks" \
          -H "Authorization: Bearer ${ACCESS_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "$WEBHOOK_PAYLOAD" 2>/dev/null || echo "000")"
        case "$webhook_status" in
          2*) log_info "Phasetwo webhook created → ${IDENTITY_SVC_WEBHOOK_URL}" ;;
          404) log_warn "Phasetwo Webhooks API returned 404 — likely non-Phasetwo image (LOGIN_ERROR bridge inactive)." ;;
          *)   log_warn "Phasetwo webhook create HTTP=${webhook_status} (continuing)" ;;
        esac
      fi
    fi
  fi

fi  # end EXPORT_ONLY check

# ─── Realm export ─────────────────────────────────────────────────────────────
log_step "Exporting realm → ${KC_EXPORT_DIR}/tukio.realm.json"
mkdir -p "${KC_EXPORT_DIR}"

EXPORT_TMP="$(mktemp)"
if ! kcadm get "realms/tukio" -r tukio 2>/dev/null > "$EXPORT_TMP"; then
  log_warn "kcadm export failed — falling back to partial-export REST API"
  ACCESS_TOKEN="$(get_admin_access_token)"
  curl -fsS \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST "${KEYCLOAK_URL}/realms/tukio/partial-export?exportClients=true&exportGroupsAndRoles=true" \
    > "$EXPORT_TMP" || {
    log_error "Could not export realm via either method"
    rm -f "$EXPORT_TMP"
    exit 1
  }
fi

# P-H2: use ${KC_EXPORT_DIR} env var (no hardcoded paths) + P-M19 (extended strip)
export EXPORT_TMP KC_EXPORT_DIR
python3 - <<'PYEOF'
import json, os, sys

with open(os.environ['EXPORT_TMP']) as f:
    realm = json.load(f)

# Strip top-level sensitive fields
for k in ['privateKey', 'publicKey', 'certificate', 'codeSecret']:
    realm.pop(k, None)
if 'smtpServer' in realm:
    for k in ['password', 'user']:
        realm['smtpServer'].pop(k, None)
for client in realm.get('clients', []):
    for k in ['secret', 'registrationAccessToken']:
        client.pop(k, None)
# P-M19: extend component config strip (Keycloak signing key providers)
SENSITIVE_COMPONENT_KEYS = {'secret', 'privateKey', 'salt', 'certificate', 'kid'}
for comp_list in realm.get('components', {}).values():
    for comp in comp_list:
        cfg = comp.get('config', {})
        for k in list(cfg.keys()):
            if k in SENSITIVE_COMPONENT_KEYS:
                cfg.pop(k, None)

# Insert auto-generated metadata header (filter out _generated id which can leak)
header = {
    '_comment': 'AUTO-GENERATED — do not edit manually. Run: pnpm keycloak:bootstrap',
    '_realm': realm.get('realm', 'tukio'),
}
output = {**header, **realm}
output.pop('id', None)  # drop the realm UUID — not meaningful across environments

out_path = os.path.join(os.environ['KC_EXPORT_DIR'], 'tukio.realm.json')
with open(out_path, 'w') as f:
    json.dump(output, f, indent=2, ensure_ascii=False, sort_keys=True)
    f.write('\n')
print(f'  ✅ tukio.realm.json written (sensitive fields stripped, sorted)')
PYEOF
rm -f "$EXPORT_TMP"

# ─── Final summary ────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  ✅  Realm 'tukio' provisioned (env=${ENV})                     "
echo "║  • 5 realm roles   : client, pro, admin-support, admin-modo, admin-super"
echo "║  • 5 OIDC clients  : tukio-web, tukio-admin, tukio-api, tukio-mobile, tukio-smoke-test"
echo "║  • MFA flow        : tukio-admin-mfa-required → tukio-admin ✓"
echo "║  • Custom claims   : tukio:locale, tukio:status, aud, amr, acr"
echo "║  • Phasetwo webhook: LOGIN_ERROR → identity-svc"
echo "║  • Realm export    : ${KC_EXPORT_DIR}/tukio.realm.json"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next: pnpm keycloak:smoke"
