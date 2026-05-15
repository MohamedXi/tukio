#!/usr/bin/env bash
set -euo pipefail

declare -A SERVICES=(
  [gateway-api]=4000
  [identity-svc]=4001
  [catalog-svc]=4002
  [booking-svc]=4003
  [order-svc]=4004
  [payment-svc]=4005
  [messaging-svc]=4006
  [review-svc]=4007
  [notification-svc]=4008
  [media-svc]=4009
)

# Resolve repo root from the script's own location — portable across machines
# and CI runners.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

for svc in "${!SERVICES[@]}"; do
  port="${SERVICES[$svc]}"
  cat > "${ROOT}/apps/${svc}/Dockerfile" <<DOCKERFILE
# syntax=docker/dockerfile:1.7
# Multi-stage build for ${svc} (port ${port}).
# Generated from infra/scripts/gen-dockerfiles.sh — re-run on workspace changes.

# ──────────────────────────────────────────────────────────────────────
# Stage 1 — builder. Installs the whole pnpm workspace, then builds only
# the requested service. Layer ordering optimises rebuild cost: lockfile
# → packages → service-specific source.
# ──────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22.16.0-alpine
FROM node:\${NODE_VERSION} AS builder

WORKDIR /app
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:\$PATH
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Lockfile + workspace metadata — invalidates only when deps change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json webpack.tukio.cjs ./
COPY .npmrc* ./

# Shared packages (always needed — workspace dep graph).
COPY packages ./packages
COPY tools ./tools

# Service-specific source.
COPY apps/${svc} ./apps/${svc}

# --ignore-scripts blocks postinstall hooks in transitive deps (supply-chain
# safety). \`pnpm rebuild\` is then executed for the workspace's allow-listed
# native binaries (declared in root package.json#pnpm.onlyBuiltDependencies).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \\
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts \\
 && pnpm rebuild

RUN pnpm --filter=${svc} build

# Produce a self-contained deploy directory.
# --legacy is required: pnpm 10 default deploy errors with
# ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE unless inject-workspace-packages=true
# is set globally (which changes the dev install experience). The deps that
# legacy mode misses (prom-client, jose, nats — declared in @tukio/auth +
# @tukio/messaging but not in apps/*/package.json) are bundled by webpack
# (see webpack.tukio.cjs#ALWAYS_BUNDLE), so /deploy/node_modules doesn't
# need them at runtime.
RUN pnpm --filter=${svc} deploy --prod --legacy /deploy

# ──────────────────────────────────────────────────────────────────────
# Stage 2 — runner. Minimal Alpine + non-root user + healthcheck.
# ──────────────────────────────────────────────────────────────────────
FROM node:\${NODE_VERSION} AS runner

WORKDIR /app
# Patch base image vulnerabilities (e.g. OpenSSL CRITICAL CVEs in Alpine 3.22
# that node:22.16.0-alpine ships unpatched). \`apk upgrade\` brings security
# fixes from the current Alpine repo without changing the Node version.
RUN apk upgrade --no-cache \\
 && apk add --no-cache curl tini \\
 && addgroup -g 1001 -S nodejs \\
 && adduser -u 1001 -S -G nodejs -s /bin/sh tukio

COPY --from=builder --chown=tukio:nodejs /deploy ./

USER tukio

ENV NODE_ENV=production \\
    PORT=${port} \\
    SERVICE_NAME=${svc}

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \\
  CMD curl -fsS "http://localhost:\${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/main"]
DOCKERFILE
  echo "Generated apps/${svc}/Dockerfile (port ${port})"
done

# ──────────────────────────────────────────────────────────────────────
# Frontends — Next.js 16 (App Router) in standalone mode (Story 0.14).
# `output: 'standalone'` produces `.next/standalone/server.js` (a custom
# Node server with a pruned node_modules tree) plus `.next/static/`. The
# runtime image only needs those two directories + the app's `public/`,
# yielding a ~50-80 MB image vs the ~250 MB `next start` runtime.
# Side benefit: the standalone server respects X-Forwarded-Host correctly,
# fixing the port leak in Location headers seen during Story 0.13b.
# ──────────────────────────────────────────────────────────────────────
declare -A FRONTENDS=(
  [public]=3000
  [seller]=3002
  [admin]=3003
)

for app in "${!FRONTENDS[@]}"; do
  port="${FRONTENDS[$app]}"
  cat > "${ROOT}/apps/${app}/Dockerfile" <<DOCKERFILE
# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js frontend ${app} (port ${port}, standalone).
# Generated from infra/scripts/gen-dockerfiles.sh — re-run on workspace changes.

# ──────────────────────────────────────────────────────────────────────
# Stage 1 — builder. Installs the whole pnpm workspace, then builds only
# the requested frontend. Layer ordering optimises rebuild cost: lockfile
# → packages → app-specific source.
# ──────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22.16.0-alpine
FROM node:\${NODE_VERSION} AS builder

WORKDIR /app
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:\$PATH
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY .npmrc* ./
COPY packages ./packages
COPY tools ./tools
COPY apps/${app} ./apps/${app}

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \\
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts \\
 && pnpm rebuild

# next build with output:'standalone' (next.config.ts) emits:
#   .next/standalone/  — server.js + minimal node_modules + app files
#   .next/static/      — JS/CSS chunks
RUN pnpm --filter=${app} build

# ──────────────────────────────────────────────────────────────────────
# Stage 2 — runner. Minimal Alpine + non-root user + standalone server.
# Only ships the standalone tree + static assets + public/ — no full
# node_modules. ~50-80 MB final image.
# ──────────────────────────────────────────────────────────────────────
FROM node:\${NODE_VERSION} AS runner

WORKDIR /app
RUN apk upgrade --no-cache \\
 && apk add --no-cache curl tini \\
 && addgroup -g 1001 -S nodejs \\
 && adduser -u 1001 -S -G nodejs -s /bin/sh tukio

# Standalone tree contains server.js at the workspace-relative path
# (apps/${app}/server.js) plus a minimal node_modules. We move the app
# subtree to /app to keep the runtime CWD tidy.
COPY --from=builder --chown=tukio:nodejs /app/apps/${app}/.next/standalone ./
COPY --from=builder --chown=tukio:nodejs /app/apps/${app}/.next/static ./apps/${app}/.next/static
COPY --from=builder --chown=tukio:nodejs /app/apps/${app}/public ./apps/${app}/public

USER tukio

ENV NODE_ENV=production \\
    PORT=${port} \\
    HOSTNAME=0.0.0.0 \\
    SERVICE_NAME=${app}

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \\
  CMD curl -fsS "http://localhost:\${PORT}" >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","apps/${app}/server.js"]
DOCKERFILE
  echo "Generated apps/${app}/Dockerfile (frontend, port ${port}, standalone)"
done
