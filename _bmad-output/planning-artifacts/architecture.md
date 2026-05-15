---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
status: 'complete'
lastStep: 8
completedAt: '2026-05-08'
inputDocuments:
  # Strate consolidée (point d'entrée canonique)
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-tukio.one.md
  - _bmad-output/planning-artifacts/product-brief-tukio.one-distillate.md
  # Strate produit
  - docs/tukio_spec_v2.2.md
  - docs/tukio_design_brief.md
  - docs/tukio_information_architecture.md
  - docs/tukio_catalogue_deepdive.md
  - docs/tukio_booking_paiements_deepdive.md
  # Strate UX flows
  - docs/tukio_ux_flow_catalog.md
  - docs/tukio_ux_flow_booking.md
  - docs/tukio_ux_flow_auth_accounts.md
  - docs/tukio_ux_flow_communication.md
  - docs/tukio_ux_flow_monetization.md
  - docs/tukio_ux_flow_admin_moderation.md
  # Strate backend (critique pour architecture)
  - docs/microservices-architecture.md
  - docs/tukio_product_tech_alignment.md
  - docs/tukio_booking_svc_deepdive.md
  - docs/tukio_event_catalog.md
  # Strate go-to-market & stratégie
  - docs/tukio_strategie_acquisition.md
  - docs/tukio_opportunites_futures.md
documentCounts:
  prd: 1
  brief: 2
  ux_design: 6
  research: 0
  project_docs: 11
  total: 20
workflowType: 'architecture'
project_name: 'tukio.one'
user_name: 'Ismael'
date: '2026-05-08'
loadStrategy: 'full-load'
---

# Architecture Decision Document — tukio.one

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

**Author:** Ismael
**Date:** 2026-05-08
**Source PRD:** `_bmad-output/planning-artifacts/prd.md` (130 FRs + 84 NFRs)
**Pre-existing ADRs:** 12 (consolidés dans le PRD §12.8 et `tukio_product_tech_alignment.md`)

## Project Context Analysis

### Requirements Overview

**Functional Requirements** — 130 FRs sur 11 capability areas (PRD §Functional Requirements) :

| Area | Code | Nb FRs | Nature architecturale |
|------|------|--------|------------------------|
| User & Identity Management | A | 17 (FR1-17) | Auth + KYC à 2 niveaux + RBAC granulaire |
| Catalog & Discovery | B | 16 (FR18-33) | Listings multilingues + recherche faceted geo + auto-publication |
| Booking & Order Lifecycle | C | 15 (FR34-48) | Saga distribuée mono-vendor MVP → multi-vendor V1 |
| Payments & Financial | D | 18 (FR49-66) | Stripe Connect Express + Stripe Billing + 3 cas TVA |
| Messaging & Communication | E | 8 (FR67-74) | WebSocket + anti-désintermédiation regex |
| Reviews & Reputation | F | 8 (FR75-82) | Multi-critères V1 + pondération récence |
| Moderation & Administration | G | 13 (FR83-95) | Audit trail immuable + RBAC `admin-{support,modo,super}` |
| Internationalization | H | 9 (FR96-104) | next-intl + tables `<entity>_translations` + index Meilisearch par locale |
| Acquisition & Growth | I | 12 (FR105-116) | Tracking server-side + parrainage + apporteurs B2B |
| Notifications | J | 9 (FR117-125) | Email FR/EN + in-app V1 + push V2 |
| Configurateur & Smart V2 | K | 5 (FR126-130) | Configurateur événement + recommendations + co-traitance |

**Non-Functional Requirements** — 84 NFRs sur 11 catégories (PRD §Non-Functional Requirements) :

- **Performance** (NFR1-8) : p95 search < 150 ms, LCP < 2,5 s, INP < 200 ms, bundle JS initial < 150 KB gzipped
- **Security** (NFR9-20) : mTLS, JWT RS256, MFA admin obligatoire, PCI SAQ-A, PII redaction logs, rate limiting
- **Compliance & Privacy** (NFR21-30) : LCEN hybride, mandat art. 289 CGI, RGPD multi-couche, RGAA AA, 3DS Secure
- **Scalability** (NFR31-38) : MVP 6 000 visiteurs/mois → V2 100 000/mois, NATS 10k events/sec, saisonnalité 3× pic mai-sept
- **Reliability** (NFR39-46) : 99,5 % MVP / 99,9 % V1, RPO < 5 min / RTO < 1 h, saga alerts > 5 min, chaos tests CI
- **Accessibility** (NFR47-55) : RGAA AA / WCAG 2.1 AA, axe-core CI, audit RGAA externe avant V0 release
- **Internationalization** (NFR56-60) : zéro texte hardcodé front, locale-prefix URLs, hreflang, 1 index Meilisearch par locale
- **Observability** (NFR61-66) : OpenTelemetry traces correlées, métriques Prometheus, dashboards Looker Studio, PII redaction
- **Maintainability** (NFR67-74) : pattern Pretre, eslint-plugin-boundaries, ADRs `docs/adr/`, coverage 80%/70%/50%
- **Integration** (NFR75-79) : Stripe webhooks endpoint unique `payment-svc`, Keycloak webhooks → `identity-svc`, no HTTP-to-HTTP downstream sauf exception booking → catalog
- **Operability** (NFR80-84) : 3 unités déploiement MVP, `payment-svc` split dès V0 prod, K8s probes `/health` `/ready` `/metrics`

### Scale & Complexity

- **Primary domain** : web application (Next.js 15 SPA + PWA V1 + native V2) avec backend microservices NestJS (10 services figés)
- **Niveau de complexité** : **medium-high** (8 drivers structurants : TVA marketplace, LCEN, RGPD, PSD2 indirect, saga distribuée, two-sided cold-start, i18n dès Sprint 0, ~50 events NATS)
- **Composants architecturaux estimés** :
  - 10 microservices backend (NestJS hexagonal pattern Pretre)
  - 1 frontend Next.js (public + customer + seller area)
  - 1 frontend admin séparé (sous-domaine `admin.tukio.one`)
  - 4 libs partagées (`@tukio/contracts`, `@tukio/messaging`, `@tukio/auth`, `@tukio/testing`)
  - ~50 events NATS catalogués + JSON Schema versionnés
  - 2 indexes Meilisearch (par locale)
  - 10 databases PostgreSQL (1 par service, MVP en 1 instance physique)
  - Cache Redis Upstash (locks dispo, sessions, pub/sub WebSocket)
  - Cluster K8s namespace MVP, séparation par traffic ensuite
- **Cibles de scalabilité** :
  - MVP : 6 000 visiteurs uniques/mois, ~80 réservations/mois, 50 pros actifs
  - V1 : 30 000 visiteurs/mois, ~400 réservations/mois, 200 abonnés Business
  - V2 : 100 000 visiteurs/mois, ~1 500 réservations/mois, 20 comptes Enterprise

### Technical Constraints & Dependencies

#### Stack figée par 12 ADRs préexistants (PRD §12.8)

- **Frontend** : Next.js 15 App Router + React 19 + TypeScript + Tailwind + shadcn/ui + `next-intl` + Lucide + Fraunces + PostHog SDK + Plausible + Stripe Elements + Zod + WebSocket
- **Backend** : NestJS 11 (Fastify adapter), pattern Pretre hexagonal (`domain/usecases/infrastructure` + `UseCaseProxy`), TypeScript end-to-end
- **Auth/IdP** : Keycloak 25 (Phasetwo managé MVP)
- **Messaging async** : NATS JetStream 2.10+ via `@horizon-republic/nestjs-jetstream` (replicas R3 prod, DLQ stream dédié)
- **DB** : PostgreSQL 16, **1 database par service** (`tukio_<service>`), TypeORM par défaut + raw SQL `*.query.ts` pour read-heavy
- **Recherche** : Meilisearch (Cloud ~30€/mois ou self-hosted)
- **Paiements** : Stripe Connect Express + Stripe Billing
- **Médias** : Cloudflare R2 + Cloudflare Images
- **Email** : Resend (transactionnel FR + EN) + Brevo (marketing V1+)
- **Cache** : Upstash Redis (locks, sessions, pub/sub WebSocket)
- **Observability** : OpenTelemetry + Prometheus + Tempo + Looker Studio
- **Hébergement** : Vercel (frontend) + Kubernetes (backend, 1 cluster/namespace MVP)

#### Intégrations externes critiques (12 listées en PRD §Domain Requirements)

- **Stripe Connect Express** (🔴 critique) — webhooks unique endpoint `payment-svc`, KYC financier délégué
- **Stripe Billing** (🔴 critique V1) — subscription tiers, tier dérivé Stripe (jamais l'inverse)
- **Stripe Identity** (🟠 V1) — KYC complet pro
- **Keycloak 25** (🔴 critique) — OIDC RS256, social login V1, SAML V2, webhooks → identity-svc
- **Cloudflare R2 + Images** (🟠) — médias + CDN + transformations
- **Resend** (🟠) — emails transactionnels FR + EN
- **Brevo** (🟡 V1+) — emails marketing FR + EN
- **Meilisearch** (🔴) — 1 index par locale
- **API INSEE SIRENE** (🟢) — vérification SIRET onboarding pro
- **Plausible** (🟡) — web analytics RGPD
- **PostHog** hosted EU (🟠) — product analytics, funnels, A/B
- **DeepL ou GPT-4** (🟡 V1+) — traduction auto FR → EN

#### Contraintes structurantes (override-able uniquement par ADR)

- **Database per service** strict (ADR-003) — aucun cross-service SQL join, communication async obligatoire pour synchroniser
- **gateway-api seul accès public** (ADR-008) — aucun service downstream exposé directement, mTLS interne en prod
- **Monorepo Turborepo** (Q7 spec v2.2 + ADR-001 + product-tech-alignment §F, **explicitement re-validé par founder**) — 10 codebases distinctes, 3 unités déploiement MVP
- **i18n FR + EN dès Sprint 0** (ADR-012, K-12 à K-15) — `next-intl` + tables `<entity>_translations` + 1 index Meilisearch par locale + templates email FR/EN
- **Saga choréographée** (ADR-006) — pas d'orchestrator type Temporal au MVP, 4-5 étapes maximum avant migration éventuelle
- **Outbox pattern** (ADR-007) — transactional outbox PostgreSQL + relais via PG LISTEN/NOTIFY (pas polling), bibliothèque `@tukio/messaging` Sprint 0
- **`@tukio/contracts` package** (ADR-011) — JSON Schema events versionnés, types TS dérivés, DTOs HTTP partagés, dès Sprint 0

#### Conventions de nommage figées (PRD §Conventions)

- UI/produit en FR/EN selon locale
- Code/DB/API/events en EN strict (provider, customer, listing, booking, order, review)
- "Buyer" interdit en code, "seller" reste seulement dans URLs
- Tous les paths URL en EN (jamais FR), avec locale-prefix `/{locale}/...`
- Slugs par locale (FR + EN distincts) stockés dans `<entity>_translations`

### Cross-Cutting Concerns Identified

#### 1. Clean Architecture & Dependency Inversion (cross-cutting fondamental, ADR-001)

> Tukio est un **microservices avec Clean Architecture derrière**, pas l'inverse. Référence canonique : https://github.com/jonathanPretre/clean-architecture-nestjs (Jonathan Pretre).
> Customisation Tukio : `docs/tukio_booking_svc_deepdive.md` §F (exemple complet sur booking-svc).

**Structure imposée pour chaque service backend** :

```
service-svc/src/
├─ domain/                              ← AUCUNE dépendance externe
│  ├─ model/                            ← Aggregates, value objects (pure TS)
│  ├─ ports/                            ← INTERFACES (ports) :
│  │  ├─ booking.repository.port.ts     ← Interface IBookingRepository
│  │  ├─ stripe.service.port.ts         ← Interface IStripeService
│  │  ├─ event-publisher.port.ts        ← Interface IEventPublisher
│  │  └─ tokens.ts                      ← Symbol tokens pour DI
│  ├─ service/                          ← Domain services stateless
│  └─ exception/                        ← Domain exceptions
├─ usecases/                            ← 1 classe par use case, méthode execute()
│  ├─ create-booking.usecase.ts         ← Dépend uniquement des ports via DI
│  └─ accept-booking.usecase.ts
└─ infrastructure/                      ← IMPLEMENTATIONS concrètes des ports
   ├─ persistence/
   │  ├─ typeorm/
   │  │  ├─ booking.entity.ts           ← Entity TypeORM avec décorateurs
   │  │  └─ booking.typeorm.repository.ts ← implements IBookingRepository
   │  └─ queries/                       ← Raw SQL pour read-heavy paths (ADR-010)
   ├─ messaging/
   │  ├─ nats/
   │  │  ├─ nats.publisher.ts           ← implements IEventPublisher
   │  │  ├─ nats.consumers.ts           ← Handlers events entrants
   │  │  └─ outbox-relay/               ← PG LISTEN/NOTIFY → NATS publish
   ├─ external/                         ← Adapters services tiers
   │  ├─ stripe/
   │  │  └─ stripe.service.ts           ← implements IStripeService
   │  ├─ keycloak/
   │  │  └─ keycloak.service.ts         ← implements IKeycloakService
   │  ├─ meilisearch/
   │  │  └─ meilisearch.service.ts      ← implements ISearchIndexService
   │  └─ r2/
   │     └─ r2-storage.service.ts       ← implements IObjectStorageService
   ├─ http/
   │  ├─ controllers/                   ← Injecte UseCaseProxy<TUseCase>
   │  ├─ dtos/                          ← DTOs entrants (Zod) + mappers DTO ↔ domain
   │  └─ guards/                        ← KeycloakJwtGuard, RolesGuard
   ├─ logger/, config/, exception/      ← Adapters cross-cutting techniques
   └─ usecases-proxy/                   ← DynamicModule central wire ports → implémentations
      └─ usecases-proxy.module.ts
```

**Règles non négociables** :
- Le **`domain/`** ne contient **aucun** import externe (pas de `@nestjs/*`, `typeorm`, `stripe`, `axios`, etc.). Vérifié par `eslint-plugin-boundaries` configuré dès Sprint 0.
- Les **interfaces (ports)** vivent dans `domain/ports/`, les **implémentations** dans `infrastructure/`. Jamais l'inverse.
- Les **use cases** dépendent uniquement des ports (via Symbol tokens DI). Aucun use case ne référence directement TypeORM, Stripe SDK, ou tout autre concrete.
- Le **wiring** des ports → implémentations se fait dans `infrastructure/usecases-proxy/usecases-proxy.module.ts` (DynamicModule). C'est le seul endroit du service où domaine et infrastructure se rencontrent.

**Repository Pattern** : pour chaque aggregate persisté, une interface dans `domain/ports/<aggregate>.repository.port.ts` + une implémentation TypeORM dans `infrastructure/persistence/typeorm/<aggregate>.typeorm.repository.ts`. Migration vers Prisma (ou autre ORM) future = écrire une nouvelle classe d'implémentation, le use case ne change pas.

**External Service Pattern** : pour chaque service tiers (Stripe, Keycloak, Resend, Meilisearch, R2, INSEE, DeepL), une interface dans `domain/ports/<service>.service.port.ts` + une implémentation dans `infrastructure/external/<service>/<service>.service.ts`. Switch de fournisseur (Stripe → Mangopay, Resend → SendGrid) = une seule classe à réécrire.

**Bénéfices opérationnels** :
- Tests unitaires triviaux sur le domaine (pas de testcontainers, pas de mocks NestJS, juste TypeScript pur)
- Swap de provider sans douleur
- Cohérence inter-services : 10 services, même structure
- Lint rules enforcées dès Sprint 0 (PR rejetée automatiquement sur violation)

#### 2. Authentification & Authorization (cross-cutting majeur)

- **Keycloak 25** comme IdP central avec realm `tukio`, 4 clients (web, admin, api, mobile V2)
- **Rôles realm-level** : `client`, `pro`, `admin-support`, `admin-modo`, `admin-super`
- **JWT RS256** validé par `gateway-api` via JWKS (cache 10 min) puis re-vérifié dans chaque service downstream (defence in depth)
- **2-couches identité** : Keycloak (auth) + `identity-svc` (profil métier, KYC, subscription tier)
- **Sync** : webhooks Keycloak → consumer `identity-svc` + job réconciliation quotidien (drift R8)
- **Header signé `x-tukio-actor`** propagé inter-services pour traçabilité

#### 3. Internationalization (cross-cutting omniprésent)

Touche **tous** les services :
- `catalog-svc` : tables `listing_translations`, `category_translations`, `pro_profile_translations`, 1 index Meilisearch par locale
- `notification-svc` : templates email Resend FR + EN, locale du destinataire pioché sur profil
- `messaging-svc` : pas d'i18n direct (les messages user sont dans la langue du speaker)
- Frontend : `next-intl`, locale-prefix URLs, hreflang, fallback FR
- `gateway-api` : détection `Accept-Language`, propagation header `x-tukio-locale` aux services downstream

#### 4. Observability & Tracing (cross-cutting tech)

- **OpenTelemetry** dans tous les services (traces avec correlation IDs propagés à travers la saga)
- **Prometheus metrics** exposées via `/metrics` sur chaque service
- **Logs centralisés** via Tempo, avec **PII redaction systématique** côté gateway et notification
- **Tracking server-side business events** émis par `gateway-api` vers PostHog (résistant ad-block)
- **Dashboards Looker Studio** consolidés (top of funnel quotidien, full funnel hebdo, revue stratégique mensuelle)

#### 5. Audit Trail & Compliance (cross-cutting LCEN/RGPD)

- **Audit trail admin** : table immuable append-only `admin_actions` côté `identity-svc`, alimentée par events NATS `admin.action.*.v1` consommés
- **Soft-delete + anonymisation** post-délai utile pour RGPD (R10)
- **Conservation factures 10 ans** via `order-svc` (PDF Cloudflare R2 + métadonnées Postgres)
- **Hash anti-recréation** sur bannissement (légal sous 6 ans, à valider avocat)
- **PII redaction** sur logs et exports analytics

#### 6. Saga Distribuée & Event Sourcing partiel (cross-cutting tech critique)

- **Booking-Payment saga choréographée** (ADR-006) : `booking-svc` → `order-svc` → `payment-svc`, ~5 étapes, état distribué reconstructible via correlation IDs
- **Transactional outbox** (ADR-007) : table `outbox` PostgreSQL + relais via PG LISTEN/NOTIFY dans chaque service producteur, fallback polling 30 s
- **Inbox table** dans chaque service consommateur (idempotence)
- **Event versioning** via suffixe (`v1`, `v2`) avec coexistence pendant migration
- **DLQ stream NATS dédié** + monitoring consumer lag (R12 mitigation)
- **Tests chaos en CI** obligatoires sur le flow booking-payment (R11 critique)

#### 7. Anti-désintermédiation (cross-cutting marketplace)

- **Coordonnées client masquées** côté Pro avant acceptation (PRD §FR45) — implémenté dans la couche présentation `gateway-api` ou frontend
- **Détection regex** emails/téléphones dans `messaging-svc` V1, config centralisée dans `@tukio/contracts`
- **Rate limiting** anti-spam : max 3 messages/h vers un Customer qui n'a pas répondu

#### 8. RBAC granulaire & Multi-tenant logique

- **Rôles Keycloak** : `client`, `pro`, `admin-{support,modo,super}` (5 rôles)
- **Endpoints `/admin/*`** distribués sur tous les services (pas de service "admin" dédié) avec RBAC enforcement côté `gateway-api`
- **Pas de multi-tenant strict** au MVP (un compte = un user) ; multi-utilisateurs Pro tier Business+ V1 (3 max) ; Pro Enterprise V2 (illimité, multi-utilisateurs sous le même compte company)

#### 9. Performance & Cache Strategy

- **Cache Redis Upstash** : locks dispo (3 layers race conditions), sessions WebSocket, rate limiting, pub/sub messaging
- **Vercel edge cache** : pages publiques `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- **JWKS cache** côté gateway (10 min) pour validation JWT
- **Meilisearch** : indexes pré-warmed mémoire, 1 par locale
- **Bundle size budgets** : initial JS < 150 KB gzipped, total page < 1,5 MB

#### 10. Multi-Provider Webhook Handling

- **Stripe** → endpoint unique `payment-svc/webhooks/stripe`, transformation en events NATS internes
- **Keycloak** → endpoint unique `identity-svc/webhooks/keycloak`, sync mirror profil métier
- **Aucun autre service** ne consomme directement les webhooks externes

#### 11. CI/CD Pipeline (Turborepo monorepo)

- **CI affected-builds** Turborepo : ne build/test que les services impactés par un changement
- **Lint rules** : `eslint-plugin-boundaries` enforce le pattern Pretre + conventions de nommage
- **Tests** : 80 % coverage `domain/`, 70 % `usecases/`, 50 % `infrastructure/` (NFR71)
- **Lighthouse CI** sur chaque PR frontend (CWV + accessibility ≥ 90)
- **Tests Playwright + axe-core** sur parcours critiques (search, checkout, onboarding pro)
- **Tests chaos en CI** sur flow saga (R11)
- **Migrations DB** backward-compatible (NFR83) pour rolling deployments

## Starter Template Evaluation

### Primary Technology Domain

**Web application full-stack monorepo** :
- Frontend Next.js 15 App Router + React 19 + TypeScript
- Backend NestJS 11 (Fastify adapter) — 10 microservices sous le pattern Pretre Clean Architecture
- Monorepo Turborepo
- Stack figée par 12 ADRs dans le PRD §12.8

### Starter Options Considered

#### Option A — Turborepo officiel (`create-turbo`)

**Pros** :
- CLI maintenu par Vercel, à jour avec Next.js 15 + React 19
- Configure pnpm workspaces + Turborepo + tsconfig partagé + lint shared
- Peut être étendu pour ajouter NestJS apps + libs partagées
- Affected-builds out-of-the-box (CI optimisé pour 12+ apps)

**Cons** :
- Le scaffold de base ne contient pas de NestJS apps (juste 1-2 Next.js apps + 1-2 packages)
- Aucun pattern Pretre / Clean Architecture (à scaffolder manuellement)
- Aucune intégration i18n / Stripe / Keycloak / NATS

#### Option B — T3 Stack (`create-t3-app`)

**Pros** :
- Best-practices Next.js + tRPC + Prisma + NextAuth + Tailwind + Zod inclus
- Documentation excellente

**Cons** :
- ❌ Bundle un ensemble de choix techniques (Prisma, tRPC, NextAuth) **incompatibles** avec nos ADRs (TypeORM, REST via gateway-api NestJS, Keycloak)
- ❌ Monolithique — pas conçu pour un monorepo avec 10 microservices NestJS distincts
- **Rejeté** : ferait perdre du temps à dé-installer / remplacer plusieurs des choix par défaut

#### Option C — RedwoodJS / Blitz

**Pros** : full-stack frameworks complets
**Cons** : ❌ Couplage front/back trop fort, incompatible avec une architecture microservices NestJS hexagonale. **Rejeté.**

#### Option D — Repo de référence Pretre cloné comme template

**Pros** :
- Donne le pattern Pretre exact pour 1 service NestJS (le but ultime)
- Référence canonique : https://github.com/jonathanPretre/clean-architecture-nestjs
- Customisation Tukio dans `docs/tukio_booking_svc_deepdive.md` §F

**Cons** :
- Pas un CLI — c'est un repo à cloner et adapter
- Ne couvre pas le frontend ni le monorepo
- À utiliser comme **complément** à Turborepo, pas comme remplacement

### Selected Starter — Stratégie hybride en 7 commandes

Aucun starter unique ne couvre nos besoins (monorepo + Next.js + 10 NestJS hexagonaux + Clean Architecture stricte). On combine **3 sources** au Sprint 0 :

#### 1. Base monorepo : `create-turbo`

```bash
pnpm dlx create-turbo@latest tukio --package-manager pnpm
cd tukio
```

Pose les fondations monorepo : `pnpm-workspace.yaml`, `turbo.json` racine, `tsconfig` racine, lint shared, `.gitignore`, structure `apps/` + `packages/`.

#### 2. Frontends multi-zones — 4 apps Next.js (architecture feature-based)

**Décision architecturale** : 4 apps Next.js distinctes pour mirror les 4 contextes RBAC Keycloak (Visitor anonymous, Customer, Pro, Admin). Composition sous `tukio.one` via **Vercel multi-zones** (rewrites au niveau de l'app `public/` qui agit comme zone parent). Chaque app est déployable indépendamment et structurée en architecture feature-based stricte (cf. Step 4 §Frontend Architecture).

```bash
cd apps && rm -rf web docs   # cleanup defaults Turborepo

# 2.1 Frontend public anonymous (homepage, search, fiches services/pros, blog, légal)
pnpm dlx create-next-app@latest public \
  --typescript --tailwind --app --turbopack --eslint \
  --import-alias "@/*" --no-src-dir

# 2.2 Frontend customer (espace client B2C/B2B, rôle Keycloak `client`)
pnpm dlx create-next-app@latest customer \
  --typescript --tailwind --app --turbopack --eslint \
  --import-alias "@/*" --no-src-dir

# 2.3 Frontend seller (espace pro, rôle Keycloak `pro`)
pnpm dlx create-next-app@latest seller \
  --typescript --tailwind --app --turbopack --eslint \
  --import-alias "@/*" --no-src-dir

# 2.4 Frontend admin (sous-domaine admin.tukio.one, MFA TOTP obligatoire)
pnpm dlx create-next-app@latest admin \
  --typescript --tailwind --app --turbopack --eslint \
  --import-alias "@/*" --no-src-dir
```

Chaque app produit Next.js 15 App Router avec Tailwind, TypeScript strict, Turbopack, ESLint. Justification du split à 4 apps :

| App | Path mounted | Audience | Rationale |
|-----|--------------|----------|-----------|
| `public` | `tukio.one` apex — visiteurs (homepage, search, category, service, pro) **+** customers B2C authentifiés (`(authenticated)/account`, `/bookings`, `/favorites`, `/messages`, …) | Visiteur anonyme + Customer authentifié (mêmes domain, route group `(authenticated)`) | Bundle mince côté visiteur (Next.js code-splitting par route), SEO-optimized, max edge cache, route-level auth gate via middleware Next.js |
| `seller` | `seller.tukio.one/{locale}/seller/*` (auth role `pro`) | Pro | Pas de code customer chargé, libs lourdes (calendar, analytics) chargeables |
| `admin` | `admin.tukio.one/*` (auth role `admin-*`, MFA obligatoire) | Admin | Sous-domaine séparé, sécurité accrue, isolation cookies, IP allowlist possible |

> **ADR-016 (2026-05-15) supersedes ADR-013** : `apps/public` + `apps/customer` ont été mergés dans une seule app servie sur l'apex `tukio.one`. Voir Story 0.14 pour les détails du refactor.

**Composition** : `apps/public/` est servie sur l'apex `tukio.one`. Le seul rewrite cross-app restant est vers `seller.tukio.one` :
```typescript
rewrites: [
  { source: '/:locale/seller/:path*', destination: 'https://seller.tukio.one/:locale/seller/:path*' },
]
```

Auth-gating : un middleware Next.js (`apps/public/src/middleware.ts`) protège les routes `(authenticated)` (`/account`, `/bookings`, `/favorites`, `/messages`) et redirige les requêtes non authentifiées vers `/login?callback=...`. Le marqueur de session HttpOnly:false `tukio-session-active` est posé par le flow login (Story 1.4) avec `Domain=.tukio.one; SameSite=Lax` pour rester partagé avec `seller.tukio.one`.

#### 4. Services backend : `@nestjs/cli` dans `apps/<service>-svc/` (×10)

```bash
cd apps
for SVC in gateway-api identity-svc catalog-svc booking-svc order-svc \
           payment-svc messaging-svc review-svc notification-svc media-svc; do
  pnpm dlx @nestjs/cli new $SVC \
    --strict \
    --package-manager pnpm \
    --skip-git \
    --skip-install
done
pnpm install   # 1 seul install racine pour tous les services
```

Génère la structure NestJS de base pour chaque service (`main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts`, configs).

#### 5. Pattern Pretre — scaffold manuel au Sprint 0

Le starter NestJS officiel **ne fournit pas** le pattern Pretre Clean Architecture. À scaffolder manuellement dans le premier service développé (recommandation : `identity-svc`, puis répliquer pour les 9 autres) :

```bash
# Cloner le repo de référence pour étudier la structure cible
git clone https://github.com/jonathanPretre/clean-architecture-nestjs reference/pretre-pattern

# Dans apps/identity-svc/src/, créer la structure :
mkdir -p src/domain/{model,ports,service,exception}
mkdir -p src/usecases
mkdir -p src/infrastructure/{persistence/typeorm,messaging/nats,external,http/{controllers,dtos,guards},logger,config,exception,usecases-proxy}
```

Le `tukio_booking_svc_deepdive.md` §F contient la structure exhaustive customisée Tukio avec exemples concrets de ports/repositories/use cases pour `booking-svc`. À utiliser comme template pour les 10 services.

#### 6. Libs partagées : packages workspace

```bash
mkdir -p packages/{contracts,messaging,auth,testing,ui,api-client,i18n-client,auth-client}
# Chaque package : package.json, tsconfig, src/index.ts, README
```

**Backend / cross-cutting** :
- `@tukio/contracts` — JSON Schema events versionnés, types TS dérivés, DTOs HTTP + Zod schemas partagés frontend/backend (ADR-011)
- `@tukio/messaging` — wrapper NATS JetStream + outbox helpers PG LISTEN/NOTIFY (ADR-007)
- `@tukio/auth` — `KeycloakJwtGuard` + `Roles` decorator + types `Actor` (côté backend)
- `@tukio/testing` — testcontainers helpers (Postgres, NATS, Redis)

**Frontend partagé entre les 4 apps** :
- `@tukio/ui` — composants shadcn/ui customisés + design tokens terracotta (palette `brand-*`, `cream-*`, `charcoal-*`) + typo Fraunces — **toutes les apps consomment cette lib**, pas de duplication de Button/Input/Modal/Toast
- `@tukio/api-client` — hooks TanStack Query typés pour gateway-api (`useSearchListings`, `useBookingDetail`, `useCreateBooking`, etc.), avec types dérivés de `@tukio/contracts`
- `@tukio/i18n-client` — config `next-intl` partagée (locale-prefix routing, fallback `fr`, formatters dates/nombres/monnaies, hreflang helpers)
- `@tukio/auth-client` — Keycloak client adapter (refresh token rotation, cookie management, hooks `useAuth`, `useRole`, redirect helpers vers `auth.tukio.one`)

#### 7. Infra & docs

```bash
mkdir -p infra/{terraform,k8s/helm-charts,docker-compose}
mkdir -p docs/adr
# Copier les 12 ADRs préexistants (PRD §12.8) en docs/adr/0001-*.md → 0012-*.md
```

### Rationale de ce choix combiné

- **Aucun starter monolithique** ne match la stack Tukio (microservices NestJS + Clean Architecture stricte + monorepo Turborepo + i18n + Stripe + Keycloak).
- **`create-turbo`** est le starter avec le plus haut ROI (configure le monorepo + tooling shared, ce qui serait coûteux à faire à la main).
- **`create-next-app`** + **`@nestjs/cli`** sont les CLI **officiels** maintenus par Vercel et NestJS — pas de risque de drift hors mainstream.
- **Le pattern Pretre est scaffold manuellement** dans le 1er service comme template, puis cloné pour les 9 autres. C'est un **investissement Sprint 0** qui paye pendant tout le projet (les 130 FRs vont s'implémenter dans cette structure).

**Note critique** : ce processus d'init est **la première story d'implémentation** du Sprint 0. Sans ce scaffold cohérent, les 130 FRs ne peuvent pas être implémentés selon les patterns figés.

### Architectural Decisions Provided by Starters

#### Language & Runtime (via `create-next-app` + `@nestjs/cli`)

- **TypeScript strict** end-to-end (frontend + backend + libs partagées)
- **Node.js LTS** (20.x ou 22.x au moment du Sprint 0)
- **pnpm** comme package manager unifié (workspaces natifs, hoisting strict)

#### Styling Solution (via `create-next-app --tailwind` + ajout manuel `shadcn/ui`)

- **Tailwind CSS** configuré dans `apps/front/` et `apps/admin/`
- **shadcn/ui** à installer en post-init pour la lib de composants accessibles : `pnpm dlx shadcn@latest init`
- **Design tokens** Tukio (palette terracotta, typo Fraunces) à câbler dans `tailwind.config.ts` au Sprint 0

#### Build Tooling (via `create-turbo` + `create-next-app --turbopack`)

- **Turborepo** orchestrateur monorepo avec affected-builds CI
- **Turbopack** pour les builds Next.js (Rust-based, plus rapide que Webpack)
- **NestJS CLI** : `nest build` (TypeScript Compiler ou SWC selon configuration)

#### Testing Framework (via `@nestjs/cli` + ajout manuel)

- **Jest** par défaut côté NestJS (à conserver — bon support testcontainers et mocks)
- **Vitest** côté frontend Next.js (plus rapide que Jest pour React, à câbler post-init)
- **Playwright** pour les tests E2E + accessibility (axe-core integration) — à ajouter au Sprint 0
- **testcontainers** pour les tests d'intégration `infrastructure/persistence` (lib `@tukio/testing`)

#### Code Organization (Pattern Pretre, NON fourni par starter — à scaffolder manuellement)

- Structure imposée : `domain/usecases/infrastructure` + `UseCaseProxy` factory
- Référence canonique : https://github.com/jonathanPretre/clean-architecture-nestjs
- Lint enforcement : `eslint-plugin-boundaries` à câbler au Sprint 0

#### Development Experience

- **Hot reload** Next.js + nest start --watch
- **Docker Compose local** complet (Postgres, NATS, Keycloak, Meilisearch, Redis Upstash mock) à câbler au Sprint 0
- **DX shared** : ESLint + Prettier + Husky + lint-staged via `create-turbo`
- **TypeScript path aliases** : `@/*` Next.js + `@tukio/*` workspace packages

#### What Starters Do NOT Provide (à câbler au Sprint 0)

| Élément | Starter ? | Action Sprint 0 |
|---------|-----------|-----------------|
| **Pattern Pretre Clean Architecture** | ❌ | Scaffold manuel dans `identity-svc`, dupliquer pour 9 autres services |
| **`next-intl` i18n config** | ❌ | `pnpm add next-intl` + setup middleware + `messages/{fr,en}.json` |
| **shadcn/ui components** | ❌ | `pnpm dlx shadcn@latest init` + design tokens terracotta |
| **NATS JetStream setup** | ❌ | `@horizon-republic/nestjs-jetstream` + `@tukio/messaging` lib |
| **TypeORM config + 1 DB par service** | ❌ | Setup connection per service + outbox table migration |
| **Keycloak integration** | ❌ | `@tukio/auth` lib + `KeycloakJwtGuard` |
| **Stripe Connect Express** | ❌ | `infrastructure/external/stripe/stripe.service.ts` (implements IStripeService port) |
| **Meilisearch sync** | ❌ | `catalog-svc` consumer NATS + Meilisearch SDK |
| **Cloudflare R2 + Images** | ❌ | `media-svc` SDK + signed URLs |
| **Resend + Brevo** | ❌ | `notification-svc` SDKs + templates FR/EN |
| **PostHog server-side + Plausible** | ❌ | `gateway-api` event emitter + Next.js script tags |
| **OpenTelemetry + Prometheus** | ❌ | Auto-instrumentation NestJS + custom metrics |
| **Docker Compose dev local** | ❌ | `infra/docker-compose/docker-compose.yml` complet |
| **K8s Helm charts** | ❌ | `infra/k8s/helm-charts/` à écrire au Sprint 0 |
| **CI Turborepo affected-builds** | ⚠️ Partiel | Configurer GitHub Actions / GitLab CI workflows |

### Note sur le Sprint 0

Cette initialisation **EST** la 1ʳᵉ story d'implémentation du Sprint 0 (Story 0.1 — *Bootstrap monorepo + scaffold pattern Pretre*). Estimation effort dev : 3-5 jours pour atteindre l'état où on peut commencer la Story 0.2 (1ère story fonctionnelle, ex : `identity-svc` health check + Keycloak intégration).

## Core Architectural Decisions

### Decision Priority Analysis

#### Critical Decisions (Block Implementation) — 12 ADRs préexistants + ADR-013 (frontend multi-zones)

Tous actés dans le PRD §12.8 et `tukio_product_tech_alignment.md` §D. À copier dans `docs/adr/0001-*.md` à `0013-*.md` au Sprint 0.

| ADR | Décision | Status |
|-----|----------|--------|
| 001 | Pattern Pretre Clean Architecture strict + monorepo Turborepo | ✅ Acté |
| 002 | NATS JetStream (vs Kafka/RabbitMQ) | ✅ Acté |
| 003 | Database per service, no shared tables | ✅ Acté |
| 004 | Booking et Order = 2 services distincts | ✅ Acté |
| 005 | Meilisearch dès le MVP (override Postgres FTS) | ✅ Acté |
| 006 | Saga choréographée (pas d'orchestrator) | ✅ Acté |
| 007 | Outbox pattern partout via PG LISTEN/NOTIFY | ✅ Acté |
| 008 | gateway-api seul accès public | ✅ Acté |
| 009 | Keycloak + identity-svc séparés | ✅ Acté |
| 010 | TypeORM par défaut + raw SQL pour read-heavy | ✅ Acté |
| 011 | `@tukio/contracts` package dès Sprint 0 | ✅ Acté |
| 012 | i18n FR + EN dès Sprint 0 (next-intl + locale prefix + tables translations + 1 index Meilisearch par locale) | ✅ Acté |
| **013** | **Frontend multi-zones 4 apps (public + customer + seller + admin) + architecture feature-based stricte** | ✅ **Nouveau** (architecture session 2026-05-08) |

#### Important Decisions (Shape Architecture) — Nouvelles décisions actées dans cette session

Décisions cascading des ADRs et du starter, à figer pour démarrer Sprint 0.

#### Deferred Decisions (V1+ / V2+)

- **Read replicas Postgres** : V2 si bottleneck mesuré (NFR33)
- **Connection pooling pgBouncer** : V1 quand > 50 conn concurrentes
- **Secret rotation automatique** : V2 (manuel via Doppler au MVP)
- **CDN multi-region** : V3+ si international
- **Database sharding** : pas anticipé avant V3+ extreme scale
- **Service mesh (Istio/Linkerd)** : pas anticipé tant que les 10 services restent dans 3 deployment units
- **Module Federation runtime** : rejeté MVP/V1, à reconsidérer V3+ uniquement si team > 30 ingénieurs (cf. ADR-013 rationale)

### Data Architecture

#### Database — déjà acté (ADR-003 + ADR-010)

- **PostgreSQL 16** (1 database par service, 10 DBs sur 1 instance physique au MVP)
- **TypeORM** par défaut + **raw SQL** dans `infrastructure/persistence/queries/*.query.ts` pour read-heavy
- **Migrations** : TypeORM CLI par service, versioning indépendant par DB
- **Rollback scripts obligatoires** en CI (NFR72)
- **Backward-compatible migrations** uniquement (NFR83) pour rolling deployments

#### Validation Strategy

- **Zod** côté frontend ET backend (unifié, schemas dans `@tukio/contracts/src/dtos/` partagés)
- Frontend : `react-hook-form` + Zod resolver
- Backend NestJS : `nestjs-zod` + `ZodValidationPipe` global
- ❌ Pas de `class-validator`

#### Caching Strategy

- **Cache-aside** avec Redis Upstash, TTL par type :

| Resource | TTL | Invalidation |
|----------|-----|--------------|
| Search results Meilisearch | 5 min | Auto via TTL |
| Listing detail public | 60 s | Event `catalog.listing.updated.v1` |
| Pro profile public | 5 min | Event `identity.pro.profile_updated.v1` |
| Category tree | 1 h | Event `catalog.category.updated.v1` |
| User session | 24 h | Logout / token refresh |
| JWKS Keycloak | 10 min | Auto via TTL |
| Rate limiting buckets | sliding 1 min | Auto |

- **Cache key convention** : `tukio:<service>:<entity>:<id>:<locale>`
- **Cache locks** (3 layers race conditions PRD §FR48) : Redis distributed lock avec timeout 5 s

#### Outbox & Inbox Tables — déjà acté (ADR-007)

```sql
-- Outbox (chaque service producteur)
CREATE TABLE outbox (
  id UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_version INT NOT NULL,
  payload JSONB NOT NULL,
  correlation_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  error_message TEXT
);
CREATE INDEX idx_outbox_status_created ON outbox (status, created_at) WHERE status = 'pending';

-- Inbox (chaque service consommateur)
CREATE TABLE inbox (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  correlation_id UUID NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  payload JSONB NOT NULL
);
CREATE INDEX idx_inbox_received ON inbox (received_at) WHERE processed_at IS NULL;
```

Relais outbox → NATS via PG LISTEN/NOTIFY dans le worker `@tukio/messaging`, fallback polling 30 s (NFR42).

### Authentication & Security

#### Auth — déjà acté (ADR-009 + NFR11)

- **Keycloak 25** comme IdP (Phasetwo managé MVP)
- **JWT RS256** validé par `gateway-api` via JWKS cache 10 min, re-vérifié dans chaque service downstream
- **`x-tukio-actor` header signé** propagé inter-services pour traçabilité

#### Session Strategy

- **Refresh token rotation** native Keycloak
- Frontend Next.js : access token en cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.tukio.one` (partagé entre les 4 apps multi-zones)
- Refresh token côté Keycloak session (jamais exposé au frontend)
- Logout : révoque session Keycloak + clear cookie

#### CSRF Protection

- **Double-submit cookie pattern** sur `gateway-api` :
  - Cookie `tukio-csrf-token` (HttpOnly: false, lisible par JS pour le mettre dans header)
  - Header `X-CSRF-Token` requis sur toute requête mutante (POST, PUT, PATCH, DELETE)
  - Vérification : header value === cookie value
- Bypass automatique sur les routes publiques GET

#### Secret Management

- **MVP** : **Doppler** (UX excellent, intégration K8s native via Doppler Operator)
- **V2** : migration possible vers AWS Secrets Manager / HashiCorp Vault si scaling justifie

#### Authorization (RBAC)

- **Rôles Keycloak realm-level** (figés) : `client`, `pro`, `admin-support`, `admin-modo`, `admin-super`
- `@tukio/auth` lib (backend) : `KeycloakJwtGuard`, `@Roles` decorator, `Actor` type
- `@tukio/auth-client` lib (frontend) : Keycloak client adapter, hooks `useAuth`, `useRole`, redirect helpers

#### API Security

- **HTTPS partout + HSTS** (NFR9)
- **mTLS inter-services prod** (NFR10) via service mesh léger ou sidecar Linkerd au V1+ (MVP : networking K8s natif suffit dans 1 namespace)
- **Rate limiting** sur `gateway-api` :
  - Anonyme : 60 req/min/IP
  - Authentifié : 600 req/min/user
  - Admin : illimité (mais audit trail)
  - Endpoints sensibles (login, register, payment) : 10 req/min/IP
- **CORS** : whitelist origines (`tukio.one`, `seller.tukio.one`, `admin.tukio.one`) — ADR-016 a supprimé `customer.tukio.one` (apex unifié) et `*.vercel.app` n'a plus lieu d'être (infra DigitalOcean Droplets, pas Vercel)

### API & Communication Patterns

#### API Style — déjà acté (ADR-008)

- **REST** via `gateway-api` (BFF pattern), JSON
- **NATS JetStream** pour async inter-services (ADR-002)
- **WebSocket** uniquement sur `messaging-svc` pour le chat temps réel

#### API Versioning

- **URL prefix `/v1/...`** sur tous les endpoints REST de `gateway-api`
- **Coexistence v1 + v2** lors des transitions majeures (NFR83)
- **Events NATS** : versioning via suffix `v1`, `v2` (ADR-011), coexistence pendant migration consumer

#### API Documentation

- **OpenAPI 3.1** auto-généré via `@nestjs/swagger` côté `gateway-api`
- Endpoint `/docs` :
  - Production : protégé par RBAC `admin-*` uniquement
  - Staging / preview : accessible librement
- Spec exportable JSON pour génération de SDK clients (V3+ API publique)

#### Error Handling Standard

Erreurs servies dans **l'enveloppe REST canonique** (cf. §API Response Format ci-dessous), bloc `error` au lieu de `data`. Inspiré du RFC 7807 Problem Details (champs `type`, `title`, `detail`, `instance`) mais embarqué dans l'enveloppe pour **uniformité** avec les responses success. Content-Type `application/json` (pas `application/problem+json` — l'enveloppe traite les deux cas).

- Tukio error codes : `<DOMAIN>-<CATEGORY>-<NNN>` (ex : `BOOKING-CONFLICT-001`, `PAYMENT-REFUSED-002`, `AUTH-FORBIDDEN-003`)
- PII redaction dans `detail` (NFR16)

#### Pagination

- **Cursor-based** pour toutes les collections > 100 items potentiels
- **Métadonnées pagination dans l'enveloppe REST** (cf. §API Response Format ci-dessous), bloc `pagination: { nextCursor, hasMore, totalEstimate, limit }`
- ❌ Offset-based interdit côté gateway

#### Health & Observability Endpoints (NFR84)

- `/health` (liveness probe K8s)
- `/ready` (readiness probe K8s, vérifie connexion DB + NATS)
- `/metrics` (Prometheus scraping)
- `/v1/info` (version, build SHA, locale supportées)

### Frontend Architecture

> ADR-013 — Multi-zones 4 apps + feature-based architecture stricte. Voir Step 3 §"Frontends multi-zones" pour le mapping URL → app et les rewrites Vercel.

#### Architecture feature-based dans chaque app

**Règle non négociable** : tout le code applicatif est organisé par **feature** (mirror des bounded contexts métier), jamais par technical layer.

```
apps/<app>/src/
├─ app/                                     # Next.js App Router (file-based routing)
│  └─ [locale]/
│     └─ ...
├─ features/                                # ← FEATURE-BASED stricte
│  ├─ <feature>/
│  │  ├─ components/                        # composants React feature-specific
│  │  ├─ hooks/                             # hooks React custom feature-specific
│  │  ├─ services/                          # client API : useXxx (TanStack Query) + mutations
│  │  ├─ schemas/                           # Zod schemas locaux (sinon viennent de @tukio/contracts)
│  │  ├─ types/                             # types feature-specific
│  │  ├─ utils/
│  │  ├─ __tests__/
│  │  └─ index.ts                           # public API barrel (limited exports)
│  └─ ...
├─ shared/                                  # cross-feature primitives (NON UI partagé)
│  ├─ layouts/                              # PublicLayout, CustomerLayout, etc.
│  ├─ utils/                                # utilities cross-feature (date formatters, currency, etc.)
│  └─ providers/                            # QueryProvider, IntlProvider, ThemeProvider, AuthProvider
└─ lib/                                     # configs (next-intl, posthog, plausible, sentry)
```

**Règles non négociables** :
- ❌ **Pas de `components/`, `hooks/`, `services/` à la racine** = anti-pattern (organisation par layer technique)
- ✅ Chaque feature est **self-contained** : composants, hooks, services API, schemas, types
- ✅ **Public API par feature** via `features/<feature>/index.ts` (ne ré-exporte que ce qui est consommé hors de la feature)
- ✅ **Lint rule `eslint-plugin-boundaries`** (frontend, ajouté à NFR67) : une feature ne peut pas importer les internals d'une autre feature, seulement son `index.ts`
- ✅ **Shared UI primitives** (Button, Input, Modal, Toast, etc.) dans `@tukio/ui` (lib monorepo), pas dans `shared/components/`

#### Mapping features par app

##### `apps/public/` (anonymous, SEO-optimized)

```
features/
├─ home/                                    # hero + search + categories + CTA pro
├─ search/                                  # /search avec filtres facets
├─ catalog/                                 # /category/{slug}, /category/{slug}/{city}
├─ service-detail/                          # /service/{slug}
├─ pro-profile/                             # /pro/{slug}
├─ blog/                                    # /blog, /blog/{slug}
├─ legal/                                   # /terms, /privacy, /cookies, /legal
└─ marketing/                               # /sell, /pricing, /about, /contact, /help
```

##### `apps/customer/` (auth role: client)

```
features/
├─ dashboard/                               # /account/ - vue d'ensemble bookings/messages
├─ bookings/                                # /account/bookings/* lifecycle complet
├─ cart-checkout/                           # /cart, /cart/shipping, /cart/checkout, /cart/confirmation
├─ messages/                                # /account/messages/* WebSocket chat
├─ favorites/                               # V1 /account/favorites
├─ quotes/                                  # V1 /account/quotes/*
├─ billing/                                 # /account/billing/* (methods + invoices)
├─ profile/                                 # /account/profile/* (identity + security + notifications + company B2B V1)
└─ reviews/                                 # /account/bookings/{id}/review
```

##### `apps/seller/` (auth role: pro)

```
features/
├─ dashboard/                               # /seller/ - to-do urgent + upcoming + recent activity
├─ onboarding/                              # /seller/onboarding/{profile,kyc,stripe,first-listing}
├─ services/                                # /seller/services/* CRUD listings
├─ bookings/                                # /seller/bookings/* gestion réservations
├─ quotes/                                  # V1 /seller/quotes/*
├─ messages/                                # /seller/messages/* WebSocket chat
├─ calendar/                                # /seller/calendar dispo + bookings overlay
├─ reviews/                                 # /seller/reviews/*
├─ analytics/                               # V1 /seller/analytics
├─ billing/                                 # /seller/billing/{invoices,payouts,exports}
├─ subscription/                            # V1 /seller/subscription/{change,invoices}
├─ team/                                    # V1 Business+ /seller/team/*
└─ settings/                                # /seller/settings/{profile,company,security,notifications,api}
```

##### `apps/admin/` (admin.tukio.one, MFA obligatoire)

```
features/
├─ dashboard/                               # KPIs plateforme
├─ users/                                   # /users/{customers,pros,admins}
├─ verifications/                           # KYC pro queue
├─ catalog/                                 # services, categories, tags, moderation queue
├─ transactions/                            # bookings, payments, disputes
├─ reports/                                 # signalements users
├─ finance/                                 # commissions, subscriptions, refunds, reconciliation
├─ communication/                           # V1 email templates, push, broadcasts V2
├─ analytics/                               # V1 KPIs détaillés
├─ support/                                 # V1 tickets
├─ config/                                  # general, commissions, categories, promotions, legal
└─ audit/                                   # journal immuable
```

#### State Management

- **Server state** : **TanStack Query** (cache HTTP, revalidation, mutations, optimistic updates) — wrapped dans `@tukio/api-client` avec hooks typés
- **UI state local** : `useState` / `useReducer` natif React
- **UI state global persistant** : **Zustand** uniquement pour locale, theme, panier non-loggé
- ❌ Pas de Redux / MobX / Context API pour state global lourd

#### Form Management

- **React Hook Form** + **Zod resolver**
- Schemas Zod partagés via `@tukio/contracts` (single source of truth frontend ↔ backend)

#### Routing Strategy par app

##### Convention `apps/public/src/app/[locale]/`

```
[locale]/
├─ page.tsx                                  # /{locale}/
├─ search/page.tsx                           # /{locale}/search
├─ category/[slug]/page.tsx                  # /{locale}/category/{slug}
├─ category/[slug]/[city]/page.tsx           # /{locale}/category/{slug}/{city} (V1)
├─ service/[slug]/page.tsx                   # /{locale}/service/{slug}
├─ pro/[slug]/page.tsx                       # /{locale}/pro/{slug}
├─ blog/page.tsx + blog/[slug]/page.tsx
├─ (legal)/{terms,privacy,cookies,legal}/page.tsx
├─ (marketing)/{sell,pricing,about,contact}/page.tsx
└─ (help)/help/...

middleware.ts                                # next-intl middleware + redirect Keycloak vers customer/seller selon role si user authentifié
```

##### Convention `apps/customer/src/app/[locale]/`

```
[locale]/
├─ account/
│  ├─ layout.tsx                             # CustomerLayout (sidebar, top bar avec avatar)
│  ├─ page.tsx                               # /{locale}/account/ dashboard
│  ├─ bookings/{page.tsx,[id]/page.tsx,[id]/cancel/page.tsx,[id]/review/page.tsx}
│  ├─ messages/{page.tsx,[id]/page.tsx}
│  ├─ favorites/page.tsx                     # V1
│  ├─ quotes/{page.tsx,[id]/page.tsx}        # V1
│  ├─ billing/{methods,invoices}/page.tsx
│  └─ profile/{identity,security,notifications,company}/page.tsx
└─ cart/                                     # tunnel checkout (auth-or-guest)
   ├─ page.tsx
   ├─ shipping/page.tsx
   ├─ checkout/page.tsx
   └─ confirmation/[orderId]/page.tsx

middleware.ts                                # next-intl + KeycloakAuthMiddleware (require role: client)
```

##### Convention `apps/seller/src/app/[locale]/`

```
[locale]/
└─ seller/
   ├─ layout.tsx                             # SellerLayout (top bar Tukio Pro, dropdown avatar, bottom nav mobile V1)
   ├─ page.tsx                               # /{locale}/seller dashboard
   ├─ onboarding/{profile,kyc,stripe,first-listing}/page.tsx
   ├─ services/{page.tsx,new/page.tsx,[id]/page.tsx,[id]/edit/page.tsx}
   ├─ bookings/{page.tsx,[id]/page.tsx,[id]/edit/page.tsx}
   ├─ quotes/{page.tsx,[id]/page.tsx,[id]/reply/page.tsx}     # V1
   ├─ messages/{page.tsx,[id]/page.tsx}
   ├─ calendar/page.tsx
   ├─ reviews/{page.tsx,[id]/reply/page.tsx}
   ├─ analytics/page.tsx                     # V1
   ├─ billing/{invoices,payouts,exports}/page.tsx
   ├─ subscription/{page.tsx,change,invoices}/page.tsx        # V1
   ├─ team/{page.tsx,invite,[userId]}/page.tsx                # V1 Business+
   └─ settings/{profile,company,security,notifications,api}/page.tsx

middleware.ts                                # next-intl + KeycloakAuthMiddleware (require role: pro, status verified)
```

##### Convention `apps/admin/src/app/[locale]/` (sur sous-domaine `admin.tukio.one`)

```
[locale]/
├─ layout.tsx                                # AdminLayout (sidebar gauche, MFA gate)
├─ page.tsx                                  # /{locale}/ admin dashboard
├─ users/{customers,pros,admins}/page.tsx + [id]/page.tsx
├─ verifications/{page.tsx,[id]/page.tsx}
├─ catalog/{services,categories,tags,moderation-queue}/page.tsx
├─ transactions/{bookings,payments,disputes}/page.tsx
├─ reports/{page.tsx,[id]/page.tsx}
├─ finance/{commissions,subscriptions,refunds,reconciliation}/page.tsx
├─ communication/...                         # V1
├─ analytics/page.tsx                        # V1
├─ support/...                               # V1
├─ config/{general,commissions,categories,promotions,legal}/page.tsx
└─ audit/page.tsx

middleware.ts                                # next-intl + KeycloakAuthMiddleware (require role: admin-*, MFA verified)
```

#### Bundle Optimization

- **Anti-barrel imports** sur `@tukio/contracts` (lint rule pour interdire `import { x } from '@tukio/contracts'` au profit de `import { x } from '@tukio/contracts/src/events/booking'`) — préserve tree-shaking
- **Dynamic imports** sur composants lourds : Stripe Elements (~200 KB), calendrier dispo, configurateur événement V2
- `next/image` systématique (Cloudflare Images backend)
- `next/font` pour Fraunces (no FOUT)
- **Bundle budget par app** : initial JS < 150 KB gzipped (NFR7) — particulièrement strict sur `apps/public/` (SEO critical)

#### Inter-app Navigation

- **Vercel multi-zones rewrites** sur `apps/public/` → autres apps deviennent transparentes pour l'utilisateur (URL reste sous `tukio.one`)
- **Cookies session partagés** via `Domain=.tukio.one` (Keycloak access token cookie)
- **Inter-app links** : utiliser `<a href="...">` standard pour les liens cross-zone (pas `<Link>` Next.js qui ne fonctionne pas cross-zone)
- **Composant `<CrossZoneLink>`** dans `@tukio/ui` qui wrappe `<a>` avec analytics tracking + accessibilité

#### Static Assets & CDN

- Assets partagés (logos, fonts custom Fraunces) servis via `static.tukio.one` ou Cloudflare CDN
- Images de contenu (photos services pros) via Cloudflare Images avec format auto AVIF/WebP

### Infrastructure & Deployment

#### Hosting — déjà acté (PRD §12.1)

- **Frontend** : Vercel (deploy automatique depuis GitHub, edge cache global, Image Optimization, Analytics) — 4 projets Vercel séparés (un par app)
- **Backend** : Kubernetes managé

#### Cloud Provider K8s — Hetzner Cloud par défaut (validé indirectement par [C])

| Provider | Coût MVP estimé | Datacenter |
|----------|----------------|------------|
| **Hetzner Cloud K8s** ✅ par défaut | 50-100 €/mois | Allemagne (RGPD ✓) |

**Recommandation MVP** : **Hetzner Cloud K8s + Neon Postgres serverless** (rapport qualité/prix imbattable, RGPD-friendly, suffisant jusqu'à V2). Migration vers AWS EKS / GCP GKE possible en V2/V3+ si scaling extrême ou besoin services managés sophistiqués.

**Postgres MVP** : **Neon** (serverless, branching, free tier généreux, scaling automatique) — découplé de Hetzner pour souplesse.

**À reconsidérer si signal** : souveraineté FR forte (→ Scaleway/OVH), scaling extrême (→ AWS EKS).

#### CI/CD

- **GitHub Actions** (intégré, marketplace riche, gratuit pour repos privés jusqu'à 2 000 min/mois)
- Workflows :
  - PR : lint + typecheck + tests affected (Turborepo) + Lighthouse CI sur les 4 apps frontend
  - Merge `main` : build images Docker → push ghcr.io → deploy staging via ArgoCD (backend) + auto deploy Vercel (frontend)
  - Tag `v*` : promote staging → production via ArgoCD
- **Container registry** : **GitHub Container Registry (ghcr.io)** (intégré, gratuit pour repos privés)

#### Deployment Strategy

- **GitOps avec ArgoCD** (manifests K8s + Helm charts versionnés dans `infra/k8s/` du monorepo) pour le backend
- **Vercel** pour les 4 frontends (`public`, `customer`, `seller`, `admin`) — déploiement automatique par PR + production sur merge main
- **3 environnements backend** : `dev` (local Docker Compose), `staging` (cluster K8s), `production` (cluster K8s séparé)
- **3 deployment units MVP backend** (NFR80) :
  - `core-api` : gateway + identity + catalog + booking + order + payment
  - `workers` : messaging + review + notification + media
  - `nats-cluster` : NATS JetStream R3
- **Split `payment-svc`** dès la production V0 release (NFR81)
- **HPA (HorizontalPodAutoscaler)** : CPU 70 % + RPS-based pour scaling automatique pic mai-sept (NFR38)
- **PDB (PodDisruptionBudget)** : minimum 1 pod disponible pendant les rolling updates
- **NetworkPolicy** : strict, deny-all par défaut + whitelist explicite par namespace

#### Logs Aggregation

- **Grafana Loki** (économique, query language LogQL similaire à PromQL, intégré à Grafana déjà décidé pour métriques + traces Tempo)
- ❌ Pas d'Elastic Stack (cher, lourd, over-kill au MVP)
- **Rétention** : 30 jours hot, 90 jours cold (S3-compatible storage Cloudflare R2)

#### Monitoring & Alerting (cohérent NFR61-66)

- **Stack** : OpenTelemetry → Tempo (traces) + Prometheus (métriques) + Loki (logs) + Grafana (dashboards) + Alertmanager (alertes)
- **Hosting** : **Grafana Cloud** (free tier généreux pour MVP) → migration self-hosted V2+ si volume justifie
- **Alertes critiques** :
  - Saga booking-payment > 5 min (R11)
  - NATS consumer lag > 1 000 msg (R12)
  - Outbox pending > 100 msg / > 1 min (R13)
  - Disponibilité gateway-api < 99,5 % (NFR39)
  - Erreur 5xx > 1 % sur 5 min
  - Lighthouse CWV régression > 10 % sur `apps/public/` (impact SEO RA1)
- **Channel** : Slack `#tukio-alerts` (MVP) → PagerDuty (V2+ si oncall structuré)

#### Backup & DR (cohérent NFR44)

- **Postgres (Neon)** : daily snapshot automatique + branching pour staging/QA
- **Cloudflare R2** : versioning activé sur les buckets médias (15 jours)
- **RPO < 5 min**, **RTO < 1 h** (NFR44)
- **Drill DR** : test de restauration mensuel automatique en staging (V1)

### Decision Impact Analysis

#### Implementation Sequence (ordre des décisions à acter au Sprint 0)

1. **Bootstrap monorepo Turborepo** + scaffolding initial (Story 0.1)
2. **Pattern Pretre** scaffolding dans `identity-svc` (template pour les 9 autres)
3. **Libs partagées backend** : `@tukio/contracts`, `@tukio/messaging`, `@tukio/auth`, `@tukio/testing`
4. **Libs partagées frontend** : `@tukio/ui`, `@tukio/api-client`, `@tukio/i18n-client`, `@tukio/auth-client`
5. **4 apps Next.js** (public, customer, seller, admin) avec architecture feature-based scaffoldée
6. **Vercel multi-zones** config (rewrites sur `apps/public/`)
7. **Docker Compose dev local** complet (Postgres × 10 DBs, NATS, Keycloak, Meilisearch, Redis mock)
8. **CI GitHub Actions** : workflow PR (lint + typecheck + tests affected + Lighthouse 4 apps)
9. **Helm charts K8s** : déploiement core-api / workers / nats sur Hetzner
10. **Observability stack** : Grafana Cloud + agents OpenTelemetry dans les 10 services
11. **Premier service fonctionnel** : `identity-svc` avec Keycloak intégration + health checks
12. **Première app fonctionnelle** : `apps/public/` avec homepage + search + Plausible/PostHog setup

#### Cross-Component Dependencies

- **Cloud provider K8s** ↔ **Postgres hosting** : Hetzner → Neon (ADR-015 a depuis pivoté vers DigitalOcean Droplets + Postgres in-droplet)
- **`@tukio/contracts`** est dépendance partagée par les 10 services + 3 frontends → versioning rigoureux
- **`@tukio/messaging`** dépend de NATS JetStream → tous les services le consomment
- **`@tukio/auth`** (backend) + **`@tukio/auth-client`** (frontend) → cohérence cookies session via `Domain=.tukio.one`
- **`@tukio/ui`** consommé par les 3 apps → toute modification UI déclenche rebuild des 3 apps (Turborepo affected-builds gère)
- **`@tukio/api-client`** dépend de `@tukio/contracts` → types end-to-end frontend ↔ backend
- **Topology frontend (ADR-016)** : `apps/public/` est servie sur l'apex `tukio.one` avec un rewrite résiduel vers `seller.tukio.one` pour les routes `/seller/*`. `apps/admin/` reste isolée sur `admin.tukio.one`.
- **Stripe webhooks** → `payment-svc` uniquement → events NATS dérivés consommés par `booking-svc`, `order-svc`, `notification-svc`, `identity-svc`
- **Keycloak webhooks** → `identity-svc` uniquement → events NATS dérivés consommés par les autres services

## Implementation Patterns & Consistency Rules

> **Rule book pour tous les dev agents** (humains + IA). Toute PR qui viole ces règles doit être rejetée en code review. Lint rules enforcent ces patterns autant que possible (cf. `eslint-plugin-boundaries` + custom rules).

### Pattern Categories Defined

**Critical conflict points identified** : 47 règles consolidées sur 6 catégories (naming, structure, format, communication, process, observability).

Référence canonique des conventions Tukio préexistantes :
- `tukio_information_architecture.md` §A (Convention technique globale)
- PRD §Conventions, §Naming, §Functional Requirements, §Non-Functional Requirements
- `tukio_event_catalog.md` (ground truth events NATS, ~50 events)
- `tukio_product_tech_alignment.md` §C (Naming alignment)

**Nouvelles ADRs ajoutées dans cette session architecture (à formaliser au Step 7)** :
- ADR-013 — Frontend multi-zones 4 apps + architecture feature-based stricte (Step 4) — **superseded by ADR-016 (2026-05-15)**
- ADR-014 — Enveloppe REST canonique sur toutes les responses gateway-api (cf. §Format Patterns ci-dessous)
- **ADR-015 — MVP infra pivot 2026-05-14** : DigitalOcean Droplets + docker-compose remplacent Hetzner+K8s+ArgoCD. Drop Vercel Turbo Cache, Codecov SaaS, Neon Postgres serverless, Doppler, Grafana Cloud, OpenTelemetry SDK auto-instrumentation, Velero. Garde Cloudflare R2 (storage gratuit < 10 GB), Resend (3000 emails/mois free), Stripe Connect, GHCR, Trivy, Lighthouse CI App. DNS sur Squarespace (NS non délégables vers Cloudflare). Budget cible €15-35/mois total. Voir mémoire `mvp_infra_pivot_2026_05_14.md` pour la liste exhaustive des outils dropped/remplacés et le contexte. Story 0.12 (Helm+K8s+ArgoCD) **superseded** — nouvelle Story 0.12 = DO Droplets + docker-compose. Re-évaluation possible en V1+ quand le volume justifie K8s (croissance trafic > 100k req/jour, équipe > 3 devs, besoin rolling deploys avancés).
- **ADR-016 — Frontend topology pivot 2026-05-15** : 4 Next.js apps → **3 apps** + tunnel B2C unifié sur l'apex `tukio.one`. **Supersedes ADR-013** (multi-zones 4 apps). Décision : merger `apps/public` + `apps/customer` en une seule app servie sur `tukio.one` (apex), avec routes auth-gated via middleware Next.js (`/account`, `/bookings`, `/favorites`, etc.). Topology finale : `tukio.one` = public+customer B2C (visiteur → customer authentifié, **même domain**), `seller.tukio.one` = pros B2B, `admin.tukio.one` = staff. Subdomain `app.tukio.one` + `customer.tukio.one` retirés. **Rationale** : (a) UX cohérente (pas de jarring cross-subdomain visiteur → customer, classique des marketplaces matures Airbnb / Booking / Vinted), (b) SEO meilleur (apex > subdomain pour ranking + canonical URLs simples), (c) -1 app à maintenir (3 codebases Next.js au lieu de 4) → -1 image Docker GHCR, -200-300 MB RAM sur tukio-apps, -1 cert LE, -1 route Caddy, (d) cart/state/cookies trivialement préservés cross-page (même domain). **Coût** : refactor 1-2 jours pour merger les routes `apps/customer/*` dans `apps/public` sous structure App Router + middleware auth-gate (Story 0.14). **Conséquences sur PRD** : section "Applications" passe de 4 à 3 apps (mettre à jour avant Epic 1 dev). **Conséquences sur stories existantes** : toute story Epic 1+ qui référençait `customer.tukio.one` doit pointer vers `tukio.one/<route>` à la place (rares — surtout Epic 1 stories 1.4, 1.5, 1.6 callbacks login / verification). **Re-évaluation V1+** : si volume B2C justifie séparation app/customer (peu probable < 100k MAU), revenir au 4-apps + cookie cross-subdomain `.tukio.one`.

### Naming Patterns

#### Database Naming (PostgreSQL)

| Élément | Convention | Exemple |
|---------|------------|---------|
| Tables | `snake_case`, **pluriel** | `bookings`, `service_categories`, `listing_translations` |
| Colonnes | `snake_case` | `created_at`, `pro_id`, `acquisition_source` |
| Foreign keys | `<entity>_id` | `customer_id`, `listing_id` |
| Indexes | `idx_<table>_<columns>` | `idx_bookings_customer_id_status` |
| Unique constraints | `uq_<table>_<columns>` | `uq_users_email` |
| Check constraints | `chk_<table>_<rule>` | `chk_bookings_status_valid` |
| Migrations | `<timestamp>-<description>.ts` (TypeORM) | `1715180000000-CreateBookingsTable.ts` |

#### API Naming (REST via gateway-api)

| Élément | Convention | Exemple |
|---------|------------|---------|
| Endpoints | `kebab-case`, **pluriel**, `/v1/...` prefix | `POST /v1/bookings`, `GET /v1/listings`, `GET /v1/sales-terms` |
| Path parameters | `{id}` notation OpenAPI | `GET /v1/bookings/{id}` |
| Query parameters | `camelCase` | `?customerId=...&status=pending&fromDate=2026-06-15` |
| Custom headers | `X-Tukio-<Purpose>` | `X-Tukio-Locale`, `X-Tukio-Actor`, `X-CSRF-Token` |
| Status codes | HTTP standard strict (200, 201, 204, 400, 401, 403, 404, 409, 422, 500) | `409 Conflict` pour conflits dispo (vs 400) |
| Versioning | `/v1`, `/v2` URL prefix uniquement (pas en header) | `GET /v2/listings` |

#### NATS Event Naming

`<service>.<aggregate>.<event>.v<n>` — **lowercase**, **dots** entre tokens, **dashes** dans tokens composés.

| Pattern | Exemples |
|---------|----------|
| Service | `catalog`, `booking`, `order`, `payment`, `messaging`, `review`, `notification`, `media`, `identity` |
| Aggregate | `listing`, `booking`, `order`, `payment-intent`, `message`, `review`, `user`, `media-asset` |
| Event | `created`, `updated`, `deleted`, `published`, `accepted`, `cancelled`, `captured`, `refunded`, `failed` |
| Version | `v1`, `v2` (suffix) |

**Exemples valides** : `catalog.listing.published.v1`, `booking.requested.v1`, `payment.intent.captured.v1`, `subscription.changed.v2`, `admin.action.user-banned.v1`.

**Exemples invalides** : ❌ `BookingCreated`, ❌ `booking_created_v1`, ❌ `booking.created` (pas de version), ❌ `Booking.Created.V1` (PascalCase).

#### Code Naming (TypeScript)

| Élément | Convention | Exemple |
|---------|------------|---------|
| Variables, fonctions | `camelCase` | `createBooking`, `userId`, `isAvailable` |
| Classes | `PascalCase` | `BookingService`, `StripePaymentAdapter`, `KeycloakJwtGuard` |
| Interfaces (ports) | `IPascalCase` (préfixe `I`) | `IBookingRepository`, `IStripeService`, `IEventPublisher` |
| Types | `PascalCase` | `BookingStatus`, `Actor`, `LocalizedListing` |
| Enums | `PascalCase` valeurs `SCREAMING_SNAKE_CASE` | `enum BookingStatus { PENDING_PRO_ACCEPTANCE, CONFIRMED }` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_PHOTOS_PER_LISTING`, `DEFAULT_LOCALE`, `JWKS_CACHE_TTL_MS` |
| DI tokens (Symbols) | `SCREAMING_SNAKE_CASE` exporté | `export const BOOKING_REPOSITORY = Symbol('BookingRepository')` |
| Files components React | `PascalCase.tsx` | `ServiceCard.tsx`, `BookingForm.tsx` |
| Files hooks/utils | `camelCase.ts` | `useSearchListings.ts`, `formatCurrency.ts` |
| Files services backend | `<purpose>.service.ts` | `stripe.service.ts`, `meilisearch-indexer.service.ts` |
| Files entities TypeORM | `<entity>.entity.ts` | `booking.entity.ts`, `listing-translation.entity.ts` |
| Files repositories impl | `<entity>.<store>.repository.ts` | `booking.typeorm.repository.ts` |
| Files ports | `<purpose>.port.ts` | `booking.repository.port.ts`, `stripe.service.port.ts` |
| Files use cases | `<verb-object>.usecase.ts` | `accept-booking.usecase.ts`, `create-listing.usecase.ts` |
| Files DTOs | `<purpose>.dto.ts` | `create-booking.dto.ts`, `booking-response.dto.ts` |
| Files Zod schemas | `<purpose>.schema.ts` | `create-booking.schema.ts` |

#### URL Slugs (i18n)

- **Paths en EN strict** (cf. IA doc §A) — jamais `/categorie/...`, toujours `/category/...`
- **Slugs par locale** dans `<entity>_translations`, FR + EN distincts (ADR-012)
- **Locale-prefix obligatoire** : `/{fr|en}/...`
- **Reserved slugs** stockés en table `reserved_slugs`, vérification à création

### Structure Patterns

#### Backend service structure (Pattern Pretre, ADR-001)

Référence canonique : Step 2 §Cross-Cutting Concerns #1 + `docs/tukio_booking_svc_deepdive.md` §F.

**Règle non négociable** : tout nouveau service ou nouveau use case respecte la structure exacte ci-dessous.

```
service-svc/src/
├─ domain/
│  ├─ model/                                # Aggregates, Value Objects
│  │  ├─ booking.aggregate.ts                # Aggregate root avec invariants métier
│  │  ├─ booking-status.enum.ts
│  │  └─ price.value-object.ts               # Value Object immutable
│  ├─ ports/
│  │  ├─ booking.repository.port.ts          # interface IBookingRepository
│  │  ├─ stripe.service.port.ts              # interface IStripeService
│  │  └─ tokens.ts                           # Symbol DI tokens
│  ├─ service/                               # Domain Services stateless
│  │  └─ pricing.domain-service.ts
│  └─ exception/
│     └─ booking-not-found.exception.ts
├─ usecases/
│  ├─ accept-booking.usecase.ts              # 1 classe, méthode .execute()
│  ├─ accept-booking.usecase.spec.ts         # tests co-locatés
│  └─ ...
└─ infrastructure/
   ├─ persistence/
   │  ├─ typeorm/
   │  │  ├─ booking.entity.ts
   │  │  └─ booking.typeorm.repository.ts    # implements IBookingRepository
   │  └─ queries/
   │     └─ search-bookings.query.ts         # raw SQL pour read-heavy
   ├─ messaging/
   │  └─ nats/
   │     ├─ nats.publisher.ts
   │     ├─ booking.consumer.ts              # consumer events entrants
   │     └─ outbox-relay/
   ├─ external/
   │  └─ stripe/
   │     └─ stripe.service.ts                # implements IStripeService
   ├─ http/
   │  ├─ controllers/booking.controller.ts
   │  ├─ dtos/{create-booking.dto.ts,...}
   │  └─ guards/keycloak-jwt.guard.ts
   ├─ logger/, config/, exception/
   └─ usecases-proxy/
      └─ usecases-proxy.module.ts             # DynamicModule wire ports → impls
```

#### Frontend app structure (feature-based, ADR-013)

Référence canonique : Step 4 §Frontend Architecture.

```
apps/<app>/src/
├─ app/                                      # Next.js App Router (file-based routing uniquement)
│  └─ [locale]/...
├─ features/
│  ├─ <feature>/
│  │  ├─ components/                          # composants React feature-specific
│  │  ├─ hooks/                               # hooks React custom
│  │  ├─ services/                            # client API (TanStack Query)
│  │  ├─ schemas/                             # Zod schemas (sinon viennent de @tukio/contracts)
│  │  ├─ types/
│  │  ├─ utils/
│  │  ├─ __tests__/                           # tests co-locatés par feature
│  │  └─ index.ts                             # public API barrel (limited exports)
│  └─ ...
├─ shared/                                   # cross-feature primitives
│  ├─ layouts/                                # PublicLayout, CustomerLayout, etc.
│  ├─ utils/                                  # date formatters, currency, etc.
│  └─ providers/                              # QueryProvider, IntlProvider, ThemeProvider, AuthProvider
└─ lib/                                      # configs (next-intl, posthog, plausible, sentry)
```

#### Tests location

- **Tests unitaires** : co-locatés avec le code (`booking.aggregate.ts` ↔ `booking.aggregate.spec.ts`)
- **Tests d'intégration** : `infrastructure/persistence/__tests__/booking.typeorm.repository.integration-spec.ts` (avec testcontainers)
- **Tests E2E backend** : `apps/<service>-svc/test/<feature>.e2e-spec.ts` (NestJS standard)
- **Tests E2E frontend** : `apps/<app>/e2e/<journey>.spec.ts` (Playwright)
- **Tests chaos** (saga R11) : `apps/<service>-svc/test/chaos/<saga>.chaos-spec.ts`

#### Shared libraries usage

- `@tukio/contracts` : importer **chemins spécifiques** (`@tukio/contracts/src/events/booking` plutôt que `@tukio/contracts`) pour préserver tree-shaking
- `@tukio/ui` : composants importés explicitement (`import { Button } from '@tukio/ui/button'`), pas de barrel `import * as UI from '@tukio/ui'`
- `@tukio/api-client` : hooks consommés directement (`useBookingDetail({ id })`), config TanStack Query centralisée dans le provider de l'app

### Format Patterns

#### API Response Format — Enveloppe REST canonique (ADR-014)

> **Toute response du `gateway-api` (success ET error) utilise une enveloppe REST uniforme** (décision architecture session 2026-05-08, références : [dev.to/tiguchi](https://dev.to/tiguchi/where-to-put-response-metadata---envelope-or-http-headers-4ai9), [Medium - varunkrishnan0001](https://medium.com/@varunkrishnan0001/restful-api-conventions-every-developer-should-know-772c0c3c1449)).

**Content-Type uniforme** : `application/json` sur tous les endpoints (pas de `application/problem+json` distinct pour les erreurs).

##### Success — Single object

```json
GET /v1/bookings/abc-123 → 200 OK
{
  "method": "GET",
  "code": 200,
  "data": {
    "id": "abc-123",
    "status": "confirmed",
    "customerId": "cust-456",
    "providerId": "prov-789",
    "totalAmount": { "amount": 80000, "currency": "EUR" },
    "createdAt": "2026-05-08T10:30:00Z"
  },
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "saga-uuid-xyz",
    "locale": "fr"
  }
}
```

##### Success — Collection avec pagination

```json
GET /v1/bookings?status=pending&limit=20 → 200 OK
{
  "method": "GET",
  "code": 200,
  "data": [
    { "id": "b-1", "status": "pending" },
    { "id": "b-2", "status": "pending" }
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0SWQiOiJiLTIwIn0=",
    "hasMore": true,
    "totalEstimate": 87,
    "limit": 20
  },
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "uuid-xyz",
    "locale": "fr"
  }
}
```

##### Success — Created

```json
POST /v1/bookings → 201 Created
{
  "method": "POST",
  "code": 201,
  "data": {
    "id": "new-booking-uuid",
    "status": "pending_pro_acceptance"
  },
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "saga-uuid",
    "locale": "fr"
  }
}
```

##### Success — Action sans payload

```json
POST /v1/bookings/abc-123/accept → 200 OK
{
  "method": "POST",
  "code": 200,
  "data": null,
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "saga-uuid",
    "locale": "fr"
  }
}
```

##### Error — Toute réponse 4xx / 5xx

```json
POST /v1/bookings → 409 Conflict
{
  "method": "POST",
  "code": 409,
  "error": {
    "type": "https://tukio.one/errors/booking-not-available",
    "title": "Booking slot not available",
    "detail": "The requested slot 2026-06-15 is no longer available for service xyz.",
    "instance": "/v1/bookings",
    "tukioCode": "BOOKING-CONFLICT-001"
  },
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "saga-uuid",
    "locale": "fr"
  }
}
```

##### Error — Validation Zod (avec détails de champs)

```json
POST /v1/bookings → 422 Unprocessable Entity
{
  "method": "POST",
  "code": 422,
  "error": {
    "type": "https://tukio.one/errors/validation-failed",
    "title": "Validation failed",
    "detail": "The submitted data did not match the expected schema.",
    "instance": "/v1/bookings",
    "tukioCode": "VALIDATION-FAILED-001",
    "issues": [
      {
        "path": ["totalAmount", "amount"],
        "code": "invalid_type",
        "message": "Expected number, received string"
      },
      {
        "path": ["requestedDate"],
        "code": "invalid_string",
        "message": "Invalid ISO 8601 date format"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "uuid-xyz",
    "locale": "fr"
  }
}
```

##### Règles strictes

- **`method`** = méthode HTTP de la requête (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) en MAJUSCULES
- **`code`** = HTTP status code (numérique). DOIT correspondre au code HTTP réel (redondant mais explicite pour clients ne lisant pas les headers)
- **`data`** = présent UNIQUEMENT sur success (2xx). Type variable selon endpoint : objet, array, string, number, boolean, ou `null` (pour actions sans payload)
- **`error`** = présent UNIQUEMENT sur error (4xx, 5xx). Mutuellement exclusif avec `data`
- **`pagination`** = présent UNIQUEMENT si `data` est une collection paginée (array avec cursor-based pagination active). Pas de bloc `pagination` sur single object, string, null
- **`meta`** = TOUJOURS présent. Champs obligatoires : `timestamp` (ISO 8601 UTC ms), `correlationId` (saga/trace ID), `locale` (locale réelle de la réponse). Champs optionnels : `version`, `deprecation`, `requestId`
- **JSON field naming** : `camelCase` partout dans l'enveloppe (`tukioCode`, `correlationId`, `nextCursor`)
- **Content-Type** : `application/json` pour success ET error (pas `application/problem+json`)

##### Implémentation NestJS — pattern recommandé

L'enveloppe est wrappée **automatiquement** par 2 mécanismes globaux côté `gateway-api`, transparents pour les controllers (qui retournent juste les DTOs nus).

```typescript
// 1. Interceptor global pour les responses success
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        const isCollection = Array.isArray(data);
        const envelope: SuccessEnvelope = {
          method: request.method,
          code: response.statusCode,
          data: isCollection ? data : data ?? null,
          meta: {
            timestamp: new Date().toISOString(),
            correlationId: request.correlationId,
            locale: request.locale ?? 'fr',
          },
        };

        // Pagination injectée par le service via response.locals.pagination
        if (isCollection && response.locals?.pagination) {
          envelope.pagination = response.locals.pagination;
        }

        return envelope;
      }),
    );
  }
}

// 2. Exception filter global pour les errors
@Catch()
export class EnvelopeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const { httpStatus, errorBody } = mapExceptionToError(exception);

    response.status(httpStatus).json({
      method: request.method,
      code: httpStatus,
      error: errorBody,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: request.correlationId,
        locale: request.locale ?? 'fr',
      },
    });
  }
}

// Bootstrap (gateway-api)
app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
app.useGlobalFilters(new EnvelopeExceptionFilter());
```

**Conséquence pour les controllers** : ils retournent juste les DTOs/entities/null directement, sans connaître l'enveloppe :

```typescript
@Controller('/v1/bookings')
export class BookingController {
  @Get(':id')
  async getBooking(@Param('id') id: string): Promise<BookingResponseDto> {
    const booking = await this.getBookingUseCaseProxy.getInstance().execute({ id });
    return BookingMapper.toDto(booking); // ← retour DTO nu, l'interceptor wrappe
  }

  @Get()
  async listBookings(
    @Query() query: ListBookingsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BookingResponseDto[]> {
    const result = await this.listBookingsUseCaseProxy.getInstance().execute(query);
    res.locals.pagination = {
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      totalEstimate: result.totalEstimate,
      limit: query.limit ?? 20,
    };
    return result.items.map(BookingMapper.toDto);
  }

  @Post()
  @HttpCode(201)
  async createBooking(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    const booking = await this.createBookingUseCaseProxy.getInstance().execute(dto);
    return BookingMapper.toDto(booking);
  }
}
```

#### Data Formats

| Type | Format | Exemple |
|------|--------|---------|
| Date / time | **ISO 8601 RFC 3339 UTC** (string) | `"2026-05-08T10:30:00Z"`, `"2026-06-15"` (date only) |
| Monétaire | **Object `{ amount: number_in_cents, currency: ISO_4217 }`** | `{ amount: 80000, currency: "EUR" }` (= 800,00 €) |
| Booleans | `true` / `false` JSON natifs | `"isVerified": true` |
| Null | `null` pour optional fields manquants ; **omit uniquement** si truly optional ET absence vs null porte un sens différent | `"deletedAt": null` (présent mais null) |
| UUID | string lowercase format UUID v4 | `"7a2e8f00-1234-5678-9abc-def012345678"` |
| Locale | string `BCP 47` lowercase | `"fr"`, `"en"`, `"fr-FR"` (V3+) |
| Currency | string `ISO 4217` 3 lettres uppercase | `"EUR"`, `"USD"` (V3+) |
| Phone | string `E.164` international | `"+33612345678"` (rare en backend, masqué côté gateway si non-acceptation) |
| Files / images | URL signée Cloudflare R2 (temps limité) | `"https://images.tukio.one/listing/abc-123/photo-1.webp?signature=..."` |

#### JSON Field Naming

- **`camelCase`** dans toute l'enveloppe ET les DTOs (`customerId`, `tukioCode`, `correlationId`, `nextCursor`)
- **`snake_case`** dans la DB (mapping via TypeORM `@Column({ name: 'created_at' })` → `createdAt` côté DTO)
- **Pas de mix** : un endpoint expose `customerId`, jamais `customer_id`

#### Localized Content (dans `data`)

```json
GET /v1/listings/abc-123?locale=fr → 200 OK
{
  "method": "GET",
  "code": 200,
  "data": {
    "id": "abc-123",
    "title": "Chapiteau 100m² blanc chic",
    "description": "Notre chapiteau 100m²...",
    "locale": "fr",
    "availableLocales": ["fr", "en"]
  },
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "uuid-xyz",
    "locale": "fr"
  }
}
```

Si la locale demandée n'est pas disponible, le backend sert un fallback FR avec un flag explicite dans `data` :

```json
GET /v1/listings/xyz-999?locale=en → 200 OK
{
  "method": "GET",
  "code": 200,
  "data": {
    "id": "xyz-999",
    "title": "Tente de jardin 50m²",
    "locale": "fr",
    "requestedLocale": "en",
    "fallbackUsed": true,
    "availableLocales": ["fr"]
  },
  "meta": {
    "timestamp": "2026-05-08T10:30:00.123Z",
    "correlationId": "uuid-xyz",
    "locale": "fr"
  }
}
```

### Communication Patterns

#### Event Payload Structure (NATS)

Tous les events suivent un **enveloppe standard** + payload spécifique.

```json
{
  "eventId": "evt-uuid",
  "eventType": "booking.requested.v1",
  "eventVersion": "v1",
  "occurredAt": "2026-05-08T10:30:00Z",
  "correlationId": "saga-uuid",
  "causationId": "evt-parent-uuid",
  "actor": {
    "userId": "kc-uuid",
    "role": "client",
    "locale": "fr"
  },
  "aggregate": {
    "type": "booking",
    "id": "booking-abc-123"
  },
  "payload": {
    "customerId": "cust-456",
    "listingId": "listing-789",
    "requestedDate": "2026-06-15",
    "totalAmount": { "amount": 80000, "currency": "EUR" }
  }
}
```

**JSON Schema versionné** dans `@tukio/contracts/src/events/<service>/<event>.v<n>.schema.json`.

#### Saga Correlation

- `correlationId` propagé à travers tous les events d'une même saga (de `booking.requested.v1` → `payment.intent.captured.v1` → `booking.confirmed.v1`)
- Initialisé par le service producteur initial (booking-svc à la création d'une demande)
- Header HTTP `X-Tukio-Correlation-Id` propagé inter-services synchrones
- Logs centralisés indexés par `correlationId` pour reconstruction d'état distribuée (R11 mitigation)

#### State Update Patterns (Frontend)

- **Immutable updates** uniquement (pas de mutation directe)
- **TanStack Query** mutations : optimistic updates avec rollback automatique en cas d'erreur
- **Zustand** : `set((state) => ({ ...state, locale: 'en' }))` style spread, jamais de mutation directe sur les slices
- **React state** : `useState`/`useReducer` natifs, jamais de mutation de référence

#### Action Naming

- **Verbs in present tense** : `createBooking`, `acceptBooking`, `cancelBooking`
- **Use case classes** suivent le pattern `<Verb><Object>UseCase` : `AcceptBookingUseCase`, `CreateListingUseCase`, `RefundPaymentUseCase`
- **TanStack Query mutations** : `useCreateBooking`, `useAcceptBooking`
- **NATS events** : passé composé : `created`, `accepted`, `cancelled`, `failed`

### Process Patterns

#### Error Handling Standards

**Backend (NestJS)** :

```typescript
// Domain layer - pure exceptions, sans dépendance NestJS
export class BookingNotAvailableException extends DomainException {
  readonly tukioCode = 'BOOKING-CONFLICT-001';
  readonly httpStatus = 409;
  readonly title = 'Booking slot not available';

  constructor(public readonly slotDate: string, public readonly listingId: string) {
    super(`Booking slot not available for listing ${listingId} on ${slotDate}`);
  }
}

// Use case - throw l'exception domain
class CreateBookingUseCase {
  async execute(input) {
    if (!isAvailable) {
      throw new BookingNotAvailableException(input.date, input.listingId);
    }
  }
}

// Infrastructure HTTP - exception filter mappe domain → enveloppe REST (ADR-014)
@Catch()
export class EnvelopeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const { httpStatus, errorBody } = mapExceptionToError(exception);

    response.status(httpStatus).json({
      method: request.method,
      code: httpStatus,
      error: errorBody, // { type, title, detail, instance, tukioCode, ... }
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: request.correlationId,
        locale: request.locale ?? 'fr',
      },
    });
  }
}
```

**Frontend (React + TanStack Query)** :

```typescript
// Toast pour erreurs ponctuelles (mutations)
const mutation = useCreateBooking();
mutation.mutate(data, {
  onError: (envelope) => {
    // envelope = { method, code, error: { tukioCode, ... }, meta }
    if (envelope.error.tukioCode === 'BOOKING-CONFLICT-001') {
      toast.error(t('booking.errors.notAvailable'));
    } else {
      toast.error(t('common.errors.generic'));
    }
  },
});

// ErrorBoundary pour erreurs catastrophiques (rendering)
<ErrorBoundary fallback={<ErrorPage />}>
  <BookingFlow />
</ErrorBoundary>

// Inline form errors (validation 422 — utilise envelope.error.issues)
<FormField error={errors.date?.message}>...</FormField>
```

#### Error Codes Catalog (initialisé Sprint 0, étendu par feature)

`<DOMAIN>-<CATEGORY>-<NNN>` :

| Domaine | Codes initiaux |
|---------|----------------|
| `AUTH` | `AUTH-FORBIDDEN-001`, `AUTH-NOT-AUTHENTICATED-002`, `AUTH-MFA-REQUIRED-003`, `AUTH-EMAIL-NOT-VERIFIED-004` |
| `BOOKING` | `BOOKING-NOT-FOUND-001`, `BOOKING-CONFLICT-001`, `BOOKING-CANNOT-CANCEL-002`, `BOOKING-PAST-EVENT-003` |
| `PAYMENT` | `PAYMENT-REFUSED-001`, `PAYMENT-3DS-REQUIRED-002`, `PAYMENT-REFUND-FAILED-003`, `PAYMENT-DISPUTE-OPEN-004` |
| `LISTING` | `LISTING-NOT-FOUND-001`, `LISTING-PHOTOS-INSUFFICIENT-002`, `LISTING-PRICE-OUT-OF-RANGE-003` |
| `KYC` | `KYC-DOCS-MISSING-001`, `KYC-VERIFICATION-PENDING-002`, `KYC-REJECTED-003` |
| `RBAC` | `RBAC-ROLE-INSUFFICIENT-001`, `RBAC-RESOURCE-NOT-OWNED-002` |
| `RATE-LIMIT` | `RATE-LIMIT-EXCEEDED-001` |
| `VALIDATION` | `VALIDATION-FAILED-001` (avec détails Zod dans `error.issues`) |

#### Loading State Conventions

- **Backend** : pas de "loading state" stocké côté backend, c'est un concept frontend
- **Frontend** : utiliser les flags TanStack Query natifs :
  - `isPending` (premier load, pas de data précédente)
  - `isFetching` (refresh, data précédente disponible)
  - `isMutating` (sur mutations)
  - `isError`, `isSuccess`
- **UI loading patterns** (cf. design brief §D.8) :
  - **Skeleton screens** : pages qui chargent (preview structure)
  - **Spinners** : actions courtes (validation form, paiement)
  - **Progress bars** : actions longues à progression connue (upload)
  - **Pas de loader** si action < 300 ms (évite flicker)

#### Authentication Flow

1. User non authentifié hit `/{locale}/account/...` ou `/{locale}/seller/...`
2. Middleware `KeycloakAuthMiddleware` détecte absence de cookie `tukio-access-token`
3. Redirect vers `auth.tukio.one/realms/tukio/protocol/openid-connect/auth?...`
4. User auth Keycloak → callback `/{locale}/auth/callback?code=...&state=...`
5. Backend (gateway-api) échange code → tokens, set cookie `tukio-access-token` `Domain=.tukio.one`
6. Redirect vers la page initialement demandée

#### Validation Flow

```
User input (formulaire) →
  React Hook Form + Zod resolver (côté frontend, schema partagé via @tukio/contracts) →
    Submit POST /v1/... →
      gateway-api guard KeycloakJwtGuard →
        DTO validation Zod (NestJS pipe) →
          UseCase execute (validation domain via aggregate invariants) →
            Repository / external service →
              Event NATS publish (outbox)
```

**Validations idempotentes** :
- **Frontend** : validation immédiate (UX), feedback instantané
- **Backend** : validation **autoritative** (source de vérité, ne fait jamais confiance au frontend)
- **Domain** : invariants métier (`booking.canBeAccepted()`, `listing.canBePublished()`)

### Observability Patterns

#### Logging Format (structured JSON)

Tous les logs applicatifs sont émis en JSON structuré, ingérés par Loki :

```json
{
  "timestamp": "2026-05-08T10:30:00.123Z",
  "level": "info|warn|error|debug",
  "service": "booking-svc",
  "version": "1.2.3",
  "correlationId": "saga-uuid",
  "actor": { "userId": "kc-uuid", "role": "pro" },
  "message": "Booking accepted",
  "metadata": {
    "bookingId": "abc-123",
    "durationMs": 145
  }
}
```

**PII redaction** systématique sur `metadata` côté `gateway-api` et `notification-svc`.

#### Trace Correlation

- **Span** par use case backend, par mutation/query frontend
- `traceparent` header W3C propagé inter-services synchrones
- `correlationId` (saga) ↔ `traceId` (OpenTelemetry) : peuvent être identiques pour les sagas synchrones initiées par une requête HTTP

#### Metrics Naming (Prometheus)

`tukio_<service>_<metric>_<unit>` lowercase, snake_case :

- `tukio_gateway_api_http_requests_total{method,route,status}` (counter)
- `tukio_gateway_api_http_request_duration_seconds{method,route}` (histogram)
- `tukio_booking_svc_saga_duration_seconds{outcome}` (histogram)
- `tukio_payment_svc_stripe_payment_intent_total{status}` (counter)
- `tukio_messaging_svc_websocket_connections{role}` (gauge)
- `tukio_nats_consumer_lag_messages{stream,consumer}` (gauge)

### Enforcement Guidelines

**All AI Agents (humains + IA) MUST** :

1. **Suivre les conventions de nommage** ci-dessus sans exception. Lint rules + code review enforcement.
2. **Respecter le pattern Pretre** : interfaces dans `domain/ports/`, implémentations dans `infrastructure/`. Lint `eslint-plugin-boundaries` enforce.
3. **Utiliser les libs partagées** (`@tukio/contracts`, `@tukio/messaging`, `@tukio/auth`, `@tukio/ui`, etc.) plutôt que de réimplémenter.
4. **Versionner les events NATS** dès le premier event publié (`v1` suffix obligatoire).
5. **Émettre les events via outbox**, jamais en direct (cohérence transactionnelle DB ↔ NATS).
6. **Servir toutes les responses HTTP dans l'enveloppe REST canonique** (ADR-014) — l'interceptor + exception filter le font automatiquement, ne pas le contourner.
7. **Tracer toutes les actions admin sensibles** dans le journal immuable via event `admin.action.*.v1`.
8. **Externaliser tous les strings UI** dans `messages/{fr,en}.json` (zéro hardcodé frontend, NFR56-57).
9. **Tester** : 80 % coverage `domain/`, 70 % `usecases/`, 50 % `infrastructure/` (NFR71).
10. **Migrations DB backward-compatible** uniquement (NFR83), avec rollback testé (NFR72).

**Pattern Enforcement Mechanisms** :

- **Lint rules** :
  - `eslint-plugin-boundaries` : pattern Pretre (domain/usecases/infrastructure) + features frontend
  - Custom rules :
    - `tukio/no-fr-paths` : interdit les paths URL en FR
    - `tukio/no-hardcoded-text` : detect strings UI hardcodés dans les composants React (utiliser `useTranslations`)
    - `tukio/event-naming` : valide format `<service>.<aggregate>.<event>.v<n>` sur les NATS publish
    - `tukio/error-code-format` : valide format `<DOMAIN>-<CATEGORY>-<NNN>`
    - `tukio/no-class-validator` : interdit `class-validator` (utiliser Zod)
    - `tukio/no-buyer` : interdit le terme `buyer` en code (utiliser `customer`)
    - `tukio/no-bypass-envelope` : detect controllers qui retournent `response.json(...)` directement (doivent retourner DTO nu)
- **Pre-commit hooks** (Husky + lint-staged) : lint + format + typecheck sur les fichiers staged
- **CI gates** :
  - lint + typecheck obligatoires
  - tests unitaires obligatoires
  - coverage minimum (cf. NFR71)
  - Lighthouse CI ≥ 90 sur les 4 apps frontend (perf + accessibility)
  - tests Playwright + axe-core sur parcours critiques
  - tests chaos sur saga (R11)
- **Code review checklist** :
  - Domain layer pollué par dépendance externe ?
  - Repository sans interface dans `domain/ports/` ?
  - External service hardcodé dans use case ?
  - Texte hardcodé dans composant React ?
  - Path URL en FR ?
  - Event sans suffix `v<n>` ?
  - Error sans code Tukio ?
  - Migration sans rollback ?
  - Response qui bypass l'enveloppe REST ?

**Documentation des violations** :
- Chaque violation documentée dans une **PR comment** avec lien vers cette section
- Si exception justifiée : ADR à créer dans `docs/adr/` pour officialiser l'écart au pattern

**Process pour mettre à jour ces patterns** :
- Toute proposition d'évolution de pattern → ADR à proposer en PR
- Discussion ouverte (au moins 2 reviewers) avant merge
- Migration de tout le code existant vers le nouveau pattern dans la même PR (ou ADR de migration séquentielle si trop volumineux)

### Pattern Examples

#### Good Examples — Repository Pattern

```typescript
// ✅ domain/ports/booking.repository.port.ts
export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  save(booking: Booking): Promise<void>;
  findByCustomerIdAndStatus(customerId: string, status: BookingStatus): Promise<Booking[]>;
}

export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');

// ✅ infrastructure/persistence/typeorm/booking.typeorm.repository.ts
@Injectable()
export class BookingTypeormRepository implements IBookingRepository {
  constructor(
    @InjectRepository(BookingEntity) private readonly repo: Repository<BookingEntity>,
  ) {}

  async findById(id: string): Promise<Booking | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? BookingMapper.toDomain(entity) : null;
  }
}

// ✅ usecases/accept-booking.usecase.ts
@Injectable()
export class AcceptBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookingRepo: IBookingRepository,
    @Inject(STRIPE_SERVICE) private readonly stripeService: IStripeService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: AcceptBookingInput): Promise<AcceptBookingOutput> {
    const booking = await this.bookingRepo.findById(input.bookingId);
    if (!booking) throw new BookingNotFoundException(input.bookingId);

    booking.accept(); // domain invariants checked here
    await this.bookingRepo.save(booking);

    const captureResult = await this.stripeService.capturePaymentIntent(
      booking.paymentIntentId,
    );

    await this.eventPublisher.publish(new BookingAcceptedEvent(booking));
    return { booking };
  }
}
```

#### Anti-Patterns — À ne JAMAIS faire

```typescript
// ❌ Use case qui import directement TypeORM (pollution domain)
import { Repository } from 'typeorm';
class AcceptBookingUseCase {
  constructor(@InjectRepository(BookingEntity) private repo: Repository<BookingEntity>) {} // ❌
}

// ❌ Use case qui import directement Stripe SDK (pollution domain)
import Stripe from 'stripe';
class AcceptBookingUseCase {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // ❌
}

// ❌ Texte hardcodé dans composant frontend (NFR56)
function BookingButton() {
  return <button>Réserver maintenant</button>; // ❌ doit utiliser useTranslations
}

// ❌ Path URL en français (NFR58 + IA doc §A)
<Link href="/fr/categorie/chapiteaux">...</Link> // ❌ doit être /fr/category/...

// ❌ Event sans version
publisher.publish('booking.created', payload); // ❌ doit être 'booking.created.v1'

// ❌ Event camelCase ou PascalCase
publisher.publish('BookingCreated', payload); // ❌ doit être lowercase + dots

// ❌ Repository sans interface (couplage direct concrete)
class AcceptBookingUseCase {
  constructor(private readonly bookingRepo: BookingTypeormRepository) {} // ❌
  // doit être : constructor(@Inject(BOOKING_REPOSITORY) private readonly bookingRepo: IBookingRepository)
}

// ❌ Validation côté serveur via class-validator (utiliser Zod)
import { IsUUID, IsString } from 'class-validator';
class CreateBookingDto {
  @IsUUID() customerId: string; // ❌ doit être Zod schema
  @IsString() title: string;
}

// ❌ Buyer en code (cf. PRD §Conventions)
async findBookingsByBuyer(buyerId: string) {} // ❌ doit être customerId

// ❌ Controller qui retourne directement un body (bypass enveloppe REST ADR-014)
@Controller('/v1/bookings')
class BookingController {
  @Get(':id')
  async getBooking(@Res() res: Response) {
    return res.json({ id: '...', status: '...' }); // ❌ bypass interceptor, casse contrat envelope
  }
}
// doit être : retour DTO nu, l'interceptor wrappe automatiquement

// ❌ Erreur servie en application/problem+json
response
  .status(409)
  .header('Content-Type', 'application/problem+json') // ❌ utiliser application/json + envelope
  .json({ type, title, detail });

// ❌ data ET error simultanément
{
  "method": "POST",
  "code": 409,
  "data": null,
  "error": { ... }   // ❌ exclusif : data ou error, pas les deux
}

// ❌ pagination sur single object response
GET /v1/bookings/abc-123 → 200
{
  "method": "GET",
  "code": 200,
  "data": { "id": "abc-123" },
  "pagination": { ... }  // ❌ pas de pagination sur single object
}

// ❌ code qui ne match pas le HTTP status réel
HTTP 200 OK
{ "method": "GET", "code": 404, "data": null }  // ❌ incohérent
```

## Project Structure & Boundaries

### Complete Project Directory Structure

Monorepo Turborepo `tukio/` racine. **14 codebases distinctes** (4 frontend + 10 backend) + **8 libs partagées** + **infra** + **docs**. Pattern Pretre strict côté backend, feature-based strict côté frontend.

```
tukio/                                                 # monorepo racine
├─ README.md                                           # vision projet, getting started, links
├─ package.json                                        # workspace root, scripts Turborepo
├─ pnpm-workspace.yaml                                 # workspaces : apps/*, packages/*
├─ turbo.json                                          # pipelines build/test/lint affected
├─ tsconfig.base.json                                  # tsconfig partagé (TS strict)
├─ .nvmrc                                              # Node.js version (LTS 22.x)
├─ .gitignore
├─ .editorconfig
├─ .prettierrc.json
├─ .eslintrc.cjs                                       # ESLint config racine + boundaries
├─ commitlint.config.cjs                               # conventional commits enforcement
├─ .husky/                                             # pre-commit hooks (lint, typecheck, format)
│  ├─ pre-commit
│  └─ commit-msg
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                                        # lint + typecheck + tests affected (PR)
│     ├─ build-images.yml                              # build & push Docker images → ghcr.io (merge main)
│     ├─ deploy-staging.yml                            # ArgoCD trigger staging (merge main)
│     ├─ deploy-production.yml                         # ArgoCD trigger prod (tag v*)
│     └─ lighthouse-ci.yml                             # Lighthouse + a11y sur 4 apps frontend
│
├─ apps/                                               # ====== APPS DÉPLOYABLES ======
│  ├─ public/                                          # Frontend public Next.js (zone parent multi-zones)
│  ├─ customer/                                        # Frontend customer (role: client)
│  ├─ seller/                                          # Frontend seller (role: pro)
│  ├─ admin/                                           # Frontend admin (admin.tukio.one)
│  ├─ gateway-api/                                     # BFF NestJS (point d'entrée public unique)
│  ├─ identity-svc/                                    # User & identity management (FR1-17)
│  ├─ catalog-svc/                                     # Catalog & discovery (FR18-33)
│  ├─ booking-svc/                                     # Booking lifecycle (FR34-48)
│  ├─ order-svc/                                       # Order, cart, invoicing (FR35, FR49-FR55, FR64)
│  ├─ payment-svc/                                     # Payments & subscriptions (FR49-66, R1, R11)
│  ├─ messaging-svc/                                   # Chat (FR67-74)
│  ├─ review-svc/                                      # Reviews & reputation (FR75-82)
│  ├─ notification-svc/                                # Notifications (FR117-125)
│  └─ media-svc/                                       # Media handling (uploads R2)
│
├─ packages/                                           # ====== LIBS PARTAGÉES (8) ======
│  ├─ contracts/                                       # @tukio/contracts (events JSON Schemas + DTOs Zod + envelope types)
│  ├─ messaging/                                       # @tukio/messaging (NATS JetStream + outbox/inbox helpers)
│  ├─ auth/                                            # @tukio/auth (KeycloakJwtGuard + Roles decorator backend)
│  ├─ testing/                                         # @tukio/testing (testcontainers + chaos helpers + fixtures)
│  ├─ ui/                                              # @tukio/ui (shadcn/ui + design tokens terracotta)
│  ├─ api-client/                                      # @tukio/api-client (TanStack Query hooks typés)
│  ├─ i18n-client/                                     # @tukio/i18n-client (next-intl shared config)
│  └─ auth-client/                                     # @tukio/auth-client (Keycloak client adapter frontend)
│
├─ infra/                                              # ====== INFRASTRUCTURE AS CODE ======
│  ├─ terraform/                                       # Hetzner K8s + Neon + Upstash + Grafana + Doppler
│  ├─ k8s/
│  │  ├─ helm-charts/{core-api,workers,nats,tukio-stack}/
│  │  ├─ argocd/applications/
│  │  └─ network-policies/
│  ├─ docker-compose/{docker-compose.dev.yml,docker-compose.test.yml}
│  └─ scripts/{bootstrap-keycloak-realm,bootstrap-databases,seed-categories,run-chaos-tests}.sh
│
├─ docs/                                               # ====== DOCUMENTATION ======
│  ├─ adr/                                             # 14 ADRs au démarrage (0001 à 0014) + template
│  ├─ tukio_*.md                                       # 16 docs source consolidés (spec, deep dives, UX flows, IA, etc.)
│  ├─ project-context.md                               # généré post-Sprint 0
│  └─ runbook/{saga-replay,stripe-dispute-handling,rgpd-erase-request,disaster-recovery,on-call}.md
│
├─ _bmad-output/                                       # ====== BMad Method artifacts ======
│  ├─ planning-artifacts/{product-brief,prd,architecture,distillate}.md
│  ├─ implementation-artifacts/                        # epics, stories, sprint plans
│  └─ test-artifacts/                                  # rapports tests automatisés
│
└─ _bmad/                                              # ====== BMad config ======
   ├─ bmm/config.yaml
   ├─ scripts/                                         # custom scripts BMad
   └─ custom/                                          # overrides team/user
```

#### Détail apps frontend (Next.js 15 App Router + feature-based)

Chaque app suit la même structure macro. Exemple `apps/public/` (zone parent) :

```
apps/public/
├─ package.json
├─ next.config.ts                                      # Vercel multi-zones rewrites (zone parent)
├─ tailwind.config.ts                                  # tokens terracotta + Fraunces
├─ tsconfig.json
├─ middleware.ts                                       # next-intl + détection locale
├─ messages/{fr.json,en.json}                          # strings UI (zéro hardcoded)
├─ public/                                             # static assets (favicon, robots.txt, sitemap.xml, manifest.json)
└─ src/
   ├─ app/[locale]/                                    # Next.js App Router locale-prefixed
   │  ├─ layout.tsx
   │  ├─ page.tsx                                      # /{locale}/
   │  ├─ search/page.tsx                               # /{locale}/search
   │  ├─ category/[slug]/page.tsx
   │  ├─ category/[slug]/[city]/page.tsx              # V1
   │  ├─ service/[slug]/page.tsx
   │  ├─ pro/[slug]/page.tsx
   │  ├─ blog/{page.tsx,[slug]/page.tsx}
   │  ├─ (legal)/{terms,privacy,cookies,legal,sales-terms}/page.tsx
   │  ├─ (marketing)/{sell,pricing,about,contact}/page.tsx
   │  └─ help/{page.tsx,[category]/page.tsx,[category]/[article]/page.tsx}
   ├─ features/                                        # ← FEATURE-BASED stricte
   │  ├─ home/{components,hooks,services,index.ts}
   │  ├─ search/{components,hooks,services,schemas,index.ts}
   │  ├─ catalog/
   │  ├─ service-detail/
   │  ├─ pro-profile/
   │  ├─ blog/
   │  ├─ legal/
   │  └─ marketing/
   ├─ shared/
   │  ├─ layouts/PublicLayout.tsx
   │  ├─ utils/
   │  └─ providers/{QueryProvider,IntlProvider,ThemeProvider}.tsx
   └─ lib/
      ├─ next-intl.config.ts
      ├─ posthog.client.ts
      ├─ plausible.tsx
      └─ schema-org/{Service,LocalBusiness,BreadcrumbList,AggregateRating}.tsx
```

`apps/customer/` ajoute `app/[locale]/{account,cart}/...` + features `{dashboard,bookings,cart-checkout,messages,favorites,quotes,billing,profile,reviews}/`. `apps/seller/` ajoute `app/[locale]/seller/...` + features `{dashboard,onboarding,services,bookings,quotes,messages,calendar,reviews,analytics,billing,subscription,team,settings}/`. `apps/admin/` ajoute `app/[locale]/{users,verifications,catalog,transactions,reports,finance,communication,analytics,support,config,audit}/...` + features correspondantes.

#### Détail services backend (NestJS 11 + pattern Pretre strict)

Chaque service suit la même structure macro. Exemple `apps/booking-svc/` :

```
apps/booking-svc/
├─ package.json, nest-cli.json, tsconfig.json, tsconfig.build.json, Dockerfile, .env.example
└─ src/
   ├─ main.ts
   ├─ app.module.ts
   ├─ domain/                                          # AUCUNE dépendance NestJS / TypeORM / SDK tiers
   │  ├─ model/{booking.aggregate.ts,booking-status.enum.ts,cancellation-policy.value-object.ts,availability-conflict.value-object.ts}
   │  ├─ ports/{booking.repository.port.ts,catalog-availability.port.ts,event-publisher.port.ts,payment-saga-coordinator.port.ts,tokens.ts}
   │  ├─ service/{cancellation-policy.domain-service.ts,booking-state-machine.domain-service.ts}
   │  └─ exception/{booking-not-found,booking-conflict,cannot-cancel-past,unauthorized-actor}.exception.ts
   ├─ usecases/                                        # 1 classe par use case
   │  ├─ create-booking.usecase.ts
   │  ├─ accept-booking.usecase.ts
   │  ├─ refuse-booking.usecase.ts
   │  ├─ confirm-booking.usecase.ts
   │  ├─ cancel-booking.usecase.ts
   │  ├─ modify-booking.usecase.ts                     # V1
   │  └─ request-quote.usecase.ts                      # V1
   └─ infrastructure/                                  # IMPLEMENTATIONS concrètes
      ├─ persistence/typeorm/
      │  ├─ entities/{booking.entity.ts,booking-status-transition.entity.ts,outbox.entity.ts,inbox.entity.ts}
      │  ├─ repositories/booking.typeorm.repository.ts # implements IBookingRepository
      │  └─ migrations/
      ├─ messaging/nats/
      │  ├─ booking.publisher.ts                       # implements IEventPublisher
      │  ├─ payment-events.consumer.ts                 # consume payment.intent.captured.v1
      │  ├─ review-events.consumer.ts
      │  └─ outbox-relay/                              # PG LISTEN/NOTIFY → NATS publish
      ├─ external/
      │  ├─ catalog-svc/catalog-availability.client.ts # SEUL appel HTTP downstream autorisé (exception ADR)
      │  └─ redis/availability-lock.service.ts         # 3 layers race conditions PRD §FR48
      ├─ http/
      │  ├─ controllers/booking.controller.ts
      │  ├─ dtos/                                      # DTOs Zod (depuis @tukio/contracts)
      │  └─ guards/keycloak-jwt.guard.ts
      ├─ logger/, config/, exception/
      └─ usecases-proxy/usecases-proxy.module.ts        # DynamicModule wire ports → impls
```

Tous les autres services (`identity-svc`, `catalog-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`) suivent **strictement** la même structure (`domain/usecases/infrastructure/usecases-proxy/`), avec des aggregates et ports propres au domaine du service. Référence canonique : `docs/tukio_booking_svc_deepdive.md` §F.

#### Détail libs partagées (`packages/`)

```
packages/contracts/src/
├─ events/
│  ├─ identity/{user-registered,pro-verified,subscription-changed,...}.v1.{schema.json,ts}
│  ├─ catalog/{listing-published,listing-updated,category-created,...}.v1.{schema.json,ts}
│  ├─ booking/{booking-requested,booking-accepted,booking-confirmed,booking-cancelled,...}.v1.{schema.json,ts}
│  ├─ order/{order-created,invoice-issued,...}.v1.{schema.json,ts}
│  ├─ payment/{payment-intent-captured,refund-issued,subscription-changed,dispute-opened,...}.v1.{schema.json,ts}
│  ├─ messaging/{message-sent,redaction-detected,...}.v1.{schema.json,ts}
│  ├─ review/{review-submitted,review-aggregated,...}.v1.{schema.json,ts}
│  ├─ notification/{notification-sent,...}.v1.{schema.json,ts}
│  ├─ media/{media-uploaded,virus-detected,...}.v1.{schema.json,ts}
│  └─ admin/{admin-action-pro-verified,admin-action-user-banned,admin-action-event-replayed,...}.v1.{schema.json,ts}
├─ dtos/{booking,catalog,order,payment,...}/*.dto.ts
├─ envelope/{success-envelope,error-envelope,pagination,meta}.ts                   # types ADR-014
├─ regex-rules.ts                                                                  # config anti-désintermédiation centralisée
├─ types/{Actor,Locale,Currency,DomainEvent,Money,...}.ts
└─ index.ts

packages/messaging/src/
├─ nats-jetstream-client.ts                                                        # wrapper @horizon-republic/nestjs-jetstream
├─ outbox-publisher.ts                                                             # PG LISTEN/NOTIFY relay
├─ inbox-consumer.ts                                                               # idempotence handler
├─ correlation-context.ts                                                          # propagation correlationId
├─ event-versioning.ts                                                             # helpers v1/v2 coexistence
└─ index.ts

packages/auth/src/                                                                  # backend
├─ keycloak-jwt.guard.ts
├─ roles.decorator.ts + roles.guard.ts
├─ jwks-cache.service.ts
├─ actor-resolver.ts
└─ types/{Actor,Role}.ts

packages/testing/src/
├─ testcontainers/{postgres,nats,redis,keycloak,meilisearch}.helper.ts
├─ chaos/{nats-disconnect,db-failure,saga-partial-failure}.helper.ts
├─ fixtures/{user,listing,booking,order,payment,review}.fixture.ts
└─ matchers/

packages/ui/src/                                                                   # consommé par les 4 frontends
├─ components/{Button,Input,Modal,Toast,Card,Avatar,Badge,Calendar,FilterSidebar,...}/
├─ tokens/{colors,typography,spacing,breakpoints,shadows,radii}.ts
├─ icons/                                                                          # Lucide re-exports + custom événementiels SVG
├─ patterns/{ConversationThread,ReviewsDisplay,PricingDisplay,QuantitySelector,Map,FileUpload,StepIndicator}/
├─ providers/ThemeProvider.tsx
└─ tailwind-preset.ts                                                              # preset partagé pour les 4 apps

packages/api-client/src/                                                           # TanStack Query hooks typés
├─ client.ts                                                                       # axios instance + envelope unwrapping
├─ envelope-handler.ts                                                             # extract data from envelope ADR-014
├─ hooks/
│  ├─ catalog/{useSearchListings,useListingDetail,useCategoryTree,useProProfile}.ts
│  ├─ booking/{useCreateBooking,useBookingDetail,useListBookings,useAcceptBooking,useCancelBooking}.ts
│  ├─ payment/{useCheckout,useSavedCards,useInvoices,usePayouts,useSubscription}.ts
│  ├─ messaging/{useConversations,useSendMessage}.ts
│  ├─ review/{useSubmitReview,useReviews}.ts
│  ├─ identity/{useProfile,useUpdateProfile,useNotificationPreferences}.ts
│  └─ admin/{useVerifications,useDisputes,useAuditTrail,useReplayEvent,useImpersonate}.ts
└─ types/{ApiError,QueryKeys}.ts

packages/i18n-client/src/                                                          # next-intl shared
├─ config.ts                                                                       # locales: ['fr', 'en'], fallback fr
├─ middleware.ts                                                                   # next-intl middleware partagé entre 4 apps
├─ formatters/{date,number,currency,relativeTime}.ts
└─ hreflang.tsx                                                                    # composant hreflang

packages/auth-client/src/                                                          # Keycloak frontend
├─ keycloak-client.ts                                                              # init Keycloak adapter
├─ refresh-token-rotation.ts
├─ cookie-manager.ts                                                               # Domain=.tukio.one
├─ hooks/{useAuth,useRole,useRequireRole,useLogout}.ts
└─ middleware-helpers.ts                                                           # KeycloakAuthMiddleware shared
```

### Architectural Boundaries

#### API Boundaries

**Surface publique unique** : `gateway-api` (ADR-008) — port 443 Internet, hébergé Hetzner K8s ingress.

```
                    ┌──────────────────────────────────────────────┐
                    │             Internet (HTTPS/TLS)              │
                    └──────────────────────────────────────────────┘
                                          │
                          ┌───────────────┴────────────────┐
                          │                                │
                          ▼                                ▼
            ┌────────────────────────┐    ┌──────────────────────────────┐
            │   Vercel Edge          │    │   Hetzner K8s Ingress        │
            │   (4 apps Next.js)     │    │   (TLS termination + WAF)    │
            └────────────────────────┘    └──────────────────────────────┘
                          │                                │
                          │                  ┌─────────────▼──────────────┐
                          │                  │       gateway-api          │
                          └─────────────────▶│   (BFF, JWT validation,    │
                                             │    rate limiting, CORS)    │
                                             └─────────────┬──────────────┘
                                                           │ HTTP interne (mTLS prod)
                              ┌────────────────────────────┼────────────────────────────┐
                              ▼                            ▼                            ▼
                   ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
                   │  identity-svc    │         │   catalog-svc    │         │   booking-svc    │
                   └──────────────────┘         └──────────────────┘         └──────────────────┘
                              │                            │                            │
                              ▼                            ▼                            ▼
                          [Postgres]                   [Postgres]                   [Postgres]
                                          ┌─────────────────┴────────────┐
                                          ▼                              ▼
                                  ┌──────────────┐              ┌──────────────┐
                                  │   order-svc  │              │  payment-svc │
                                  └──────────────┘              └──────────────┘
                                          │                              │
                                          ▼                              ▼
                                      [Postgres]                     [Postgres]

                  + Workers : messaging-svc, review-svc, notification-svc, media-svc
                  + NATS JetStream R3 (events bus)
                  + Redis Upstash (locks, sessions, pub/sub)
                  + Meilisearch (1 index par locale)
```

**Webhooks externes — endpoints uniques** :
- Stripe → `payment-svc/webhooks/stripe` (NFR75)
- Keycloak → `identity-svc/webhooks/keycloak` (NFR76)
- Aucun autre service ne consomme directement les webhooks externes.

**Sub-domaines & isolation** (ADR-016 supersedes ADR-013) :
- `tukio.one` (apex) → `apps/public/` (visiteurs + customers B2C unifié, route group `(authenticated)`)
- `seller.tukio.one` → `apps/seller/` (rewrite depuis public via `next.config.ts`)
- `admin.tukio.one` → `apps/admin/` (sous-domaine séparé, sécurité accrue, MFA TOTP)
- `auth.tukio.one` → Keycloak (Phasetwo managé)
- `api.tukio.one` → gateway-api (REST publique exposée)
- `app.tukio.one` (legacy ADR-013) → 301 redirect vers apex via Caddy, garder ~6 mois

#### Component Boundaries (Frontend)

- **Aucune feature ne peut importer les internals d'une autre feature** (lint `eslint-plugin-boundaries`). Seules les exports publics via `features/<feature>/index.ts` sont autorisés.
- **Aucune app ne partage de state runtime avec une autre** (cookies session Keycloak via `Domain=.tukio.one` partagés mais state TanStack Query / Zustand isolé par app).
- **Composants UI partagés** dans `@tukio/ui` uniquement — aucune duplication de Button/Input/Modal/Toast entre apps.
- **Hooks API partagés** dans `@tukio/api-client` uniquement — types dérivés de `@tukio/contracts`.

#### Service Boundaries (Backend)

- **Database per service** strict (ADR-003) — aucun service ne peut SELECT sur la DB d'un autre service.
- **Communication async via NATS uniquement** (ADR-002) — sauf 1 exception : `booking-svc` → `catalog-svc` HTTP pour vérification dispo temps réel.
- **gateway-api** est le seul autorisé à appeler les services downstream en HTTP synchrone.
- **mTLS inter-services** en production (NFR10).

#### Data Boundaries

- **10 databases logiques** (`tukio_<service>`) sur 1 instance Neon physique au MVP, séparation possible en V2.
- **Cross-service data sharing** uniquement via events NATS (snapshot dans inbox/projection locale du service consommateur).
- **PII encryption at-rest** sur Cloudflare R2 (pièces d'identité KYC pros) et tables sensibles (Postgres pgcrypto pour les colonnes critiques).
- **Audit trail immuable** (table `admin_actions` côté `identity-svc`) — append-only, jamais modifiable même par admin-super.

### Requirements to Structure Mapping (FRs PRD → fichiers concrets)

| FR Range | Capability Area | Backend service(s) | Frontend app(s) / features |
|----------|-----------------|---------------------|------------------------------|
| **FR1-17** | A. User & Identity Management | `identity-svc` + Keycloak (externe) | `customer/features/profile/`, `seller/features/{onboarding,settings}/`, `admin/features/{users,verifications}/` |
| **FR18-33** | B. Catalog & Discovery | `catalog-svc` + `media-svc` | `public/features/{search,catalog,service-detail,pro-profile,home}/`, `seller/features/services/` |
| **FR34-48** | C. Booking & Order Lifecycle | `booking-svc` + `order-svc` (split ADR-004) | `customer/features/{cart-checkout,bookings}/`, `seller/features/{bookings,quotes}/`, `admin/features/transactions/` |
| **FR49-66** | D. Payments & Financial | `payment-svc` + `order-svc` (factures) + `identity-svc` (subscription tier sync) | `customer/features/{billing,cart-checkout}/`, `seller/features/{billing,subscription}/`, `admin/features/{finance,transactions}/` |
| **FR67-74** | E. Messaging & Communication | `messaging-svc` | `customer/features/messages/`, `seller/features/messages/` |
| **FR75-82** | F. Reviews & Reputation | `review-svc` | `customer/features/reviews/`, `seller/features/reviews/`, `public/features/{service-detail,pro-profile}/` (display) |
| **FR83-95** | G. Moderation & Administration | distribué (tous les services) + `gateway-api` (RBAC) + `identity-svc` (audit trail) | `admin/features/{users,verifications,reports,catalog,transactions,finance,audit,config}/` |
| **FR96-104** | H. Internationalization | `catalog-svc` (translations) + `notification-svc` (templates FR/EN) + `gateway-api` (locale propagation) + tous les services (locale-aware payload) | `@tukio/i18n-client` consommé par les 4 apps |
| **FR105-116** | I. Acquisition & Growth | `gateway-api` (server-side tracking) + `identity-svc` (referral codes V1) + `payment-svc` (apporteur commissions V1) | `customer/features/{billing,profile}/` (referral codes), `apps/public/lib/{posthog.client,plausible}.ts` |
| **FR117-125** | J. Notifications | `notification-svc` (consume tous events) | `customer/features/profile/notifications/`, `seller/features/settings/notifications/`, `admin/features/communication/` (V1+) |
| **FR126-130** | K. Configurateur & Smart V2 | `catalog-svc` (recommendations) + `booking-svc` (co-traitance) + `notification-svc` (analytics) | `customer/features/{configurator,recommendations}/` (V2), `seller/features/{analytics,team}/` (V1+) |

### Integration Points

#### Internal Communication (NATS events)

~50 events catalogués dans `@tukio/contracts/src/events/` (référence : `docs/tukio_event_catalog.md`). Exemples critiques :

| Event | Producer | Consumers | Trigger UX |
|-------|----------|-----------|------------|
| `catalog.listing.published.v1` | `catalog-svc` | meilisearch-indexer (interne), `notification-svc` | Service apparaît dans search public |
| `booking.requested.v1` | `booking-svc` | `notification-svc` (email pro), `order-svc` (créer order) | Demande arrive dans dashboard pro |
| `booking.accepted.v1` | `booking-svc` | `payment-svc` (capture intent), `notification-svc` (email client), `order-svc` (lock order) | Customer reçoit confirmation, paiement capturé |
| `payment.intent.captured.v1` | `payment-svc` | `booking-svc` (transition confirmed), `order-svc` (génère facture) | Saga booking-payment poursuit |
| `booking.confirmed.v1` | `booking-svc` | `notification-svc` (rappels J-7, J-1), `review-svc` (planifier review request J+1) | Rappels logistiques planifiés |
| `payout.completed.v1` | `payment-svc` | `notification-svc` (email pro), `order-svc` (marquer payout dans facture) | Pro voit payout dans `/seller/billing/payouts` |
| `admin.action.pro-verified.v1` | `identity-svc` | `notification-svc` (email pro), `identity-svc` (audit trail mirror) | Pro reçoit email "Compte validé" |
| `payment.intent.failed.v1` | `payment-svc` | `booking-svc` (transition refused), `notification-svc` (email client retry) | Customer voit erreur + retry |
| `subscription.changed.v1` | `payment-svc` | `identity-svc` (sync tier) | Pro tier mis à jour côté backend |

**Saga booking-payment** (R11 critique, mono-vendor MVP, ~5 étapes) :

```
1. Customer POST /v1/bookings → gateway-api → booking-svc
2. booking-svc valide dispo (HTTP sync exception → catalog-svc)
3. booking-svc crée Booking pending_pro_acceptance, émet booking.requested.v1 (outbox)
4. order-svc consume → crée Order avec line items, émet order.created.v1
5. payment-svc consume → crée PaymentIntent (autorisation), émet payment.intent.authorized.v1
6. Customer paye via Stripe Elements → 3DS → autorisation
7. Pro accepte → POST /v1/bookings/{id}/accept → booking-svc
8. booking-svc émet booking.accepted.v1 (outbox)
9. payment-svc consume → capture PaymentIntent, émet payment.intent.captured.v1
10. booking-svc consume → transition vers confirmed, émet booking.confirmed.v1
11. order-svc consume → génère facture PDF, émet invoice.issued.v1
12. notification-svc consume tous les events → emails Resend FR/EN aux acteurs
13. correlationId propagé partout pour reconstruction d'état distribué
```

**Si saga bloquée > 5 min** (R11) → alerte admin → outil admin replay event NATS dans `admin.tukio.one/transactions/disputes/{id}`.

#### External Integrations

| Provider | Service Tukio | Endpoint Tukio | Direction |
|----------|---------------|----------------|-----------|
| Stripe Connect Express | `payment-svc` | `/webhooks/stripe` (Tukio) + Stripe API (sortant) | Bidirectionnelle |
| Stripe Billing | `payment-svc` | idem (même endpoint webhook, types events distincts) | Bidirectionnelle |
| Stripe Identity | `identity-svc` | Stripe API (sortant) | Sortante |
| Keycloak 25 | `identity-svc` + `gateway-api` | `/webhooks/keycloak` (Tukio) + JWKS endpoint (entrant) | Bidirectionnelle |
| Cloudflare R2 / Images | `media-svc` | API R2 + signed URLs (sortant) | Sortante |
| Resend | `notification-svc` | API Resend (sortant) | Sortante |
| Brevo | `notification-svc` | API Brevo (sortant) | Sortante |
| Meilisearch Cloud | `catalog-svc` | API Meilisearch (sortant) | Sortante |
| API INSEE SIRENE | `identity-svc` | API INSEE (sortant) | Sortante |
| Plausible | `apps/public/` | script tag (frontend) | Sortante (frontend) |
| PostHog hosted EU | `gateway-api` + apps frontend | API PostHog (server-side via gateway + client SDK) | Sortante |
| DeepL ou GPT-4 (V1+) | `catalog-svc` | API translation (sortant) | Sortante |

#### Data Flow — exemple search (Sophie cherche un chapiteau)

```
Sophie (Visitor) → public.tukio.one/fr/search
   ↓ (Plausible script tag fire side, asynchrone)
Vercel Edge → SSR public app → @tukio/api-client → useSearchListings({ query, filters })
   ↓ (HTTP avec X-Tukio-Locale: fr)
gateway-api/v1/listings/search?q=chapiteau&where=la-baule&from=2026-06-15
   ↓ (rate limit anonyme 60 req/min, JWT optional, locale propagée)
gateway-api → HTTP downstream → catalog-svc/v1/listings/search
   ↓ (mTLS prod, header X-Tukio-Actor=anonymous, X-Tukio-Locale=fr)
catalog-svc → SearchListingsUseCase.execute()
   ↓
catalog-svc → IMeilisearchSearchIndex.search({ index: 'listings_fr', filters })
   ↓
Meilisearch Cloud → résultats top 20
   ↓
catalog-svc → SearchListingsResult { items, totalEstimate, nextCursor }
   ↓
gateway-api → ResponseEnvelopeInterceptor wrap → enveloppe REST canonique (ADR-014)
   ↓
{ method: GET, code: 200, data: [...], pagination: {...}, meta: {...} }
   ↓
Sophie voit fiches services en 4 minutes, fait son choix.

Parallèlement : gateway-api émet event server-side `search_performed` → PostHog (résistant ad-block).
```

### File Organization Patterns

#### Configuration Files

- **Racine monorepo** : `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc.json`, `.editorconfig`, `commitlint.config.cjs`
- **Par app/service** : `package.json`, `tsconfig.json`, `Dockerfile`, `.env.example` (jamais `.env` committé)
- **CI/CD** : `.github/workflows/*.yml` (au niveau racine monorepo)
- **Helm charts** : `infra/k8s/helm-charts/<deployment-unit>/` avec `values-{dev,staging,production}.yaml`

#### Source Organization

- **Backend** : pattern Pretre strict (`domain/usecases/infrastructure` + `usecases-proxy/usecases-proxy.module.ts` central wiring)
- **Frontend** : feature-based strict (`features/<feature>/{components,hooks,services,schemas,index.ts}` + `shared/` + `lib/`)
- **Libs partagées** : structure `src/<domain>/` cohérente, barrel `index.ts` avec exports limités

#### Test Organization

- **Tests unitaires** : co-locatés (`<file>.spec.ts` à côté de `<file>.ts`)
- **Tests d'intégration** : `<service>/test/<feature>.integration-spec.ts` (testcontainers PostgreSQL/NATS/Redis)
- **Tests E2E backend** : `<service>/test/<feature>.e2e-spec.ts` (NestJS standard)
- **Tests E2E frontend** : `<app>/e2e/<journey>.spec.ts` (Playwright)
- **Tests chaos** : `<service>/test/chaos/<saga>.chaos-spec.ts` (lib `@tukio/testing`)

#### Asset Organization

- **Static assets frontend** : `apps/<app>/public/{favicon,robots.txt,sitemap.xml,manifest.json}`
- **Images de contenu** : Cloudflare R2 + Cloudflare Images (jamais committés dans le repo)
- **Fonts custom** (Fraunces) : servies via `next/font` Google Fonts (pas de fichiers locaux)
- **Icons** : Lucide importés depuis `@tukio/ui/icons`, picto custom événementiels en SVG dans `@tukio/ui/icons/custom/`

### Development Workflow Integration

#### Development Server Structure

```bash
# Démarrer tout le stack en local (Docker Compose + Turborepo dev mode)
pnpm docker:up                      # Postgres × 10 DBs, NATS, Keycloak, Meilisearch, Redis, MailHog
pnpm dev                            # Turborepo lance les 4 apps + 10 services en parallèle

# Démarrer un sous-ensemble (avec affected-builds)
pnpm dev --filter=public --filter=gateway-api --filter=identity-svc

# Tests sur un seul service
pnpm test --filter=booking-svc

# Tests E2E Playwright sur 1 app
pnpm e2e --filter=customer
```

#### Build Process Structure

```bash
# CI/CD pipelines :
# PR : pnpm lint + pnpm typecheck + pnpm test --filter=...[origin/main] (affected only)
# Merge main : pnpm build → docker build × 10 services → push ghcr.io → ArgoCD sync staging
# Tag v* : ArgoCD sync production

# Build local image Docker pour 1 service
pnpm --filter=booking-svc docker:build

# Build des 4 frontends (Vercel le fait automatiquement par push, mais en local)
pnpm build --filter=public --filter=customer --filter=seller --filter=admin
```

#### Deployment Structure

- **Frontend** : 4 projets Vercel (1 par app), branchés sur `main` du monorepo. Vercel détecte les changements affected via Turborepo.
- **Backend** : Helm charts `infra/k8s/helm-charts/{core-api,workers,nats}/` deployés via ArgoCD sur cluster Hetzner staging puis production (GitOps).
- **Migrations DB** : Job K8s `tukio-migrate` lancé avant rolling update (NFR83 backward-compatible).
- **Rollback** : ArgoCD permet rollback en 1 clic vers la version précédente. Postgres rollback via les scripts down de TypeORM (NFR72).

## Architecture Validation Results

### Coherence Validation ✅

#### Decision Compatibility

Toutes les décisions architecturales (14 ADRs : 12 préexistants + ADR-013 + ADR-014) sont mutuellement cohérentes. Aucun conflit identifié.

| Décision | Cohérence avec | Verdict |
|----------|----------------|---------|
| ADR-001 (Pretre Clean Architecture) | ADR-003 (DB per service), ADR-008 (gateway public only), ADR-010 (TypeORM + raw SQL) | ✅ Compatible — pattern hexagonal isole le domaine de l'infrastructure |
| ADR-002 (NATS JetStream) | ADR-006 (saga choréographée), ADR-007 (outbox pattern), ADR-011 (`@tukio/contracts`) | ✅ Compatible — JetStream + outbox + JSON Schemas versionnés forment une chaîne cohérente |
| ADR-004 (booking + order split) | ADR-006 (saga choréographée), ADR-007 (outbox) | ✅ Compatible — saga distribuée 5 étapes max naturellement gérable |
| ADR-005 (Meilisearch dès MVP) | ADR-012 (i18n) | ✅ Compatible — 1 index par locale (FR + EN) |
| ADR-009 (Keycloak + identity-svc séparés) | ADR-008 (gateway-api seul public) | ✅ Compatible — webhooks Keycloak → identity-svc, JWT validation gateway-api |
| ADR-012 (i18n FR + EN dès Sprint 0) | ADR-013 (4 apps multi-zones), tables `<entity>_translations`, `next-intl` | ✅ Compatible — locale-prefix URLs propagent à tous les niveaux |
| ADR-013 (4 apps multi-zones feature-based) | ADR-001 (clean architecture côté backend), `eslint-plugin-boundaries` | ✅ Compatible — discipline architecturale cohérente front/back |
| ADR-014 (enveloppe REST) | ADR-011 (types DTOs partagés), Frontend `@tukio/api-client` (envelope-handler) | ✅ Compatible — types `SuccessEnvelope`/`ErrorEnvelope` dans `@tukio/contracts/src/envelope/` |

**Versions & compatibilité technique** :
- Next.js 15 + React 19 + TypeScript 5.x : compatible
- NestJS 11 + Fastify adapter + TypeORM + Zod : compatible
- Keycloak 25 + OIDC RS256 : compatible avec NestJS guards
- NATS JetStream 2.10+ + `@horizon-republic/nestjs-jetstream` : compatible
- Meilisearch + Cloudflare R2 + Upstash Redis : SDKs Node.js natifs
- pnpm workspaces + Turborepo : standard mature 2026

#### Pattern Consistency

| Pattern | Backend | Frontend | Verdict |
|---------|---------|----------|---------|
| Hexagonal / Clean | Pretre `domain/usecases/infrastructure` | Feature-based `features/<feature>/` (mirror domain boundaries) | ✅ Cohérent — discipline architecturale uniforme |
| Naming code | `camelCase`/`PascalCase` TypeScript strict | Idem | ✅ Identique |
| Naming DB / API / events | `snake_case` DB, `kebab-case` API, `<svc>.<aggr>.<evt>.v<n>` NATS | Consommé tel quel via `@tukio/contracts` | ✅ Single source of truth |
| Validation | Zod via `nestjs-zod` + ZodValidationPipe | React Hook Form + Zod resolver | ✅ Schemas partagés `@tukio/contracts/src/dtos/` |
| State management | NestJS DI + use case proxies | TanStack Query (server state) + Zustand (UI global) + React local | ✅ Patterns adaptés à chaque couche, jamais de mix |
| Error handling | Domain exceptions → `EnvelopeExceptionFilter` → enveloppe REST ADR-014 | TanStack Query `onError` + ErrorBoundary + inline form errors | ✅ Cohérent end-to-end |
| i18n | Locale dans events, templates Resend par locale, payload localisé | `next-intl` + locale-prefix URL + `messages/{fr,en}.json` | ✅ Stack cohérente |

#### Structure Alignment

| Aspect | Vérification | Verdict |
|--------|--------------|---------|
| Monorepo Turborepo supporte 14 codebases + 8 packages | `apps/*` + `packages/*` workspaces, `turbo.json` pipelines | ✅ Aligné |
| Pattern Pretre × 10 services backend | Structure `domain/usecases/infrastructure/usecases-proxy/` répliquée à l'identique | ✅ Aligné |
| Feature-based × 4 frontends | Structure `features/<feature>/{components,hooks,services,index.ts}` répliquée | ✅ Aligné |
| 3 unités de déploiement MVP | `infra/k8s/helm-charts/{core-api,workers,nats}/` | ✅ Aligné |
| Frontend multi-zones | `apps/public/` (zone parent) + `apps/{customer,seller,admin}/` rewrites | ✅ Aligné |
| Vercel × 4 projets | 1 projet par app, indépendants | ✅ Aligné |

### Requirements Coverage Validation ✅

#### Functional Requirements Coverage (130 FRs)

Toutes les 11 capability areas (A à K du PRD) sont mappées vers des services backend + features frontend concrets. Cf. tableau §Requirements to Structure Mapping.

| Capability Area | FR Range | Backend coverage | Frontend coverage | Status |
|-----------------|----------|------------------|-------------------|--------|
| A. User & Identity Management | FR1-17 | `identity-svc` + Keycloak | `customer/profile`, `seller/onboarding+settings`, `admin/users+verifications` | ✅ Couvert |
| B. Catalog & Discovery | FR18-33 | `catalog-svc` + `media-svc` | `public/{search,catalog,service-detail,pro-profile,home}`, `seller/services` | ✅ Couvert |
| C. Booking & Order Lifecycle | FR34-48 | `booking-svc` + `order-svc` | `customer/{cart-checkout,bookings}`, `seller/{bookings,quotes}`, `admin/transactions` | ✅ Couvert |
| D. Payments & Financial | FR49-66 | `payment-svc` + `order-svc` + `identity-svc` (tier sync) | `customer/billing+cart-checkout`, `seller/{billing,subscription}`, `admin/{finance,transactions}` | ✅ Couvert |
| E. Messaging | FR67-74 | `messaging-svc` | `customer/messages`, `seller/messages` | ✅ Couvert |
| F. Reviews | FR75-82 | `review-svc` | `customer/reviews`, `seller/reviews`, `public/{service-detail,pro-profile}` (display) | ✅ Couvert |
| G. Moderation & Administration | FR83-95 | distribué + `gateway-api` (RBAC) + `identity-svc` (audit trail) | `admin/{users,verifications,reports,catalog,transactions,finance,audit,config}` | ✅ Couvert |
| H. Internationalization | FR96-104 | `catalog-svc` + `notification-svc` + `gateway-api` + tous services | `@tukio/i18n-client` × 4 apps | ✅ Couvert |
| I. Acquisition & Growth | FR105-116 | `gateway-api` + `identity-svc` (referral) + `payment-svc` (apporteurs) | `customer/{billing,profile}`, `apps/public/lib/{posthog,plausible}` | ✅ Couvert |
| J. Notifications | FR117-125 | `notification-svc` (consume tous events) | `customer/profile/notifications`, `seller/settings/notifications`, `admin/communication` | ✅ Couvert |
| K. Configurateur & Smart V2 | FR126-130 | `catalog-svc` + `booking-svc` + `notification-svc` (V2) | `customer/{configurator,recommendations}`, `seller/{analytics,team}` (V2) | ✅ Couvert |

**Résultat** : 100 % des 130 FRs ont un mapping architectural explicite vers au moins 1 service backend + 1 feature frontend (sauf FRs purement backend comme FR47 lifecycle). Aucun FR orphelin.

#### Non-Functional Requirements Coverage (84 NFRs)

| Catégorie NFR | NFRs | Couverture architecturale | Status |
|---------------|------|---------------------------|--------|
| Performance (8) | NFR1-8 | Meilisearch p95 < 150ms, Vercel edge cache, Turbopack, bundle budgets, Lighthouse CI | ✅ Couvert |
| Security (12) | NFR9-20 | mTLS, JWT RS256 + JWKS cache, MFA admin, Doppler, Stripe Elements iframe, R2 encryption, PII redaction, rate limiting, Dependabot, audit trail, hash anti-recréation | ✅ Couvert |
| Compliance & Privacy (10) | NFR21-30 | LCEN hybride, mandat art. 289 CGI, RGPD stack (Plausible/PostHog EU/Brevo FR), soft-delete + anonymisation, droits RGPD, 3DS Secure | ✅ Couvert |
| Scalability (8) | NFR31-38 | Auto-scaling K8s HPA, NATS R3, split par service, Postgres scaling Neon, saisonnalité 3× pic | ✅ Couvert |
| Reliability (8) | NFR39-46 | Saga R11 monitoring + replay, NATS R3 + DLQ, outbox fallback polling, RPO/RTO Postgres, retries + circuit breakers, chaos tests CI | ✅ Couvert |
| Accessibility (9) | NFR47-55 | RGAA AA, design brief contraste/clavier/screen reader, axe-core CI, Lighthouse ≥ 90 | ✅ Couvert |
| Internationalization (5) | NFR56-60 | `next-intl` zéro hardcoded, locale-prefix URLs, `<entity>_translations`, 1 index Meilisearch par locale, templates Resend FR/EN | ✅ Couvert |
| Observability (6) | NFR61-66 | OpenTelemetry traces correlées, Prometheus metrics, Loki logs, PostHog server-side, dashboards Looker Studio, PII redaction | ✅ Couvert |
| Maintainability (8) | NFR67-74 | Pattern Pretre + lint boundaries, ADRs `docs/adr/`, coverage 80/70/50, conventional commits, conventions nommage figées | ✅ Couvert |
| Integration (5) | NFR75-79 | Webhooks unique endpoint Stripe/Keycloak, no HTTP-to-HTTP downstream, retries + circuit breakers, INSEE SIRENE | ✅ Couvert |
| Operability (5) | NFR80-84 | 3 deployment units MVP, payment-svc split prod, K8s probes /health /ready /metrics, migrations backward-compatible | ✅ Couvert |

**Résultat** : 100 % des 84 NFRs ont une réponse architecturale explicite. Aucun NFR orphelin.

#### User Journeys Coverage (6 journeys + V1 implicits)

| Journey | Capabilities révélées | Architecture support | Status |
|---------|----------------------|----------------------|--------|
| J1 Sophie réserve (happy path C1 MVP) | search, fiche service, booking, capture différée, messagerie, avis, i18n | `catalog-svc` + `booking-svc` + `order-svc` + `payment-svc` + `messaging-svc` + `review-svc` + `apps/public/` + `apps/customer/` | ✅ Couvert |
| J2 Annulation force majeure (edge C1) | dispute workflow, refund admin, audit trail, communication empathique | `booking-svc` + `payment-svc` + `identity-svc` (audit) + `notification-svc` + `apps/admin/` | ✅ Couvert |
| J3 Marc onboarde (happy P1 MVP) | onboarding wizard, KYC, Stripe Connect, dashboard pro, anti-désintermédiation | `identity-svc` + `payment-svc` + `apps/seller/onboarding+dashboard+bookings` | ✅ Couvert |
| J4 Dispute Stripe (edge P1) | evidence trail messagerie, signature électronique V1, contestation guidée | `messaging-svc` (audit trail) + `payment-svc` (dispute submission) + `apps/seller/billing/payouts` | ✅ Couvert |
| J5 Léa valide pro (admin-support MVP) | verification queue, audit trail immuable, RBAC, MFA admin | `identity-svc` (audit) + `apps/admin/verifications` + Keycloak MFA | ✅ Couvert |
| J6 Saga échouée (admin-modo edge) | replay event NATS, monitoring saga > 5min, observability traces correlées | `payment-svc` + `booking-svc` + `apps/admin/transactions/disputes` (outil replay) + Grafana Cloud | ✅ Couvert |
| Implicits V1+ (C2 B2B multi-vendor, P3 Starter, conversion client→pro, apporteurs B2B, workflow litige V1) | Tous mappés dans Functional Requirements + Project Structure | ✅ Couvert pour V1+ |

### Implementation Readiness Validation ✅

#### Decision Completeness

- ✅ 14 ADRs avec versions et rationale (à copier dans `docs/adr/0001-*` à `0014-*` au Sprint 0)
- ✅ Stack technique : 100 % spécifiée avec versions précises (Next.js 15, NestJS 11, Postgres 16, NATS 2.10+, Keycloak 25, etc.)
- ✅ Cloud provider tranché : Hetzner K8s + Neon Postgres + Vercel + Grafana Cloud
- ✅ Décisions cascading actées : Zod, cache Redis TTL par type, GitHub Actions + ghcr.io + ArgoCD, Doppler, Loki

#### Structure Completeness

- ✅ Project tree complet : 14 codebases + 8 packages + infra + docs + bmad
- ✅ Boundaries définies : API, component, service, data
- ✅ Integration points cartographiés : 12 intégrations externes + ~50 events NATS internes
- ✅ Mapping FR → fichiers concrets pour les 11 capability areas

#### Pattern Completeness

- ✅ Naming conventions : DB, API, NATS events, code, files, slugs URL — tout figé
- ✅ Format API : enveloppe REST canonique ADR-014 avec exemples success/error/pagination/validation
- ✅ Communication patterns : event payload structure, saga correlation, state update, action naming
- ✅ Process patterns : error handling backend + frontend, error codes catalog initialisé, loading states, auth flow, validation flow
- ✅ Observability patterns : logging JSON structuré, trace correlation, metrics naming
- ✅ Enforcement : 10 règles obligatoires + lint rules custom + pre-commit hooks + CI gates + code review checklist

### Gap Analysis

#### Critical Gaps (Block Implementation)

**Aucun.** L'architecture est complète sur tous les axes critiques. Sprint 0 peut démarrer.

#### Important Gaps (Address During Sprint 0+)

Ces éléments sont des **livrables d'implémentation Sprint 0**, pas des décisions architecturales manquantes. À traiter dans les premières stories :

| Gap | Priorité | Story Sprint 0 |
|-----|----------|----------------|
| **`@tukio/contracts` events JSON Schemas** : structure listée (~50 events) mais schemas individuels à écrire | 🔴 Critique pour Sprint 1 | Story 0.x — Bootstrap `@tukio/contracts` avec 5 events critiques (booking-requested, accepted, payment captured, listing published, admin action) |
| **Helm charts K8s** : structure définie, manifests à écrire | 🟠 Élevé | Story 0.x — Helm chart `core-api` + `workers` + `nats` |
| **Migrations TypeORM + seed scripts** : décisions actées, scripts à écrire | 🟠 Élevé | Story 0.x — Migration initiale par service (`outbox`, `inbox`, `<entity>` tables) + seed catégories pilotes |
| **Sequence diagrams visualisés** : sagas décrites en prose, manque diagrammes Mermaid/PlantUML | 🟡 Moyen | Story Sprint 0+ — Diagrammes Mermaid intégrés à `docs/runbook/` |
| **OpenAPI specs auto-générées** : décision prise (`@nestjs/swagger`), endpoints à annoter au fur et à mesure | 🟡 Moyen | Couvert par chaque story d'implémentation feature |
| **RBAC matrix complète par endpoint** : principes définis (`@Roles` decorator), matrice exhaustive endpoint × rôle à constituer | 🟡 Moyen | Couvert par chaque story d'implémentation feature |
| **Stratégie de tests par feature** : NFR71 % définit les seuils, pyramide de tests à implémenter | 🟡 Moyen | Couvert par chaque story d'implémentation feature |
| **Disaster Recovery procedure** : RPO/RTO définis (NFR44), runbook à détailler | 🟡 Moyen | Story 0+ — Runbook DR `docs/runbook/disaster-recovery.md` |

#### Nice-to-Have Gaps (V1+)

- Documentation API publique (V3+ optionnel)
- Storybook lib `@tukio/ui` (V1)
- E2E test framework Playwright complet (les hooks sont définis, à configurer Sprint 0)
- Setup PagerDuty (V2+ si oncall structuré)
- Documentation onboarding développeur (`docs/CONTRIBUTING.md`, `docs/ARCHITECTURE.md` synthétique)

### Validation Issues Addressed

#### Decisions cascading actées dans cette session architecture

- ✅ **ADR-013 (Frontend multi-zones 4 apps + feature-based)** — Override de l'option "1 frontend monolithique" envisagée initialement
- ✅ **ADR-014 (Enveloppe REST canonique)** — Override de l'option "retour DTO direct + RFC 7807" envisagée initialement
- ✅ **Hetzner K8s + Neon Postgres** — Cloud provider tranché par défaut (option Scaleway/AWS/GCP rejetée pour MVP)
- ✅ **Stack frontend libs partagées** — `@tukio/ui`, `@tukio/api-client`, `@tukio/i18n-client`, `@tukio/auth-client` formalisés (au-delà des 4 libs backend)

#### Cohérence avec la documentation source

- ✅ **Pattern Pretre Clean Architecture** : aligné avec `tukio_booking_svc_deepdive.md` §F + référence canonique https://github.com/jonathanPretre/clean-architecture-nestjs
- ✅ **Conventions paths URL EN** : aligné avec `tukio_information_architecture.md` §A
- ✅ **Vouvoiement systématique** : aligné avec `tukio_design_brief.md` §I (corrige une erreur antérieure du brief v0.3)
- ✅ **Mandat art. 289 CGI + 3 cas TVA** : aligné avec `tukio_booking_paiements_deepdive.md` + spec v2.2
- ✅ **Anti-désintermédiation** : aligné avec PRD §FR45, §FR72-73 + spec v2.2 §2.6

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed (130 FRs + 84 NFRs + 6 journeys + 8 domaines + 12 ADRs préexistants)
- [x] Scale and complexity assessed (medium-high, 8 drivers structurants)
- [x] Technical constraints identified (12 ADRs + 12 intégrations externes + monorepo + i18n + LCEN)
- [x] Cross-cutting concerns mapped (11 concerns dont Clean Architecture en #1)

**Architectural Decisions**

- [x] Critical decisions documented with versions (14 ADRs)
- [x] Technology stack fully specified (Next.js 15, NestJS 11, Postgres 16, NATS 2.10+, Keycloak 25, etc.)
- [x] Integration patterns defined (REST via gateway + NATS + 1 exception sync booking→catalog + webhooks endpoints uniques)
- [x] Performance considerations addressed (Core Web Vitals, latence p95 search < 150ms, NATS sweet spot 10k events/sec, bundle budgets)

**Implementation Patterns**

- [x] Naming conventions established (DB, API, NATS, code, files, slugs)
- [x] Structure patterns defined (Pretre backend, feature-based frontend, tests co-locatés, libs partagées)
- [x] Communication patterns specified (event payload, saga correlation, state update, action naming, enveloppe REST)
- [x] Process patterns documented (error handling, error codes catalog, loading states, auth flow, validation flow, observability)

**Project Structure**

- [x] Complete directory structure defined (14 codebases + 8 packages + infra + docs + bmad)
- [x] Component boundaries established (API, component, service, data)
- [x] Integration points mapped (12 intégrations externes + ~50 events NATS internes + saga booking-payment)
- [x] Requirements to structure mapping complete (11 capability areas → services + features explicites)

**Total : 16/16 ✅**

### Architecture Readiness Assessment

**Overall Status** : **READY FOR IMPLEMENTATION**

L'architecture couvre 100 % des 130 FRs et 84 NFRs du PRD, propose un plan d'implémentation cohérent (3-5 jours Sprint 0 pour bootstrap + scaffolding pattern Pretre + 4 apps Next.js + 8 libs partagées), et liste les ADRs avec leurs cascading implications.

Aucun gap critique. Les "Important Gaps" identifiés sont des **livrables d'implémentation Sprint 0+** (scaffolds, schemas events, helm charts, migrations) plutôt que des décisions architecturales manquantes.

**Confidence Level** : **High**

- Stack figée par 14 ADRs (pas de débats techniques en suspens)
- Pattern Pretre + feature-based : standards établis avec référence canonique
- Documentation source riche (16 docs Tukio + brief + distillate + PRD)
- Conventions de nommage non négociables et enforced via lint
- Mappings explicites FR → fichiers + Journeys → capabilities + NFRs → mitigations

#### Key Strengths

1. **Discipline architecturale exceptionnelle dès Sprint 0** : pattern Pretre Clean Architecture, lint enforcement, 14 ADRs documentés, conventions figées. La dette structurelle est payée *avant* le premier commit.
2. **Cohérence frontend ↔ backend** : feature-based frontend mirror les bounded contexts backend, avec `@tukio/contracts` comme single source of truth pour types/DTOs/events/envelope.
3. **i18n-first dès le départ** (ADR-012) : impossible à rétro-fitter, câblé dans les 4 apps + 10 services + 2 indexes Meilisearch + templates Resend.
4. **Acquisition tech intégrée** (RA1 mitigation) : tracking server-side ad-block-resistant, schema `acquisition_*` Sprint 0, SEO foundation (locale-prefix + hreflang + Schema.org + sitemap par locale).
5. **Saga distribuée robuste** (R11 mitigation) : outbox pattern + DLQ NATS + correlation IDs + monitoring + outil admin replay.
6. **Compliance-aware** : LCEN hybride éditeur/hébergeur, mandat art. 289 CGI, RGPD stack EU, RGAA AA, audit trail immuable, PCI SAQ-A minimal.
7. **Coût opérationnel maîtrisé** : Hetzner Cloud K8s + Neon serverless + Grafana Cloud free tier + Vercel hobby/pro = ~150-200 €/mois MVP.

#### Areas for Future Enhancement

- **Service mesh** (Istio/Linkerd) : V1+ si team > 5 devs et complexité réseau augmente
- **Module Federation runtime** : V3+ uniquement si team > 30 ingénieurs (rejet explicite ADR-013)
- **Read replicas Postgres + pgBouncer** : V1-V2 selon scaling
- **Multi-region CDN** : V3+ si international
- **AWS Secrets Manager / HashiCorp Vault** : V2 migration depuis Doppler si scaling justifie
- **PagerDuty** : V2 si oncall structuré
- **Storybook `@tukio/ui`** : V1 quand le design system se stabilise
- **API publique exposée** (`api.tukio.one`) : V3+ avec OpenAPI auto-généré déjà préparé

### Implementation Handoff

#### AI Agent Guidelines (humains + IA)

1. **Suivre les 14 ADRs sans exception**. Tout écart nécessite un nouvel ADR documenté.
2. **Respecter le pattern Pretre** côté backend : interfaces dans `domain/ports/`, impls dans `infrastructure/`. Lint enforce.
3. **Respecter l'architecture feature-based** côté frontend : `features/<feature>/` self-contained. Lint enforce les boundaries inter-features.
4. **Utiliser les libs partagées** (`@tukio/contracts`, `@tukio/messaging`, `@tukio/auth`, `@tukio/ui`, `@tukio/api-client`, `@tukio/i18n-client`, `@tukio/auth-client`, `@tukio/testing`) plutôt que de réimplémenter.
5. **Servir toutes les responses HTTP via l'enveloppe REST canonique** (ADR-014) — l'interceptor + exception filter le font automatiquement, ne pas le contourner.
6. **Versionner les events NATS** dès le premier event publié (`v1` suffix obligatoire).
7. **Émettre les events via outbox**, jamais en direct (cohérence transactionnelle DB ↔ NATS).
8. **Externaliser tous les strings UI** dans `messages/{fr,en}.json` (zéro hardcoded frontend).
9. **Tracer toutes les actions admin sensibles** dans le journal immuable via event `admin.action.*.v1`.
10. **Tester** : 80 % coverage `domain/`, 70 % `usecases/`, 50 % `infrastructure/`. CI gate bloquant.

#### First Implementation Priority — Sprint 0

**Story 0.1 — Bootstrap monorepo Turborepo + scaffold pattern Pretre** (3-5 jours)

```bash
# Étape 1 : Bootstrap monorepo
pnpm dlx create-turbo@latest tukio --package-manager pnpm
cd tukio
rm -rf apps/web apps/docs

# Étape 2 : 4 apps Next.js multi-zones
pnpm dlx create-next-app@latest apps/public --typescript --tailwind --app --turbopack --eslint --import-alias "@/*" --no-src-dir
pnpm dlx create-next-app@latest apps/customer --typescript --tailwind --app --turbopack --eslint --import-alias "@/*" --no-src-dir
pnpm dlx create-next-app@latest apps/seller --typescript --tailwind --app --turbopack --eslint --import-alias "@/*" --no-src-dir
pnpm dlx create-next-app@latest apps/admin --typescript --tailwind --app --turbopack --eslint --import-alias "@/*" --no-src-dir

# Étape 3 : 10 services NestJS
for SVC in gateway-api identity-svc catalog-svc booking-svc order-svc payment-svc messaging-svc review-svc notification-svc media-svc; do
  pnpm dlx @nestjs/cli new apps/$SVC --strict --package-manager pnpm --skip-git --skip-install
done
pnpm install

# Étape 4 : 8 libs partagées
mkdir -p packages/{contracts,messaging,auth,testing,ui,api-client,i18n-client,auth-client}

# Étape 5 : Pattern Pretre dans identity-svc (template) — réplication aux 9 autres ensuite
git clone https://github.com/jonathanPretre/clean-architecture-nestjs reference/pretre-pattern
mkdir -p apps/identity-svc/src/domain/{model,ports,service,exception}
mkdir -p apps/identity-svc/src/usecases
mkdir -p apps/identity-svc/src/infrastructure/{persistence/typeorm,messaging/nats,external,http/{controllers,dtos,guards},logger,config,exception,usecases-proxy}

# Étape 6 : ADRs + infra
mkdir -p docs/adr
# Copier les 14 ADRs (PRD §12.8 + ADR-013 + ADR-014) dans docs/adr/0001-*.md → 0014-*.md
mkdir -p infra/{terraform,k8s/helm-charts/{core-api,workers,nats},docker-compose,scripts}

# Étape 7 : Vercel multi-zones config + cookies session Domain=.tukio.one
# Étape 8 : Docker Compose dev local complet
# Étape 9 : CI GitHub Actions (lint + typecheck + tests affected + Lighthouse 4 apps)
# Étape 10 : Premier déploiement Hetzner staging via ArgoCD
```

**Story 0.2+** — Implémenter `identity-svc` (Keycloak intégration, KYC light, audit trail) selon les FRs FR1-17.

**Sprint suivants** — Implémentation feature-by-feature des FRs MVP (catalogue → booking → payment → messaging → reviews → notifications → admin).

#### Documents de référence pour l'implémentation

- **Architecture (ce document)** : `_bmad-output/planning-artifacts/architecture.md`
- **PRD** : `_bmad-output/planning-artifacts/prd.md` (130 FRs + 84 NFRs)
- **Brief executif** : `_bmad-output/planning-artifacts/product-brief-tukio.one.md`
- **Distillate token-efficient** : `_bmad-output/planning-artifacts/product-brief-tukio.one-distillate.md`
- **Pattern Pretre canonique** : https://github.com/jonathanPretre/clean-architecture-nestjs
- **Booking-svc deep dive** : `docs/tukio_booking_svc_deepdive.md` §F (~2 339 lignes, exemple complet pattern Pretre customisé Tukio)
- **Event catalog** : `docs/tukio_event_catalog.md` (~50 events NATS, ground truth `@tukio/contracts`)
- **Information Architecture** : `docs/tukio_information_architecture.md` (URLs, sitemap, RBAC, sous-domaines)
- **Design brief** : `docs/tukio_design_brief.md` (palette terracotta, typo Fraunces, vouvoiement systématique)
- **Stratégie acquisition** : `docs/tukio_strategie_acquisition.md` (CAC, SEO, payant, parrainage)
- **Opportunités futures** : `docs/tukio_opportunites_futures.md` (10 pistes V3+ documentées hors roadmap)
