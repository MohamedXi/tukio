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

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-tukio}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="${REPO_ROOT}/infra/scripts/keycloak/realm-export.json"

echo "🔑 Fetching admin token from ${KEYCLOAK_URL}…"
TOKEN=$(curl -fsS -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli&username=${KEYCLOAK_ADMIN_USER}&password=${KEYCLOAK_ADMIN_PASSWORD}&grant_type=password" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to obtain admin token. Is Keycloak running? Run 'pnpm docker:up:wait'."
  exit 1
fi

echo "📤 Exporting realm '${KEYCLOAK_REALM}' (clients + groups + roles)…"
curl -fsS -X POST \
  "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/partial-export?exportClients=true&exportGroupsAndRoles=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -m json.tool > "${OUTPUT_FILE}"

CLIENT_COUNT=$(grep -oE '"clientId": *"tukio-[^"]+"' "${OUTPUT_FILE}" | wc -l | tr -d '[:space:]')
ROLE_COUNT=$(grep -oE '"name": *"(client|pro|admin-(support|modo|super))"' "${OUTPUT_FILE}" | wc -l | tr -d '[:space:]')

echo "✅ Realm export written: ${OUTPUT_FILE}"
echo "   • Tukio clients : ${CLIENT_COUNT}"
echo "   • Tukio roles   : ${ROLE_COUNT}"
echo ""
echo "Next: git add ${OUTPUT_FILE} && git commit"
