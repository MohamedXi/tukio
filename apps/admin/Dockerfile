# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js frontend admin (port 3003, standalone).
# Generated from infra/scripts/gen-dockerfiles.sh — re-run on workspace changes.

# ──────────────────────────────────────────────────────────────────────
# Stage 1 — builder. Installs the whole pnpm workspace, then builds only
# the requested frontend. Layer ordering optimises rebuild cost: lockfile
# → packages → app-specific source.
# ──────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22.16.0-alpine
FROM node:${NODE_VERSION} AS builder

WORKDIR /app
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY .npmrc* ./
COPY packages ./packages
COPY tools ./tools
COPY apps/admin ./apps/admin

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts \
 && pnpm rebuild

# next build with output:'standalone' (next.config.ts) emits:
#   .next/standalone/  — server.js + minimal node_modules + app files
#   .next/static/      — JS/CSS chunks
RUN pnpm --filter=admin build

# ──────────────────────────────────────────────────────────────────────
# Stage 2 — runner. Minimal Alpine + non-root user + standalone server.
# Only ships the standalone tree + static assets + public/ — no full
# node_modules. ~50-80 MB final image.
# ──────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner

WORKDIR /app
RUN apk upgrade --no-cache \
 && apk add --no-cache curl tini \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S -G nodejs -s /bin/sh tukio

# Standalone tree contains server.js at the workspace-relative path
# (apps/admin/server.js) plus a minimal node_modules. We move the app
# subtree to /app to keep the runtime CWD tidy.
COPY --from=builder --chown=tukio:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=tukio:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=tukio:nodejs /app/apps/admin/public ./apps/admin/public

USER tukio

ENV NODE_ENV=production \
    PORT=3003 \
    HOSTNAME=0.0.0.0 \
    SERVICE_NAME=admin

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}" >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","apps/admin/server.js"]
