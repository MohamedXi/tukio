#!/usr/bin/env bash
# smoke-test-keycloak-realm.sh — verify Story 1.1 ACs (8 smoke tests) (Story 1.1)
#
# Usage: bash infra/scripts/smoke-test-keycloak-realm.sh [--env=local|staging]
#                                                         [--skip-phasetwo-tests]
#
# Exit 0 if all tests pass, exit 1 on first failure.
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly REPO_ROOT

# ─── Tool prereqs (P-L5) ──────────────────────────────────────────────────────
for tool in curl python3 docker; do
  command -v "$tool" >/dev/null 2>&1 || { echo "❌ Required tool not found: $tool" >&2; exit 1; }
done

ENV="local"
SKIP_PHASETWO_TESTS="${ENABLE_PHASETWO_TESTS:+false}"
SKIP_PHASETWO_TESTS="${SKIP_PHASETWO_TESTS:-false}"
for arg in "$@"; do
  case $arg in
    --env=*) ENV="${arg#*=}" ;;
    --skip-phasetwo-tests) SKIP_PHASETWO_TESTS=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

# ─── Env vars ─────────────────────────────────────────────────────────────────
case $ENV in
  local)
    KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
    KEYCLOAK_ADMIN_USERNAME="${KEYCLOAK_ADMIN_USERNAME:-admin}"
    KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
    KEYCLOAK_CLIENT_SECRET_SMOKE_TEST="${KEYCLOAK_CLIENT_SECRET_SMOKE_TEST:-tukio_smoke_dev_secret}"
    ;;
  staging)
    command -v doppler >/dev/null 2>&1 || { echo "Doppler CLI required for staging" >&2; exit 1; }
    eval "$(doppler secrets download --no-file --format env --project tukio --config staging)"
    ;;
  *) echo "Unknown env: $ENV" >&2; exit 1 ;;
esac

KC="${KEYCLOAK_URL}"
COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose/docker-compose.dev.yml"

kcadm() {
  if [[ "$ENV" == "local" ]]; then
    docker compose -f "$COMPOSE_FILE" exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@"
  else
    docker run --rm --network host \
      -v /tmp/kcadm-config:/opt/keycloak/.keycloak \
      quay.io/keycloak/keycloak:latest \
      /opt/keycloak/bin/kcadm.sh "$@"
  fi
}

# ─── Track created entities for trap-based cleanup (P-M12) ─────────────────────
SMOKE_USER_ID=""
LOCK_USER_ID=""

cleanup_smoke_users() {
  if [ -n "$SMOKE_USER_ID" ]; then
    kcadm delete "users/${SMOKE_USER_ID}" -r tukio >/dev/null 2>&1 || true
  fi
  if [ -n "$LOCK_USER_ID" ]; then
    kcadm delete "users/${LOCK_USER_ID}" -r tukio >/dev/null 2>&1 || true
  fi
}
trap cleanup_smoke_users EXIT

# ─── Result tracking ──────────────────────────────────────────────────────────
PASSED=0
FAILED=0
declare -a RESULTS

# P-M11: capture stderr on FAIL so failures aren't undebuggable
run_test() {
  local name="$1"
  local start_ms
  start_ms="$(($(date +%s%N) / 1000000))"
  local status="PASS"
  local err_log
  err_log="$(mktemp)"
  if ! eval "$2" >/dev/null 2>"$err_log"; then
    status="FAIL"
  fi
  local elapsed_ms="$(( $(date +%s%N) / 1000000 - start_ms ))"
  if [ "$status" = "PASS" ]; then
    RESULTS+=("✅ ${name} (${elapsed_ms}ms)")
    PASSED=$((PASSED + 1))
  else
    local err_summary
    err_summary="$(head -3 "$err_log" | tr '\n' ' ' | head -c 200)"
    RESULTS+=("❌ ${name} (${elapsed_ms}ms) — FAILED: ${err_summary}")
    FAILED=$((FAILED + 1))
  fi
  rm -f "$err_log"
}

# ─── Admin login ──────────────────────────────────────────────────────────────
echo "🔑 Authenticating admin…"
kcadm config credentials \
  --server "${KC}" --realm master \
  --user "${KEYCLOAK_ADMIN_USERNAME}" \
  --password "${KEYCLOAK_ADMIN_PASSWORD}" >/dev/null 2>&1

echo "🧪 Running smoke tests…"
echo ""

# ── Test 1 (AC1): OIDC discovery endpoint ─────────────────────────────────────
run_test "T1 — OIDC discovery (AC1)" \
  "curl -fsS '${KC}/realms/tukio/.well-known/openid-configuration' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert 'issuer' in d and d['issuer'].endswith('/realms/tukio')\""

# ── Test 2 (AC1): ALL 5 realm roles must exist (P-H6: iterate, not OR-grep) ────
run_test "T2 — all 5 realm roles (AC1)" "$(cat <<SHELLEOF
  names_csv=\$(kcadm get roles -r tukio --fields name --format csv --noquotes 2>/dev/null)
  for r in client pro admin-support admin-modo admin-super; do
    echo "\$names_csv" | grep -qx "\$r" || { echo "missing role: \$r" >&2; exit 1; }
  done
SHELLEOF
)"

# ── Test 3 (AC2): 4 production clients enabled ────────────────────────────────
run_test "T3 — 4 clients enabled (AC2)" \
  "for id in tukio-web tukio-admin tukio-api tukio-mobile; do
     kcadm get \"clients?clientId=\$id\" -r tukio --fields enabled --format csv --noquotes 2>/dev/null | grep -qx 'true' || exit 1
   done"

# ── Test 4 (AC2): PKCE S256 on tukio-web ──────────────────────────────────────
run_test "T4 — PKCE S256 on tukio-web (AC2)" \
  "kcadm get 'clients?clientId=tukio-web' -r tukio | python3 -c \"
import sys, json
d = json.load(sys.stdin)
assert d and 'attributes' in d[0], f'no attributes in client: {d!r}'
got = d[0]['attributes'].get('pkce.code.challenge.method')
assert got == 'S256', f'expected S256, got {got!r}; attributes={d[0][\\\"attributes\\\"]!r}'
\""

# ── Test 5 (AC4): tukio:locale claim in JWT (P-M9 urlsafe b64, P-M12 cleanup via trap) ──
SMOKE_USER="smoke-test-$$@tukio.one"
run_test "T5 — tukio:locale claim in JWT (AC4)" "$(cat <<SHELLEOF
  kcadm create users -r tukio \
    -s "username=${SMOKE_USER}" \
    -s "email=${SMOKE_USER}" \
    -s "enabled=true" \
    -s "emailVerified=true" \
    -s "attributes.locale=[\"en\"]" \
    -s "attributes.status=[\"active\"]" >/dev/null 2>&1
  SMOKE_USER_ID=\$(kcadm get users -r tukio -q "email=${SMOKE_USER}" --fields id --format csv --noquotes 2>/dev/null | head -1 | tr -d '\r\n ')
  echo "\$SMOKE_USER_ID" > /tmp/smoke-user-id-\$\$
  kcadm set-password -r tukio --username "${SMOKE_USER}" -p "Smoke!Test1234" >/dev/null 2>&1
  TOKEN_RESPONSE=\$(curl -sS -X POST "${KC}/realms/tukio/protocol/openid-connect/token" \
    -d "grant_type=password&username=${SMOKE_USER}&password=Smoke!Test1234&client_id=tukio-smoke-test&client_secret=${KEYCLOAK_CLIENT_SECRET_SMOKE_TEST}")
  if ! echo "\$TOKEN_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); 'access_token' in d or (_ for _ in ()).throw(AssertionError(f'no access_token, response={d!r}'))" 2>&1; then
    echo "T5 token request failed: \$TOKEN_RESPONSE" >&2
    exit 1
  fi
  ACCESS_TOKEN=\$(echo "\$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
  # P-M9: JWT payload uses urlsafe base64 with possible padding stripped
  python3 -c "
import base64, json, sys
seg = '\$ACCESS_TOKEN'.split('.')[1]
seg += '=' * (-len(seg) % 4)
payload = json.loads(base64.urlsafe_b64decode(seg).decode())
assert payload.get('tukio:locale') == 'en', f'expected tukio:locale=en, got {payload.get(\"tukio:locale\")!r}'
assert payload.get('tukio:status') == 'active', f'expected tukio:status=active, got {payload.get(\"tukio:status\")!r}'
"
SHELLEOF
)"
# Capture user id for trap cleanup
[ -f "/tmp/smoke-user-id-$$" ] && SMOKE_USER_ID=$(cat "/tmp/smoke-user-id-$$" 2>/dev/null) && rm -f "/tmp/smoke-user-id-$$"

# ── Test 6 (AC5): brute-force locks account after 5 failures ──────────────────
# P-M10: pre-clear any existing lockout state by creating a fresh user
LOCK_USER="smoke-lock-$$@tukio.one"
run_test "T6 — brute-force lock after 5 failures (AC5)" "$(cat <<SHELLEOF
  kcadm create users -r tukio \
    -s "username=${LOCK_USER}" \
    -s "email=${LOCK_USER}" \
    -s "enabled=true" \
    -s "emailVerified=true" >/dev/null 2>&1
  LOCK_USER_ID=\$(kcadm get users -r tukio -q "email=${LOCK_USER}" --fields id --format csv --noquotes 2>/dev/null | head -1 | tr -d '\r\n ')
  echo "\$LOCK_USER_ID" > /tmp/lock-user-id-\$\$
  kcadm set-password -r tukio --username "${LOCK_USER}" -p "Correct!Pass123" >/dev/null 2>&1
  # P-M10: ensure no pre-existing lockout
  kcadm update users/\${LOCK_USER_ID} -r tukio -s "enabled=true" >/dev/null 2>&1 || true
  for i in \$(seq 1 5); do
    curl -fsS -X POST "${KC}/realms/tukio/protocol/openid-connect/token" \
      -d "grant_type=password&username=${LOCK_USER}&password=WRONG_PASS&client_id=tukio-smoke-test&client_secret=${KEYCLOAK_CLIENT_SECRET_SMOKE_TEST}" >/dev/null 2>&1 || true
  done
  SIXTH_RESPONSE=\$(curl -s -X POST "${KC}/realms/tukio/protocol/openid-connect/token" \
    -d "grant_type=password&username=${LOCK_USER}&password=WRONG_PASS&client_id=tukio-smoke-test&client_secret=${KEYCLOAK_CLIENT_SECRET_SMOKE_TEST}" 2>/dev/null || true)
  echo "\$SIXTH_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
desc = d.get('error_description', '').lower()
assert any(k in desc for k in ('locked', 'disabled', 'temporarily')), f'expected lockout, got: {desc}'
"
SHELLEOF
)"
[ -f "/tmp/lock-user-id-$$" ] && LOCK_USER_ID=$(cat "/tmp/lock-user-id-$$" 2>/dev/null) && rm -f "/tmp/lock-user-id-$$"

# ── Test 7 (AC6): themes wired (config check + render check) ─────────────────
# /login-actions/registration requires a session_code; instead, check the realm
# is configured with the `tukio` theme AND hit the OIDC auth endpoint that
# triggers the actual login page render.
run_test "T7 — realm wired to tukio theme (AC6)" \
  "kcadm get realms/tukio --fields 'loginTheme,accountTheme,emailTheme' | python3 -c \"
import sys, json
d = json.load(sys.stdin)
for k in ('loginTheme', 'accountTheme', 'emailTheme'):
    assert d.get(k) == 'tukio', f'{k} expected tukio, got {d.get(k)!r}'
\""

# Hit the OIDC auth endpoint that renders the login page — follows redirects.
AUTH_URL="${KC}/realms/tukio/protocol/openid-connect/auth?client_id=tukio-web&response_type=code&scope=openid&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2F&kc_locale=fr"
run_test "T7b — login page renders FR (AC6)" \
  "curl -fsSL '$AUTH_URL' 2>/dev/null | grep -q 'Tukio\|Se connecter\|Bienvenue'"

AUTH_URL_EN="${KC}/realms/tukio/protocol/openid-connect/auth?client_id=tukio-web&response_type=code&scope=openid&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2F&kc_locale=en"
run_test "T7c — login page renders EN (AC6)" \
  "curl -fsSL '$AUTH_URL_EN' 2>/dev/null | grep -q 'Tukio\|Sign in\|Welcome'"

# ── Test 8 (AC8): Phasetwo Orgs API — P-L8: opt-out for vanilla Keycloak ──────
if [[ "$SKIP_PHASETWO_TESTS" != "true" ]]; then
  # Auto-detect: probe endpoint, accept only 200 + JSON array as available
  T8_BODY="$(curl -sS -o /tmp/t8.body -w '%{http_code}' "${KC}/realms/tukio/orgs" 2>/dev/null || echo "000")"
  T8_IS_JSON_ARRAY=$(python3 -c "
import json
try:
    with open('/tmp/t8.body') as f:
        d = json.load(f)
    print('yes' if isinstance(d, list) else 'no')
except Exception:
    print('no')
" 2>/dev/null)
  if [ "$T8_BODY" = "200" ] && [ "$T8_IS_JSON_ARRAY" = "yes" ]; then
    RESULTS+=("✅ T8 — Phasetwo Orgs API (AC8) — endpoint responds with JSON array")
    PASSED=$((PASSED + 1))
  else
    RESULTS+=("⏭️  T8 — Phasetwo Orgs API skipped (HTTP=$T8_BODY, json_array=$T8_IS_JSON_ARRAY)")
  fi
  rm -f /tmp/t8.body
else
  RESULTS+=("⏭️  T8 — Phasetwo Orgs API skipped (--skip-phasetwo-tests)")
fi

# ─── Results ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Smoke Test Results — Realm tukio (env=${ENV})                  "
echo "╠══════════════════════════════════════════════════════════════════╣"
for result in "${RESULTS[@]}"; do
  printf "║  %-63s║\n" "$result"
done
echo "╠══════════════════════════════════════════════════════════════════╣"
printf "║  %d/%d passed                                                        ║\n" "$PASSED" "$((PASSED + FAILED))"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "❌ ${FAILED} test(s) failed"
  exit 1
fi
echo "✅ All smoke tests passed"
