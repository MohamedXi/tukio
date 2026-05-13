# AGENTS.md

This is the **tukio.one** monorepo — a B2B2C marketplace for event services
(tents, marquees, event furniture, decor…) launching in Pays de la Loire.
Bilingual FR/EN from day one. Microservices on NestJS + Next.js frontends.

**Stack at a glance:** Next.js 16 · React 19 · TypeScript 6 strict · Tailwind
v4 · NestJS 11 (Fastify) · Postgres 16 · NATS JetStream 2.10 · Keycloak 25 ·
Meilisearch v1 · Stripe Connect Express · Cloudflare R2 · Resend · Upstash
Redis · pnpm 10 · Turborepo 2.

This file is the **entry point** for AI agents. The repo follows the
[ACS (Agent Convention System)](https://dev.to/jackby03/why-every-ai-assisted-project-needs-a-agents-folder-49i3)
layout under `.agents/`. The full manifest is `.agents/acs.yaml`.

## Read first (every agent, every session)

1. `.agents/acs.yaml` — manifest, hard rules, scope, codebase + package map.
2. `.agents/permissions/policy.yaml` — what you may write / run.
3. `.agents/context/overview.md` — what Tukio is, the marketplace shape, the
   pilots, the user roles.
4. `.agents/context/architecture.md` — 14-codebase monorepo + 8 packages,
   ports, ADR pointers.
5. `.agents/context/code-style.md` — TS strict, naming, language rules
   (EN-only tech layer + FR/EN bilingual content).
6. `.agents/context/bmad-workflow.md` — every change is scoped through a
   BMad story file. Required reading before any implementation.

## Pick a persona (`.agents/agents/`)

Adopt the persona that matches your task. Default is `frontend-next` for UI
work and `backend-nest` for service work — pick the more specific one when it
applies.

- `frontend-next.md` — Next.js 16 App Router, React 19, Tailwind v4,
  next-intl. Default for any frontend task.
- `backend-nest.md` — NestJS 11 + Pattern Pretre + TypeORM + Pino. Default
  for any backend service task.
- `design-system.md` — `@tukio/ui` atoms (`components/`) and patterns
  (`patterns/`), tokens, Tailwind v4 theme.
- `platform-infra.md` — docker-compose dev stack, bootstrap scripts, K8s /
  Helm (Story 0.12+), CI (Story 0.11).
- `qa-engineer.md` — Jest (backend) + Vitest (frontend) + testcontainers +
  chaos suites, NFR coverage, traceability.
- `security.md` — Keycloak realm, MFA TOTP, JWT validation, secret
  management, threat surface around payments and PII.
- `architect.md` — cross-cutting changes, ADR authoring, microservice
  boundaries, scaling decisions.

## Pull task-specific context (`.agents/context/`)

| If your task touches…                                       | Read                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| What Tukio is, audiences, pilots                            | `overview.md`                                           |
| The exact stack (versions, locked tools)                    | `stack.md`                                              |
| Monorepo map, services, packages, ports                     | `architecture.md`                                       |
| Tree layout of `apps/` + `packages/` + `infra/`             | `directory-layout.md`                                   |
| Where a specific concern lives (envelope, auth, scripts…)   | `where-things-live.md`                                  |
| Naming, identifiers, English vs French content              | `code-style.md`                                         |
| Backend service architecture (Clean Arch)                   | `pretre-pattern.md`                                     |
| `@tukio/ui` atoms vs patterns, tokens, imports              | `atomic-design.md`                                      |
| HTTP response shape (`{ method, code, data, meta, … }`)     | `rest-envelope.md`                                      |
| `next-intl` usage, message files, locale dispatch           | `i18n.md`                                               |
| Outbox/inbox, NATS event naming, JetStream conventions      | `messaging.md`                                          |
| Jest, Vitest, testcontainers, chaos                         | `testing.md`                                            |
| Branches, commits, PR target, Husky                         | `git-workflow.md`                                       |
| BMad stories, sprint-status, allowed file edits             | `bmad-workflow.md`                                      |
| Docker compose, Postgres init, Keycloak realm, scripts      | `infrastructure.md`                                     |
| French business term → English identifier                   | `glossary.md`                                           |

## Follow a skill when scaffolding (`.agents/skills/`)

- `add-backend-service.md` — scaffold a new NestJS service that follows
  Pattern Pretre, with TypeORM + outbox + envelope filter wired in.
- `add-ui-component.md` — new atom in `packages/ui/src/components/<Name>/`.
- `add-ui-pattern.md` — new composite in `packages/ui/src/patterns/<Name>/`.
- `add-frontend-page.md` — new Next.js page with i18n + auth wiring.
- `add-rest-endpoint.md` — new endpoint on `gateway-api` with envelope
  serialization and tests.
- `add-nats-event.md` — new versioned event in
  `@tukio/contracts/events/<domain>/<event>.v<n>.ts`.
- `add-typeorm-migration.md` — generate + run + commit a migration for a
  service.
- `add-i18n-key.md` — new translation key in `messages/{fr,en}.json`.

## Run a command when validating (`.agents/commands/`)

- `check.md` — `pnpm lint && pnpm typecheck && pnpm test`. Before every commit.
- `ship.md` — full pipeline incl. format check + build + test:cov.
- `infra-up.md` — `pnpm docker:up:wait && pnpm docker:bootstrap`. Daily start.
- `infra-reset.md` — `pnpm docker:reset`. When DB or realm is corrupted.
- `chaos.md` — `pnpm chaos:test`. NATS / outbox chaos suite.

## Nested AGENTS files (Codex convention)

Per the [Codex `AGENTS.md` convention](https://developers.openai.com/codex/guides/agents-md),
files are concatenated root → sub-folder; the closest file wins. To override
this `AGENTS.md` for a specific sub-folder, create `AGENTS.override.md`
in that folder — **never** duplicate `AGENTS.md`. Only create an override
when the sub-folder genuinely needs different rules (e.g. a Next.js app's
"this is not the Next.js you know" warning).

## Hard rules (also in `.agents/acs.yaml`)

- ✅ Backend services follow **Pattern Pretre** (Clean Arch). Domain layer
  framework-free; forbidden imports list in `eslint.config.mjs`. Identity-svc
  is the canonical reference.
- ✅ Frontends use **`@tukio/ui`** via subpath imports only. Barrel imports
  rejected by `tukio/no-barrel-import-ui`.
- ✅ Every HTTP response uses the canonical envelope `{ method, code,
  data | error, pagination?, meta }`.
- ✅ Bilingual FR/EN from day one (`next-intl`). Zero hardcoded user-facing text.
- ✅ Tech layer 100 % English (paths, identifiers, DB, events, branches).
  FR slugs in `*_translations` tables for SEO hreflang.
- ✅ Cross-service events go through `OutboxPublisher`. Enforced by
  `tukio/no-direct-event-publish`.
- ✅ Every change is scoped through a BMad story file under
  `_bmad-output/implementation-artifacts/`. Sprint state in
  `sprint-status.yaml`.
- ✅ Latest stable versions always. No pinning to old majors without an ADR.
- ❌ **Never edit files under `_bmad/`, `.claude/commands/BMad/`, or
  `.claude/skills/bmad-*`.** Upstream BMad updates wipe local changes.
  Customise via `_bmad/custom/<skill>.toml` (team) or
  `.user.toml` (personal).
- ❌ Never install new dependencies without an ADR or story-level approval.
- ❌ Never commit `.env` or any secret. Never store auth tokens or PII in
  localStorage / sessionStorage.
- ❌ Never bypass `OutboxPublisher` for events, or return DTOs raw without
  the envelope.
- ❌ Never `git commit --amend`, `--no-verify`, or `git push --force` to
  shared branches without explicit user authorization.
- ❌ Never push to `main` — `main` carries the README only. PRs target
  `develop`.
- ✅ Validate every change with `/check` before declaring it done.
