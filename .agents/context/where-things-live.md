# Where things live

Fast lookup table — "I need to touch X, where is it?".

| What you're looking for                                        | Where                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Project intro / Quick Start**                                | `README.md` (root)                                                   |
| **Agent rules (you're already reading them)**                  | `AGENTS.md` + `.agents/`                                             |
| **PRD (functional + non-functional requirements)**             | `_bmad-output/planning-artifacts/prd.md` (130 FRs, 84 NFRs)          |
| **Architecture + ADRs**                                        | `_bmad-output/planning-artifacts/architecture.md` (14 ADRs)          |
| **UX spec + 31 screens**                                       | `_bmad-output/planning-artifacts/ux-spec.md`                         |
| **Cloud Design brief**                                         | `docs/tukio_design_brief.md`                                         |
| **Epic + story catalogue**                                     | `_bmad-output/planning-artifacts/epics.md` (115 stories on 17 epics) |
| **Active story spec**                                          | `_bmad-output/implementation-artifacts/<X-Y>-<slug>.md`              |
| **Sprint lifecycle ledger**                                    | `_bmad-output/implementation-artifacts/sprint-status.yaml`           |
| **Deferred-work backlog**                                      | `_bmad-output/implementation-artifacts/deferred-work.md`             |
| **NATS event catalog**                                         | `docs/tukio_event_catalog.md`                                        |
| **Architecture deepdives** (booking, catalog, paiements)       | `docs/tukio_*_deepdive.md`                                           |
| **UX flow walkthroughs** (catalog, booking, comm, admin, etc.) | `docs/tukio_ux_flow_*.md`                                            |
| **Acquisition strategy + SEO plan**                            | `docs/tukio_strategie_acquisition.md`                                |
| **Microservices architecture (legacy intro)**                  | `docs/microservices-architecture.md`                                 |

## Backend service references

| What you're looking for                                     | Where                                                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Canonical Pretre service (mirror this for new services)** | `apps/identity-svc/`                                                                                              |
| Canonical aggregate                                         | `apps/identity-svc/src/domain/model/user-profile.aggregate.ts`                                                    |
| Canonical port (interface)                                  | `apps/identity-svc/src/domain/ports/user-profile.repository.port.ts`                                              |
| Canonical use case                                          | `apps/identity-svc/src/usecases/get-user-profile.usecase.ts`                                                      |
| Canonical adapter (TypeORM impl of port)                    | `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/`                                          |
| Canonical TypeORM `data-source.ts`                          | `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` (single export!)                        |
| Canonical migration                                         | `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715200000000-CreateUserProfilesBaseline.ts` |
| Outbox/inbox migration (Story 0.7)                          | `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715210000000-AddOutboxInboxTables.ts`       |
| Canonical EnvSchema (Zod runtime config)                    | `apps/identity-svc/src/infrastructure/config/env.schema.ts`                                                       |
| Canonical Pino logger adapter                               | `apps/identity-svc/src/infrastructure/logger/`                                                                    |
| Canonical e2e test pattern                                  | `apps/identity-svc/test/user.e2e-spec.ts`                                                                         |
| Canonical buildTestApp helper                               | `apps/identity-svc/test/build-test-app.ts`                                                                        |
| Canonical jwks-rsa nock mock                                | `apps/identity-svc/test/__mocks__/jwks-rsa.js`                                                                    |
| Pretre replicator (for new services scaffolding)            | `infra/scripts/replicate-pretre-structure.sh` (Story 0.6 legacy)                                                  |

## Frontend references

| What you're looking for      | Where                                                                      |
| ---------------------------- | -------------------------------------------------------------------------- |
| **Design system source**     | `packages/ui/src/`                                                         |
| Tokens (CSS-first @theme)    | `packages/ui/src/styles/theme.css`                                         |
| Tokens (TypeScript)          | `packages/ui/src/tokens/`                                                  |
| Atom convention reference    | `packages/ui/src/components/Button/`                                       |
| Pattern convention reference | `packages/ui/src/patterns/TopBar/`                                         |
| Stripe Elements theme        | `packages/ui/src/themes/stripe-elements.ts`                                |
| Frontends                    | `apps/{public,seller,admin}/` (ADR-016 — public sert l'apex unifié)        |
| App-local per-frontend rules | `apps/<frontend>/AGENTS.md` (override file)                                |
| Frontend i18n messages       | `apps/<frontend>/messages/{fr,en}.json` (Story 7.1 wires the actual files) |

## Shared packages (`@tukio/*`)

| What you're looking for                            | Where                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| REST envelope types                                | `packages/contracts/src/envelope/`                                                            |
| DTOs (Zod schemas, per-domain)                     | `packages/contracts/src/dtos/{auth,booking,catalog,payment,…}.ts`                             |
| NATS event schemas (versioned)                     | `packages/contracts/src/events/<domain>/<event-name>.v<n>.ts`                                 |
| DomainException base + subclasses                  | `packages/contracts/src/exceptions/`                                                          |
| Shared types (Actor, Locale, Money, …)             | `packages/contracts/src/types/`                                                               |
| Keycloak JWT guard (backend)                       | `packages/auth/src/guards/keycloak-jwt.guard.ts`                                              |
| Roles guard + decorator                            | `packages/auth/src/guards/roles.guard.ts` + `packages/auth/src/decorators/roles.decorator.ts` |
| `@Public()` decorator                              | `packages/auth/src/decorators/public.decorator.ts`                                            |
| JWKS cache                                         | `packages/auth/src/services/jwks-cache.service.ts`                                            |
| Keycloak PKCE wiring (frontend)                    | `packages/auth-client/src/`                                                                   |
| OutboxPublisher (transactional outbox)             | `packages/messaging/src/outbox/`                                                              |
| OutboxRelayService                                 | `packages/messaging/src/outbox/outbox-relay.service.ts`                                       |
| InboxService (dedup)                               | `packages/messaging/src/inbox/`                                                               |
| NATS JetStream module                              | `packages/messaging/src/nats/`                                                                |
| @NatsSubscribe decorator                           | `packages/messaging/src/nats/decorators/nats-subscribe.decorator.ts`                          |
| Typed REST client                                  | `packages/api-client/src/`                                                                    |
| next-intl helpers                                  | `packages/i18n-client/src/`                                                                   |
| Testcontainers helpers                             | `packages/testing/src/` (PG, NATS, Keycloak, Meilisearch, Redis)                              |
| Keycloak realm export (consumed by testcontainers) | `infra/scripts/keycloak/realm-export.json`                                                    |

## Infrastructure

| What you're looking for               | Where                                                              |
| ------------------------------------- | ------------------------------------------------------------------ |
| Dev stack compose file                | `infra/docker-compose/docker-compose.dev.yml`                      |
| CI stack compose file                 | `infra/docker-compose/docker-compose.test.yml`                     |
| Postgres init SQL                     | `infra/docker-compose/postgres-init/01-create-tukio-databases.sql` |
| Bootstrap DB script                   | `infra/scripts/bootstrap-databases.sh`                             |
| Bootstrap Keycloak realm              | `infra/scripts/bootstrap-keycloak-realm.sh`                        |
| Re-export Keycloak realm              | `infra/scripts/export-keycloak-realm.sh`                           |
| Chaos test orchestrator               | `infra/scripts/run-chaos-tests.sh`                                 |
| Seed pilot categories                 | `infra/scripts/seed-categories.ts`                                 |
| Pretre replicator                     | `infra/scripts/replicate-pretre-structure.sh`                      |
| Helm charts (Story 0.12)              | `infra/helm/<service>/` — not created yet                          |
| GitHub Actions workflows (Story 0.11) | `.github/workflows/` — not created yet                             |

## Tooling

| What you're looking for                 | Where                                                               |
| --------------------------------------- | ------------------------------------------------------------------- |
| Custom ESLint plugin                    | `tools/eslint-plugin-tukio/`                                        |
| Plugin entry point (CJS)                | `tools/eslint-plugin-tukio/src/index.js`                            |
| `tukio/event-naming` rule               | `tools/eslint-plugin-tukio/src/rules/event-naming.js`               |
| `tukio/no-barrel-import-contracts` rule | `tools/eslint-plugin-tukio/src/rules/no-barrel-import-contracts.js` |
| `tukio/no-barrel-import-ui` rule        | `tools/eslint-plugin-tukio/src/rules/no-barrel-import-ui.js`        |
| `tukio/no-direct-event-publish` rule    | `tools/eslint-plugin-tukio/src/rules/no-direct-event-publish.js`    |
| Root ESLint config                      | `eslint.config.mjs`                                                 |
| Root TS config (path aliases + strict)  | `tsconfig.base.json`                                                |
| Turborepo pipeline                      | `turbo.json`                                                        |
| Prettier config                         | `.prettierrc.json`                                                  |
| Commitlint                              | `commitlint.config.cjs`                                             |
| Lint-staged                             | `lint-staged.config.cjs`                                            |
| Husky hooks                             | `.husky/`                                                           |

## BMad framework

| What you're looking for                 | Where                                                       |
| --------------------------------------- | ----------------------------------------------------------- |
| BMad core config                        | `_bmad/bmm/config.yaml`                                     |
| BMad customisation overrides (team)     | `_bmad/custom/<skill>.toml`                                 |
| BMad customisation overrides (personal) | `_bmad/custom/<skill>.user.toml`                            |
| Slash commands (BMad personas)          | `.claude/commands/BMad/agents/` — ⚠️ DO NOT EDIT (upstream) |
| BMad slash-command skills               | `.claude/skills/bmad-*` — ⚠️ DO NOT EDIT (upstream)         |

## Things NOT in this repo

If a task implies any of these, surface it and stop — it's by design:

- **Backend code in NestJS that isn't in `apps/<svc>/`.** Backend is here.
- **A separate frontend repo.** All 4 frontends live in `apps/`.
- **A separate `tukio.one` website.** Marketing site is `apps/public/`.
- **A native mobile app.** React Native scaffolding is V2 (Epic 14) and
  will live alongside the others, but not at MVP.
- **A "design tokens repo".** Tokens live in `packages/ui/src/tokens/` +
  `packages/ui/src/styles/theme.css`.
