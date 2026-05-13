#!/usr/bin/env bash
# Tukio — bootstrap Keycloak realm `tukio` (Story 0.10)
#
# Provisions the realm + 5 realm roles + 4 OIDC clients (web/admin/api/mobile)
# and configures MFA TOTP for the admin client. Idempotent: re-running updates
# existing entities instead of creating duplicates.
#
# Pre-req: `pnpm docker:up:wait` (Keycloak must be healthy).
# Usage:   bash infra/scripts/bootstrap-keycloak-realm.sh
#
# Env overrides:
#   KEYCLOAK_URL              (default: http://localhost:8080)
#   KEYCLOAK_CONTAINER        (default: tukio_keycloak)
#   KEYCLOAK_ADMIN_USER       (default: admin)
#   KEYCLOAK_ADMIN_PASSWORD   (default: admin)
#   KEYCLOAK_REALM            (default: tukio)
#   TUKIO_API_CLIENT_SECRET   (default: tukio_api_dev_secret)

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-tukio_keycloak}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-tukio}"
TUKIO_API_CLIENT_SECRET="${TUKIO_API_CLIENT_SECRET:-tukio_api_dev_secret}"

# Use -i so we can pipe JSON payloads to kcadm.sh `... -f -` (stdin).
KCADM="docker exec -i ${KEYCLOAK_CONTAINER} /opt/keycloak/bin/kcadm.sh"

# ─── 0. Pre-req: Keycloak healthy ────────────────────────────────────
echo "🔐 Checking Keycloak at ${KEYCLOAK_URL}…"
# Keycloak 25 puts /health/ready on the management port (9000) which is not
# exposed to the host. We probe the well-known /realms/master endpoint on
# port 8080 instead — once it returns a JSON realm config, Keycloak is up.
if ! curl -fsS -o /dev/null --max-time 5 "${KEYCLOAK_URL}/realms/master/.well-known/openid-configuration"; then
  echo "❌ Keycloak does not respond at ${KEYCLOAK_URL}/realms/master/.well-known/openid-configuration."
  echo "   Run 'pnpm docker:up:wait' and wait for the keycloak container to be healthy, then retry."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${KEYCLOAK_CONTAINER}"; then
  echo "❌ Container '${KEYCLOAK_CONTAINER}' is not running. Run 'pnpm docker:up:wait' first."
  exit 1
fi

# ─── 1. Authenticate kcadm as admin ──────────────────────────────────
echo "🔑 Authenticating admin against master realm…"
$KCADM config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$KEYCLOAK_ADMIN_USER" \
  --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

# ─── 2. Create or update realm `tukio` ───────────────────────────────
REALM_JSON=$(cat <<EOF
{
  "realm": "${KEYCLOAK_REALM}",
  "enabled": true,
  "displayName": "Tukio.one",
  "loginTheme": "keycloak",
  "accountTheme": "keycloak",
  "adminTheme": "keycloak",
  "emailTheme": "keycloak",
  "internationalizationEnabled": true,
  "supportedLocales": ["fr", "en"],
  "defaultLocale": "fr",
  "registrationAllowed": true,
  "registrationEmailAsUsername": true,
  "verifyEmail": true,
  "resetPasswordAllowed": true,
  "rememberMe": true,
  "bruteForceProtected": true,
  "permanentLockout": false,
  "maxFailureWaitSeconds": 900,
  "failureFactor": 5,
  "waitIncrementSeconds": 60,
  "minimumQuickLoginWaitSeconds": 60,
  "accessTokenLifespan": 900,
  "ssoSessionMaxLifespan": 28800,
  "ssoSessionIdleTimeout": 7200,
  "passwordPolicy": "length(12) and notUsername and notEmail and specialChars(1) and upperCase(1) and digits(1)"
}
EOF
)

if $KCADM get "realms/${KEYCLOAK_REALM}" >/dev/null 2>&1; then
  echo "  ⏭️  Realm '${KEYCLOAK_REALM}' exists — updating config"
  echo "$REALM_JSON" | $KCADM update "realms/${KEYCLOAK_REALM}" -f - >/dev/null
else
  echo "  ✅ Creating realm '${KEYCLOAK_REALM}'"
  echo "$REALM_JSON" | $KCADM create realms -f - >/dev/null
fi

# ─── 3. Realm roles ──────────────────────────────────────────────────
ROLES=("client" "pro" "admin-support" "admin-modo" "admin-super")

echo "👥 Provisioning realm roles…"
for role in "${ROLES[@]}"; do
  if $KCADM get "roles/${role}" -r "${KEYCLOAK_REALM}" >/dev/null 2>&1; then
    echo "  ⏭️  role '${role}' already exists"
  else
    $KCADM create roles -r "${KEYCLOAK_REALM}" -s "name=${role}" >/dev/null
    echo "  ✅ role '${role}' created"
  fi
done

# ─── 4. OIDC clients ─────────────────────────────────────────────────
# Helper: get client UUID by clientId (empty if missing).
# kcadm CSV format outputs values only (no header row). We validate the
# result is UUID-shaped before returning so a kcadm error spilling on stdout
# can't masquerade as a "uuid" we then PUT to (M3 review finding).
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

get_client_uuid() {
  local client_id="$1"
  local raw
  raw="$($KCADM get clients -r "${KEYCLOAK_REALM}" -q "clientId=${client_id}" --fields id --format csv --noquotes 2>/dev/null \
    | head -n1 \
    | tr -d '\r\n[:space:]' \
    || true)"
  if [[ "$raw" =~ $UUID_RE ]]; then
    echo "$raw"
  fi
  # Empty output → caller treats as "missing" and creates the client.
}

# Story 0.10 / H6 review finding: re-running the bootstrap silently
# overwrote the tukio-api confidential client secret to its dev default
# even when an operator had rotated it via the admin UI.
# Strategy:
#   - For PUBLIC clients we always update (idempotent, safe).
#   - For CONFIDENTIAL clients (those carrying a "secret" key), we strip
#     the secret on update so the existing one is preserved. Pass
#     FORCE_CLIENT_SECRET=1 to opt back in to overwriting.
FORCE_CLIENT_SECRET="${FORCE_CLIENT_SECRET:-0}"

upsert_client() {
  local client_id="$1"
  local payload="$2"
  local uuid
  uuid="$(get_client_uuid "$client_id")"
  if [ -n "$uuid" ]; then
    local update_payload="$payload"
    if [ "$FORCE_CLIENT_SECRET" != "1" ]; then
      # Drop the "secret" line if present. Conservative sed: only matches a
      # full key-on-its-own-line so we don't accidentally munge JSON values.
      update_payload="$(echo "$payload" | sed '/^[[:space:]]*"secret"[[:space:]]*:/d' | sed 's/,\([[:space:]]*\)}\([[:space:]]*\)$/\1}\2/')"
    fi
    echo "  ⏭️  client '${client_id}' exists (uuid=${uuid}) — updating (secret preserved unless FORCE_CLIENT_SECRET=1)"
    echo "$update_payload" | $KCADM update "clients/${uuid}" -r "${KEYCLOAK_REALM}" -f - >/dev/null
  else
    echo "  ✅ creating client '${client_id}'"
    echo "$payload" | $KCADM create clients -r "${KEYCLOAK_REALM}" -f - >/dev/null
  fi
}

echo "🔧 Provisioning OIDC clients…"

# tukio-web (public + PKCE S256)
upsert_client "tukio-web" "$(cat <<'EOF'
{
  "clientId": "tukio-web",
  "name": "Tukio Web (public, customer + seller + public)",
  "enabled": true,
  "publicClient": true,
  "protocol": "openid-connect",
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": false,
  "implicitFlowEnabled": false,
  "redirectUris": [
    "https://*.tukio.one/*",
    "http://localhost:3000/*",
    "http://localhost:3001/*",
    "http://localhost:3002/*"
  ],
  "webOrigins": ["+"],
  "attributes": {
    "pkce.code.challenge.method": "S256",
    "post.logout.redirect.uris": "+"
  }
}
EOF
)"

# tukio-admin (public + PKCE S256 + TOTP required)
upsert_client "tukio-admin" "$(cat <<'EOF'
{
  "clientId": "tukio-admin",
  "name": "Tukio Admin (public, MFA TOTP required)",
  "enabled": true,
  "publicClient": true,
  "protocol": "openid-connect",
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": false,
  "redirectUris": [
    "https://admin.tukio.one/*",
    "http://localhost:3003/*"
  ],
  "webOrigins": ["+"],
  "attributes": {
    "pkce.code.challenge.method": "S256",
    "post.logout.redirect.uris": "+"
  }
}
EOF
)"

# tukio-api (confidential, machine-to-machine)
upsert_client "tukio-api" "$(cat <<EOF
{
  "clientId": "tukio-api",
  "name": "Tukio API (confidential, M2M)",
  "enabled": true,
  "publicClient": false,
  "protocol": "openid-connect",
  "standardFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": true,
  "secret": "${TUKIO_API_CLIENT_SECRET}",
  "attributes": {
    "use.refresh.tokens": "false"
  }
}
EOF
)"

# tukio-mobile (public + PKCE S256, V2 prep)
upsert_client "tukio-mobile" "$(cat <<'EOF'
{
  "clientId": "tukio-mobile",
  "name": "Tukio Mobile (public, React Native — V2)",
  "enabled": true,
  "publicClient": true,
  "protocol": "openid-connect",
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "redirectUris": ["tukio://callback"],
  "attributes": {
    "pkce.code.challenge.method": "S256"
  }
}
EOF
)"

# ─── 5. Bind TOTP requirement to the `browser` flow ─────────────────
# Keycloak's default `browser` flow already contains a "Browser - Conditional OTP"
# execution. We force its requirement to REQUIRED for the admin client by making
# OTP REQUIRED at the realm level (`otpPolicyType=totp`) and elevating the
# conditional OTP execution to REQUIRED. This applies to all users in the realm;
# non-admin users can register a TOTP authenticator on first login or via the
# account console. (FR9 + NFR12 explicitly mandate admin TOTP; in V1 we can
# scope this per-client via authentication flow override.)
echo "🔐 Configuring TOTP policy…"
$KCADM update "realms/${KEYCLOAK_REALM}" -s 'otpPolicyType=totp' \
  -s 'otpPolicyAlgorithm=HmacSHA1' -s 'otpPolicyDigits=6' \
  -s 'otpPolicyPeriod=30' -s 'otpPolicyInitialCounter=0' \
  -s 'otpPolicyLookAheadWindow=1' >/dev/null

# Elevate the "Browser - Conditional OTP" execution to REQUIRED so that any user
# with the `configure-totp` required action will be forced to set up TOTP.
# Assert exactly ONE matching execution to avoid silently elevating the wrong
# step if Keycloak ships multiple "Conditional OTP" entries (EH-10 review finding).
OTP_EXEC_LINES="$($KCADM get "authentication/flows/browser/executions" -r "${KEYCLOAK_REALM}" \
  --format csv --noquotes --fields id,displayName 2>/dev/null \
  | awk -F, 'tolower($2) ~ /conditional otp/ {print $1}')"
OTP_EXEC_COUNT="$(echo -n "$OTP_EXEC_LINES" | grep -c . || true)"
if [ "$OTP_EXEC_COUNT" -eq 1 ]; then
  OTP_EXEC_ID="$OTP_EXEC_LINES"
  $KCADM update "authentication/flows/browser/executions" -r "${KEYCLOAK_REALM}" \
    -b "{\"id\":\"${OTP_EXEC_ID}\",\"requirement\":\"REQUIRED\"}" >/dev/null \
    && echo "  ✅ browser flow: Conditional OTP set to REQUIRED" \
    || echo "  ⚠️  could not update Conditional OTP requirement"
elif [ "$OTP_EXEC_COUNT" -gt 1 ]; then
  echo "  ❌ multiple 'Conditional OTP' executions found in browser flow (count=$OTP_EXEC_COUNT) — refusing to elevate (would risk wrong execution)."
  exit 1
else
  echo "  ⚠️  Conditional OTP execution not found in browser flow (skipped)"
fi

# ─── 6. Summary ──────────────────────────────────────────────────────
echo ""
echo "✅ Realm '${KEYCLOAK_REALM}' provisioned"
echo "   • ${#ROLES[@]} realm roles : ${ROLES[*]}"
echo "   • 4 OIDC clients         : tukio-web, tukio-admin, tukio-api, tukio-mobile"
echo "   • Admin console           : ${KEYCLOAK_URL}/admin/master/console/#/${KEYCLOAK_REALM}"
echo ""
echo "Next steps:"
echo "  • Re-export realm config : bash infra/scripts/export-keycloak-realm.sh"
echo "  • Seed dev users (Epic 1+) via the admin console or a dedicated seed-users.sh"
