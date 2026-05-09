# Tukio

> Event-services marketplace (B2B2C) — Pays de la Loire pilot.
> Trusted local providers, transparent pricing, end-to-end booking with escrowed payments.

## Stack

- **Frontends** — 4 Next.js 16 apps (App Router, Turbopack, React 19, Tailwind v4)
  - `public` (3000), `customer` (3001), `seller` (3002), `admin` (3003)
- **Backends** — 10 NestJS 11 services (Express adapter par défaut; migration Fastify planifiée — ADR)
  - `gateway-api` (4000), `identity-svc` (4001), `catalog-svc` (4002),
    `booking-svc` (4003), `order-svc` (4004), `payment-svc` (4005),
    `messaging-svc` (4006), `review-svc` (4007), `notification-svc` (4008),
    `media-svc` (4009)
- **Shared packages** — `@tukio/contracts`, `messaging`, `auth`, `testing`, `ui`,
  `api-client`, `i18n-client`, `auth-client`
- **Tooling** — Turborepo 2, pnpm 10, TypeScript 5 strict, ESLint 9, Prettier 3,
  Husky 9, commitlint 21, lint-staged 17, Vitest 4 (frontends) / Jest (backends)

## Getting started

Prerequisites: **Node.js 22 LTS**, **pnpm 10+**.

```bash
pnpm install        # install all workspaces
pnpm dev            # start the 14 codebases in parallel via Turborepo
pnpm lint           # ESLint across all workspaces
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest (frontends) + Jest (backends)
pnpm build          # production builds (Next.js + NestJS dist/)
```

The `prepare` script wires Husky on first install (pre-commit + commit-msg hooks).

## Conventions

- **Code, DB, API, events: English only.** No French in URL paths, identifiers,
  table names, or event names. UI/content stays bilingual (FR/EN via `next-intl`).
- **Conventional commits** enforced by commitlint. Allowed types: `feat | fix |
  docs | chore | refactor | test | perf | ci | build | style`.
- **Clean Architecture (Pretre pattern)** in NestJS services: `domain/` (pure),
  `usecases/` (orchestration), `infrastructure/` (adapters).
- **REST envelope** standard: `{ method, code, data | error, pagination?, meta }`.
- **TypeScript strict** everywhere (`strict: true`, `noUncheckedIndexedAccess: true`).

## Repository layout

```
tukio_projects/
├─ apps/             # 4 Next.js apps + 10 NestJS services
├─ packages/         # 8 shared libs (@tukio/*)
├─ infra/            # docker-compose, helm charts (Story 0.10 / 0.12)
├─ docs/             # architecture, ADRs (Story 0.13), planning
├─ _bmad/            # BMad framework
├─ _bmad-output/     # planning artifacts (PRD, architecture, epics, stories)
└─ ...
```

## License

Proprietary — © Tukio.
