# Stack — exact versions

The stack is **locked**. Adding or swapping a top-level technology requires
an ADR added to `_bmad-output/planning-artifacts/architecture.md`. See
`.agents/context/architecture.md` for the existing 14 ADRs.

When in doubt about a version, run `pnpm view <pkg> version` and use the
**latest stable**. Never pin to an older major without a written reason.

## Frontend

| Package                    | Version       | Notes                                                 |
| -------------------------- | ------------- | ----------------------------------------------------- |
| `next`                     | `^16.0.0`     | App Router, Turbopack, RSC                            |
| `react` / `react-dom`      | `^19.0.0`     | Server Components + use() hook                        |
| `tailwindcss`              | `^4.0.0`      | CSS-first `@theme {}` tokens, no `tailwind.config.js` |
| `next-intl`                | `^4.0.0`      | i18n FR/EN; locale routing                            |
| `lucide-react`             | latest        | Icon system                                           |
| `class-variance-authority` | `^0.7.0`      | `cva()` for variant API in `@tukio/ui`                |
| `@radix-ui/react-slot`     | latest        | Polymorphic `asChild` pattern                         |
| `zod`                      | `^4.0.0`      | Validation everywhere                                 |
| Storybook                  | (planned V1+) | Will live in `packages/ui/.storybook/`                |

## Backend

| Package                          | Version    | Notes                                              |
| -------------------------------- | ---------- | -------------------------------------------------- |
| `@nestjs/core`, `@nestjs/common` | `^11.0.1`  |                                                    |
| `@nestjs/platform-fastify`       | `^11.1.19` | Fastify adapter (not Express)                      |
| `@nestjs/typeorm`                | `^11.0.1`  | ORM module — service-by-service via `forRootAsync` |
| `typeorm`                        | `^0.3.29`  | Migrations CLI runs via `tsx`                      |
| `pg`                             | `^8.20.0`  | Postgres driver                                    |
| `nestjs-pino`                    | `^4.6.1`   | Structured JSON logging                            |
| `pino`                           | `^10.3.1`  |                                                    |
| `nestjs-zod`                     | `^5.3.0`   | Zod-first DTO validation                           |
| `@nestjs/config`                 | `^4.0.4`   | Env vars + Zod schema                              |

## Shared tooling

| Package                    | Version     | Notes                                              |
| -------------------------- | ----------- | -------------------------------------------------- |
| `pnpm`                     | `>=10.0.0`  | Required (declared in root `package.json` engines) |
| `node`                     | `>=22.16.0` | LTS                                                |
| `turbo`                    | `^2.9.0`    | Monorepo build / cache                             |
| `typescript`               | `^5.6.0`    | Strict + `noUncheckedIndexedAccess`                |
| `eslint`                   | `^9.0.0`    | Flat config (`eslint.config.mjs`)                  |
| `eslint-plugin-boundaries` | `^5.0.0`    | App ↔ package layer enforcement                    |
| `prettier`                 | `^3.5.0`    |                                                    |
| `husky`                    | `^9.1.0`    | Pre-commit hooks                                   |
| `lint-staged`              | `^16.1.0`   |                                                    |
| `commitlint`               | `^21.0.0`   | Conventional Commits                               |
| `tsx`                      | `^4.21.0`   | Runs `*.ts` for migrations + scripts               |

## Tests

| Package                  | Version            | Where it runs                           |
| ------------------------ | ------------------ | --------------------------------------- |
| `jest`                   | (Nest default)     | Per-service unit + e2e                  |
| `vitest`                 | `^4.0.0`           | Frontends + `@tukio/ui` + packages      |
| `@testing-library/react` | latest             | Frontend component tests                |
| `playwright`             | (planned V1+)      | Frontend e2e (Story 0.11+ scope)        |
| `testcontainers`         | (`@tukio/testing`) | Real PG/NATS/Keycloak/Meili/Redis in CI |
| `nock`                   | latest             | HTTP mocking in backend tests           |

## Infrastructure (dev)

Provisioned by Story 0.10. See `.agents/context/infrastructure.md`.

| Service       | Image                            | Host port      | Notes                                |
| ------------- | -------------------------------- | -------------- | ------------------------------------ |
| `postgres`    | `postgres:16-alpine`             | `5432`         | 11 logical DBs (10 Tukio + Keycloak) |
| `nats`        | `nats:2.10-alpine`               | `4222`, `8222` | JetStream + HTTP monitoring          |
| `keycloak`    | `quay.io/keycloak/keycloak:25.0` | `8080`         | OIDC; mgmt port 9000 internal        |
| `meilisearch` | `getmeili/meilisearch:v1.13`     | `7700`         | Per-locale search index (Story 3.7)  |
| `redis`       | `redis:7-alpine`                 | `6379`         | Rate limiting, locks, idempotency    |
| `mailhog`     | `mailhog/mailhog:v1.0.1`         | `1025`, `8025` | SMTP sink + Web UI (Resend stand-in) |

## Infrastructure (prod / staging)

| Layer                        | Provider                                           | Notes                                          |
| ---------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| Frontend host                | Vercel multi-zones                                 | One Vercel project per app, shared apex domain |
| Backend host                 | Kubernetes (1 cluster MVP)                         | Helm charts in Story 0.12                      |
| OIDC                         | Phasetwo (managed Keycloak)                        | Realm config exported via `realm-export.json`  |
| Search                       | Meilisearch Cloud                                  | ~30 € / mo or self-hosted                      |
| Payments                     | Stripe Connect Express + Billing                   | Single webhook endpoint on `payment-svc`       |
| Media (uploads + transforms) | Cloudflare R2 + Cloudflare Images                  | Signed upload URLs from `media-svc`            |
| Email                        | Resend (transactional)                             | Brevo for marketing V1+                        |
| Cache                        | Upstash Redis                                      | Locks, sessions, pub/sub WebSocket             |
| CI                           | GitHub Actions                                     | Story 0.11                                     |
| GitOps                       | ArgoCD (planned)                                   | Story 0.12                                     |
| Observability                | OpenTelemetry + Prometheus + Tempo + Looker Studio | Story 0.12                                     |

## What is OUT of scope

If a task implies any of these, surface it and stop. They are deliberate
exclusions, not gaps:

- **Express adapter on NestJS** — we use Fastify. ADR documented; revisit
  only if Fastify can't meet a specific need.
- **Prisma** — TypeORM is the ORM. Raw SQL via `*.query.ts` for read-heavy
  paths.
- **`tailwind.config.js` JS file** — Tailwind v4 is CSS-first; tokens live
  in `packages/ui/src/styles/theme.css` under `@theme {}`.
- **shadcn/ui** as a runtime dependency — we copy patterns we like into
  `@tukio/ui`, we don't pull the npm package.
- **Lerna / Nx / yarn workspaces** — Turborepo + pnpm only.
- **MongoDB / DynamoDB / any non-Postgres DB** at MVP.
- **AWS** — Vercel + Cloudflare + Upstash + Stripe + Phasetwo + Resend +
  Meilisearch Cloud is the cloud surface.
