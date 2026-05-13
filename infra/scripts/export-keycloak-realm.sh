#!/usr/bin/env bash
# Tukio — export Keycloak realm config to JSON (Story 0.10)
#
# Regenerates `infra/scripts/keycloak/realm-export.json` from the running
# Keycloak container by calling the admin REST API's `partial-export`
# endpoint (which — unlike `kcadm.sh get realms/{name}` — embeds clients
# and roles in the output).
#
# Usage:
#   bash infra/scripts/export-keycloak-realm.sh
#
# Commit the result so testcontainers (Story 0.9) + CI consume the same
# realm config.
#
# Dependencies: bash, curl, and either jq (preferred) or python3 for
# pretty-printing + token extraction.

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-tukio}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="${REPO_ROOT}/infra/scripts/keycloak/realm-export.json"

# EH-25 — ensure parent dir exists on a fresh clone.
mkdir -p "$(dirname "$OUTPUT_FILE")"

# M4 — prefer jq, fall back to python3, fail loudly if neither.
if command -v jq >/dev/null 2>&1; then
  JSON_TOOL="jq"
elif command -v python3 >/dev/null 2>&1; then
  JSON_TOOL="python3"
else
  echo "❌ Need either 'jq' (preferred) or 'python3' to parse + pretty-print JSON."
  echo "   macOS: brew install jq    |    Debian/Ubuntu: apt install jq"
  exit 1
fi

extract_token() {
  if [ "$JSON_TOOL" = "jq" ]; then
    jq -r '.access_token // empty'
  else
    python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("access_token",""))'
  fi
}

pretty_print() {
  if [ "$JSON_TOOL" = "jq" ]; then
    jq '.'
  else
    python3 -m json.tool
  fi
}

echo "🔑 Fetching admin token from ${KEYCLOAK_URL}…"
TOKEN_RESPONSE="$(curl -fsS -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli&username=${KEYCLOAK_ADMIN_USER}&password=${KEYCLOAK_ADMIN_PASSWORD}&grant_type=password" \
  || true)"

TOKEN="$(echo "$TOKEN_RESPONSE" | extract_token || true)"
if [ -z "$TOKEN" ]; then
  echo "❌ Failed to obtain admin token. Response (first 200 chars):"
  echo "$TOKEN_RESPONSE" | head -c 200
  echo ""
  echo "   Is Keycloak running? Run 'pnpm docker:up:wait'."
  exit 1
fi

# EH-23 — write to a tmpfile + validate JSON before clobbering OUTPUT_FILE.
# Otherwise a 401/500 response leaves us with a truncated/garbage export.
echo "📤 Exporting realm '${KEYCLOAK_REALM}' (clients + groups + roles)…"
TMP_RAW="$(mktemp -t tukio-realm-export.XXXXXX.json)"
TMP_PRETTY="$(mktemp -t tukio-realm-export.pretty.XXXXXX.json)"
trap 'rm -f "$TMP_RAW" "$TMP_PRETTY"' EXIT

if ! curl -fsS -X POST \
  "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/partial-export?exportClients=true&exportGroupsAndRoles=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "$TMP_RAW"; then
  echo "❌ partial-export request failed. First 500 chars of body:"
  head -c 500 "$TMP_RAW"
  echo ""
  exit 1
fi

# Validate the response is parseable JSON.
if ! pretty_print < "$TMP_RAW" > "$TMP_PRETTY" 2>/dev/null; then
  echo "❌ Response was not valid JSON. First 500 chars:"
  head -c 500 "$TMP_RAW"
  echo ""
  exit 1
fi

mv "$TMP_PRETTY" "$OUTPUT_FILE"

# EH-24 — count clients/roles via jq when available (grep heuristics on
# pretty-printed JSON can double-count when keys wrap onto multiple lines).
if [ "$JSON_TOOL" = "jq" ]; then
  CLIENT_COUNT="$(jq '[.clients[]? | select(.clientId | startswith("tukio-"))] | length' "$OUTPUT_FILE")"
  ROLE_COUNT="$(jq '[.roles.realm[]? | select(.name | test("^(client|pro|admin-(support|modo|super))$"))] | length' "$OUTPUT_FILE")"
else
  CLIENT_COUNT="$(grep -oE '"clientId": *"tukio-[^"]+"' "$OUTPUT_FILE" | wc -l | tr -d '[:space:]')"
  ROLE_COUNT="$(grep -oE '"name": *"(client|pro|admin-(support|modo|super))"' "$OUTPUT_FILE" | wc -l | tr -d '[:space:]')"
fi

echo "✅ Realm export written: ${OUTPUT_FILE}"
echo "   • Tukio clients : ${CLIENT_COUNT}"
echo "   • Tukio roles   : ${ROLE_COUNT}"
echo "   • JSON tool used: ${JSON_TOOL}"
echo ""
echo "Next: git add ${OUTPUT_FILE} && git commit"
