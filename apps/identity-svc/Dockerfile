# syntax=docker/dockerfile:1.7
# Multi-stage build for identity-svc (port 4001).
# Generated from infra/scripts/gen-dockerfiles.sh — re-run on workspace changes.

# ──────────────────────────────────────────────────────────────────────
# Stage 1 — builder. Installs the whole pnpm workspace, then builds only
# the requested service. Layer ordering optimises rebuild cost: lockfile
# → packages → service-specific source.
# ──────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22.16.0-alpine
FROM node:${NODE_VERSION} AS builder

WORKDIR /app
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Lockfile + workspace metadata — invalidates only when deps change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json webpack.tukio.cjs ./
COPY .npmrc* ./

# Shared packages (always needed — workspace dep graph).
COPY packages ./packages
COPY tools ./tools

# Service-specific source.
COPY apps/identity-svc ./apps/identity-svc

# --ignore-scripts blocks postinstall hooks in transitive deps (supply-chain
# safety). `pnpm rebuild` is then executed for the workspace's allow-listed
# native binaries (declared in root package.json#pnpm.onlyBuiltDependencies).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts \
 && pnpm rebuild

RUN pnpm --filter=identity-svc build

# Produce a self-contained deploy directory.
# Default pnpm 10 deploy walks workspace transitive deps (e.g. @tukio/auth
# → prom-client) and includes them in /deploy/node_modules. The --legacy
# flag forces v1 behavior which uses symlinks that don't survive Docker
# COPY across stages — leading to runtime "Cannot find module 'prom-client'".
RUN pnpm --filter=identity-svc deploy --prod /deploy

# ──────────────────────────────────────────────────────────────────────
# Stage 2 — runner. Minimal Alpine + non-root user + healthcheck.
# ──────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner

WORKDIR /app
# Patch base image vulnerabilities (e.g. OpenSSL CRITICAL CVEs in Alpine 3.22
# that node:22.16.0-alpine ships unpatched). `apk upgrade` brings security
# fixes from the current Alpine repo without changing the Node version.
RUN apk upgrade --no-cache \
 && apk add --no-cache curl tini \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S -G nodejs -s /bin/sh tukio

COPY --from=builder --chown=tukio:nodejs /deploy ./

USER tukio

ENV NODE_ENV=production \
    PORT=4001 \
    SERVICE_NAME=identity-svc

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/main"]
