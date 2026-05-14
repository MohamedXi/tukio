# syntax=docker/dockerfile:1.7
# Multi-stage build for notification-svc (port 4008).
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
COPY apps/notification-svc ./apps/notification-svc

# --ignore-scripts blocks postinstall hooks in transitive deps (supply-chain
# safety). `pnpm rebuild` is then executed for the workspace's allow-listed
# native binaries (declared in root package.json#pnpm.onlyBuiltDependencies).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts \
 && pnpm rebuild

RUN pnpm --filter=notification-svc build

# Produce a self-contained deploy directory.
# --legacy is required: pnpm 10 default deploy errors with
# ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE unless inject-workspace-packages=true
# is set globally (which changes the dev install experience). The deps that
# legacy mode misses (prom-client, jose, nats — declared in @tukio/auth +
# @tukio/messaging but not in apps/*/package.json) are bundled by webpack
# (see webpack.tukio.cjs#ALWAYS_BUNDLE), so /deploy/node_modules doesn't
# need them at runtime.
RUN pnpm --filter=notification-svc deploy --prod --legacy /deploy

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
    PORT=4008 \
    SERVICE_NAME=notification-svc

EXPOSE 4008

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/main"]
