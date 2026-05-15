#!/usr/bin/env bash
# build-keycloak-themes.sh — package Tukio Keycloak themes as a .jar (ZIP) (Story 1.1)
#
# Usage:
#   bash infra/scripts/build-keycloak-themes.sh [--deploy-local]
#
# Output: dist/tukio-keycloak-themes.jar
# Optionally copies the JAR to the Docker volume for hot-reload in dev.
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly REPO_ROOT

THEMES_DIR="${REPO_ROOT}/infra/keycloak/themes"
DIST_DIR="${REPO_ROOT}/dist"
JAR_NAME="tukio-keycloak-themes.jar"
DEPLOY_LOCAL=false

# ─── Tool prereqs (P-L6) ──────────────────────────────────────────────────────
for tool in zip iconv find; do
  command -v "$tool" >/dev/null 2>&1 || { echo "❌ Required tool not found: $tool" >&2; exit 1; }
done

for arg in "$@"; do
  case $arg in
    --deploy-local) DEPLOY_LOCAL=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

echo "🎨 Building Tukio Keycloak themes…"

# ── Validate .properties encoding (UTF-8) ────────────────────────────────────
echo "  → Validating .properties encoding…"
while IFS= read -r -d '' props_file; do
  if ! iconv -f utf-8 -t utf-8 "$props_file" >/dev/null 2>&1; then
    echo "  ❌ Encoding error in: $props_file" >&2
    exit 1
  fi
done < <(find "$THEMES_DIR" -name "*.properties" -print0)
echo "  ✅ All .properties files are valid UTF-8"

# ── Package ───────────────────────────────────────────────────────────────────
mkdir -p "$DIST_DIR"
JAR_PATH="${DIST_DIR}/${JAR_NAME}"

# Keycloak themes JARs are ZIPs with the theme directory at the root
(cd "$THEMES_DIR" && zip -r "${JAR_PATH}" tukio/ -x "*.DS_Store" -x "__MACOSX/*" -q)
echo "  ✅ Packaged: ${JAR_PATH}"

# ── Deploy to Docker volume (dev hot-reload) ──────────────────────────────────
if [[ "$DEPLOY_LOCAL" == "true" ]]; then
  COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose/docker-compose.dev.yml"
  CONTAINER_ID="$(docker compose -f "$COMPOSE_FILE" ps -q keycloak 2>/dev/null || true)"
  if [ -n "$CONTAINER_ID" ]; then
    docker compose -f "$COMPOSE_FILE" cp "${JAR_PATH}" "keycloak:/opt/keycloak/providers/${JAR_NAME}"
    echo "  ✅ Deployed to container (restart Keycloak to reload themes)"
  else
    echo "  ⚠️  Keycloak not running — JAR built but not deployed"
  fi
fi

echo ""
echo "✅ Build complete: ${JAR_PATH}"
echo "   For dev: mount infra/keycloak/themes → /opt/keycloak/themes (see docker-compose.dev.yml)"
