# Tukio — Product ↔ Technical Architecture Alignment

> Document de réconciliation entre la spec produit (`tukio_spec_v2.md` et docs UX) et l'architecture API microservices (`Research_Report.md`).
> À lire après les deux dossiers principaux.
> Audience : produit, dev backend, dev frontend, CTO/lead.

---

## Sommaire

- [A. Why this document](#a-why-this-document)
- [B. Mapping: functional domains ↔ microservices](#b-mapping-functional-domains--microservices)
- [C. Naming alignment](#c-naming-alignment)
- [D. Architecture Decision Records](#d-architecture-decision-records-adrs)
- [E. Updated risks & mitigations](#e-updated-risks--mitigations)
- [F. MVP deployment topology](#f-mvp-deployment-topology)
- [G. Cross-document inconsistencies — resolved](#g-cross-document-inconsistencies--resolved)
- [H. What this document changes elsewhere](#h-what-this-document-changes-elsewhere)

---

## A. Why this document

Le projet Tukio a maintenant deux corpus documentaires complets mais produits indépendamment :

| Corpus | Contenu | Optique | Convention |
|--------|---------|---------|------------|
| **Produit / UX** (5 docs, ~6 855 lignes) | Spec v2.1, deep dives Catalogue/Booking/Paiements, Design Brief, Information Architecture, UX flows | "Ce qu'on construit pour les utilisateurs" | FR avec routes EN |
| **Backend / API** (1 doc, ~700 lignes) | Architecture microservices NestJS hexagonal, services map, NATS, Pretre proxy pattern | "Comment on le construit côté serveur" | EN strict |

Ces deux corpus ont été produits avec des partis-pris cohérents, mais ils utilisent un **vocabulaire différent**, **découpent différemment** ce qui est un seul concept côté produit en plusieurs services techniques, et **divergent sur quelques choix techniques** (timing Meilisearch, fusion booking/order, etc.).

**Le risque** : sans réconciliation explicite, l'équipe dev qui lira les docs va tomber sur ces divergences au moment où elle écrit du code, devra trancher dans l'urgence et ces tranchements seront souvent contradictoires entre devs.

**L'objet de ce doc** : trancher proprement, une fois pour toutes, sur les divergences ; produire le mapping unique qui sert de référence ; et lister les ADRs qui en découlent.

---

## B. Mapping: functional domains ↔ microservices

### B.1 Vue d'ensemble

Côté produit, on a **8 domaines fonctionnels** (cf. `tukio_spec_v2.md` Partie 2). Côté backend, on a **10 services** (cf. `Research_Report.md` §2.1). Ce ne sont **pas** les mêmes découpages, et c'est normal :

- Les domaines fonctionnels sont organisés par **valeur utilisateur** (ce que le user fait)
- Les microservices sont organisés par **bounded context technique** (ce qui change ensemble, scale ensemble, échoue ensemble)

### B.2 Mapping table

| # | Domaine fonctionnel (produit) | Service(s) responsable(s) (backend) | Notes |
|---|-------------------------------|-------------------------------------|-------|
| **2.1** | Comptes & utilisateurs | `identity-svc` + Keycloak (externe) | Keycloak gère l'auth (login, password, MFA, OIDC). `identity-svc` gère les attributs métier (profil, KYC, préférences, statut). |
| **2.2** | Catalogue & services | `catalog-svc` + `media-svc` | `catalog-svc` = listings, catégories, dispos, recherche. `media-svc` = upload R2, scan, dérivés images. |
| **2.3** | Booking & panier | `booking-svc` + `order-svc` | **Découpage technique** : `booking-svc` gère la résa (slot + lifecycle pro side), `order-svc` gère la commande payable (cart, lignes, totaux, TVA). Voir ADR-008. |
| **2.4** | Paiements & facturation | `payment-svc` + `order-svc` (côté facturation) | `payment-svc` = Stripe Connect, PaymentIntents, payouts, disputes. `order-svc` génère les factures (PDF, mandat) à partir des données qu'il a. |
| **2.5** | Abonnements professionnels | `payment-svc` (Stripe Billing) + `identity-svc` (tier sync) | Stripe Billing pour la subscription. `identity-svc` reçoit les events (`subscription.created/updated/deleted`) et met à jour `subscription_tier` sur le profil pro. |
| **2.6** | Messagerie | `messaging-svc` | Chat client ↔ pro lié à booking. WebSocket via Redis pub/sub. |
| **2.7** | Avis & évaluations | `review-svc` | Reviews, multi-criteria (V1), pro response (V1), réciprocité (V1). |
| **2.8** | Modération & administration | Admin features distribuées dans **tous les services** + `gateway-api` | Pas de service "admin" dédié. Les actions admin sont des endpoints sur chaque service avec rôles `admin-*`. Audit trail centralisé via NATS event `admin.action.*` consommé par `notification-svc` et stocké dans une table immutable côté `identity-svc`. |
| **(transverse)** | Notifications | `notification-svc` | Consume *tous* les events des autres services pour générer emails (Resend), in-app, SMS (V1). Templates centralisés. |
| **(transverse)** | Authentication & API | `gateway-api` | Point d'entrée unique. JWT validation, rate limiting, request fan-out, BFF pour web/mobile. |

### B.3 Diagramme d'alignement

```
PRODUCT DOMAINS (user-facing)              BACKEND SERVICES (technical)

┌─────────────────────────────┐
│  2.1 Comptes & users        │ ────────►  identity-svc + Keycloak
└─────────────────────────────┘

┌─────────────────────────────┐            catalog-svc
│  2.2 Catalogue              │ ────────►  +
└─────────────────────────────┘            media-svc

┌─────────────────────────────┐            booking-svc
│  2.3 Booking & cart         │ ────────►  +
└─────────────────────────────┘            order-svc

┌─────────────────────────────┐            payment-svc
│  2.4 Payments & invoicing   │ ────────►  +
└─────────────────────────────┘            order-svc (invoices)

┌─────────────────────────────┐            payment-svc (Stripe Billing)
│  2.5 Pro subscriptions      │ ────────►  +
└─────────────────────────────┘            identity-svc (tier)

┌─────────────────────────────┐
│  2.6 Messaging              │ ────────►  messaging-svc
└─────────────────────────────┘

┌─────────────────────────────┐
│  2.7 Reviews                │ ────────►  review-svc
└─────────────────────────────┘

┌─────────────────────────────┐            (distributed across all services)
│  2.8 Moderation & admin     │ ────────►  + gateway-api (RBAC enforcement)
└─────────────────────────────┘            + identity-svc (audit trail)

┌─────────────────────────────┐
│  Notifications (transverse) │ ────────►  notification-svc
└─────────────────────────────┘

┌─────────────────────────────┐
│  Auth/API (transverse)      │ ────────►  gateway-api
└─────────────────────────────┘
```

### B.4 Inverse mapping (service → which UX/product features it powers)

Pour chaque service, lister les écrans UX qui en dépendent. Permet aux devs backend de comprendre l'impact business de leurs changements.

| Service | Écrans UX powered |
|---------|-------------------|
| `gateway-api` | Tous les écrans (point d'entrée API). Owns rate limiting and auth gate. |
| `identity-svc` | `/account/profile/*`, `/seller/onboarding/profile`, `/seller/onboarding/kyc`, `/seller/settings/profile`, `/seller/settings/company`, admin `verifications/*`, admin `users/*` |
| `catalog-svc` | `/`, `/search`, `/category/*`, `/service/*`, `/pro/*`, `/seller/services/*`, `/seller/calendar`, admin `catalog/*` |
| `media-svc` | Toutes les zones d'upload photos/vidéos : création service (`/seller/services/new`, step 3), profil pro |
| `booking-svc` | `/account/bookings/*`, `/seller/bookings/*`, `/seller/calendar` (booking overlays), customer dashboard widget "À traiter" |
| `order-svc` | `/cart/*` (entire checkout funnel), `/account/billing/invoices`, `/seller/billing/invoices` |
| `payment-svc` | `/cart/checkout` (Stripe Elements), `/account/billing/methods`, `/seller/billing/payouts`, `/seller/onboarding/stripe`, `/seller/subscription/*`, admin `finance/*` |
| `messaging-svc` | `/account/messages/*`, `/seller/messages/*`, in-app chat WebSocket |
| `review-svc` | `/account/bookings/{id}/review`, `/seller/reviews/*`, fiche service & profil pro (display) |
| `notification-svc` | Aucun écran direct. Génère emails/SMS/push consommés par les apps externes (mail client). Backoffice templates en V1 (`admin/communication/*`). |

---

## C. Naming alignment

### C.1 Trois vocabulaires à unifier

Les docs utilisent trois vocabulaires partiellement différents pour parler des mêmes concepts. On fige le canonique ici.

| Concept | Spec produit | UX docs | Backend (Research_Report) | **CANONIQUE** |
|---------|--------------|---------|---------------------------|---------------|
| Le pro qui vend | "Pro", "professionnel" | "Pro", "seller" (URLs) | "Provider" | **Pro** (UI/produit) / **provider** (backend code) |
| Le client qui achète | "Client" | "Client", "customer" (URLs) | "Buyer" | **Client** (UI/produit) / **customer** (backend code) |
| L'admin | "Admin" | "Admin" | "Admin" | **Admin** (partout) |
| L'annonce | "Service", "fiche service" | "Service", "listing" (annexes) | "Listing" | **Service** (UI/produit) / **listing** (backend code) |
| La réservation | "Réservation" | "Booking" (URLs) | "Reservation", "booking" | **Réservation** (UI) / **booking** (backend code) |
| La commande payable | (confondu avec réservation) | (confondu) | "Order" | **Commande** (UI) / **order** (backend code) |
| L'avis | "Avis" | "Review" (URLs) | "Review" | **Avis** (UI) / **review** (backend code) |

**Règle d'or finale** :
- **Tout ce qui est visible utilisateur** : terminologie **française produit** (Service, Réservation, Pro, Client, Avis)
- **Tout ce qui est code, DB, API, events, logs** : terminologie **anglaise backend** (Listing, Booking, Provider, Customer, Review)
- **Le mapping UI ↔ code** se fait en couche présentation (DTOs / presenters)

### C.2 Backend service names (immutables)

Liste figée — ne pas renommer sans ADR :

```
gateway-api
identity-svc
catalog-svc
booking-svc
order-svc
payment-svc
messaging-svc
review-svc
notification-svc
media-svc
```

---

## D. Architecture Decision Records (ADRs)

Chaque divergence ou choix structurant entre les docs est tranchée ici sous forme d'ADR. Ces ADRs sont à intégrer comme premiers documents dans le dossier `docs/adr/` du repo backend dès Sprint 0.

### ADR-001 — Monorepo structure with Pretre's proxy pattern

**Status**: Accepted
**Context**: Le `Research_Report.md` recommande la structure Pretre (`domain/` / `usecases/` / `infrastructure/` + `UseCaseProxy`) pour chaque service. Le risque est la verbosité.

**Decision**: On adopte le pattern Pretre **strictement** dans tous les services dès le départ. Pas de raccourci au prétexte que "ce n'est qu'un MVP".

**Rationale**:
- La cohérence inter-services est plus importante que la concision intra-service
- Les use-cases sont triviaux à tester unitairement (mocks plain)
- Le coût marginal d'un nouveau use case est faible une fois le pattern installé

**Consequences**:
- Onboarding dev : 1-2 jours pour internaliser le pattern
- Code review checklist : tout PR qui touche au domaine doit respecter "no NestJS imports in domain/"
- Lint rule (eslint-plugin-boundaries) à mettre en place dès Sprint 0

---

### ADR-002 — NATS JetStream over Kafka or RabbitMQ

**Status**: Accepted
**Context**: Choix du message broker pour la communication async inter-services.

**Decision**: NATS JetStream avec `@horizon-republic/nestjs-jetstream` (pas le `Transport.NATS` natif de NestJS, qui ne gère pas JetStream).

**Rationale**: cf. `Research_Report.md` §3.2. Sweet spot pour < 10 k events/sec, faible burden opérationnel, équipe < 5 devs.

**Consequences**:
- Pas de Schema Registry (Kafka pattern) — on gère via JSON Schema dans `@tukio/contracts`
- Outbox pattern obligatoire pour la cohérence transactionnelle
- Reviser à 100k+ events/sec ou 10+ devs

---

### ADR-003 — Database per service, no shared tables

**Status**: Accepted
**Context**: Risque de tomber dans le piège "microservices distribués sur une seule DB".

**Decision**: Chaque service a sa propre database PostgreSQL nommée `tukio_<service>` (ex : `tukio_catalog`, `tukio_booking`). Aucun cross-service join. Aucune lecture cross-service en SQL direct.

**Rationale**: garde les services véritablement découplés. Permet de scaler indépendamment.

**Consequences**:
- Données dupliquées entre services (ex : `customer_id` connu par `booking-svc`, `order-svc`, `payment-svc`)
- Communication async obligatoire pour synchroniser
- Coût Postgres : 10 databases sur la même instance Postgres au début (pas 10 instances)

---

### ADR-004 — Booking and Order split into two services

**Status**: Accepted (clarification du `Research_Report.md`)
**Context**: Côté produit, "réservation" et "commande" semblent être un seul concept. Côté backend, le `Research_Report.md` propose 2 services distincts (`booking-svc` et `order-svc`).

**Decision**: On garde la séparation. `booking-svc` gère le **slot d'inventaire et le lifecycle pro side** (request → quoted → accepted → confirmed → completed). `order-svc` gère la **commande payable** (cart, line items, totals, taxes, invoices).

**Rationale**:
- En V1 multi-vendor : 1 cart customer = N bookings (un par pro) mais 1 order avec splits Stripe
- En V1 packages : 1 booking peut référencer plusieurs services consommés (chapiteau + chaises) sous une même order
- Lifecycles différents : un booking peut être annulé sans toucher l'order si compensation par un autre booking
- Les invoices sont émises au niveau order (mandat de facturation), pas par booking

**Consequences**:
- Le frontend doit savoir distinguer les deux dans certains écrans :
  - `/account/bookings/{id}` montre la booking + référence à l'order
  - `/account/billing/invoices` liste les orders (factures)
  - `/cart/*` parle d'order côté URL (consistent avec backend)
- Mapping côté UI : "Ma réservation" = booking + order combinés dans l'affichage

---

### ADR-005 — Meilisearch in catalog-svc from MVP

**Status**: Accepted (overrides spec v2.1 §3.3)
**Context**: La spec v2.1 disait "Postgres FTS au MVP, Meilisearch en V1". Le `Research_Report.md` recommande Meilisearch dès le départ.

**Decision**: On adopte Meilisearch dès le MVP.

**Rationale**:
- La recherche est le **fonction la plus utilisée** côté customer (cf. `tukio_ux_flow_catalog.md` C.1, C.3)
- Postgres FTS gère mal les facettes + geo + recherche partielle simultanément (cas typique du catalogue marketplace)
- Meilisearch managé (Meilisearch Cloud, à partir de ~30 €/mois) ou self-hosted Docker = peu de coût opérationnel
- Migration Postgres → Meilisearch en cours de route est plus douloureux qu'un démarrage direct sur Meilisearch
- Coût négligeable vs gain UX

**Consequences**:
- `catalog-svc` a 2 datastores : Postgres (source of truth) + Meilisearch (read-side index)
- Sync via consumer interne sur les events `catalog.listing.published.v1`
- Migration spec v2.1 §3.3 : "Postgres FTS" remplacé par "Meilisearch" dans la stack table

---

### ADR-006 — Choreographed sagas, no orchestrator

**Status**: Accepted
**Context**: Booking-payment cross-service workflow.

**Decision**: Saga choreographed via NATS events (cf. `Research_Report.md` §3.3). Pas de Temporal, pas d'orchestrator dédié.

**Rationale**: 4-5 étapes seulement, langage métier dans les events suffit. Réintroduire un orchestrator quand le workflow dépasse 8 étapes ou nécessite une vue centralisée d'état.

**Consequences**:
- État de la saga **distribué** entre `booking-svc`, `order-svc`, `payment-svc`
- Reconstruction de l'état complet via correlation IDs et logs centralisés
- Investir lourdement en tests (chaos test, replay tests)

---

### ADR-007 — Outbox pattern in every service that emits events

**Status**: Accepted
**Context**: Garantir la cohérence transactionnelle entre la DB et les events NATS.

**Decision**: Chaque service qui émet des events utilise une table `outbox` PostgreSQL avec relais vers NATS via PG LISTEN/NOTIFY (pas polling).

**Rationale**: Évite la double-écriture (DB OK mais NATS down). Latence sub-seconde grâce à LISTEN/NOTIFY.

**Consequences**:
- Bibliothèque commune `@tukio/messaging` à développer en Sprint 0
- Migration table `outbox` dans chaque service
- Monitoring lag outbox → NATS

---

### ADR-008 — gateway-api is the only public surface

**Status**: Accepted
**Context**: Comment les apps frontend (web, mobile, admin) parlent au backend.

**Decision**: `gateway-api` est l'unique point d'entrée HTTP public. Aucun service downstream n'expose son API directement à Internet. Les services downstream sont accessibles uniquement via :
- Le gateway (HTTP interne, mTLS en prod)
- NATS (events async)

**Rationale**:
- Surface d'attaque minimale
- Authentification centralisée (JWT validation Keycloak)
- Rate limiting centralisé
- BFF possible (composer plusieurs services en une réponse)

**Consequences**:
- 3 frontends (web, mobile, admin) parlent au même gateway, ou éventuellement à 3 gateways spécialisés (BFF pattern V1+)
- L'admin sur sous-domaine séparé `admin.tukio.one` parle au même `gateway-api` mais avec routes admin (`/admin/*`) protégées par les rôles `admin-*`

---

### ADR-009 — Keycloak for auth, identity-svc for domain profile

**Status**: Accepted
**Context**: Q7 spec v2.1 a validé Keycloak pour l'auth. Le `Research_Report.md` propose un `identity-svc` distinct.

**Decision**: Séparation nette :
- **Keycloak** : authentification, sessions, password, MFA, social login, refresh tokens. Source of truth pour l'identité au sens "qui est connecté".
- **identity-svc** : profil métier (display name, locale, role métier `customer/pro/admin`, KYC state, subscription tier, préférences notifs). Source of truth pour les attributs métier.

**Sync** : Keycloak emit des webhooks (via `keycloak-events-listener`) → consumer dans `identity-svc` qui maintient un mirror de l'utilisateur Keycloak avec ses attributs métier.

**Rationale**:
- Keycloak n'est pas designé pour stocker des attributs métier riches (KYC docs, stripe IDs, subscription state)
- `identity-svc` peut évoluer indépendamment de Keycloak (changement IdP futur sans casser le métier)
- Les autres services ne dépendent pas de Keycloak directement, seulement de `identity-svc` via NATS events

**Consequences**:
- Sync drift Keycloak ↔ identity-svc à monitorer (job de réconciliation quotidien)
- 2 sources d'identité = 2 sources de bugs potentiels
- Vaut le coût pour la flexibilité long-terme

---

### ADR-010 — TypeORM as default ORM, raw SQL for read-heavy paths

**Status**: Accepted
**Context**: Choix d'ORM.

**Decision**: TypeORM par défaut (cohérent avec Pretre). Pour les paths read-heavy (catalog search) on n'utilise pas le QueryBuilder TypeORM mais des requêtes SQL brutes via `pg`, encapsulées dans un adapter dédié côté `infrastructure/persistence/queries/`.

**Rationale**: TypeORM est productif pour les CRUD basiques. Sa QueryBuilder devient verbeuse et lente pour les jointures complexes geo+facets. Les écrire en SQL natif pour ces 5-10 % de cas est plus simple à maintenir et plus performant.

**Consequences**:
- Migration Drizzle ou Prisma reportée — pas avant qu'un vrai pain TypeORM apparaisse
- Convention : un fichier `*.query.ts` dans `infrastructure/persistence/queries/` par requête complexe

---

### ADR-011 — Shared library `@tukio/contracts` from Sprint 0

**Status**: Accepted
**Context**: Comment partager les schémas d'events entre services.

**Decision**: Package `@tukio/contracts` dans le monorepo. Contient :
- JSON Schema par event versionné (`catalog.listing.published.v1.schema.json`)
- Types TypeScript dérivés
- Type `DomainEvent<T>` partagé
- DTOs HTTP partagés entre gateway et services downstream

**Rationale**:
- Garantit que producer et consumer parlent du même schéma
- Versioning via suffix `v1`, `v2` avec coexistence pendant migration
- Compilation TS-end-to-end

**Consequences**:
- Discipline : tout nouvel event ou DTO passe par une PR sur `@tukio/contracts`
- CI : tests de compatibilité de schéma en cas de modif

---

## E. Updated risks & mitigations

Mise à jour de la matrice de risques (`tukio_spec_v2.md` §3.4) avec les risques techniques identifiés par le `Research_Report.md`.

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| **R1** | TVA & facturation marketplace mal conformes | 🔴 Critique | Audit expert-comptable spécialisé avant V1 |
| **R2** | Statut éditeur LCEN involontaire | 🔴 Critique | Pas de modération systématique pré-publication |
| **R3** | Concentration GMV sur peu de pros | 🟠 Élevé | Métrique de concentration suivie hebdo |
| **R4** | Cold-start côté offre | 🟠 Élevé | Sourcing pro physique en PdL |
| **R5** | Race conditions sur dispos | 🟠 Élevé | Locks Redis + idempotence DB. Confirmé par ADR-006/007 |
| **R6** | Anti-désintermédiation insuffisante | 🟡 Moyen | Coordonnées masquées + détection regex |
| **R7** | Stripe Connect KYC long | 🟡 Moyen | UX d'attente claire |
| **R8** | Sync Keycloak ↔ identity-svc drift | 🟡 Moyen | Job de réconciliation quotidien (ADR-009) |
| **R9** | Disputes Stripe tardifs | 🟡 Moyen | Evidence trail systématique |
| **R10** | RGPD vs conservation 10 ans | 🟡 Moyen | Anonymisation post-délai utile |
| **R11** *nouveau* | Saga booking-payment partiellement échouée | 🔴 Critique | Tests chaos en CI, replay possible, monitoring inbox/outbox lag, alertes admin sur sagas bloquées > 5 min |
| **R12** *nouveau* | NATS JetStream perte de message | 🟠 Élevé | Replicas R3 en prod, DLQ stream dédié, monitoring consumer lag, alerte si lag > 1000 messages |
| **R13** *nouveau* | Outbox relay (PG LISTEN/NOTIFY) en panne | 🟠 Élevé | Healthcheck dédié + fallback polling toutes les 30 s + alerte si > 100 messages outbox en `pending` depuis > 1 min |
| **R14** *nouveau* | Database per service complexité opérationnelle | 🟡 Moyen | Au MVP : 10 databases sur 1 instance Postgres. Backup unifié. Séparer en instances dédiées seulement si bottleneck mesuré |
| **R15** *nouveau* | Coût opérationnel des 10 services dès MVP | 🟠 Élevé | Co-localiser tous les services dans 1 cluster K8s/namespace au MVP. Séparer par traffic seulement quand besoin (cf. F.1) |

---

## F. MVP deployment topology

Le `Research_Report.md` §9.1 a une recommandation cruciale : *"Start with three services running in production, not ten."*

### F.1 Strategy: codebase split, deployment colocation

Idée : on garde **10 codebases distinctes** dès le départ (boundaries clairs, indépendance dev) mais on **déploie** seulement quelques unités au début.

```
                    CODEBASE                   DEPLOYMENT (MVP)              DEPLOYMENT (V1+)
                    ────────                   ────────────────              ────────────────

   gateway-api  ──┐
   identity-svc ──┤                            ┌──────────────────┐         ┌─ gateway-api ──┐
   catalog-svc  ──┤                            │                  │         │                │
   booking-svc  ──┼──── 10 services ────►      │  3 deployment    │   ───►  │  3 deployment  │
   order-svc    ──┤                            │  units :          │         │  groups split   │
   payment-svc  ──┤                            │   1. core-api    │         │  by traffic    │
   messaging-svc──┤                            │   2. workers     │         │                │
   review-svc   ──┤                            │   3. nats        │         │                │
   notification ──┤                            │                  │         │                │
   media-svc    ──┘                            └──────────────────┘         └────────────────┘
```

### F.2 MVP deployment units

- **core-api** (1 unit) : `gateway-api`, `identity-svc`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`. Tous les services synchrones et qui répondent au gateway.
- **workers** (1 unit) : `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`. Services principalement event-driven, tolérants à la latence.
- **nats** (1 cluster) : NATS JetStream avec replicas R3.
- **postgres** (1 instance) : 10 databases logiques sur la même instance physique au MVP. Migration vers instances dédiées si nécessaire.
- **redis** (1 instance Upstash) : cache + locks dispo + WebSocket pub/sub messaging.

### F.3 Quand splitter

| Service | Trigger pour le sortir en deployment dédié |
|---------|---------------------------------------------|
| `payment-svc` | Premier — dès la production. Sécurité (PCI-DSS-adjacent) + isolation. |
| `notification-svc` | Quand volume > 10 k emails/jour OU latence des autres services impactée |
| `media-svc` | Quand volume upload > 1000/jour OU besoin scale workers ML (V2) |
| `messaging-svc` | Quand WebSocket users concurrents > 5000 |
| `catalog-svc` | Si search devient le bottleneck (mémoire Meilisearch) |

### F.4 Implications du codebase split day 1

Même en "core-api" déployé monolithiquement, chaque service garde :
- Son propre `package.json`, son propre `Dockerfile`, ses propres migrations
- Son propre database schema isolé (database-per-service côté DB)
- Sa propre app NestJS (un service = un `main.ts`)
- Ses tests CI séparés (matrix par service)

Le seul "raccourci" est qu'on les **lance dans le même pod K8s** (sidecars) ou dans la **même VM** au début.

---

## G. Cross-document inconsistencies — resolved

Liste des incohérences entre les docs déjà produits et la résolution canonique.

| # | Incohérence | Apparaît dans | Résolution |
|---|-------------|---------------|------------|
| **I-01** | Postgres FTS vs Meilisearch au MVP | spec v2.1 §3.3 vs Research §2.1, §5.1 | **Meilisearch dès MVP** (ADR-005). Update spec v2.1 §3.3. |
| **I-02** | Booking et Order : 1 ou 2 entités ? | Tous les docs UX parlent de "réservation" comme entité unique. Research les sépare. | **2 services backend**, **1 concept UX dans certains écrans** (mapping en couche présentation). ADR-004. |
| **I-03** | "Acompte" mentionné dans spec V1 mais pas dans Research | spec v2.1 §2.4 V1 vs absence dans Research §2.1 | **À ajouter dans Research V1 plan** : `payment-svc` doit gérer Stripe SetupIntent + paiements échelonnés via cron, cf. `tukio_booking_paiements_deepdive.md` C.3 |
| **I-04** | Identité technique "customer" / "buyer" / "client" | spec produit utilise "Client", URLs "customer", Research dit "Buyer" | **Standardisation ADR §C** : "Client" en UI/produit, "customer" en backend code. Pas de "buyer". |
| **I-05** | Identité technique "pro" / "seller" / "provider" | spec "Pro", URLs "seller", Research "Provider" | **Standardisation §C** : "Pro" en UI, "provider" en backend code. Le mot "seller" reste seulement dans les URLs (`/seller/*`) pour cohérence avec l'IA. |
| **I-06** | Anti-désintermédiation : géré où ? | Spec v2.1 §2.6 dit "détection regex au V1" mais sans préciser où | **Décidé** : dans `messaging-svc` (regex pre-send), avec config centralisée dans `@tukio/contracts`. |
| **I-07** | Stripe webhooks : géré par quel service ? | Spec v2.1 ne précise pas, Research §2.1 dit `payment-svc` | **Confirmé** : `payment-svc` est le seul endpoint Stripe webhook. Il transforme en events NATS pour les autres services. |
| **I-08** | Mandat de facturation : émis par qui ? | Spec dit "Tukio émet au nom du pro", Research ne le mentionne pas explicitement | **Décidé** : `order-svc` génère les PDF. Templates à figer en V1 avec expert-comptable. |
| **I-09** | Inventory partagé entre fiches d'un même pro (catalogue G.3) | Reporté V1 dans deep dive catalogue, non mentionné dans Research | **Confirmé V1 dans `catalog-svc`** : ajout d'une entité `InventoryPool` reliée à plusieurs Listings. |
| **I-10** | "verifier-email" dans urls IA (J.2) — qui héberge la page ? | IA dit "Bloque l'accès aux features transactionnelles" | **Décidé** : la page `/verify-email` est servie par le frontend, mais le check est fait par `gateway-api` qui interroge `identity-svc.email_verified` à chaque requête. Si false → 403. |

---

## H. What this document changes elsewhere

Pour ne rien laisser flou, voici les **mises à jour à faire** sur les documents existants.

### H.1 Updates `tukio_spec_v2.md` v2.1 → v2.2

À appliquer dans une prochaine itération du document :

- **§3.3 Architecture technique** : remplacer "Recherche : Postgres FTS au MVP → Meilisearch en V1" par "Recherche : Meilisearch dès MVP" (cf. ADR-005)
- **§3.4 Risques** : ajouter R11 à R15 de §E ci-dessus
- **§3.5 Documents complémentaires** : ajouter ce doc et le `Research_Report.md`
- **§2.3 Booking & panier** : ajouter une note "Implémenté techniquement comme 2 services : `booking-svc` (lifecycle) + `order-svc` (cart/invoices). Cf. ADR-004."
- **Changelog** : "v2.2 — réconciliation produit ↔ archi technique, ajout ADRs"

### H.2 Updates `tukio_information_architecture.md`

- **Section L (version tagging)** : préciser que l'écran `/cart` est servi par `order-svc` (pas `booking-svc`)
- **Annexe (Map vers domaines fonctionnels)** : ajouter une colonne "Service backend" basée sur §B.2

### H.3 Updates UX flows (catalog, booking)

- **`tukio_ux_flow_booking.md` B.0** : préciser que `/cart/checkout` parle à `order-svc` (création order) puis `payment-svc` (Stripe). Le booking n'est créé qu'à l'acceptation pro, donc côté `booking-svc` après l'event `order.paid.v1`.
- **`tukio_ux_flow_booking.md` D.3** : ajouter une note "L'acceptation pro émet `booking.accepted.v1` qui déclenche `payment-svc` pour la capture Stripe."

### H.4 Nouveau doc à produire (recommandé pour Sprint 0)

**`tukio_event_catalog.md`** — catalogue exhaustif de tous les events NATS du système avec leur schéma JSON. Format suggéré :

```yaml
events:
  - name: catalog.listing.published.v1
    producer: catalog-svc
    consumers: [meilisearch-indexer (catalog-svc internal), notification-svc]
    payload:
      listingId: uuid
      providerId: keycloak-sub
      title: string
      ...
    triggers_ux: [public service appears in /search, fiche service indexed]

  - name: booking.requested.v1
    producer: booking-svc
    consumers: [notification-svc, order-svc]
    payload:
      bookingId: uuid
      customerId: keycloak-sub
      providerId: keycloak-sub
      listingId: uuid
      ...
```

Ce doc devient la "ground truth" du contrat events et alimente `@tukio/contracts`.

### H.5 Backend roadmap Sprint 0 (ajouts au Research_Report §11)

À faire avant Sprint 1 :

- [ ] Lire ce doc + `Research_Report.md` en équipe (kickoff technique)
- [ ] Initialiser `docs/adr/` avec les 11 ADRs ci-dessus
- [ ] Setup `@tukio/contracts` (vide, prêt pour Sprint 1)
- [ ] Setup `@tukio/messaging` avec wrapper NATS JetStream + outbox helpers
- [ ] Setup `@tukio/auth` avec `KeycloakJwtGuard` + `Roles` decorator + types `Actor`
- [ ] Setup `@tukio/testing` avec testcontainers helpers
- [ ] Docker Compose local complet (services infra)
- [ ] CI pipeline pour 1 service exemple (`catalog-svc`)
- [ ] Lint rules `eslint-plugin-boundaries` configurées
- [ ] ADR template prêt pour les futures décisions

---

*Fin du document — version 1, à itérer au fil des décisions en sprint.*
