#!/usr/bin/env bash
# Tukio — run chaos tests (Story 0.10)
#
# Spins up the CI-tuned stack (`docker-compose.test.yml --profile slow-services`),
# runs every chaos suite tagged via Jest/Vitest naming, and tears the stack down
# on exit (signal-safe via `trap`).
#
# Conventions:
#   - Jest:   test names tagged with `@chaos` are filtered via --testNamePattern='@chaos'.
#   - Vitest: same convention, --testNamePattern='@chaos' (Vitest CLI parity).
#   - Service-side chaos files use the `*.chaos-spec.ts` suffix to keep them out
#     of the default test run.
#
# Usage:
#   pnpm chaos:test
#
# Env overrides:
#   COMPOSE_FILE   (default: infra/docker-compose/docker-compose.test.yml)
#   COMPOSE_PROFILE (default: slow-services)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose/docker-compose.test.yml}"
COMPOSE_PROFILE="${COMPOSE_PROFILE:-slow-services}"

cd "$REPO_ROOT"

cleanup() {
  echo ""
  echo "🧹 Tearing down chaos test stack…"
  docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILE" down -v --remove-orphans >/dev/null 2>&1 || true
  echo "✅ Stack down"
}
trap cleanup EXIT INT TERM

echo "🚀 Starting chaos test stack (profile: ${COMPOSE_PROFILE})…"
docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILE" up -d --wait

# Each target = name + bash-array of args. M1 — avoid `pnpm … run $command`
# word-splitting fragility: a future arg containing spaces/globs (e.g.
# --testNamePattern='foo bar') would shatter on the unquoted expansion.
run_chaos() {
  local filter="$1"; shift
  echo ""
  echo "🌪️  Running chaos suite for '${filter}'…"
  if (cd "$REPO_ROOT" && pnpm --filter="$filter" run "$@"); then
    echo "  ✅ ${filter} chaos OK"
    return 0
  else
    echo "  ❌ ${filter} chaos FAILED"
    return 1
  fi
}

declare -i failures=0

run_chaos "@tukio/messaging" test --testNamePattern=@chaos || failures=$((failures + 1))
run_chaos "identity-svc"     test --testPathPatterns=chaos || failures=$((failures + 1))

echo ""
if [ "$failures" -eq 0 ]; then
  echo "✅ All chaos suites passed"
  exit 0
else
  echo "❌ ${failures} chaos suite(s) failed"
  exit 1
fi
