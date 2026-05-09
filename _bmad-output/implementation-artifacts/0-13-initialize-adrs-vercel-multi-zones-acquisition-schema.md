# Story 0.13: Initialize 14 ADRs in docs/adr/ + Vercel multi-zones config + schema acquisition_*

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** tech lead (équipe Sprint 0 — DERNIÈRE STORY EPIC 0),
**I want** **3 livrables foundational** qui closent Sprint 0 :
1. **14 ADRs documentés** dans `docs/adr/0001-*.md` à `0014-*.md` au format ADR standard (Status / Context / Decision / Consequences / Alternatives Considered) — formalise toutes les décisions architecturales actées Stories 0.1-0.12 (Pretre Clean Arch, NATS JetStream, DB-per-service, Booking/Order split, Meilisearch MVP, saga choréographée, outbox pattern, gateway-api public-only, Keycloak split, TypeORM + raw SQL, `@tukio/contracts`, i18n FR/EN, frontend multi-zones, API envelope) + **`template.md`** réutilisable pour futurs ADRs Stories Epic 1+
2. **Vercel multi-zones config** dans `apps/public/next.config.ts` avec rewrites `/{locale}/account/*` → `customer.tukio.one`, `/{locale}/seller/*` → `seller.tukio.one`, cookie session shared via `Domain=.tukio.one` (cohérent Story 0.8)
3. **Migration TypeORM `acquisition_*` schema** sur `users` table (`tukio_identity` DB) ET `bookings` table (`tukio_booking` DB) avec 6 colonnes : `acquisition_source` (ENUM), `acquisition_medium`, `acquisition_campaign`, `acquisition_referral_id`, `acquisition_first_touch`, `acquisition_last_touch` — **impossible à rétro-fitter sans perte K-04** (NFR64)

**so that** : (1) les 14 décisions architecturales sont formalisées comme **source-of-truth versionnée Git** (consultables par tout dev futur, justifie les contraintes techniques imposées par le pattern Pretre, l'outbox, etc.), (2) un user connecté sur `customer.tukio.one` reste authentifié quand il navigue vers `tukio.one/fr/...` (cookie cross-subdomain) et l'expérience frontend est unifiée (URL reste sous `tukio.one`), (3) le tracking acquisition est **opérationnel dès le 1ᵉʳ Visitor** Stories Epic 1+ (un user qui s'inscrit avec `?utm_source=google_ads&utm_campaign=spring2026` aura `acquisition_source='google_ads'` persisté en DB pour analytics business critiques).

> **Outcome attendu** : à la fin de cette story, **Sprint 0 est CLOS** (13/13 stories ready-for-dev). `docs/adr/` contient 14 fichiers Markdown + 1 template — un nouveau dev qui ouvre `0001-pretre-clean-architecture.md` comprend POURQUOI le pattern Pretre est imposé sans avoir à reconstituer le contexte. `apps/public/next.config.ts` contient les 3 rewrites Vercel + tests d'intégration validation. `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddAcquisitionColumns.ts` + idem `apps/booking-svc/...` ajoutent les 6 colonnes — Stories Epic 1+ (notamment Story 1.2 register customer + Story 4.4 create booking) pourront persister les UTM params depuis le tout 1ᵉʳ commit fonctionnel. **Le projet est PRÊT à recevoir les stories user-facing Epic 1+** ✅.

## Acceptance Criteria

### Pour les 14 ADRs

1. **AC1 — Structure `docs/adr/` complète avec 14 ADRs + template** : Given `docs/adr/`, When je l'ouvre, Then je trouve **exactement 15 fichiers Markdown** :
   ```
   docs/adr/
   ├─ template.md                                    # Template ADR réutilisable (futurs Stories Epic 1+)
   ├─ 0001-pretre-clean-architecture.md
   ├─ 0002-nats-jetstream.md
   ├─ 0003-database-per-service.md
   ├─ 0004-booking-order-split.md
   ├─ 0005-meilisearch-mvp.md
   ├─ 0006-saga-choreographed.md
   ├─ 0007-outbox-pattern.md
   ├─ 0008-gateway-api-public-only.md
   ├─ 0009-keycloak-identity-svc-split.md
   ├─ 0010-typeorm-default-raw-sql-readheavy.md
   ├─ 0011-tukio-contracts-package.md
   ├─ 0012-i18n-fr-en-sprint-zero.md
   ├─ 0013-frontend-multi-zones-feature-based.md
   └─ 0014-api-response-envelope.md
   ```

2. **AC2 — Format ADR standard (Status / Context / Decision / Consequences / Alternatives)** : Given chaque fichier ADR, When je l'ouvre, Then je trouve **strictement** ce format Markdown (cohérent format MADR/Nygard standard) :
   ```markdown
   # ADR-NNNN: <title>

   - **Status**: ✅ Accepted (alternatives : Proposed / Accepted / Deprecated / Superseded by ADR-XXXX)
   - **Date**: 2026-05-09 (date de prise de décision, immutable post-Acceptance)
   - **Deciders**: Ismael (founder), tech lead (à définir Story Epic 1+)
   - **Tags**: `architecture`, `<categorie>` (ex `backend`, `frontend`, `data`, `security`)

   ## Context

   <Contexte business + technique : POURQUOI cette décision était nécessaire ? quel problème résoudre ? quelles forces s'opposent ?>

   ## Decision

   <Décision claire en 1-3 sentences : QUOI on a décidé exactement, sans ambiguïté>

   ## Consequences

   ### Positive
   - <Bénéfice 1>
   - <Bénéfice 2>

   ### Negative / Trade-offs
   - <Coût ou contrainte 1>
   - <Coût ou contrainte 2>

   ### Neutral
   - <Effet collatéral neutre>

   ## Alternatives Considered

   ### <Alternative 1>
   <Description + pourquoi rejetée>

   ### <Alternative 2>
   <Description + pourquoi rejetée>

   ## References

   - [Source: PRD section X]
   - [Source: Architecture section Y]
   - [Story Z où cette décision est appliquée]
   - [External: <lien externe pertinent>]

   ## Implementation Notes

   <Optionnel — comment implémenter concrètement, quels patterns code, quels lints associés>
   ```

3. **AC3 — Contenu détaillé des 14 ADRs (mapping vers Architecture + Stories)** : Given chaque ADR, When je l'ouvre, Then le contenu est **substantiel** (≥ 200 lignes par ADR pour les complexes, ≥ 80 lignes pour les simples) et map précisément vers Architecture + Stories où la décision est appliquée :
   - **`0001-pretre-clean-architecture.md`** : Pattern Pretre `domain/usecases/infrastructure` strict — Context : éviter dette technique microservices ; Decision : structure imposée Story 0.6 ; Consequences : tests faciles, swap providers triviaux ; Alternatives : DDD tactique pure, Hexagonal CSharp-style, no-pattern. References : Architecture lignes 168-232 + Story 0.6 + repo Pretre canonique
   - **`0002-nats-jetstream.md`** : NATS JetStream vs Kafka/RabbitMQ — Context : besoin async durable + JetStream pour replay/persistance ; Decision : NATS JetStream R3 ; Consequences : ops simple vs Kafka complexité, cost-efficient, stack consolidée Grafana ; Alternatives : Kafka, RabbitMQ, AWS SQS+SNS. References : Architecture ligne 123, Story 0.7
   - **`0003-database-per-service.md`** : DB-per-service strict — Context : éviter coupling inter-services ; Decision : 1 DB Postgres par service (10 DBs MVP, 1 instance physique) ; Consequences : pas de cross-service joins SQL, communication async obligatoire ; Alternatives : monolithic schema, schema-per-service same DB. References : Architecture lignes 600-606, Stories 0.6 + 0.10
   - **`0004-booking-order-split.md`** : `booking-svc` ≠ `order-svc` — Context : domaine booking riche (state machine 6 états) vs order (line items + invoicing) ; Decision : split en 2 services dès MVP ; Consequences : saga choréographée 5 étapes, complexité +1 service mais clarté domaine ; Alternatives : 1 seul service `booking-order-svc`. References : Architecture, PRD §FR34-66
   - **`0005-meilisearch-mvp.md`** : Meilisearch dès MVP (override Postgres FTS) — Context : recherche faceted multi-filtres + SEO critique ; Decision : Meilisearch Cloud 30€/mois ; Consequences : sync via NATS consumer, 1 index par locale ; Alternatives : Postgres FTS, Algolia (cher), ElasticSearch (lourd). References : PRD NFR1 (search p95 < 150ms), Architecture ligne 125
   - **`0006-saga-choreographed.md`** : Saga choréographée vs Orchestrator — Context : 5 étapes booking-payment, simplicité MVP ; Decision : choréographée (chaque service réagit aux events) ; Consequences : pas de single point of failure orchestrator, mais reconstruction état distribué via correlationId ; Alternatives : Temporal orchestrator, Saga state machine library. References : Architecture ligne 154, Story 0.7
   - **`0007-outbox-pattern.md`** : Transactional outbox PG LISTEN/NOTIFY — Context : cohérence DB ↔ NATS publish ; Decision : outbox table + PG LISTEN/NOTIFY relay + fallback polling 30s ; Consequences : R13 mitigation, garantie at-least-once ; Alternatives : 2-phase commit (lourd), CDC Debezium (complexe). References : Architecture lignes 632-663, Story 0.7
   - **`0008-gateway-api-public-only.md`** : `gateway-api` seul accès public — Context : sécurité + simplicité auth ; Decision : tous services downstream cachés derrière gateway-api ; Consequences : 1 surface d'attaque publique, mTLS interne prod ; Alternatives : services exposés directement (sécurité ↘), API gateway managed (Kong/Tyk). References : Architecture ligne 2247
   - **`0009-keycloak-identity-svc-split.md`** : 2 couches identité (Keycloak + identity-svc) — Context : Keycloak gère auth, identity-svc gère profil métier (KYC, tier subscription) ; Decision : split + sync via webhooks ; Consequences : drift R8 mitigation via job réconciliation quotidien ; Alternatives : tout dans Keycloak (custom attributes), tout dans identity-svc (réimplémenter OIDC). References : Architecture lignes 234-241
   - **`0010-typeorm-default-raw-sql-readheavy.md`** : TypeORM par défaut + raw SQL pour read-heavy — Context : pragmatisme productivité vs perf ; Decision : TypeORM pour 95 % code, raw SQL `*.query.ts` pour read-heavy paths ; Consequences : flexibilité, perf garantie sur paths critiques ; Alternatives : Prisma (excellent dev UX mais ORM lock-in), Drizzle (récent), tout raw SQL. References : Architecture ligne 603
   - **`0011-tukio-contracts-package.md`** : `@tukio/contracts` package dès Sprint 0 — Context : éviter divergence types frontend ↔ backend ; Decision : monorepo lib partagée avec JSON Schema events + Zod DTOs + envelope types ; Consequences : single source of truth, lint enforce subpath imports ; Alternatives : codegen OpenAPI, types dupliqués (dette). References : Architecture ligne 156, Story 0.2
   - **`0012-i18n-fr-en-sprint-zero.md`** : i18n FR + EN dès Sprint 0 — Context : utilisateurs FR qui préfèrent EN + impossible à rétro-fitter sans douleur ; Decision : `next-intl` + locale-prefix URLs + `<entity>_translations` tables + 1 index Meilisearch par locale ; Consequences : zéro hardcoded text, +20 % effort initial mais gain massif post-MVP ; Alternatives : i18n V1 (douloureux migration). References : Architecture lignes 153, 671, Story 0.9
   - **`0013-frontend-multi-zones-feature-based.md`** : 4 apps Next.js multi-zones — Context : 4 contextes RBAC distincts (Visitor, Customer, Pro, Admin) + bundle size ; Decision : 4 apps distinctes composées via Vercel multi-zones rewrites ; Consequences : déploiement indépendant, cookie session shared `Domain=.tukio.one`, CWV apps/public ; Alternatives : 1 monolith app, Module Federation runtime (V3+ si team > 30 ingénieurs). References : Architecture ligne 582, Story 0.13 (cette story finalise rewrites)
   - **`0014-api-response-envelope.md`** : Enveloppe REST canonique — Context : cohérence DTO success/error + métadonnées (correlationId, locale) ; Decision : `{ method, code, data | error, pagination?, meta }` sur toutes responses gateway-api ; Consequences : interceptor + filter NestJS auto-wrap, lint `tukio/no-bypass-envelope` enforce ; Alternatives : RFC 7807 problem+json (pas d'enveloppe success), GraphQL-style (overkill REST). References : Architecture lignes 1252-1505, Stories 0.2 + 0.6
   - **`template.md`** : Template ADR vide à dupliquer pour Stories Epic 1+ futurs ADRs (ex `0015-stripe-elements-checkout.md`, `0016-meilisearch-cloud-vs-self-hosted-v1.md`)

### Pour Vercel multi-zones

4. **AC4 — `apps/public/next.config.ts` avec rewrites multi-zones** : Given `apps/public/next.config.ts`, When je l'ouvre, Then je trouve la config `rewrites` exacte (cohérent Architecture lignes 416-425) :
   ```ts
   import type { NextConfig } from 'next';
   import createNextIntlPlugin from 'next-intl/plugin';

   const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

   const config: NextConfig = {
     async rewrites() {
       const customerHost = process.env.NEXT_PUBLIC_CUSTOMER_HOST ?? 'https://customer.tukio.one';
       const sellerHost = process.env.NEXT_PUBLIC_SELLER_HOST ?? 'https://seller.tukio.one';
       return [
         { source: '/:locale/account/:path*', destination: `${customerHost}/:locale/account/:path*` },
         { source: '/:locale/cart/:path*', destination: `${customerHost}/:locale/cart/:path*` },
         { source: '/:locale/seller/:path*', destination: `${sellerHost}/:locale/seller/:path*` },
       ];
     },
     // Préserve les autres configs Next.js (i18n via next-intl, images, etc.)
     experimental: {
       optimizePackageImports: ['@tukio/ui', '@tukio/i18n-client', '@tukio/api-client'], // tree-shaking optimal
     },
     images: {
       remotePatterns: [
         { protocol: 'https', hostname: 'images.tukio.one' },         // Cloudflare Images Story 0.12
         { protocol: 'https', hostname: '*.cloudflareimages.com' },
       ],
     },
   };

   export default withNextIntl(config);
   ```
   - **`NEXT_PUBLIC_CUSTOMER_HOST`** + `NEXT_PUBLIC_SELLER_HOST` env vars : default prod URLs, override en dev (ex `http://localhost:3001` pour customer en local — fonctionne avec Vercel multi-zones rewrites locaux via Next.js dev server)
   - **`apps/admin/`** reste **isolée** sur sous-domaine `admin.tukio.one` (pas de rewrite depuis `apps/public/` — Architecture ligne 1069). Justification : sécurité accrue admin, isolation cookies, IP allowlist possible V1+

5. **AC5 — Vercel deployment config** : Given `apps/public/vercel.json` + `apps/{customer,seller,admin}/vercel.json`, When je les ouvre, Then je trouve les configs Vercel pour le déploiement :
   - **`apps/public/vercel.json`** :
     ```json
     {
       "$schema": "https://openapi.vercel.sh/vercel.json",
       "framework": "nextjs",
       "buildCommand": "pnpm turbo run build --filter=public",
       "installCommand": "pnpm install --frozen-lockfile",
       "outputDirectory": ".next",
       "regions": ["fra1"],
       "functions": {
         "app/api/**/*.{js,ts}": { "maxDuration": 30 }
       },
       "headers": [
         {
           "source": "/(.*)",
           "headers": [
             { "key": "X-Frame-Options", "value": "DENY" },
             { "key": "X-Content-Type-Options", "value": "nosniff" },
             { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
             { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" },
             { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
           ]
         }
       ]
     }
     ```
   - **`apps/customer/vercel.json`** : idem mais `buildCommand: "pnpm turbo run build --filter=customer"`, `regions: ["fra1"]`
   - **`apps/seller/vercel.json`** : idem `--filter=seller`
   - **`apps/admin/vercel.json`** : idem `--filter=admin` + headers additionnels (`Cache-Control: private, no-store` partout — admin sensible)
   - **Domain assignment** : `tukio.one` + `www.tukio.one` → apps/public, `customer.tukio.one` → apps/customer, `seller.tukio.one` → apps/seller, `admin.tukio.one` → apps/admin (configuration manuelle Vercel UI ou Terraform Vercel provider V1+)

6. **AC6 — Tests d'intégration multi-zones** : Given un user authentifié sur `customer.tukio.one` (cookie session Keycloak `Domain=.tukio.one` posé par gateway-api Story Epic 1+), When il navigue vers `tukio.one/fr/account/bookings`, Then :
   - **Vercel multi-zones rewrite** : `tukio.one/fr/account/bookings` → rewrite vers `customer.tukio.one/fr/account/bookings` (transparent côté URL bar)
   - **Cookie session shared** : le cookie `tukio-access-token` (`Domain=.tukio.one`, HttpOnly) est envoyé sur les 2 origines automatiquement
   - **Authentification préservée** : `useAuth()` (Story 0.8) retourne `isAuthenticated: true` sur la nouvelle page
   - **Test E2E placeholder** : `apps/public/e2e/multi-zones.spec.ts` (Playwright) qui simule navigation cross-zone — **NB** : ce test est marqué `it.skip()` car nécessite environnement réel Vercel (pas faisable en local sans déploiement). À activer par Story Epic 1+ avec smoke test staging.

### Pour le schema acquisition_*

7. **AC7 — Migration TypeORM `1715220000000-AddAcquisitionColumns.ts` sur `users` table** : Given `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715220000000-AddAcquisitionColumns.ts`, When je l'exécute via `pnpm --filter=identity-svc migration:run`, Then les 6 colonnes sont ajoutées sur `user_profiles` table (créée Story 0.6 baseline) :
   ```sql
   ALTER TABLE user_profiles ADD COLUMN acquisition_source TEXT NOT NULL DEFAULT 'unknown'
     CHECK (acquisition_source IN ('organic', 'google_ads', 'meta_ads', 'referral', 'direct', 'partner', 'unknown'));
   ALTER TABLE user_profiles ADD COLUMN acquisition_medium TEXT;
   ALTER TABLE user_profiles ADD COLUMN acquisition_campaign TEXT;
   ALTER TABLE user_profiles ADD COLUMN acquisition_referral_id UUID;          -- FK vers referral_codes (V1)
   ALTER TABLE user_profiles ADD COLUMN acquisition_first_touch TIMESTAMPTZ NOT NULL DEFAULT NOW();
   ALTER TABLE user_profiles ADD COLUMN acquisition_last_touch TIMESTAMPTZ NOT NULL DEFAULT NOW();

   -- Indexes pour analytics queries
   CREATE INDEX idx_user_profiles_acquisition_source ON user_profiles (acquisition_source);
   CREATE INDEX idx_user_profiles_acquisition_campaign ON user_profiles (acquisition_campaign) WHERE acquisition_campaign IS NOT NULL;
   CREATE INDEX idx_user_profiles_acquisition_first_touch ON user_profiles (acquisition_first_touch);
   ```
   - **`acquisition_source` ENUM** : 7 valeurs (cohérent Architecture ligne 1067 + analytics) :
     - `organic` (SEO, traffic direct sans UTM)
     - `google_ads` (UTM `source=google_ads`)
     - `meta_ads` (UTM `source=facebook_ads` ou `instagram_ads` — agrégés)
     - `referral` (lien partagé par un user via referral code Story 7.6)
     - `direct` (URL directe ou bookmark)
     - `partner` (Apporteur d'affaires V1 — wedding planners, etc.)
     - `unknown` (fallback safe par défaut)
   - **`acquisition_first_touch`** vs **`acquisition_last_touch`** : modèle multi-touch attribution (Story 7.5 V1 raffine — avant V1, juste tracking simple first/last)
   - **`acquisition_referral_id`** : nullable, FK soft (vers `referral_codes` table V1 Story 7.6 — pas de FK contrainte au MVP car table referral_codes pas encore créée)
   - **`down()` migration** : DROP COLUMNs + DROP INDEXes (rollback NFR72 Story 0.11)

8. **AC8 — Migration TypeORM `1715220000001-AddAcquisitionColumns.ts` sur `bookings` table** : Given `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/1715220000001-AddAcquisitionColumns.ts`, When je l'exécute, Then idem AC7 mais sur `bookings` table de `tukio_booking` DB. Justification : tracker l'acquisition au niveau **booking** ET user (un user peut avoir 1ʳᵉ acquisition `organic` mais ses bookings successifs peuvent venir de re-marketing `meta_ads`).
   - **NB** : `bookings` table n'existe PAS encore au scaffolding Story 0.6 (booking-svc n'a pas de migration baseline) — la migration Story 0.13 est **conditionnelle** : si `bookings` table existe (Stories Epic 4 baseline créée), ajouter les colonnes ; sinon, créer un script `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/_pending-acquisition-columns.sql` documenté comme "À jouer après création table bookings dans Story 4.1"
   - **Décision documentée** : la migration `acquisition_*` sur `bookings` est **DIFFÉRÉE Story 4.1** (Booking saga state machine) qui crée la table `bookings`. Story 0.13 prépare le SQL + documentation, Story 4.1 l'intègre dans sa migration baseline.

9. **AC9 — Helpers TypeScript pour parsing UTM params** : Given `packages/contracts/src/types/Acquisition.ts` (étend `@tukio/contracts` Story 0.2), When je l'ouvre, Then je trouve :
   ```ts
   export type AcquisitionSource = 'organic' | 'google_ads' | 'meta_ads' | 'referral' | 'direct' | 'partner' | 'unknown';

   export interface AcquisitionContext {
     source: AcquisitionSource;
     medium?: string;       // e.g. 'cpc', 'social', 'email', 'organic'
     campaign?: string;     // e.g. 'spring2026', 'wedding-march'
     referralId?: string;   // UUID si source === 'referral' ou 'partner'
     firstTouch: string;    // ISO 8601
     lastTouch: string;     // ISO 8601
   }

   export function parseUtmParams(searchParams: URLSearchParams): Partial<AcquisitionContext> {
     const utmSource = searchParams.get('utm_source');
     const source = utmSource ? mapUtmSourceToAcquisitionSource(utmSource) : undefined;
     return {
       source,
       medium: searchParams.get('utm_medium') ?? undefined,
       campaign: searchParams.get('utm_campaign') ?? undefined,
     };
   }

   function mapUtmSourceToAcquisitionSource(utmSource: string): AcquisitionSource {
     const lower = utmSource.toLowerCase();
     if (lower === 'google' || lower === 'google_ads') return 'google_ads';
     if (lower === 'facebook' || lower === 'instagram' || lower === 'meta_ads') return 'meta_ads';
     return 'unknown'; // safe fallback
   }
   ```
   - **Subpath export** : `@tukio/contracts/types/Acquisition` (cohérent Story 0.2 pattern)
   - **Tests** : `@tukio/contracts/src/types/__tests__/Acquisition.spec.ts` (parse UTM, mapping source, edge cases)

10. **AC10 — `acquisitionCookieMiddleware` Next.js (frontend tracking)** : Given `apps/public/src/middleware.ts` (Story 0.8 déjà composé avec auth + i18n middlewares), When un Visitor arrive sur `tukio.one/fr/?utm_source=google_ads&utm_campaign=spring2026`, Then le middleware :
   - **Extract UTM params** depuis `request.nextUrl.searchParams` via `parseUtmParams()` (AC9)
   - **Set cookie `tukio-acquisition`** : JSON encoded `AcquisitionContext` (`Domain=.tukio.one`, `HttpOnly: false` car lu côté client + envoyé serveur, `SameSite=Lax`, `Max-Age=2592000` = 30 jours)
   - **Si cookie déjà existant** : preserve `firstTouch`, update `lastTouch` + `source/medium/campaign` (multi-touch attribution simple — Story 7.5 V1 raffinera)
   - **Si pas d'UTM params** : ne touche pas au cookie existant. Si premier visit sans UTM : set cookie avec `source: 'direct'` ou `'organic'` (heuristique : `referer` header empty → `direct`, sinon `organic`)
   - Le cookie est **lu par gateway-api Story Epic 1+** au moment de l'inscription user / création booking → persisté dans les colonnes `acquisition_*`
   - **Composé avec auth + i18n middlewares** via `composeMiddlewares()` (Story 0.9)

### Sprint 0 close

11. **AC11 — Sprint 0 documentation completion + handoff Epic 1+** : Given `_bmad-output/implementation-artifacts/SPRINT-0-COMPLETION.md` (NOUVEAU), When je l'ouvre, Then je trouve un récapitulatif Sprint 0 :
    - **Status** : ✅ COMPLET (13/13 stories ready-for-dev)
    - **Date** : 2026-05-09
    - **Estimated effort total** : 44-61 j-h dev (cf. memory `sprint_progress_checkpoint.md`)
    - **Liste des 13 stories** + leurs files
    - **Pré-requis pour démarrer Epic 1+** (`/bmad-create-story` Story 1.1) :
      - Stories 0.1 → 0.13 implémentées en dev (séquence recommandée)
      - Validation visuelle : `pnpm dev` → 14 codebases démarrent, `pnpm docker:up` → 6 containers, CI verte sur PR test
      - Cluster Hetzner staging déployé (Story 0.12 ops manuel) + Grafana dashboards visibles
      - Doppler secrets configurés
      - Phasetwo Keycloak provisionné (V0+ — au MVP local Docker Compose suffit)
    - **Sprint 0 design backlog rappel** (5-7j design en parallèle) : 4 nouveaux écrans MVP critiques + audit 5 écrans bundle Cloud Design + 7 templates emails Resend FR/EN
    - **4 décisions D1-D4 toujours en attente** (memory `implementation_readiness_2026_05_09.md`) à trancher avant Epic 5/10
    - **Next steps** : `/bmad-create-story` → auto-discover Story 1.1 (Provision Keycloak realm tukio + roles + clients + Phasetwo MVP)

12. **AC12 — Smoke test final Sprint 0 complet** : Given le repo après implémentation Stories 0.1-0.13, When je lance la séquence smoke complète :
    ```bash
    git clone <repo> && cd tukio
    pnpm install
    pnpm docker:up:wait                      # Story 0.10 — 6 containers healthy
    pnpm docker:bootstrap                    # Story 0.10 — DBs + Keycloak realm + categories seed
    pnpm dev                                 # Story 0.1 — 14 codebases démarrent
    # Vérifier en parallèle :
    curl http://localhost:4001/health        # Story 0.6 — identity-svc OK
    curl http://localhost:3000/fr/           # Story 0.3 — apps/public terracotta + Fraunces OK
    pnpm lint && pnpm typecheck && pnpm test # Stories 0.2-0.9 — tous passent
    pnpm --filter=identity-svc test:e2e      # Story 0.6+0.8 — e2e identity OK
    pnpm chaos:test                          # Story 0.10 + 0.7 — chaos NATS OK
    ```
    Then **toute la séquence passe sans erreur** = **Sprint 0 validé** = **prêt pour Epic 1**.

13. **AC13 — Update `epic-0` status à `done` post-implementation** : Given `_bmad-output/implementation-artifacts/sprint-status.yaml`, When les 13 stories Sprint 0 passent toutes à status `done` (post-dev-story + code-review chacune), Then `epic-0` status auto-update à `done` (cohérent skill `bmad-create-story` workflow). Story 0.13 prépare aussi un retrospective placeholder `epic-0-retrospective: optional` (déjà présent dans sprint-status — pas de change ici, juste documenté que la retrospective Epic 0 est `optional` et **recommandée** post-Sprint 0 implémentation pour capter les leçons).

## Tasks / Subtasks

- [ ] **Task 1 — Créer `docs/adr/template.md`** (AC: #2)
  - [ ] 1.1 — Template Markdown vide avec sections Status / Context / Decision / Consequences / Alternatives Considered / References / Implementation Notes
  - [ ] 1.2 — Documenter dans `docs/adr/README.md` : "Comment proposer un nouvel ADR" (numérotation séquentielle, processus PR review)

- [ ] **Task 2 — Rédiger les 14 ADRs** (AC: #1, #3) — **dense, ~80-200 lignes par ADR**
  - [ ] 2.1 — `0001-pretre-clean-architecture.md` (≥ 200 lignes — fondamental)
  - [ ] 2.2 — `0002-nats-jetstream.md` (~150 lignes)
  - [ ] 2.3 — `0003-database-per-service.md` (~120 lignes)
  - [ ] 2.4 — `0004-booking-order-split.md` (~100 lignes)
  - [ ] 2.5 — `0005-meilisearch-mvp.md` (~120 lignes)
  - [ ] 2.6 — `0006-saga-choreographed.md` (~150 lignes)
  - [ ] 2.7 — `0007-outbox-pattern.md` (~150 lignes)
  - [ ] 2.8 — `0008-gateway-api-public-only.md` (~100 lignes)
  - [ ] 2.9 — `0009-keycloak-identity-svc-split.md` (~120 lignes)
  - [ ] 2.10 — `0010-typeorm-default-raw-sql-readheavy.md` (~120 lignes)
  - [ ] 2.11 — `0011-tukio-contracts-package.md` (~100 lignes)
  - [ ] 2.12 — `0012-i18n-fr-en-sprint-zero.md` (~120 lignes)
  - [ ] 2.13 — `0013-frontend-multi-zones-feature-based.md` (≥ 200 lignes — fondamental)
  - [ ] 2.14 — `0014-api-response-envelope.md` (~150 lignes)
  - [ ] 2.15 — Cross-link les ADRs entre eux (e.g., 0006 saga → reference 0007 outbox)
  - [ ] 2.16 — Mention dans chaque ADR `## Implementation Notes` les Stories qui appliquent la décision (e.g., ADR-001 → Story 0.6, ADR-007 → Story 0.7, etc.)

- [ ] **Task 3 — Update `apps/public/next.config.ts` avec rewrites multi-zones** (AC: #4)
  - [ ] 3.1 — Ajouter import `next-intl/plugin` (Story 0.9 setup)
  - [ ] 3.2 — Implémenter `async rewrites()` avec 3 rewrites (cf. AC4 spec exhaustive)
  - [ ] 3.3 — Ajouter `experimental.optimizePackageImports` pour tree-shaking `@tukio/{ui,i18n-client,api-client}`
  - [ ] 3.4 — Configurer `images.remotePatterns` pour Cloudflare Images (Story 0.12)
  - [ ] 3.5 — Smoke test : `pnpm --filter=public dev` → naviguer vers `http://localhost:3000/fr/account/...` → vérifier rewrite vers `http://localhost:3001/fr/account/...` (customer port Story 0.1)

- [ ] **Task 4 — Créer 4 `vercel.json` per app** (AC: #5)
  - [ ] 4.1 — `apps/public/vercel.json` (security headers, regions fra1, build command Turborepo filter)
  - [ ] 4.2 — `apps/customer/vercel.json` (idem mais filter customer)
  - [ ] 4.3 — `apps/seller/vercel.json` (idem)
  - [ ] 4.4 — `apps/admin/vercel.json` + headers strictes `Cache-Control: private, no-store`
  - [ ] 4.5 — Documenter dans `apps/<app>/README.md` : domain assignment Vercel (manuel UI ou Terraform Vercel V1+)

- [ ] **Task 5 — Test E2E multi-zones placeholder** (AC: #6)
  - [ ] 5.1 — Créer `apps/public/e2e/multi-zones.spec.ts` (Playwright config Story 0.5/0.11)
  - [ ] 5.2 — Test marqué `it.skip()` avec TODO clair "Activer en Story Epic 1+ smoke test staging — nécessite déploiement Vercel réel"
  - [ ] 5.3 — Pseudo-code commenté : `await page.goto('https://customer.tukio.one'); await login(); await page.goto('https://tukio.one/fr/account/bookings'); expect(page.url()).toContain('account/bookings'); expect(await isAuthenticated()).toBe(true)`

- [ ] **Task 6 — Migration `acquisition_*` sur `users`** (AC: #7)
  - [ ] 6.1 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddAcquisitionColumns.ts` via `pnpm --filter=identity-svc migration:generate` (timestamp réel généré)
  - [ ] 6.2 — Implémenter `up()` : ALTER TABLE 6 columns + 3 indexes + CHECK constraint sur ENUM
  - [ ] 6.3 — Implémenter `down()` : DROP indexes + DROP columns (rollback NFR72)
  - [ ] 6.4 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/user-profile.entity.ts` (Story 0.6) avec les 6 nouveaux champs : `acquisitionSource: AcquisitionSource`, `acquisitionMedium?: string`, etc.
  - [ ] 6.5 — Update `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` (Story 0.6) avec champs `acquisition: AcquisitionContext` (importé depuis `@tukio/contracts/types/Acquisition` AC9)
  - [ ] 6.6 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts` (Story 0.6) avec mapping entity ↔ aggregate sur les 6 champs
  - [ ] 6.7 — Tester migration : `pnpm --filter=identity-svc migration:run` → vérifier colonnes via `psql`
  - [ ] 6.8 — Tester rollback : `pnpm --filter=identity-svc migration:revert` → colonnes supprimées

- [ ] **Task 7 — Migration `acquisition_*` sur `bookings` (différée Story 4.1)** (AC: #8)
  - [ ] 7.1 — Créer `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/_pending-acquisition-columns.sql` (placeholder NON exécuté — préparation Story 4.1)
  - [ ] 7.2 — Documenter dans `_pending-acquisition-columns.sql` : "À intégrer dans Story 4.1 baseline migration `<timestamp>-CreateBookingsBaseline.ts` — voir Story 0.13 dev notes pour rationale"
  - [ ] 7.3 — Update `_bmad-output/implementation-artifacts/sprint-status.yaml` development_status `4-1-booking-svc-pretre-saga-state-machine: backlog` avec annotation YAML (`# NOTE: include acquisition_* columns from Story 0.13`)

- [ ] **Task 8 — Helpers `Acquisition` types + `parseUtmParams()`** (AC: #9)
  - [ ] 8.1 — Créer `packages/contracts/src/types/Acquisition.ts` avec type `AcquisitionSource` + interface `AcquisitionContext` + fonctions `parseUtmParams` + `mapUtmSourceToAcquisitionSource`
  - [ ] 8.2 — Update `packages/contracts/src/types/index.ts` (Story 0.2) — re-export Acquisition types
  - [ ] 8.3 — Update `packages/contracts/package.json` `exports` (Story 0.2) — ajouter `"./types/Acquisition": "./src/types/Acquisition.ts"`
  - [ ] 8.4 — Tests `packages/contracts/src/types/__tests__/Acquisition.spec.ts` :
    - parseUtmParams happy path (utm_source + utm_medium + utm_campaign)
    - mapUtmSourceToAcquisitionSource pour Google/Facebook/Instagram/inconnu
    - Edge cases : URLSearchParams empty → returns `{}`, malformed UTM → fallback `unknown`

- [ ] **Task 9 — `acquisitionCookieMiddleware` dans `apps/public/`** (AC: #10)
  - [ ] 9.1 — Créer `apps/public/src/middleware/acquisition-cookie.ts` qui exporte `acquisitionCookieMiddleware: NextMiddleware`
  - [ ] 9.2 — Implémenter parse UTM + set cookie `tukio-acquisition` (`Domain=.tukio.one`, `Max-Age=2592000`, `SameSite=Lax`)
  - [ ] 9.3 — Logique multi-touch : preserve `firstTouch`, update `lastTouch` + `source/medium/campaign`
  - [ ] 9.4 — Heuristique source si pas d'UTM : `referer` header empty → `direct`, sinon `organic`
  - [ ] 9.5 — Composer dans `apps/public/src/middleware.ts` via `composeMiddlewares(i18nMw, acquisitionCookieMw)` (helper Story 0.9)
  - [ ] 9.6 — Idem dans `apps/customer/`, `apps/seller/`, `apps/admin/` middlewares (cookie marker partagé via `Domain=.tukio.one`)
  - [ ] 9.7 — Tests `apps/public/src/middleware/__tests__/acquisition-cookie.spec.ts` (mocks NextRequest/Response Story 0.9 pattern)

- [ ] **Task 10 — Document Sprint 0 completion + handoff Epic 1** (AC: #11)
  - [ ] 10.1 — Créer `_bmad-output/implementation-artifacts/SPRINT-0-COMPLETION.md` (cf. AC11 spec exhaustive)
  - [ ] 10.2 — Mettre à jour `MEMORY.md` : ajouter une entrée `Sprint 0 completion 2026-05-09` qui pointe vers ce fichier
  - [ ] 10.3 — Update memory `sprint_progress_checkpoint.md` pour acter Sprint 0 = 13/13 stories ready-for-dev

- [ ] **Task 11 — Smoke test final + commit** (AC: #12, #13)
  - [ ] 11.1 — `pnpm install` (au cas où deps Acquisition ajoutées)
  - [ ] 11.2 — `pnpm lint && pnpm typecheck && pnpm test` racine → tout passe
  - [ ] 11.3 — `pnpm --filter=identity-svc migration:run` → migration acquisition appliquée
  - [ ] 11.4 — Validation manuelle : `pnpm --filter=public dev` → naviguer `http://localhost:3000/fr/?utm_source=google_ads&utm_campaign=spring2026` → vérifier cookie `tukio-acquisition` set dans DevTools Application tab
  - [ ] 11.5 — Vérifier `docs/adr/` contient 14 ADRs + template + README
  - [ ] 11.6 — Commit `feat(adr): 14 ADRs + Vercel multi-zones + acquisition schema (Sprint 0 closing)` — Story 0.13 done

## Dev Notes

### Pourquoi cette story est la 13ᵉ (DERNIÈRE Sprint 0) — contexte stratégique

> **Sources canoniques** : Architecture lignes 562-583 (12 ADRs préexistants + 13/14 nouveaux), 416-425 (Vercel multi-zones rewrites), PRD NFR63-64 + FR105-106 (acquisition tracking K-04 critique).

Stories 0.1-0.12 ont posé tout le code + l'infra. **Story 0.13 clôt Sprint 0** avec 3 livrables apparemment hétérogènes mais qui partagent un point commun : **chacun est impossible à rétro-fitter sans douleur** :
1. **ADRs** : sans ADRs versionnés Git dès le départ, on perd la traçabilité des décisions ; Stories Epic 1+ remettent en question (à raison ou tort) des choix Sprint 0 sans avoir le contexte
2. **Vercel multi-zones** : configuration des rewrites + cookie `Domain=.tukio.one` figés Sprint 0 ; tout changement V1+ casse l'auth cross-subdomain pour les users existants
3. **Schema acquisition_*** : impossible à rétro-fitter sans perte (NFR64 K-04) ; chaque Visitor inscrit avant cette migration aura `acquisition_source: NULL` à vie

**Décisions techniques majeures** :
1. **Format ADR MADR/Nygard standard** : 5 sections fixes (Status / Context / Decision / Consequences / Alternatives). Pas de format custom Tukio (interopérabilité avec adr-tools, ADR Manager, etc.)
2. **`apps/admin/` PAS dans rewrites multi-zones** : reste isolée sur `admin.tukio.one` (sécurité accrue, IP allowlist V1+, isolation cookies)
3. **Acquisition schema sur `users` ET `bookings`** : 2 niveaux de tracking (user level pour 1ʳᵉ acquisition, booking level pour re-marketing). Modèle multi-touch attribution simple MVP, raffiné Story 7.5 V1.
4. **Migration `bookings` différée Story 4.1** : booking-svc n'a pas de baseline migration au scaffolding Story 0.6. Story 4.1 (Booking saga state machine) crée la table `bookings` — Story 0.13 prépare le SQL en placeholder à intégrer dans la baseline 4.1.
5. **`acquisitionCookieMiddleware` dans middleware composé** : utilise `composeMiddlewares()` (Story 0.9) pour chain avec auth + i18n. Pas de race condition cookie (Next.js middleware fonctionne en série).
6. **Heuristique source par défaut** : `direct` si pas d'UTM ni referer (URL directe / bookmark), `organic` si referer présent (SEO inbound).
7. **`@tukio/contracts/types/Acquisition`** étend Story 0.2 — patron déjà figé. Pas de nouveau package.
8. **Sprint 0 close avec retrospective `optional`** mais recommandée — capter les leçons avant Epic 1.

### Versions à utiliser

| Stack | Version | Rationale |
|---|---|---|
| **Markdown ADRs** | n/a | Format texte simple, versionné Git |
| **Next.js** | 15.x latest (cohérent Story 0.1) | rewrites API stable |
| **TypeORM** | latest stable (cohérent Story 0.6) | migration:generate |
| **next-intl** | 4.x latest (cohérent Story 0.9) | createNextIntlPlugin import |

> ⚠️ **Pas de nouvelles dépendances** : Story 0.13 réutilise tout l'écosystème déjà installé Stories 0.1-0.12.

### Project Structure cible

```
docs/adr/                                            # ← cette story
├─ README.md                                         # comment proposer un ADR
├─ template.md                                       # template réutilisable
└─ 0001-*.md à 0014-*.md                             # 14 ADRs

apps/public/
├─ next.config.ts                                    # ← UPDATE rewrites multi-zones
├─ vercel.json                                       # ← CREATE
└─ src/middleware/acquisition-cookie.ts              # ← CREATE

apps/{customer,seller,admin}/
├─ vercel.json                                       # ← CREATE × 3
└─ src/middleware.ts                                 # ← UPDATE compose acquisition middleware

apps/identity-svc/src/
├─ infrastructure/persistence/typeorm/
│  ├─ migrations/<timestamp>-AddAcquisitionColumns.ts  # ← CREATE
│  ├─ entities/user-profile.entity.ts                  # ← UPDATE 6 colonnes
│  └─ mappers/user-profile.mapper.ts                   # ← UPDATE
└─ domain/model/user-profile.aggregate.ts             # ← UPDATE acquisition champ

apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/
└─ _pending-acquisition-columns.sql                  # ← CREATE (placeholder Story 4.1)

packages/contracts/src/types/Acquisition.ts          # ← CREATE
packages/contracts/src/types/__tests__/Acquisition.spec.ts # ← CREATE

_bmad-output/implementation-artifacts/SPRINT-0-COMPLETION.md  # ← CREATE
```

### Pattern code — `template.md` ADR (à dupliquer pour les 14 + futurs)

```markdown
# ADR-NNNN: <Title in Title Case>

- **Status**: ✅ Accepted (Proposed | Accepted | Deprecated | Superseded by ADR-XXXX)
- **Date**: YYYY-MM-DD (immutable post-Acceptance)
- **Deciders**: <names>
- **Tags**: `architecture`, `<categorie>` (backend, frontend, data, security, ops)

## Context

<Pourquoi cette décision est nécessaire ? Quel problème métier ou technique on résout ? Quelles forces s'opposent ?>

## Decision

<Décision claire en 1-3 sentences. Pas d'ambiguïté.>

## Consequences

### Positive
- <Bénéfice 1>
- <Bénéfice 2>

### Negative / Trade-offs
- <Coût ou contrainte 1>

### Neutral
- <Effet neutre>

## Alternatives Considered

### <Alternative 1>
<Description + pourquoi rejetée>

### <Alternative 2>
<Description + pourquoi rejetée>

## References

- [Source: PRD section X]
- [Source: Architecture section Y]
- [Story Z où la décision est appliquée]
- [External: <lien externe pertinent>]

## Implementation Notes

<Optionnel — patterns code recommandés, lints associés, exemples concrets>
```

### Pattern code — `0001-pretre-clean-architecture.md` (excerpt fondamental)

```markdown
# ADR-0001: Pattern Pretre Clean Architecture (strict, monorepo Turborepo)

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`, `pattern`

## Context

Tukio.one déploie 10 microservices NestJS qui doivent évoluer pendant 5+ ans avec des équipes qui changent. Sans un pattern strict imposé dès le 1ᵉʳ commit, chaque service va dériver vers son propre style → dette technique massive après 18 mois (cf. retours d'expérience documentés `docs/tukio_*.md`).

Plusieurs forces s'opposent :
1. **Productivité court-terme** vs **maintenabilité long-terme** : pattern strict = +20-30 % effort initial mais coût marginal nul après scaffolding
2. **Flexibilité** vs **contrainte** : enforcing strict via lint évite les "je sais ce que je fais" qui pourrissent la codebase
3. **Choix de pattern** : DDD tactique vs Hexagonal vs Onion vs Pretre adapté Tukio

## Decision

Tukio adopte le **Pattern Pretre Clean Architecture strict** (référence canonique : https://github.com/jonathanPretre/clean-architecture-nestjs) pour tous les 10 microservices backend. Structure imposée :

\`\`\`
service-svc/src/
├─ domain/         # ZÉRO dépendance externe (NestJS, TypeORM, axios, etc.)
│  ├─ model/       # Aggregates + Value Objects
│  ├─ ports/       # Interfaces (IRepository, IExternalService)
│  ├─ service/     # Domain services stateless
│  └─ exception/   # Domain exceptions
├─ usecases/       # 1 classe par use case, méthode .execute()
└─ infrastructure/ # Implementations concrètes des ports
   ├─ persistence/typeorm/
   ├─ messaging/nats/
   ├─ external/<provider>/
   ├─ http/{controllers,dtos,guards,interceptors,filters}/
   └─ usecases-proxy/usecases-proxy.module.ts  # central wiring
\`\`\`

**Règles non négociables** :
- `domain/` ne contient aucun import de lib I/O (vérifié par `eslint-plugin-boundaries`)
- Interfaces dans `domain/ports/`, implémentations dans `infrastructure/`
- Use cases dépendent uniquement des ports via Symbol DI tokens
- Wiring port → impl uniquement dans `usecases-proxy.module.ts`

## Consequences

### Positive
- **Tests unitaires triviaux** sur le domaine (pas de testcontainers, pas de mocks NestJS)
- **Swap de provider sans douleur** (TypeORM → Prisma = 1 classe à réécrire)
- **Cohérence inter-services** : 10 services, même structure → onboarding rapide
- **Lint enforce dès Sprint 0** → PR rejetée auto sur violation domain/infrastructure
- **Replication facile** : 1 service template (identity-svc Story 0.6) cloné vers les 9 autres

### Negative / Trade-offs
- **+20-30 % effort scaffolding** initial vs structure libre
- **Verbosité** : repository pattern + UseCaseProxy + DTOs + mappers = beaucoup de boilerplate
- **Apprentissage** : pattern moins familier qu'un MVC simple Express

### Neutral
- Lint custom `eslint-plugin-boundaries` ajoute friction réviewers (acceptable)

## Alternatives Considered

### DDD Tactique pur (sans Clean Arch)
Aggregate Root + Value Objects + Domain Events sans la séparation domain/infrastructure stricte. **Rejetée** : couple le domaine aux libs (TypeORM dans aggregates) → tests difficiles, swap impossible.

### Hexagonal Architecture pure (Cockburn)
Idem Clean Arch mais terminologie ports/adapters strict. **Considérée équivalente** au Pattern Pretre. Choix Pretre car repo référence concret + customisations Tukio documentées (`docs/tukio_booking_svc_deepdive.md`).

### Style Express libre (no-pattern)
Aucune structure imposée, chaque service organisé par convention équipe. **Rejetée** : drift garantie après 18 mois.

## References

- [External: https://github.com/jonathanPretre/clean-architecture-nestjs (repo référence canonique)]
- [Source: Architecture lignes 168-232 (Cross-Cutting Concern #1 Clean Architecture)]
- [Source: Architecture lignes 1161-1208 (Backend service structure Pattern Pretre)]
- [Source: Story 0.6 (Pattern Pretre scaffolding identity-svc + replication script)]
- [Source: PRD §12.8 (Stack figée)]

## Implementation Notes

- **Lint enforcement** via `eslint-plugin-boundaries` (Story 0.6 task 8.1) + lint custom `tukio/no-class-validator` (Story 0.11) + `tukio/no-bypass-envelope` (Story 0.11)
- **Coverage thresholds** différenciés par layer (NFR71) : `domain/` ≥ 80 %, `usecases/` ≥ 70 %, `infrastructure/` ≥ 50 % — enforced via Vitest coverage thresholds par workspace (Story 0.11)
- **UseCaseProxy<T>** pattern : seul endroit où domaine touche infrastructure (DI factory) — voir Story 0.6 task 6.1 pour le code exact
- **Replication script** `infra/scripts/replicate-pretre-structure.sh --target=<svc>` (Story 0.6 task 12) pour cloner la structure dans les 9 autres services
```

### Critical Architecture Constraints

> Cf. Architecture + memories `feedback_*.md`.

1. **ADRs versionnés Git, immutables post-Acceptance** : ne jamais éditer un ADR `Accepted`. Si nouvelle décision contradictoire → nouvel ADR avec `Status: Accepted` + ancien ADR mis à `Status: Superseded by ADR-XXXX`.
2. **Format MADR/Nygard standard** : 5 sections fixes. Cohérence cross-ADR.
3. **Cross-link entre ADRs** : ADR-006 saga → cite ADR-007 outbox. Permet exploration du graphe de décisions.
4. **`apps/admin/` isolée** : pas dans rewrites multi-zones. Sécurité par séparation.
5. **Cookie `Domain=.tukio.one`** : critique pour cross-subdomain (Story 0.8 a posé). Ne pas changer Sprint 0+.
6. **`acquisition_first_touch` immutable** : preserve la 1ʳᵉ source d'acquisition (analytics historiques). Update uniquement `last_touch` + `source/medium/campaign` au multi-touch.
7. **Migration acquisition impossible à rétro-fitter** (NFR64 K-04) : Sprint 0 ABSOLUMENT.
8. **`acquisitionCookieMiddleware` exécuté avant auth middleware** (Story 0.8) — pour que le user qui se logge ait le cookie acquisition déjà set.

### What this story does NOT do (out of scope)

- ❌ **Tests E2E multi-zones réels** — nécessitent déploiement Vercel staging (Story Epic 1+ smoke test)
- ❌ **Migration acquisition sur `bookings`** — différée Story 4.1 (booking-svc baseline)
- ❌ **Multi-touch attribution complète** (modèles last-click, first-click, linear, time-decay) → Story 7.5 V1
- ❌ **Referral codes table V1** → Story 7.6
- ❌ **Apporteurs d'affaires partner dashboard** → Story 11.3 V1
- ❌ **Plausible + PostHog setup** → Story 7.4
- ❌ **Server-side acquisition events tracking** (gateway-api PostHog forward) → Story 7.5 V1
- ❌ **ADR Manager UI / adr-tools CLI** → V1+ (utiliser éditeur Markdown standard MVP)
- ❌ **Vercel deployment Terraform** → V1+ (manuel UI Vercel MVP)
- ❌ **Sprint 0 retrospective** : `optional` status — recommandée mais pas dans cette story (post-implementation)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `apps/public/next.config.ts` — ajouter rewrites multi-zones + experimental.optimizePackageImports
> - `apps/{customer,seller,admin}/src/middleware.ts` — composer avec acquisition middleware
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/user-profile.entity.ts` (Story 0.6) — ajouter 6 nouveaux champs
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts` (Story 0.6) — mapping
> - `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` (Story 0.6) — champ `acquisition`
> - `packages/contracts/src/types/index.ts` (Story 0.2) — re-export Acquisition types
> - `packages/contracts/package.json` (Story 0.2) — ajouter `./types/Acquisition` export

> **À CREATE** :
> - `docs/adr/README.md`
> - `docs/adr/template.md`
> - `docs/adr/0001-*.md` à `0014-*.md` (14 ADRs)
> - `apps/{public,customer,seller,admin}/vercel.json` (4 fichiers)
> - `apps/public/src/middleware/acquisition-cookie.ts` + tests
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddAcquisitionColumns.ts`
> - `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/_pending-acquisition-columns.sql` (placeholder Story 4.1)
> - `packages/contracts/src/types/Acquisition.ts` + tests
> - `_bmad-output/implementation-artifacts/SPRINT-0-COMPLETION.md`
> - **Estimation total fichiers créés/modifiés** : ~30 fichiers (dont 14 ADRs denses)

### Previous Story Intelligence (Stories 0.1 → 0.12)

**Story 0.1** : `apps/public/next.config.ts` placeholder Next.js default. Story 0.13 ajoute `rewrites` + `experimental.optimizePackageImports`. Ports figés (3000-3003).

**Story 0.2** : `@tukio/contracts/types/` pattern subpath exports. Story 0.13 ajoute `Acquisition.ts` (cohérent pattern). `Actor` + `Locale` + `Currency` + `Money` + `DomainEvent` déjà exportés — `Acquisition` est le 6ᵉ type global.

**Story 0.6** : `user_profiles` table baseline migration `1715200000000-CreateUserProfilesBaseline.ts`. Story 0.13 ajoute migration `<timestamp>-AddAcquisitionColumns.ts` qui suit (timestamp > baseline). `UserProfile` aggregate à étendre avec champ `acquisition`.

**Story 0.7** : Migration outbox/inbox `1715210000000-AddOutboxInboxTables.ts`. Story 0.13 migration acquisition est le 3ᵉ batch après outbox/inbox.

**Story 0.8** : Cookie `Domain=.tukio.one` HttpOnly. Story 0.13 ajoute cookie `tukio-acquisition` non-HttpOnly (lu par middleware + envoyé serveur).

**Story 0.9** : `composeMiddlewares()` helper créé. Story 0.13 utilise pour composer acquisition middleware avec i18n + auth.

**Story 0.10** : `bootstrap-databases.sh` joue migrations. Story 0.13 migration acquisition jouée automatiquement à Story 0.10 task 3.4 (boucle services + migration:run).

**Story 0.11** : Lint custom `tukio/no-fr-paths` + `tukio/no-hardcoded-text`. Story 0.13 ADRs en EN strict (cohérent).

**Story 0.12** : Helm charts + ArgoCD. Story 0.13 ne touche pas l'infra K8s.

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.13 |
|---|---|---|
| EN strict | tous fichiers + types EN | ✅ |
| ADR format MADR | 5 sections fixes | ✅ AC2 |
| ADR numérotation séquentielle | 0001, 0002, ..., 9999 | ✅ |
| ADR immutable post-Accepted | `Superseded by` si change | ✅ |
| Migration timestamp réel | `Date.now()` | ✅ Task 6.1 |
| Cookie `Domain=.tukio.one` | cross-subdomain | ✅ |
| Coverage tests acquisition | ≥ 80 % helpers | ✅ Task 8.4 |
| Idempotent migration | `IF NOT EXISTS` PG | ✅ |
| FK soft (referral) | nullable, pas FK contrainte MVP | ✅ |

### Testing Standards

- **Tests `Acquisition.ts`** : Vitest (cohérent Story 0.2 pattern) — coverage ≥ 80 %.
- **Tests `acquisitionCookieMiddleware`** : Vitest + mocks Next.js (cohérent Story 0.9 pattern) — coverage ≥ 80 %.
- **Tests migration acquisition** : E2E manuel via `pnpm --filter=identity-svc migration:run` + `psql` query.
- **Pas de tests E2E multi-zones** Story 0.13 (nécessite Vercel staging — Stories Epic 1+).

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 562-583 (12 ADRs préexistants + ADR-013 + ADR-014 = 14 ADRs).

✅ **Aligné** avec Architecture lignes 416-425 (Vercel multi-zones rewrites — 3 destinations).

✅ **Aligné** avec PRD NFR63-64 + FR105-106 (acquisition tracking K-04 critique impossible à rétro-fitter).

⚠️ **Décision documentée** : ADR-013 + ADR-014 sont **NOUVEAUX** (Architecture session 2026-05-08, Architecture lignes 1087-1089). Les 12 autres ADRs préexistent dans le PRD §12.8 + `tukio_product_tech_alignment.md` §D — Story 0.13 les **formalise** dans `docs/adr/` au format MADR standard. Le contenu est **adapté** depuis ces sources, pas copié-collé.

⚠️ **Décision documentée** : `apps/admin/` exclue des rewrites multi-zones — reste isolée sur sous-domaine `admin.tukio.one` (Architecture ligne 1069). Si V1+ on veut intégrer, créer un nouveau ADR `0015-admin-multi-zones-integration.md`.

⚠️ **Décision documentée** : migration `acquisition_*` sur `bookings` **différée Story 4.1** car booking-svc n'a pas de baseline migration au scaffolding. Documenter clairement dans `_pending-acquisition-columns.sql` + sprint-status.yaml YAML annotation Story 4.1.

⚠️ **À noter** : `acquisitionCookieMiddleware` est un **3ᵉ middleware** dans la chaîne Next.js (après i18n + auth). Vérifier la **performance impact** (devrait être négligeable — JSON parse + cookie set < 1ms). Si > 5ms par requête → optimiser via early-return si pas d'UTM params.

⚠️ **À noter** : la rétrospective Sprint 0 (`epic-0-retrospective: optional` dans sprint-status.yaml) est **recommandée** post-implementation des 13 stories pour capturer les leçons (effort réel vs estimé, décisions à reconsidérer, conventions ajoutées en cours de route, etc.). Story 0.13 ne la déclenche pas — c'est l'équipe qui décide.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-Priority-Analysis — Lines 562-583 (12 ADRs préexistants + ADR-013 + ADR-014)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Multi-Zones-Rewrites — Lines 416-425 (config rewrites Vercel)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Component-Dependencies — Line 1069 (apps/admin isolée admin.tukio.one)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Sequence — Line 1053 (Vercel multi-zones config)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Response-Format-Enveloppe-REST — Lines 1252-1505 (ADR-014 source)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-app-structure-feature-based — Lines 1210-1235 (ADR-013 source)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.13 — Lines 1049-1069 (6 ACs originaux)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR63-64 — Lines 1395-1396 (acquisition K-04 critique)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR105-106 — Lines 1231-1232 (UTM tracking + server-side events)]
- [Source: _bmad-output/planning-artifacts/prd.md#12-8-Stack-figée — Source des 12 ADRs préexistants]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Pattern subpath exports + types/]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — `user_profiles` table baseline + UserProfile aggregate]
- [Source: _bmad-output/implementation-artifacts/0-9-setup-tukio-api-client-i18n-client-testing.md — `composeMiddlewares()` helper]
- [Source: _bmad-output/implementation-artifacts/0-10-docker-compose-dev-local-bootstrap-scripts.md — `bootstrap-databases.sh` runs migrations]
- [Source: _bmad-output/implementation-artifacts/0-11-ci-github-actions-pipeline.md — Lint custom `tukio/no-hardcoded-text`]
- [External: https://adr.github.io/ (ADR organisation + tooling)]
- [External: https://github.com/joelparkerhenderson/architecture-decision-record (ADR templates)]
- [External: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites (Next.js rewrites API)]
- [External: https://vercel.com/docs/projects/project-configuration#rewrites (Vercel multi-zones)]
- [Memory: feedback_clean_architecture_explicit.md — pattern Pretre canonique]
- [Memory: feedback_api_envelope_response.md — enveloppe REST canonique]
- [Memory: feedback_i18n_frontend.md — i18n FR/EN dès Sprint 0]
- [Memory: feedback_tech_layer_english.md — code/files/folders EN strict]
- [Memory: implementation_readiness_2026_05_09.md — 4 décisions D1-D4 en attente]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent)

### Debug Log References

(à remplir — décisions ADR contenu vs source PRD/Architecture, vérifications cookie multi-zones, durations migration acquisition, time tracker rédaction 14 ADRs)

### Completion Notes List

(à remplir — résumé décisions, déviations, points d'attention pour Story 1.1 et Stories Epic 1+ qui consomment ces ADRs comme source-of-truth + acquisition tracking + Vercel multi-zones)

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational) — **DERNIÈRE STORY**
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 3-4 jours (~30 fichiers : 14 ADRs denses + 4 vercel.json + middleware + migration + helpers + Sprint 0 completion doc)
- **Dépendances upstream** :
  - Stories 0.1-0.12 (toutes — Story 0.13 référence + clôture)
  - Story 0.2 (`@tukio/contracts/types/` pattern à étendre avec Acquisition)
  - Story 0.6 (`user_profiles` table à étendre)
  - Story 0.8 (cookie `Domain=.tukio.one` posé)
  - Story 0.9 (`composeMiddlewares()` helper)
- **Dépendances downstream** :
  - **Story 1.1** (Provision Keycloak realm) — utilise ADRs comme source-of-truth conventions
  - **Story 1.2** (B2C registration) — persiste `acquisition_*` columns au signup user (cookie → DB)
  - **Story 4.1** (Booking saga state machine) — intègre `_pending-acquisition-columns.sql` dans baseline migration `bookings`
  - **Story 4.4** (Create booking) — persiste `acquisition_*` columns sur la table `bookings`
  - **Story 7.4** (Plausible setup) — consomme acquisition data
  - **Story 7.5** (Multi-touch attribution V1) — raffine modèle simple Sprint 0
  - **Story 7.6** (Referral codes V1) — connecte FK soft `acquisition_referral_id`
  - **Stories Epic 1+ (toutes)** — consultent ADRs pour conventions
- **FRs covered** :
  - **FR105** — UTM tracking + persistance (préparé via schema + middleware) ✅
  - **FR106** — préparé (events business via gateway-api Story 7.5 V1)
- **NFRs touchés** :
  - **NFR63** — server-side events tracking préparé (Story 7.5 V1 finalise)
  - **NFR64** — UTM persistés sur users + bookings dès Sprint 0 ✅ (impossible à rétro-fitter K-04 critique)
  - **NFR67** — pattern `@tukio/contracts/types/Acquisition` figé
  - **NFR74** — naming + conventions ADRs documentées source-of-truth
  - **ADR-001 à 014** — formalisés ✅ (foundational pour toutes Stories Epic 1+)

---

## 🎉 SPRINT 0 EPIC 0 — STATUS

**13/13 stories ready-for-dev** ✅

| # | Story | Estimation |
|---|---|---|
| 0.1 | Bootstrap monorepo Turborepo | 3-5 j |
| 0.2 | `@tukio/contracts` | 2-3 j |
| 0.3 | Design system Tailwind v4 | 2-3 j |
| 0.4 | 17 atomics `@tukio/ui/components` | 4-5 j |
| 0.5 | 12 patterns `@tukio/ui/patterns` | 4-5 j |
| 0.6 | Pattern Pretre identity-svc + script replication | 5-7 j |
| 0.7 | `@tukio/messaging` NATS + outbox/inbox | 4-5 j |
| 0.8 | `@tukio/auth` + `@tukio/auth-client` | 4-6 j |
| 0.9 | `@tukio/api-client` + `@tukio/i18n-client` + `@tukio/testing` | 6-8 j |
| 0.10 | Docker Compose dev local + bootstrap scripts | 2-3 j |
| 0.11 | CI GitHub Actions pipeline | 3-4 j |
| 0.12 | Helm charts K8s + ArgoCD + observability | 5-7 j |
| 0.13 | 14 ADRs + Vercel multi-zones + acquisition schema | 3-4 j |

**Total : ~47-65 j-h dev** (~10-13 semaines pour 1 dev fullstack senior, ~5-7 semaines pour 2 devs).

**Prêt pour `/bmad-create-story` → Story 1.1** (Provision Keycloak realm tukio + 4 clients + 5 rôles + Phasetwo MVP — ouverture Epic 1).
