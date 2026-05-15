# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js frontend customer (port 3001).
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
COPY apps/customer ./apps/customer

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts \
 && pnpm rebuild

RUN pnpm --filter=customer build

# pnpm deploy --legacy isolates a self-contained runtime tree at /deploy
# (package.json + node_modules + the app source incl. .next/ and public/).
RUN pnpm --filter=customer deploy --prod --legacy /deploy

# ──────────────────────────────────────────────────────────────────────
# Stage 2 — runner. Minimal Alpine + non-root user + Next.js start.
# ──────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner

WORKDIR /app
RUN apk upgrade --no-cache \
 && apk add --no-cache curl tini \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S -G nodejs -s /bin/sh tukio

COPY --from=builder --chown=tukio:nodejs /deploy ./
# pnpm deploy --legacy doesn't ship build artefacts. Copy the Next.js
# .next/ output + public/ assets explicitly so 'next start' has what it needs.
COPY --from=builder --chown=tukio:nodejs /app/apps/customer/.next ./.next
COPY --from=builder --chown=tukio:nodejs /app/apps/customer/public ./public

USER tukio

ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    SERVICE_NAME=customer

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}" >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node_modules/.bin/next","start"]
