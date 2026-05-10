#!/usr/bin/env bash
# replicate-pretre-structure.sh
# ─────────────────────────────────────────────────────────────────────────────
# Replicate the Pattern Pretre Clean Architecture skeleton from `apps/identity-svc/`
# (the canonical template — Story 0.6) into another backend service folder.
#
# Copies framework-only files (interceptors, filters, UseCaseProxy, logger, config,
# exceptions base, gitkeeps, module shells) and rewrites identity-specific labels.
# Skips identity domain logic (UserProfile aggregate, GetUserProfileById use case,
# user_profile entity / mapper / repository, user.controller, etc.) — the target
# service must define its own aggregates and use cases.
#
# USAGE
#   bash infra/scripts/replicate-pretre-structure.sh --target=<svc> [--dry-run] [--force]
#
# EXAMPLES
#   bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc --dry-run
#   bash infra/scripts/replicate-pretre-structure.sh --target=booking-svc
#   bash infra/scripts/replicate-pretre-structure.sh --target=order-svc --force
#
# REQUIREMENTS
#   - bash 3.2+ (macOS default), no zsh-isms.
#   - portable `find`, `cp`, `sed`, `mkdir`, `awk`, `tr`. BSD-sed safe.
#
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ----- Configuration ---------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_SVC="identity-svc"
SOURCE_DIR="$REPO_ROOT/apps/$SOURCE_SVC/src"

ALLOWED_TARGETS=(
  gateway-api
  catalog-svc
  booking-svc
  order-svc
  payment-svc
  messaging-svc
  review-svc
  notification-svc
  media-svc
)

# Files to replicate (framework-only; identity-specific files are excluded).
# Paths are relative to apps/identity-svc/src/.
REPLICATE_FILES=(
  "domain/exception/domain.exception.ts"
  "domain/ports/event-publisher.port.ts"
  "domain/ports/keycloak-sync.port.ts"
  "domain/ports/logger.port.ts"
  "domain/ports/config.port.ts"
  "domain/ports/tokens.template.ts"
  "domain/service/.gitkeep"
  "infrastructure/usecases-proxy/usecases-proxy.ts"
  "infrastructure/usecases-proxy/usecases-proxy.module.ts"
  "infrastructure/http/envelope/envelope.helpers.ts"
  "infrastructure/http/interceptors/response-envelope.interceptor.ts"
  "infrastructure/http/filters/envelope-exception.filter.ts"
  "infrastructure/http/guards/.gitkeep"
  "infrastructure/http/http.module.ts"
  "infrastructure/http/controllers/health.controller.ts"
  "infrastructure/logger/pino-logger.service.ts"
  "infrastructure/logger/logger.module.ts"
  "infrastructure/config/env.schema.ts"
  "infrastructure/config/environment-config.service.ts"
  "infrastructure/config/config.module.ts"
  "infrastructure/messaging/nats/nats.publisher.ts"
  "infrastructure/messaging/nats/nats-publisher.module.ts"
  "infrastructure/external/keycloak/keycloak.service.ts"
  "infrastructure/external/keycloak/keycloak.module.ts"
  "infrastructure/persistence/typeorm/data-source.ts"
  "infrastructure/exception/.gitkeep"
)

# ----- Helpers ---------------------------------------------------------------

log()   { printf '\033[0;36m[replicate]\033[0m %s\n' "$*"; }
warn()  { printf '\033[0;33m[replicate]\033[0m %s\n' "$*" >&2; }
error() { printf '\033[0;31m[replicate]\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,28p' "$0" >&2
  exit 64
}

contains() {
  local needle="$1"; shift
  local item
  for item in "$@"; do
    [ "$item" = "$needle" ] && return 0
  done
  return 1
}

# Convert kebab-case service name to PascalCase token (catalog-svc -> CatalogSvc).
to_pascal() {
  echo "$1" | awk -F- '{
    out=""
    for (i=1; i<=NF; i++) {
      out = out toupper(substr($i,1,1)) substr($i,2)
    }
    print out
  }'
}

# Convert service name to db-friendly token (catalog-svc -> catalog).
to_db_name() {
  echo "$1" | sed 's/-svc$//; s/-/_/g'
}

# Cross-platform sed inplace (BSD vs GNU).
sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

# ----- Argument parsing ------------------------------------------------------

TARGET=""
DRY_RUN=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --target=*)   TARGET="${arg#*=}" ;;
    --target)     error "--target requires =<svc> form. e.g. --target=catalog-svc" ;;
    --dry-run)    DRY_RUN=1 ;;
    --force)      FORCE=1 ;;
    -h|--help)    usage ;;
    *)            error "Unknown argument: $arg" ;;
  esac
done

[ -z "$TARGET" ] && error "--target=<svc> is required. Allowed: ${ALLOWED_TARGETS[*]}"

if ! contains "$TARGET" "${ALLOWED_TARGETS[@]}"; then
  error "Unsupported target '$TARGET'. Allowed: ${ALLOWED_TARGETS[*]}"
fi

if [ "$TARGET" = "$SOURCE_SVC" ]; then
  error "Source service ($SOURCE_SVC) cannot be its own target."
fi

TARGET_DIR="$REPO_ROOT/apps/$TARGET"
TARGET_SRC="$TARGET_DIR/src"

[ -d "$TARGET_DIR" ] || error "Target service folder does not exist: apps/$TARGET. Story 0.1 should have scaffolded it."

if [ -d "$TARGET_SRC/domain" ] && [ "$FORCE" -ne 1 ]; then
  error "Pattern Pretre structure already exists at apps/$TARGET/src/domain/. Pass --force to overwrite."
fi

TARGET_PASCAL="$(to_pascal "$TARGET")"
TARGET_DB="$(to_db_name "$TARGET")"

log "Source : apps/$SOURCE_SVC/"
log "Target : apps/$TARGET/   (pascal=$TARGET_PASCAL, db_token=$TARGET_DB)"
[ "$DRY_RUN" -eq 1 ] && log "Mode   : DRY-RUN (no files written)"
[ "$FORCE" -eq 1 ]   && log "Mode   : FORCE (will overwrite existing files)"

# ----- Replication -----------------------------------------------------------

# Helper: build template tokens.ts (without identity-specific tokens).
emit_tokens_template() {
  cat <<'EOF'
// Symbol DI tokens — Pattern Pretre wiring (Story 0.6 AC3).
// Replicated from identity-svc by infra/scripts/replicate-pretre-structure.sh.
// Add service-specific tokens (e.g. <AGGREGATE>_REPOSITORY) below.
//
// Convention: SCREAMING_SNAKE_CASE matching the port name.
// `Symbol(...)` (NOT `Symbol.for(...)`) → unicité absolue, no cross-service collision risk.
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
export const LOGGER = Symbol('LOGGER');
export const CONFIG_SERVICE = Symbol('CONFIG_SERVICE');
EOF
}

CREATED_COUNT=0

for rel in "${REPLICATE_FILES[@]}"; do
  src="$SOURCE_DIR/$rel"
  dest="$TARGET_SRC/$rel"

  # `domain/ports/tokens.template.ts` is virtual — render to `domain/ports/tokens.ts` in target.
  if [ "$rel" = "domain/ports/tokens.template.ts" ]; then
    dest="$TARGET_SRC/domain/ports/tokens.ts"
    if [ "$DRY_RUN" -eq 1 ]; then
      log "WOULD render template -> apps/$TARGET/src/domain/ports/tokens.ts"
    else
      mkdir -p "$(dirname "$dest")"
      emit_tokens_template > "$dest"
      log "rendered template -> apps/$TARGET/src/domain/ports/tokens.ts"
    fi
    CREATED_COUNT=$((CREATED_COUNT + 1))
    continue
  fi

  if [ ! -e "$src" ]; then
    warn "skip (source missing): $rel"
    continue
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    log "WOULD copy -> apps/$TARGET/src/$rel"
    CREATED_COUNT=$((CREATED_COUNT + 1))
    continue
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"

  # Apply text rewrites only on .ts files (skip .gitkeep and other non-text).
  case "$dest" in
    *.ts)
      sed_inplace -e "s/identity-svc/$TARGET/g" \
                  -e "s/IdentitySvc/$TARGET_PASCAL/g" \
                  -e "s/tukio_identity_user/tukio_${TARGET_DB}_user/g" \
                  -e "s/tukio_identity/tukio_${TARGET_DB}/g" \
                  "$dest"
      ;;
  esac
  log "created apps/$TARGET/src/$rel"
  CREATED_COUNT=$((CREATED_COUNT + 1))
done

# ----- Summary ---------------------------------------------------------------

if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY-RUN complete — would have created $CREATED_COUNT files in apps/$TARGET/src/."
  exit 0
fi

cat <<EOF

✅ Created $CREATED_COUNT files in apps/$TARGET/src/.

Next steps:
  1. Define your aggregates in domain/model/<aggregate>.aggregate.ts
  2. Create your ports in domain/ports/<aggregate>.repository.port.ts
     and add tokens to domain/ports/tokens.ts (SCREAMING_SNAKE_CASE)
  3. Implement your use cases in usecases/<verb-object>.usecase.ts
  4. Implement repositories in infrastructure/persistence/typeorm/repositories/
  5. Wire ports → impls in infrastructure/usecases-proxy/usecases-proxy.module.ts

Then run:
  pnpm --filter=$TARGET lint
  pnpm --filter=$TARGET typecheck
  pnpm --filter=$TARGET test

EOF
