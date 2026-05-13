# Directory layout

The full monorepo tree at a glance. See
`.agents/context/where-things-live.md` for "I need X, where is it?"
shortcuts.

```
tukio_projects/
│
├── AGENTS.md                              ACS entry point (this file's source of truth)
├── CLAUDE.md                              Claude Code @-imports (AGENTS.md + acs.yaml + code-style.md)
├── README.md                              Public-facing project intro + Quick Start
│
├── package.json                           Root workspace (pnpm + Turborepo)
├── pnpm-workspace.yaml                    Workspace declaration (apps/* + packages/* + tools/*)
├── pnpm-lock.yaml                         Lockfile (do NOT edit by hand)
├── tsconfig.base.json                     Strict TS + path aliases (@tukio/*)
├── turbo.json                             Pipeline + cache keys
├── eslint.config.mjs                      Flat ESLint config (custom Tukio rules)
├── commitlint.config.cjs                  Conventional Commits
├── lint-staged.config.cjs                 Pre-commit pipeline
├── webpack.tukio.cjs                      Shared NestJS webpack config (backend services)
├── .editorconfig
├── .prettierrc.json + .prettierignore
├── .nvmrc                                 Node 22 LTS
├── .npmrc                                 pnpm settings
├── .gitignore
├── .env.example                           Root env vars (shared across infra scripts)
│
├── .agents/                               ACS — what you're reading
│   ├── acs.yaml                           Manifest
│   ├── context/                           ATOMS — 16 single-concept docs
│   ├── agents/                            PATTERNS — 7 personas
│   ├── skills/                            PATTERNS — 8 scaffolding workflows
│   ├── commands/                          TEMPLATES — 5 runnable shortcuts
│   └── permissions/policy.yaml            Write / shell action policy
│
├── .claude/                               Claude Code config
│   ├── settings.json                      Tracked: enabled plugins
│   ├── settings.local.json                Personal overrides (gitignored)
│   ├── commands/                          Slash commands (BMad/ — UPSTREAM, do not edit)
│   └── skills/                            BMad skills (bmad-* — UPSTREAM, do not edit)
│
├── .husky/                                Git hooks (pre-commit + commit-msg)
├── .github/                               (Story 0.11 will populate workflows)
├── .vscode/ + .idea/                      IDE configs
│
├── apps/
│   ├── public/                            Next.js 16 — port 3000 — marketing / search / listing detail
│   ├── customer/                          Next.js 16 — port 3001 — authenticated B2C / B2B
│   ├── seller/                            Next.js 16 — port 3002 — pro dashboard
│   ├── admin/                             Next.js 16 — port 3003 — moderation console
│   ├── gateway-api/                       NestJS 11 — port 4000 — public REST gateway
│   ├── identity-svc/                      NestJS 11 — port 4001 — canonical Pretre reference
│   │   ├── src/
│   │   │   ├── domain/                    Pure TS — model + ports + service + exception
│   │   │   ├── usecases/                  Orchestration over domain ports
│   │   │   ├── infrastructure/            Adapters (config, http, persistence, messaging, …)
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   │   ├── jest-e2e.json              E2E Jest config
│   │   │   ├── *.e2e-spec.ts              E2E specs
│   │   │   └── __mocks__/                 Module mocks (jwks-rsa, …)
│   │   ├── package.json + nest-cli.json + jest.config.ts
│   │   ├── tsconfig.json + tsconfig.build.json + webpack.config.cjs
│   │   ├── Dockerfile                     (Story 0.12 will refine for K8s)
│   │   ├── eslint.config.mjs
│   │   ├── .env.example
│   │   └── README.md
│   ├── catalog-svc/                       NestJS 11 — port 4002
│   ├── booking-svc/                       NestJS 11 — port 4003
│   ├── order-svc/                         NestJS 11 — port 4004
│   ├── payment-svc/                       NestJS 11 — port 4005
│   ├── messaging-svc/                     NestJS 11 — port 4006
│   ├── review-svc/                        NestJS 11 — port 4007
│   ├── notification-svc/                  NestJS 11 — port 4008
│   └── media-svc/                         NestJS 11 — port 4009
│
├── packages/
│   ├── contracts/                         @tukio/contracts — DTOs + events + envelope
│   │   ├── src/
│   │   │   ├── envelope/                  REST envelope types (ADR-014)
│   │   │   ├── dtos/                      Per-domain Zod schemas + types
│   │   │   ├── events/                    NATS event schemas, versioned
│   │   │   ├── exceptions/                DomainException + subclasses
│   │   │   ├── types/                     Shared types (Actor, Locale, Money, …)
│   │   │   └── index.ts                   Types-only barrel (no named-value exports)
│   │   └── package.json#exports           Subpath map
│   ├── ui/                                @tukio/ui — design system
│   │   ├── src/
│   │   │   ├── tokens/                    Colors, typography, spacing, radius, shadows
│   │   │   ├── styles/                    globals.css, theme.css, reset
│   │   │   ├── themes/                    Stripe Elements theme + future shadcn variants
│   │   │   ├── components/                ATOMS (Button, Input, Modal, …)
│   │   │   ├── patterns/                  COMPOSITES (TopBar, FilterSidebar, …)
│   │   │   └── utils/                     cn helper, etc.
│   │   ├── package.json#exports
│   │   └── README.md
│   ├── auth/                              @tukio/auth — backend Keycloak guards + JWKS
│   ├── auth-client/                       @tukio/auth-client — frontend Keycloak PKCE
│   ├── messaging/                         @tukio/messaging — outbox/inbox + NATS module
│   ├── api-client/                        @tukio/api-client — typed REST client
│   ├── i18n-client/                       @tukio/i18n-client — next-intl helpers
│   └── testing/                           @tukio/testing — testcontainers helpers
│
├── infra/
│   ├── docker-compose/
│   │   ├── docker-compose.dev.yml         Dev stack (6 services, named volumes)
│   │   ├── docker-compose.test.yml        CI stack (tmpfs, anon volumes, slow-services profile)
│   │   ├── postgres-init/                 SQL init scripts run on first PG init
│   │   │   └── 01-create-tukio-databases.sql
│   │   └── README.md                      Quick Start + Troubleshooting
│   └── scripts/
│       ├── bootstrap-databases.sh         11 DBs + per-service migrations
│       ├── bootstrap-keycloak-realm.sh    Realm + roles + clients + TOTP
│       ├── export-keycloak-realm.sh       Regenerate realm-export.json
│       ├── run-chaos-tests.sh             Chaos orchestrator
│       ├── seed-categories.ts             2 pilot MVP categories
│       ├── replicate-pretre-structure.sh  Helper for new-service scaffolding (Story 0.6 legacy)
│       └── keycloak/
│           └── realm-export.json          Versioned realm config (machine-generated)
│
├── tools/
│   └── eslint-plugin-tukio/               Custom ESLint plugin
│       ├── src/
│       │   ├── index.js                   Plugin entry (CJS)
│       │   └── rules/
│       │       ├── event-naming.js
│       │       ├── no-barrel-import-contracts.js
│       │       ├── no-barrel-import-ui.js
│       │       └── no-direct-event-publish.js
│       ├── __tests__/
│       └── package.json
│
├── docs/                                  Architecture deepdives + UX flows
│   ├── microservices-architecture.md      Top-level architecture (legacy)
│   ├── tukio_spec_v2.1.md + v2.2.md       Product spec versions
│   ├── tukio_design_brief.md              Cloud Design bundle reference
│   ├── tukio_information_architecture.md  IA map
│   ├── tukio_event_catalog.md             NATS event catalog
│   ├── tukio_booking_svc_deepdive.md      Booking service architecture
│   ├── tukio_catalogue_deepdive.md        Catalog deepdive
│   ├── tukio_booking_paiements_deepdive.md Booking + payments deepdive
│   ├── tukio_strategie_acquisition.md     Marketing / SEO / acquisition plan
│   ├── tukio_product_tech_alignment.md
│   ├── tukio_opportunites_futures.md
│   └── tukio_ux_flow_{auth_accounts,catalog,booking,communication,monetization,admin_moderation}.md
│
├── _bmad/                                 ⚠️ UPSTREAM — DO NOT EDIT
│   ├── bmm/                               BMad config (config.yaml, etc.)
│   ├── custom/                            Personal/team overrides (this is YOUR escape hatch)
│   └── scripts/                           BMad helper scripts (Python)
│
└── _bmad-output/                          Planning + implementation artifacts
    ├── planning-artifacts/
    │   ├── prd.md                         PRD (130 FRs + 84 NFRs)
    │   ├── architecture.md                14 ADRs + project structure
    │   ├── ux-spec.md                     31 screens + design system gap analysis
    │   └── epics.md                       17 epics × 115 stories
    └── implementation-artifacts/
        ├── sprint-status.yaml             Sprint lifecycle ledger
        ├── deferred-work.md               Findings deferred from code reviews
        ├── 0-1-…md → 3-10-…md             Story files (one per story)
        └── …
```

## Things you might wonder about

- **No `infra/helm/`, no `.github/workflows/` populated.** Story 0.12 +
  Story 0.11 will fill these.
- **No `apps/<frontend>/messages/{fr,en}.json`** files yet. Story 7.1
  (next-intl setup) creates them. Manual i18n placeholders exist in
  app-local `src/` until then.
- **`apps/identity-svc/test/__mocks__/jwks-rsa.js`** mocks JWKS for e2e
  tests against a real Keycloak (Story 0.8 pattern).
- **`apps/admin/AGENTS.md`** + the 3 other frontend `AGENTS.md` are
  per-app overrides via `AGENTS.override.md` convention (currently they
  just carry the `<!-- BEGIN:nextjs-agent-rules -->` Next.js warning).
- **`tools/eslint-plugin-tukio`** uses CJS — loaded via `require()` in
  `eslint.config.mjs` (ESM) due to plugin format constraints.
