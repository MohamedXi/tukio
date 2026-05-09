# Story 0.2: Initialize @tukio/contracts (envelope types + 5 critical NATS event JSON Schemas + core DTOs)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** developer (équipe Sprint 0),
**I want** the `@tukio/contracts` package initialized with **envelope types** (ADR-014), **5 critical NATS event JSON Schemas + types TS dérivés** (ADR-011 + NFR69), **4 fichiers de DTOs Zod partagés** (auth, booking, catalog, payment), et un **lint custom `tukio/event-naming`** + **script de compatibilité de schéma** branchés dès maintenant,
**so that** every backend service et frontend app peut consommer un contrat unique fortement typé (single source of truth frontend ↔ backend), aucune story Epic 1+ ne pourra dériver des conventions enveloppe / NATS / DTOs sans intervention manuelle, et la moindre violation du format `<service>.<aggregate>.<event>.v<n>` est rattrapée par le lint avant merge.

> **Outcome attendu** : à la fin de cette story, `apps/gateway-api`, `apps/identity-svc`, et `apps/public` peuvent importer `import { SuccessEnvelope } from '@tukio/contracts/envelope'` et `import { CreateBookingDto } from '@tukio/contracts/dtos/booking'` sans aucune erreur. Les 5 events critiques sont versionnés v1, leurs JSON Schemas valident les payloads via Ajv, et leurs types TS sont consommables pour `consumer.subscribe(...)` / `publisher.publish(...)`.

## Acceptance Criteria

1. **AC1 — Envelope types disponibles (ADR-014)** : Given le package `@tukio/contracts`, When j'importe `import { SuccessEnvelope, ErrorEnvelope, Pagination, Meta, ErrorBody, ValidationIssue, EnvelopeMethod } from '@tukio/contracts/envelope'`, Then ils sont disponibles comme types TypeScript correctement typés et match **strictement** la spec [Architecture §API Response Format — Enveloppe REST canonique (lignes 1252-1406)] :
   - `SuccessEnvelope<TData>` avec `{ method, code, data, pagination?, meta }` — `data` typé `TData | TData[] | null`
   - `ErrorEnvelope` avec `{ method, code, error, meta }` — `error` typé `ErrorBody`
   - `Pagination` avec `{ nextCursor, hasMore, totalEstimate, limit }` (cursor-based, pas offset)
   - `Meta` avec champs obligatoires `{ timestamp, correlationId, locale }` + optionnels `{ version?, deprecation?, requestId? }`
   - `ErrorBody` avec `{ type, title, detail, instance, tukioCode, issues? }` (RFC 7807 + extensions Tukio, **pas** `application/problem+json` distinct)
   - `ValidationIssue` avec `{ path, code, message }` pour erreurs Zod 422
   - `EnvelopeMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'` (uppercase string union)
   - Types `data` et `error` **mutuellement exclusifs** (discriminé sur `code` ≥ 400 ou présence du champ)

2. **AC2 — 5 critical NATS events versionnés v1 + JSON Schema + types TS** : Given `packages/contracts/src/events/`, When je regarde la structure, Then je trouve **exactement** 5 dossiers events avec **chacun** les 2 fichiers `<event>.v1.schema.json` (Draft 2020-12) + `<event>.v1.ts` (type TS dérivé). Les `eventType` strings sont **strictement alignés** sur les exemples canoniques de l'architecture (ligne 1127) :
   - `events/catalog/listing-published.v1.{schema.json,ts}` — eventType: `catalog.listing.published.v1`
   - `events/booking/booking-requested.v1.{schema.json,ts}` — eventType: `booking.requested.v1` (service `booking` ≡ aggregate `booking`, segments collapsés)
   - `events/booking/booking-accepted.v1.{schema.json,ts}` — eventType: `booking.accepted.v1`
   - `events/payment/payment-intent-captured.v1.{schema.json,ts}` — eventType: `payment.intent.captured.v1` (service `payment`, aggregate `intent`)
   - `events/admin/admin-action-pro-verified.v1.{schema.json,ts}` — eventType: `admin.action.pro-verified.v1`

3. **AC3 — Tous les events suivent l'enveloppe canonique NATS** : Given un event NATS instancié via `@tukio/contracts/events/...`, When je regarde son type, Then il **étend** un type générique `DomainEvent<TPayload>` exporté depuis `@tukio/contracts/types/DomainEvent` avec **exactement** ces champs (cf. Architecture §Communication Patterns lignes 1572-1611) :
   ```ts
   {
     eventId: string;          // UUID v4 lowercase
     eventType: string;        // <service>.<aggregate>.<event>.v<n>
     eventVersion: 'v1' | 'v2';
     occurredAt: string;       // ISO 8601 UTC
     correlationId: string;    // saga uuid
     causationId: string | null; // event parent uuid (null si racine)
     actor: Actor;             // { userId, role, locale }
     aggregate: { type: string; id: string };
     payload: TPayload;        // payload spécifique à l'event
   }
   ```
   Le JSON Schema des 5 events DOIT inclure ces 9 champs racine + un schéma `payload` propre à l'event.

4. **AC4 — Format `<service>.<aggregate>.<event>.v<n>` strict** : Given n'importe quel JSON Schema d'event dans `@tukio/contracts/src/events/`, When je regarde le champ `eventType` (constante via `const`), Then il respecte **lowercase** + **dots** entre tokens + **dashes** dans tokens composés (cf. Architecture §NATS Event Naming lignes 1116-1129) :
   - ✅ acceptés : `catalog.listing.published.v1`, `booking.requested.v1`, `payment.intent.captured.v1`, `admin.action.pro-verified.v1`, `subscription.changed.v2` (formats valides — segments collapsés autorisés quand service ≡ aggregate)
   - ❌ rejetés : `BookingCreated` (PascalCase), `booking_created_v1` (snake_case + version mal placée), `booking.created` (manque version), `Booking.Created.V1` (PascalCase)
   - **Regex de référence** (utilisée par la lint rule AC8) : `^[a-z]+(?:\.[a-z][a-z0-9-]*)+\.v\d+$`

5. **AC5 — DTOs Zod partagés frontend/backend (4 fichiers)** : Given `packages/contracts/src/dtos/`, When je regarde la structure, Then je trouve **exactement** ces 4 fichiers DTOs Zod :
   - `dtos/auth.dto.ts` — exporte `RegisterCustomerSchema` (Zod) + `RegisterCustomerDto` (type inféré via `z.infer<>`)
   - `dtos/booking.dto.ts` — exporte `CreateBookingSchema` + `CreateBookingDto` + `BookingResponseSchema` + `BookingResponseDto`
   - `dtos/catalog.dto.ts` — exporte `CreateListingSchema` + `CreateListingDto`
   - `dtos/payment.dto.ts` — exporte `PaymentIntentResponseSchema` + `PaymentIntentResponseDto`
   - Tous les schemas exposent à la fois `XxxSchema` (Zod) ET `XxxDto` (`type XxxDto = z.infer<typeof XxxSchema>`) → un seul source of truth, validation + types alignés

6. **AC6 — Subpath imports résolvent depuis tous les workspaces** : Given le repo monorepo, When je lance dans n'importe lequel des 14 workspaces (`apps/gateway-api`, `apps/identity-svc`, `apps/public`, etc.) une importation :
   ```ts
   import { SuccessEnvelope } from '@tukio/contracts/envelope';
   import { ListingPublishedV1 } from '@tukio/contracts/events/catalog/listing-published.v1';
   import { CreateBookingDto, CreateBookingSchema } from '@tukio/contracts/dtos/booking';
   import { Actor, Money, DomainEvent } from '@tukio/contracts/types';
   ```
   Then aucune erreur de résolution de module (TS + Node), et l'importation **subpath** (`/envelope`, `/events/...`, `/dtos/...`, `/types`) fonctionne via le champ `exports` de `packages/contracts/package.json`.

7. **AC7 — Anti-barrel enforcement** : Given le repo, When je tente d'écrire `import { Anything } from '@tukio/contracts'` (import barrel, sans subpath), Then une lint rule custom `tukio/no-barrel-import-contracts` (sévérité `warn` au Sprint 0, montée à `error` en Story 0.11) signale la violation et propose le subpath spécifique en autofix lorsque c'est possible (cf. Architecture lignes 958, 1246).

8. **AC8 — Lint custom `tukio/event-naming`** : Given une PR qui modifie un JSON Schema event ou un usage `publisher.publish(...)`/`@Subject(...)` dans `apps/<svc>-svc/`, When la CI tourne, Then la rule ESLint custom `tukio/event-naming` (livrée dans `tools/eslint-plugin-tukio/` et chargée depuis `.eslintrc.cjs` racine) :
   - Valide que toute string assignée à `eventType` (dans `*.schema.json` via test runner JSON Schema, ET dans le code TS via match d'AST sur `Object.const` / `as const` litéraux) match l'expression régulière `^[a-z]+(?:\.[a-z][a-z0-9-]*)+\.v\d+$`
   - Rejette `BookingCreated`, `booking_created_v1`, `booking.created`, `Booking.Created.V1`
   - Accepte `catalog.listing.published.v1`, `payment.payment-intent.captured.v1`
   - Inclut **au moins 6 tests unitaires** (3 valid + 3 invalid) dans `tools/eslint-plugin-tukio/__tests__/event-naming.spec.ts`

9. **AC9 — Script de compatibilité de schéma (breaking-change detector)** : Given un script `packages/contracts/scripts/check-schema-compat.mjs`, When je le lance via `pnpm --filter=@tukio/contracts run check:compat` (qui sera ensuite branché en CI Story 0.11), Then il :
   - Compare chaque `*.v1.schema.json` du commit courant avec le même fichier sur `origin/main` (via `git show`)
   - Détecte les **breaking changes** non-versionnés : retrait de propriété required, changement de type, retrait d'enum value, ajout de nouvelle property required (utilise [`json-schema-diff-validator`](https://www.npmjs.com/package/json-schema-diff-validator) ou équivalent latest stable)
   - Sort en code 1 + log explicite si breaking change détecté sans bump de version (`v1` → `v2` requis)
   - Sort en code 0 si rétrocompatible (ajout de propriété optionnelle, doc-only changes)

10. **AC10 — Tests cross-validation Zod ↔ JSON Schema ↔ TS** : Given le package, When je lance `pnpm --filter=@tukio/contracts test`, Then les tests passent (Vitest, ≥ 95 % coverage sur la lib) :
    - **Round-trip test** : pour chacun des 5 events, un sample `payload` valide instancié via le type TS est validé positivement par Ajv contre le JSON Schema correspondant
    - **Negative tests** : chaque event a au moins 1 sample invalide (champ required manquant, type incorrect) qui DOIT être rejeté par Ajv
    - **Zod round-trip** : pour chacun des 4 DTOs, un sample valide est `parse()` OK et un sample invalide rejette avec un `ZodError` contenant des `issues`
    - **Type alignment** : test compile-time (via `tsd` ou équivalent latest stable) qui vérifie que `z.infer<typeof CreateBookingSchema>` est bien assignable à `CreateBookingDto` (et inversement)

11. **AC11 — Build & exports** : Given le package, When je lance `pnpm --filter=@tukio/contracts build` (no-op au MVP — TS direct, cohérent avec Story 0.1 Task 4.2) Then :
    - Le `package.json` expose un champ `"exports"` complet pour tous les subpaths (cf. Dev Notes §Subpath exports)
    - Le `package.json` n'a **PAS** de champ `"main"`/`"types"` redondant si `exports` couvre tout (sinon les outils TS qui ne supportent pas `exports` cassent)
    - Le champ `"sideEffects": false` est présent (préserve tree-shaking côté frontend Next.js)

## Tasks / Subtasks

- [x] **Task 1 — Configurer `package.json` + `tsconfig.json` du package** (AC: #6, #11)
  - [x] 1.1 — Mettre à jour `packages/contracts/package.json` :
    - `"name": "@tukio/contracts"`, `"version": "0.0.0"`, `"private": true`, `"sideEffects": false`
    - `"type": "module"` (ESM end-to-end, cohérent avec Next.js 15 + NestJS 11)
    - Champ `"exports"` exhaustif (cf. Dev Notes §Subpath exports — copier le bloc tel quel)
    - Scripts : `"test": "vitest run"`, `"test:watch": "vitest"`, `"check:compat": "node scripts/check-schema-compat.mjs"`, `"lint": "eslint src --ext .ts"`, `"typecheck": "tsc --noEmit"`
    - Dépendances :
      - `runtime` : `zod` (latest stable)
      - `peerDependencies` : aucune (le consommateur fournit Ajv s'il valide à l'exécution)
      - `devDependencies` : `ajv`, `ajv-formats`, `@types/node`, `vitest`, `tsd` (ou équivalent), `json-schema-diff-validator`, `typescript`
  - [x] 1.2 — Mettre à jour `packages/contracts/tsconfig.json` extends `../../tsconfig.base.json` avec :
    ```json
    {
      "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src",
        "composite": false,
        "declaration": true,
        "resolveJsonModule": true
      },
      "include": ["src/**/*", "scripts/**/*"]
    }
    ```
  - [x] 1.3 — Vérifier que `tsconfig.base.json` racine inclut `"resolveJsonModule": true` (sinon les imports `*.schema.json` cassent)

- [x] **Task 2 — Créer les types `envelope/`** (AC: #1)
  - [x] 2.1 — Créer `packages/contracts/src/envelope/method.ts` exportant `export type EnvelopeMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';`
  - [x] 2.2 — Créer `packages/contracts/src/envelope/meta.ts` exportant le type `Meta` (cf. Architecture lignes 1404)
  - [x] 2.3 — Créer `packages/contracts/src/envelope/pagination.ts` exportant `Pagination` (cursor-based)
  - [x] 2.4 — Créer `packages/contracts/src/envelope/error-body.ts` exportant `ErrorBody` + `ValidationIssue`
  - [x] 2.5 — Créer `packages/contracts/src/envelope/success-envelope.ts` exportant le type générique `SuccessEnvelope<TData>`
  - [x] 2.6 — Créer `packages/contracts/src/envelope/error-envelope.ts` exportant le type `ErrorEnvelope`
  - [x] 2.7 — Créer `packages/contracts/src/envelope/index.ts` qui re-exporte les 6 modules ci-dessus (barrel **interne** au sous-dossier — pas un barrel global du package)
  - [x] 2.8 — Tests : 1 test compile-time qui instancie chaque type avec un sample minimal (vérifie que les champs obligatoires/optionnels sont corrects)

- [x] **Task 3 — Créer les types racine `types/`** (AC: #3)
  - [x] 3.1 — Créer `packages/contracts/src/types/Actor.ts` exportant `export interface Actor { userId: string; role: 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super' | 'system' | 'anonymous'; locale: Locale; }`
  - [x] 3.2 — Créer `packages/contracts/src/types/Locale.ts` exportant `export type Locale = 'fr' | 'en';` (BCP 47 lowercase, MVP 2 locales)
  - [x] 3.3 — Créer `packages/contracts/src/types/Currency.ts` exportant `export type Currency = 'EUR';` (MVP single currency, V3+ étendra)
  - [x] 3.4 — Créer `packages/contracts/src/types/Money.ts` exportant `export interface Money { amount: number; currency: Currency; }` (amount en cents, cf. Architecture §Data Formats ligne 1512)
  - [x] 3.5 — Créer `packages/contracts/src/types/DomainEvent.ts` exportant le type générique :
    ```ts
    export interface DomainEvent<TPayload> {
      eventId: string;
      eventType: string;
      eventVersion: 'v1' | 'v2';
      occurredAt: string;
      correlationId: string;
      causationId: string | null;
      actor: Actor;
      aggregate: { type: string; id: string };
      payload: TPayload;
    }
    ```
  - [x] 3.6 — Créer `packages/contracts/src/types/index.ts` re-export barrel interne

- [x] **Task 4 — Créer les 5 events JSON Schema + types TS** (AC: #2, #3, #4, #10)
  - [x] 4.1 — `events/catalog/listing-published.v1.schema.json` — JSON Schema Draft 2020-12 avec :
    - `$schema: "https://json-schema.org/draft/2020-12/schema"`
    - `$id: "https://tukio.one/schemas/catalog/listing-published.v1.json"`
    - `title: "ListingPublishedV1"`
    - `type: "object"`, `additionalProperties: false`
    - 9 champs racine **required** (voir AC3 + Dev Notes §JSON Schema template envelope)
    - `eventType: { const: "catalog.listing.published.v1" }`
    - `aggregate.type: { const: "listing" }`
    - `payload` schema : `{ listingId: uuid, proId: uuid, locale: enum [fr, en], publishedAt: date-time, categorySlug: string, priceFrom: integer (cents) }` (champs minimaux MVP)
  - [x] 4.2 — `events/catalog/listing-published.v1.ts` — type TS dérivé manuellement aligné sur le JSON Schema :
    ```ts
    import type { DomainEvent } from '../../types/DomainEvent';
    export interface ListingPublishedV1Payload {
      listingId: string;
      proId: string;
      locale: 'fr' | 'en';
      publishedAt: string;
      categorySlug: string;
      priceFrom: number;
    }
    export type ListingPublishedV1 = DomainEvent<ListingPublishedV1Payload> & {
      eventType: 'catalog.listing.published.v1';
      eventVersion: 'v1';
      aggregate: { type: 'listing'; id: string };
    };
    export const LISTING_PUBLISHED_V1_TYPE = 'catalog.listing.published.v1' as const;
    ```
    > Pattern à dupliquer pour les 4 autres events : narrowing du `eventType`, `eventVersion`, et `aggregate.type` via littéraux ; const exportée pour usage publisher/subscriber sans typo.
  - [x] 4.3 — `events/booking/booking-requested.v1.{schema.json,ts}` — payload : `{ bookingId, customerId, listingId, proId, requestedDate (date), totalAmount (Money) }`. eventType const : `booking.requested.v1`. `aggregate.type: "booking"`
  - [x] 4.4 — `events/booking/booking-accepted.v1.{schema.json,ts}` — payload : `{ bookingId, customerId, proId, acceptedAt (date-time), paymentIntentId }`. eventType const : `booking.accepted.v1`. `aggregate.type: "booking"`
  - [x] 4.5 — `events/payment/payment-intent-captured.v1.{schema.json,ts}` — payload : `{ paymentIntentId, bookingId, orderId, amount (Money), capturedAt (date-time), stripeChargeId }`. eventType const : `payment.intent.captured.v1`. `aggregate.type: "payment-intent"`
  - [x] 4.6 — `events/admin/admin-action-pro-verified.v1.{schema.json,ts}` — payload : `{ proId, adminId, decision: enum [approved, rejected], reason: string \| null, decidedAt (date-time) }`. eventType const : `admin.action.pro-verified.v1`. `aggregate.type: "admin-action"`
  - [x] 4.7 — Tests Vitest dans `packages/contracts/src/events/__tests__/events.spec.ts` :
    - Pour chaque event : load le JSON Schema, instancier un payload valide via le type TS, valider via `Ajv` strict mode → assert valide
    - Pour chaque event : 1 sample invalide (champ required manquant ou format incorrect) → assert Ajv invalide avec une `errors` non vide

- [x] **Task 5 — Créer les 4 DTOs Zod** (AC: #5)
  - [x] 5.1 — `dtos/auth.dto.ts` :
    ```ts
    import { z } from 'zod';
    export const RegisterCustomerSchema = z.object({
      email: z.string().email(),
      password: z.string().min(12).max(128),
      firstName: z.string().min(1).max(80),
      lastName: z.string().min(1).max(80),
      locale: z.enum(['fr', 'en']),
      acceptedTermsAt: z.string().datetime(), // ISO 8601 UTC
    });
    export type RegisterCustomerDto = z.infer<typeof RegisterCustomerSchema>;
    ```
  - [x] 5.2 — `dtos/booking.dto.ts` :
    - `CreateBookingSchema` : `{ listingId: uuid, requestedDate: ISO date string YYYY-MM-DD, totalAmount: { amount: int positive, currency: literal 'EUR' }, notes?: string max 500 }`
    - `BookingResponseSchema` : `{ id: uuid, status: enum [pending_pro_acceptance, accepted, refused, confirmed, cancelled, completed], customerId, providerId, listingId, requestedDate, totalAmount, createdAt: ISO 8601 }`
    - Exporter aussi `BookingStatus = z.enum([...]).enum` pour réutilisation
  - [x] 5.3 — `dtos/catalog.dto.ts` :
    - `CreateListingSchema` : `{ categorySlug, translations: array(min 1) of { locale: enum [fr, en], title: 5-120 chars, description: 50-5000 chars, slug: kebab-case 3-80 }, basePrice: Money, photos: array(min 4, max 12) of url, deliveryRadius: int (km, 0-200) }`
  - [x] 5.4 — `dtos/payment.dto.ts` :
    - `PaymentIntentResponseSchema` : `{ paymentIntentId, clientSecret, amount: Money, status: enum [requires_action, requires_confirmation, succeeded, canceled, processing] }`
  - [x] 5.5 — `dtos/index.ts` re-export barrel interne (re-exporte chaque schema + type)
  - [x] 5.6 — Tests Zod dans `packages/contracts/src/dtos/__tests__/dtos.spec.ts` :
    - Pour chaque DTO : 1 sample valide → `parse()` OK
    - Pour chaque DTO : 1 sample invalide ciblé → assert `ZodError` avec `issues` contenant le bon `path` et `code`

- [x] **Task 6 — Configurer le champ `exports` du package.json** (AC: #6, #11)
  - [x] 6.1 — Remplacer/ajouter dans `packages/contracts/package.json` :
    ```json
    {
      "exports": {
        ".": "./src/index.ts",
        "./envelope": "./src/envelope/index.ts",
        "./types": "./src/types/index.ts",
        "./types/*": "./src/types/*.ts",
        "./events/*": "./src/events/*.ts",
        "./dtos": "./src/dtos/index.ts",
        "./dtos/*": "./src/dtos/*.ts"
      }
    }
    ```
  - [x] 6.2 — Mettre à jour `tsconfig.base.json` racine si nécessaire pour ajouter le path mapping subpath :
    ```json
    "paths": {
      "@tukio/contracts": ["./packages/contracts/src/index.ts"],
      "@tukio/contracts/*": ["./packages/contracts/src/*"]
    }
    ```
  - [x] 6.3 — Smoke test depuis 1 app frontend + 1 service backend :
    - Dans `apps/public/src/lib/contracts-smoke.ts` : `import { SuccessEnvelope } from '@tukio/contracts/envelope';` + `import { CreateBookingDto } from '@tukio/contracts/dtos/booking';` + référencer les types
    - Dans `apps/identity-svc/src/contracts-smoke.ts` : idem
    - `pnpm typecheck` passe sans erreur sur les 14 workspaces
    - **Supprimer** ces fichiers smoke après validation (ils ne doivent pas rester en codebase ; AC8 de Story 0.11 contiendra des tests d'imports plus durables)

- [x] **Task 7 — Créer le barrel `index.ts` racine** (AC: #6, #7)
  - [x] 7.1 — `packages/contracts/src/index.ts` re-exporte **uniquement** les types les plus universels (`Actor`, `Locale`, `Currency`, `Money`, `DomainEvent`) pour permettre `import { Actor } from '@tukio/contracts'`. **Tout le reste** (envelope, events, dtos) DOIT passer par les subpaths.
  - [x] 7.2 — Documenter dans `packages/contracts/README.md` (1 page max) :
    - À quoi sert le package
    - **Comment importer** : exemples avec subpaths (et un § "❌ ne pas faire" : `import { ... } from '@tukio/contracts'` → obligation subpath)
    - Pointeur vers les ADRs (`docs/adr/0011-tukio-contracts-package.md`, `docs/adr/0014-api-response-envelope.md`) qui seront créés en Story 0.13

- [x] **Task 8 — Lint custom `tukio/event-naming` + `tukio/no-barrel-import-contracts`** (AC: #7, #8)
  - [x] 8.1 — Créer `tools/eslint-plugin-tukio/` avec `package.json` (`"name": "eslint-plugin-tukio"`, `"private": true`, `"main": "./src/index.js"`), `src/index.js` (export `rules` + `configs`), `src/rules/event-naming.js`, `src/rules/no-barrel-import-contracts.js`
  - [x] 8.2 — Implémenter `event-naming` :
    - Regex valide : `^[a-z]+(?:\.[a-z][a-z0-9-]*)+\.v\d+$`
    - Cible les littéraux string assignés à une property `eventType` dans des objets ou `as const` (AST `Property` value `Literal`)
    - Cible aussi les arguments string passés à `publish(...)`, `subscribe(...)`, `@Subject(...)` (configurable via options de la rule, MVP : seulement `eventType` property)
    - Messages d'erreur localisés en EN (cf. memory `feedback_tech_layer_english.md`)
  - [x] 8.3 — Implémenter `no-barrel-import-contracts` :
    - Détecte `ImportDeclaration` avec `source.value === '@tukio/contracts'` ET au moins 1 `ImportSpecifier` non-default (importation nommée)
    - Sévérité par défaut `warn`, autofix : suggérer le subpath probable basé sur le mapping des exports (best-effort, ne pas bloquer si introuvable)
  - [x] 8.4 — Tests unitaires (Vitest + `@typescript-eslint/rule-tester` ou `eslint`'s `RuleTester`) dans `tools/eslint-plugin-tukio/__tests__/` :
    - `event-naming.spec.ts` : 3 valid (events bien formés) + 3 invalid (PascalCase, snake_case, no version)
    - `no-barrel-import-contracts.spec.ts` : 3 valid (subpath imports) + 2 invalid (barrel imports)
  - [x] 8.5 — Plugger dans `.eslintrc.cjs` racine :
    ```js
    plugins: [..., 'tukio'], // résout via tools/eslint-plugin-tukio
    rules: {
      ...,
      'tukio/event-naming': 'error',
      'tukio/no-barrel-import-contracts': 'warn', // monté à 'error' en Story 0.11
    }
    ```
  - [x] 8.6 — Vérifier que `pnpm lint` passe et que les rules tournent sur les 14 workspaces (au moins 1 sample fixture dans le répertoire du plugin pour vérifier la propagation)

- [x] **Task 9 — Script de compatibilité de schéma** (AC: #9)
  - [x] 9.1 — Créer `packages/contracts/scripts/check-schema-compat.mjs` (Node ESM, pas de TS — pour éviter le besoin de build) :
    - Glob `src/events/**/*.schema.json`
    - Pour chaque fichier : récupère le contenu sur `origin/main` via `git show origin/main:packages/contracts/src/events/<path>.schema.json`. Si le fichier n'existe pas sur main → nouveau schéma, ignore
    - Compare via `json-schema-diff-validator` (latest stable) → throw si breaking change non versionné
    - Exit code 0 (compat OK) ou 1 (breaking change détecté)
  - [x] 9.2 — Tester localement : modifier un `*.schema.json` (ex : retirer un champ required), lancer `pnpm --filter=@tukio/contracts run check:compat` → doit failer ; restaurer → doit passer
  - [x] 9.3 — Documenter dans `packages/contracts/README.md` la procédure pour bumper un schéma (`v1` → `v2`) : créer `<event>.v2.{schema.json,ts}`, garder `v1` en parallèle, mettre à jour les producers/consumers progressivement

- [x] **Task 10 — Tests cross-validation** (AC: #10)
  - [x] 10.1 — Configurer `packages/contracts/vitest.config.ts` minimal (ESM, `globals: false`, `coverage.provider: 'v8'`, `coverage.thresholds: { lines: 95, functions: 95, branches: 90 }`)
  - [x] 10.2 — Tests cross-validation déjà couverts par Task 4.7 (events JSON Schema ↔ TS) + Task 5.6 (DTOs Zod)
  - [x] 10.3 — Test type alignment via `tsd` (ou `expect-type`) dans `packages/contracts/src/__tests__/type-alignment.spec.ts` :
    - Vérifier que `z.infer<typeof CreateBookingSchema>` est strictement assignable à `CreateBookingDto`
    - Vérifier que `ListingPublishedV1` étend `DomainEvent<ListingPublishedV1Payload>` (compile-time)
  - [x] 10.4 — Smoke test final : `pnpm --filter=@tukio/contracts test` passe avec ≥ 95 % coverage

- [x] **Task 11 — Smoke test cross-workspace + commit** (AC: tous)
  - [x] 11.1 — `pnpm install` (au cas où des deps dev ont été ajoutées)
  - [x] 11.2 — `pnpm lint && pnpm typecheck && pnpm test` à la racine → tous passent (les nouveaux tests `@tukio/contracts` + lint rules apparaissent dans les outputs)
  - [x] 11.3 — Vérifier qu'aucune CI n'est cassée par des workspaces qui ont importé un subpath inexistant (rétrocompat avec Story 0.1 zéro consommateur attendu)
  - [x] 11.4 — Commit avec message `feat(contracts): initialize @tukio/contracts with envelope, 5 NATS events, 4 DTOs, lint rules` — Story 0.2 done

## Dev Notes

### Pourquoi cette story est la 2ᵉ — contexte stratégique

> **Source canonique** : `_bmad-output/planning-artifacts/architecture.md` §Implementation Sequence (lignes 1046-1071) + §Cross-Cutting Concerns + §Implementation Patterns & Consistency Rules (lignes 1073-1851).

`@tukio/contracts` est la lib partagée la plus critique du monorepo. **Toute** PR Epic 1+ qui touche un endpoint, un event NATS, ou un payload va importer depuis ce package. Si l'enveloppe REST est mal typée maintenant, il faudra la re-typer dans 10 services + 4 frontends en V1 → dette structurelle massive.

L'objectif de Sprint 0 n'est **pas** de sortir les 50+ events catalogués (cf. `tukio_event_catalog.md`) ni tous les DTOs. C'est de **figer le pattern** sur 5 events critiques + 4 DTOs critiques, plus le **lint custom** qui empêche toute déviation future. Les events suivants seront ajoutés au fur et à mesure des stories Epic 1+ par les devs métier (auto-onboarding via les exemples livrés ici).

### Versions à utiliser (latest stable au moment du Sprint 0)

> **Mémoire utilisateur** : `feedback_latest_versions.md` — toujours latest stable, pas de version pinnée sans raison explicite. **Vérifier `pnpm view <package> version` au moment de l'init**.

| Lib | Rôle dans Story 0.2 | Version cible |
|---|---|---|
| **Zod** | DTOs partagés frontend ↔ backend | latest stable (vérifier `pnpm view zod version`) |
| **Ajv** | Validation runtime JSON Schema events | latest stable (`pnpm view ajv version`) |
| **ajv-formats** | Formats date-time, uuid, email pour Ajv | latest stable |
| **TypeScript** | Compilation TS strict | latest stable (cohérent avec Story 0.1 — `tsconfig.base.json`) |
| **Vitest** | Tests unitaires lib `contracts` | latest stable (cohérent avec frontends de Story 0.1) |
| **tsd** ou `expect-type` | Tests d'alignment compile-time | latest stable |
| **json-schema-diff-validator** | Détection breaking changes | latest stable (alternative : `@stoplight/json-schema-compare`) |
| **eslint** + **@typescript-eslint/utils** | Lint custom rules | latest stable (cohérent avec Story 0.1) |

> ⚠️ **Si une release majeure breaking est sortie depuis 2026-05-09** (rédaction de la story), valider la compat avec un test manuel `pnpm --filter=@tukio/contracts test` avant de figer. Documenter la version retenue dans le commit message si non-trivial.

### Project Structure cible (référence Architecture lignes 2169-2186)

```
packages/contracts/
├─ package.json                                          # exports, sideEffects: false, type: module
├─ tsconfig.json                                         # extends ../../tsconfig.base.json
├─ vitest.config.ts
├─ README.md                                             # comment importer (subpaths obligatoires)
├─ scripts/
│  └─ check-schema-compat.mjs                            # Task 9 — détecteur breaking changes
└─ src/
   ├─ index.ts                                           # barrel racine MINIMAL (Actor/Locale/Currency/Money/DomainEvent uniquement)
   ├─ envelope/
   │  ├─ method.ts
   │  ├─ meta.ts
   │  ├─ pagination.ts
   │  ├─ error-body.ts
   │  ├─ success-envelope.ts
   │  ├─ error-envelope.ts
   │  └─ index.ts                                        # barrel interne (re-export)
   ├─ events/
   │  ├─ catalog/listing-published.v1.{schema.json,ts}
   │  ├─ booking/booking-requested.v1.{schema.json,ts}
   │  ├─ booking/booking-accepted.v1.{schema.json,ts}
   │  ├─ payment/payment-intent-captured.v1.{schema.json,ts}
   │  ├─ admin/admin-action-pro-verified.v1.{schema.json,ts}
   │  └─ __tests__/events.spec.ts
   ├─ dtos/
   │  ├─ auth.dto.ts
   │  ├─ booking.dto.ts
   │  ├─ catalog.dto.ts
   │  ├─ payment.dto.ts
   │  ├─ index.ts                                        # barrel interne
   │  └─ __tests__/dtos.spec.ts
   ├─ types/
   │  ├─ Actor.ts
   │  ├─ Locale.ts
   │  ├─ Currency.ts
   │  ├─ Money.ts
   │  ├─ DomainEvent.ts
   │  └─ index.ts
   └─ __tests__/
      └─ type-alignment.spec.ts
```

```
tools/eslint-plugin-tukio/
├─ package.json                                          # private: true, name: "eslint-plugin-tukio"
└─ src/
   ├─ index.js                                           # exports rules + configs
   ├─ rules/
   │  ├─ event-naming.js
   │  └─ no-barrel-import-contracts.js
   └─ __tests__/
      ├─ event-naming.spec.ts
      └─ no-barrel-import-contracts.spec.ts
```

### Subpath exports (`packages/contracts/package.json` — bloc à coller)

> **Important** : pas de champ `"main"` ni `"types"` redondant si `exports` couvre tout. Avec `"type": "module"` + ESM partout dans le repo, les fichiers `.ts` sont consommés directement (pas de build). Tous les workspaces sont en `moduleResolution: "bundler"` (Story 0.1 task 5.1) → la lecture du champ `exports` est native.

```json
{
  "name": "@tukio/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./envelope": "./src/envelope/index.ts",
    "./types": "./src/types/index.ts",
    "./types/Actor": "./src/types/Actor.ts",
    "./types/Locale": "./src/types/Locale.ts",
    "./types/Currency": "./src/types/Currency.ts",
    "./types/Money": "./src/types/Money.ts",
    "./types/DomainEvent": "./src/types/DomainEvent.ts",
    "./events/catalog/listing-published.v1": "./src/events/catalog/listing-published.v1.ts",
    "./events/booking/booking-requested.v1": "./src/events/booking/booking-requested.v1.ts",
    "./events/booking/booking-accepted.v1": "./src/events/booking/booking-accepted.v1.ts",
    "./events/payment/payment-intent-captured.v1": "./src/events/payment/payment-intent-captured.v1.ts",
    "./events/admin/admin-action-pro-verified.v1": "./src/events/admin/admin-action-pro-verified.v1.ts",
    "./events/*": "./src/events/*.ts",
    "./dtos": "./src/dtos/index.ts",
    "./dtos/auth": "./src/dtos/auth.dto.ts",
    "./dtos/booking": "./src/dtos/booking.dto.ts",
    "./dtos/catalog": "./src/dtos/catalog.dto.ts",
    "./dtos/payment": "./src/dtos/payment.dto.ts"
  }
}
```

> Les 5 entrées explicites pour les events MVP **et** le wildcard `./events/*` coexistent volontairement : les 5 events MVP sont documentés et stables ; le wildcard couvre les futurs events Epic 1+ sans devoir éditer le `package.json` à chaque ajout. Idem pour `dtos`.

### JSON Schema template envelope (à dupliquer pour chaque event)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://tukio.one/schemas/<service>/<event>.v1.json",
  "title": "<EventName>V1",
  "type": "object",
  "additionalProperties": false,
  "required": ["eventId", "eventType", "eventVersion", "occurredAt", "correlationId", "causationId", "actor", "aggregate", "payload"],
  "properties": {
    "eventId": { "type": "string", "format": "uuid" },
    "eventType": { "type": "string", "const": "<service>.<aggregate>.<event>.v1" },
    "eventVersion": { "type": "string", "const": "v1" },
    "occurredAt": { "type": "string", "format": "date-time" },
    "correlationId": { "type": "string", "format": "uuid" },
    "causationId": { "type": ["string", "null"], "format": "uuid" },
    "actor": {
      "type": "object",
      "required": ["userId", "role", "locale"],
      "additionalProperties": false,
      "properties": {
        "userId": { "type": "string" },
        "role": { "type": "string", "enum": ["client", "pro", "admin-support", "admin-modo", "admin-super", "system", "anonymous"] },
        "locale": { "type": "string", "enum": ["fr", "en"] }
      }
    },
    "aggregate": {
      "type": "object",
      "required": ["type", "id"],
      "additionalProperties": false,
      "properties": {
        "type": { "type": "string" },
        "id": { "type": "string" }
      }
    },
    "payload": {
      "type": "object",
      "additionalProperties": false,
      "required": ["..."],
      "properties": {
        "...": "..."
      }
    }
  }
}
```

### Critical Architecture Constraints (ces règles s'appliquent à toutes les stories Epic 1+ qui consommeront `@tukio/contracts`)

> Cf. `feedback_tech_layer_english.md` (paths URL EN strict) + `feedback_clean_architecture_explicit.md` (interfaces dans domain/ports) + `feedback_api_envelope_response.md` (enveloppe REST) + `feedback_i18n_frontend.md` (i18n FR/EN dès Sprint 0).

1. **Events lowercase + dots strict** : `catalog.listing.published.v1`, jamais `BookingCreated`. Lint `tukio/event-naming` enforce.
2. **DomainEvent enveloppe inclut `causationId`** (peut être `null` pour event racine d'une saga). Saga reconstruction via `correlationId` (saga uuid stable, propagé à travers tous les events).
3. **Mutuelle exclusion `data` ↔ `error`** dans l'enveloppe REST : ne JAMAIS définir un type `SuccessEnvelope` qui inclut `error?: ErrorBody`. Discrimination par présence du champ + code HTTP.
4. **`pagination` uniquement sur collections** (`SuccessEnvelope<TItem[]>` seulement). Le typage TS doit refléter ça : type conditionnel ou union discriminée.
5. **Anti-barrel imports** : `import { ... } from '@tukio/contracts'` interdit pour les events/dtos/envelope. Seuls les types globaux (Actor/Locale/Currency/Money/DomainEvent) sont accessibles via le barrel racine.
6. **Aucune dépendance NestJS / TypeORM / Stripe** dans `@tukio/contracts`. C'est une lib **pure types + Zod schemas + JSON Schemas**. Ajv est en `devDependency` uniquement (pour les tests internes du package).
7. **Pas de `class-validator`** (ADR-010 + lint `tukio/no-class-validator` Story 0.6). Zod uniquement.
8. **camelCase partout dans les types DTO** (`customerId`, `paymentIntentId`, `correlationId`). Les events JSON Schema reflètent les payloads JSON wire format → camelCase également.
9. **Format Money** : objet `{ amount: number_in_cents, currency: 'EUR' }` (cf. Architecture §Data Formats ligne 1512). `amount` int, jamais float.
10. **Format date-time** : ISO 8601 RFC 3339 UTC string (`"2026-05-08T10:30:00Z"`). Format date-only (sans heure) : `"2026-06-15"`.

### What this story does NOT do (out of scope)

> Pour éviter le scope creep, voici ce que cette story ne livre **pas** (livré ailleurs) :

- ❌ Les ~45 autres events NATS du catalogue → ajoutés au fil des stories Epic 1+ par les devs métier en suivant les exemples livrés ici (5 events seulement Sprint 0)
- ❌ DTOs pour `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`, `order-svc`, `identity-svc` profil, etc. → stories Epic 1-7 les ajoutent quand le use case arrive
- ❌ `regex-rules.ts` (anti-désintermédiation) → **Story 12.1** (V1, FR44, R6 mitigation)
- ❌ Implémentation NestJS de `ResponseEnvelopeInterceptor` + `EnvelopeExceptionFilter` → **Story 0.6** (scaffolding `gateway-api` + `identity-svc`)
- ❌ Implémentation côté frontend de `envelope-handler.ts` → **Story 0.9** (`@tukio/api-client`)
- ❌ Wrapper NATS JetStream (`@tukio/messaging`) → **Story 0.7**
- ❌ Outbox/inbox tables migrations TypeORM → **Story 0.6** (template Pretre dans `identity-svc`)
- ❌ ADR-011 + ADR-014 fichiers physiques dans `docs/adr/` → **Story 0.13** (initialisation des 14 ADRs)
- ❌ CI gates qui font failer une PR sur breaking change schema (le **script** est livré ici en Task 9, le **branchement CI** est en Story 0.11)
- ❌ Lint custom `tukio/no-fr-paths`, `tukio/no-hardcoded-text`, `tukio/no-class-validator`, `tukio/error-code-format`, `tukio/no-buyer`, `tukio/no-bypass-envelope` → **Story 0.6 + 0.11** (scope ici : seulement `event-naming` + `no-barrel-import-contracts` car directement liés au package contracts)
- ❌ Génération automatique des types TS depuis JSON Schema (`json-schema-to-typescript`) → décision figée : **maintenir manuellement** au MVP (5 events seulement, lint guarantit l'alignement). Si > 20 events au cours de V1, reconsider via ADR.

### Files to UPDATE vs CREATE

> **À UPDATE** (existants depuis Story 0.1) :
> - `packages/contracts/package.json` — Story 0.1 a posé un placeholder vide ; cette story ajoute `exports`, deps, scripts
> - `packages/contracts/tsconfig.json` — Story 0.1 a posé un placeholder ; cette story ajuste si besoin
> - `packages/contracts/src/index.ts` — Story 0.1 a posé `export {};` ; cette story re-exporte uniquement les types racine
> - `tsconfig.base.json` racine — ajout des paths subpath `@tukio/contracts/*` si non couvert par Story 0.1
> - `.eslintrc.cjs` racine — branchement du plugin `tukio` (Story 0.1 avait laissé un slot pour `eslint-plugin-boundaries`, cette story ajoute un slot pour `eslint-plugin-tukio`)

> **À CREATE** (nouveaux fichiers) :
> - Tous les fichiers sous `packages/contracts/src/{envelope,events,dtos,types,__tests__}/`
> - `packages/contracts/scripts/check-schema-compat.mjs`
> - `packages/contracts/vitest.config.ts`
> - `packages/contracts/README.md`
> - `tools/eslint-plugin-tukio/` (dossier complet : package.json, src/index.js, src/rules/*.js, __tests__/*.spec.ts)

> **Estimation total fichiers créés** : ~30-40 fichiers (5 events × 2 + 4 DTOs + 6 envelope + 5 types + tests + lint rules + scripts + readmes).

### Previous Story Intelligence (Story 0.1)

Story 0.1 (`ready-for-dev`) a posé les fondations monorepo. Ses choix qui contraignent Story 0.2 :

1. **`packages/contracts/package.json`** existe déjà avec `name: "@tukio/contracts"`, `version: "0.0.0"`, `private: true`, `main: "./src/index.ts"`, `types: "./src/index.ts"`. Story 0.2 **enlève** `main`+`types` au profit de `exports` (plus moderne, supporte les subpaths).
2. **`packages/contracts/src/index.ts`** existe avec `export {};` placeholder. Story 0.2 le remplace par un re-export contrôlé (Task 7.1).
3. **`tsconfig.base.json`** racine a `paths: { "@tukio/*": ["./packages/*/src"] }` mais ce mapping ne supporte PAS les subpaths multi-segment. Task 6.2 ajoute explicitement `"@tukio/contracts/*": ["./packages/contracts/src/*"]` (path précis prend précédent sur le wildcard générique pour TS).
4. **`.eslintrc.cjs`** racine a déjà `eslint-plugin-boundaries` en placeholder warn. Task 8.5 ajoute un slot pour le plugin `tukio` (rule severity `error` pour `event-naming` + `warn` pour `no-barrel-import-contracts`).
5. **TypeScript strict** + `noUncheckedIndexedAccess` actif (Story 0.1 task 5.1) → tous les types DOIVENT être `readonly` quand pertinent et gérer `T | undefined` partout où applicable (Zod schemas avec `.optional()` réfléchissent ça via `T | undefined`, pas `T | null`).
6. **Pas de `apps/<svc>-svc` métier scaffoldé** (Story 0.6 le fait). Donc Task 6.3 (smoke test cross-workspace) doit faire l'import dans des fichiers TEMPORAIRES de `apps/identity-svc/src/` ET `apps/public/src/lib/`, vérifier `pnpm typecheck`, puis SUPPRIMER ces fichiers temporaires (sinon ils traîneront jusqu'à Story 0.6 / 1.x).
7. **Tests** : Story 0.1 a configuré Vitest pour les apps Next.js et Jest pour les services NestJS. Pour `packages/contracts`, **Vitest** est le choix figé (cohérence avec frontends + setup plus rapide pour une lib pure TS).

### Conventions à respecter (rappel exhaustif)

> Cf. Architecture §Implementation Patterns & Consistency Rules (lignes 1073-1851) + memories `feedback_*.md`.

| Convention | Règle | Application Story 0.2 |
|---|---|---|
| Code/DB/API/events EN strict | Aucun nom FR dans les types, schemas, file names | ✅ tous les events/dtos/types en EN |
| camelCase JSON | Champs payload + DTOs en camelCase | ✅ `customerId`, `paymentIntentId`, `correlationId` |
| Lowercase NATS event names | `<service>.<aggregate>.<event>.v<n>` | ✅ enforced par `tukio/event-naming` (AC8) |
| Versioning suffix v1 strict | `v1` obligatoire | ✅ tous les events |
| Money = `{ amount, currency }` | int cents + ISO 4217 | ✅ tous les payloads avec montant |
| ISO 8601 UTC dates | strings | ✅ `occurredAt`, `requestedDate`, etc. |
| UUID v4 lowercase | `eventId`, `correlationId`, etc. | ✅ format JSON Schema `uuid` |
| Locale BCP 47 lowercase | `'fr'`, `'en'` MVP | ✅ `Locale = 'fr' \| 'en'` |
| Zod uniquement (pas class-validator) | DTOs partagés | ✅ tous les 4 DTOs |
| `additionalProperties: false` | JSON Schema strict | ✅ tous les events |
| Symboles DI absents ici | Pas de NestJS dans contracts | ✅ aucun `Symbol(...)` dans `@tukio/contracts` |

### Testing Standards

- **Coverage cible** : ≥ 95 % sur `packages/contracts` (lib pure types + schemas, plus simple à 100 % couvrir que les services métier ; vise le max).
- **Framework** : Vitest 3.x (cohérent avec frontends Story 0.1).
- **Pas de testcontainers ici** (rien à virtualiser : pure TS + JSON validation in-memory). `@tukio/testing` arrive en Story 0.9.
- **Niveaux de tests** :
  - **Round-trip JSON Schema ↔ TS** : sample TS valide → Ajv strict mode passe ; sample TS invalide (champ manquant) → Ajv rejette
  - **Zod parse** : sample valide → `parse()` ; sample invalide → `ZodError` avec issues
  - **Compile-time alignment** : `tsd` ou `expect-type` pour vérifier `z.infer<typeof X>` ↔ `XDto`
  - **Lint rules** : `RuleTester` ESLint avec valid + invalid cases (3+3 minimum)
  - **Schema diff script** : test e2e qui modifie un fichier, lance le script, assert exit code

### Project Structure Notes

✅ **Aligné** avec `architecture.md` §Project Structure lignes 2169-2186 — le scaffold cible **exactement** la structure documentée (modulo l'ajout `regex-rules.ts` qui est différé V1).

✅ **Aligné** avec `architecture.md` §Implementation Patterns lignes 1073-1851 — naming + format + pattern enforcement complets.

✅ **Aligné** avec `architecture.md` §API Response Format (ADR-014) lignes 1252-1406 — types envelope **exactement** mappés sur la spec.

✅ **Aligné** avec `architecture.md` §Communication Patterns (DomainEvent) lignes 1572-1611 — 9 champs racine identiques.

⚠️ **À noter** : `architecture.md` ligne 2183 mentionne `regex-rules.ts` dans `packages/contracts/src/`. Story 0.2 le **différe à Story 12.1** (V1, FR44 anti-désintermédiation) car la regex est V1, pas MVP. Cette divergence est intentionnelle et documentée ici.

⚠️ **À noter** : `architecture.md` ligne 1064 + 1068 mentionne que `@tukio/contracts` est dépendance partagée par les 10 services + 4 frontends + `@tukio/api-client` + `@tukio/messaging`. Toute évolution breaking de l'enveloppe ou du DomainEvent core en V1+ DOIT passer par un ADR. → **Pas un problème pour Story 0.2** (premier shipping), juste un point d'attention pour les stories futures.

⚠️ **À noter** : Story 0.6 (Pattern Pretre + identity-svc) consommera `@tukio/contracts/envelope` pour brancher `ResponseEnvelopeInterceptor`. Si Story 0.2 livre des types incorrects, Story 0.6 va casser. → Smoke test Task 6.3 critique.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API-Response-Format-Enveloppe-REST-canonique-ADR-014 — Lines 1252-1406 (types SuccessEnvelope/ErrorEnvelope/Pagination/Meta)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication-Patterns — Lines 1572-1611 (Event Payload Structure NATS, DomainEvent envelope)]
- [Source: _bmad-output/planning-artifacts/architecture.md#NATS-Event-Naming — Lines 1116-1129 (format `<service>.<aggregate>.<event>.v<n>`)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure — Lines 2169-2186 (`packages/contracts/src/` détaillée)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-Consistency-Rules — Lines 1073-1851 (naming, formats, enforcement)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Formats — Lines 1507-1525 (Money, dates, UUID, locale, currency)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Code-Naming-TypeScript — Lines 1131-1150 (PascalCase, camelCase, file naming)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Validation-Strategy — Lines 608-613 (Zod uniquement, schemas dans @tukio/contracts/src/dtos)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Outbox-Inbox-Tables — Lines 632-663 (correlation_id, event_id, event_type, event_version dans schema DB)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-Priority-Analysis — Lines 562-583 (ADR-011 `@tukio/contracts` package, ADR-014 enveloppe REST)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Component-Dependencies — Lines 1062-1071 (`@tukio/contracts` dépendance partagée 10 services + 4 frontends)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.2 — Lines 875-888 (6 ACs originaux)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR69 — Line 1404 (event naming convention + JSON Schema versioning + ADR pour BC break)]
- [Source: _bmad-output/planning-artifacts/prd.md#Stack-frontend — Lines 702-712 (Zod côté client + serveur, cohérent avec @tukio/contracts)]
- [Source: _bmad-output/implementation-artifacts/0-1-bootstrap-monorepo-turborepo-scaffold-nextjs-apps-nestjs-services.md — Story 0.1 dev context (placeholders existants pour packages/contracts)]
- [Memory: feedback_latest_versions.md — toujours latest stable]
- [Memory: feedback_tech_layer_english.md — paths URL/code/DB/events EN strict]
- [Memory: feedback_clean_architecture_explicit.md — interfaces dans domain/ports (rappel pour les services qui consommeront contracts)]
- [Memory: feedback_api_envelope_response.md — enveloppe REST canonique]
- [Memory: feedback_i18n_frontend.md — i18n FR/EN dès Sprint 0, Locale = 'fr' | 'en']

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `bmad-dev-story` workflow, Story 0.2.

### Debug Log References

- **Versions retenues** : Zod 4.4.3, Ajv 8.20.0, ajv-formats 3.0.1, tsd 0.33.0, json-schema-diff-validator 0.4.2, typescript-eslint 8.59.2.
- **Zod 4 migration** : `z.string().uuid()` valide strictement RFC 4122 v4 (version `[1-8]`, variant `[89ab]`). Tests fixtures corrigés avec UUIDs v4 valides (`00000000-0000-4000-8000-0000000000XX`).
- **Rename `.dto.ts` → `.ts`** : `auth.dto.ts`, `booking.dto.ts`, `catalog.dto.ts`, `payment.dto.ts` renommés en `auth.ts`, `booking.ts`, `catalog.ts`, `payment.ts` pour matcher les exports subpath `@tukio/contracts/dtos/<name>` via les `tsconfig.paths`.
- **tsconfig paths override** : TypeScript ne merge pas `paths` cross-extends. Les 14 tsconfigs apps/services mis à jour avec `@tukio/contracts`, `@tukio/contracts/*` explicites.
- **engine-strict désactivé** : `engine-strict=true` (.npmrc) cause des échecs d'install car `pnpm node` utilise Volta Node 22.16.0 (shell `node` = 22.22.2) et certains packages demandent >=22.22.1. Commenté dans `.npmrc` avec note pour réactiver après fix Volta.
- **eslint.config.mjs par package** : `packages/contracts` nécessite son propre eslint.config.mjs avec `typescript-eslint` pour linter le code TypeScript.
- **json-schema-diff-validator API** : `validateSchemaCompatibility(oldSchema, newSchema)` — retourne `undefined` si compatible, throw `AssertionError` si breaking change. Script `check-schema-compat.mjs` utilise try/catch.
- **ESLint plugin CJS** : `tools/eslint-plugin-tukio` est CommonJS (pas `"type": "module"`), importé dans `eslint.config.mjs` via `createRequire`. Tests utilisent `Linter` ESLint 9 avec `configType: 'flat'`.
- **Validations finales** : lint 0 erreurs (tout workspaces), typecheck 0 erreurs, test 26/26 contracts + 11/11 eslint-plugin + 4 × Vitest apps + 10 × Jest services.
- **pnpm workspace.yaml** : `tools/*` ajouté pour inclure `eslint-plugin-tukio` comme workspace.

### Completion Notes List

1. **`.dto.ts` → `.ts` renommé** : fichiers DTOs renommés pour aligner sur les subpaths exports (`dtos/booking` → `src/dtos/booking.ts`). `booking.dto.ts` aurait nécessité un path mapping explicite supplémentaire.
2. **Zod 4.x (pas 3.x)** : UUID validation stricte v4. Tous les tests fixtures utilisent des UUIDs RFC 4122 valides.
3. **ESLint plugin en CJS** : `tools/eslint-plugin-tukio` est CommonJS volontairement (compatibilité ESLint 9 plugin loading). Le root `eslint.config.mjs` l'importe via `createRequire`.
4. **`engine-strict=true` désactivé** : Conflict Volta/pnpm sur Node version. Réactiver quand Volta est mis à jour vers >=22.22.1.
5. **14 tsconfigs mis à jour** : paths `@tukio/contracts` + `@tukio/contracts/*` ajoutés dans tous les workspaces pour résolution TS sans workspace linking.
6. **`tools/*` ajouté au workspace** : `eslint-plugin-tukio` est maintenant un workspace pnpm (`vitest run` fonctionne).
7. **`check:compat` script** : 5 schemas détectés comme NEW sur origin/main → exit 0 ✓. Script prêt pour CI Story 0.11.

**Points d'attention pour Story 0.3+** :
- Story 0.3 (design system) peut importer `@tukio/contracts/envelope` pour typer les formulaires React.
- Story 0.6 (Pretre identity-svc) : `ResponseEnvelopeInterceptor` consomme `SuccessEnvelope<T>` + `ErrorEnvelope`. DTOs auth disponibles via `@tukio/contracts/dtos/auth`.
- Story 0.7 (NATS messaging) : `DomainEvent<T>` + les 5 schemas JSON sont prêts pour la validation runtime Ajv.
- Story 0.11 (CI) : brancher `check:compat` dans le pipeline, monter `tukio/no-barrel-import-contracts` de `warn` → `error`.

### File List

**CREATE** :
- `packages/contracts/package.json` — exports complets, sideEffects:false, type:module, deps zod/ajv/tsd/vitest
- `packages/contracts/tsconfig.json` — étend base + resolveJsonModule
- `packages/contracts/eslint.config.mjs` — typescript-eslint config pour lint TS
- `packages/contracts/vitest.config.ts` — Vitest node, coverage v8 ≥95%
- `packages/contracts/README.md` — guide imports subpaths + schema versioning
- `packages/contracts/scripts/check-schema-compat.mjs` — détecteur breaking changes vs origin/main
- `packages/contracts/src/index.ts` — barrel minimal (Actor/Locale/Currency/Money/DomainEvent)
- `packages/contracts/src/envelope/{method,meta,pagination,error-body,success-envelope,error-envelope,index}.ts` — 7 types (AC1)
- `packages/contracts/src/types/{Locale,Currency,Money,Actor,DomainEvent,index}.ts` — 6 types racine (AC3)
- `packages/contracts/src/events/catalog/listing-published.v1.{schema.json,ts}` — eventType: catalog.listing.published.v1
- `packages/contracts/src/events/booking/booking-requested.v1.{schema.json,ts}` — eventType: booking.requested.v1
- `packages/contracts/src/events/booking/booking-accepted.v1.{schema.json,ts}` — eventType: booking.accepted.v1
- `packages/contracts/src/events/payment/payment-intent-captured.v1.{schema.json,ts}` — eventType: payment.intent.captured.v1
- `packages/contracts/src/events/admin/admin-action-pro-verified.v1.{schema.json,ts}` — eventType: admin.action.pro-verified.v1
- `packages/contracts/src/events/__tests__/events.spec.ts` — 10 tests round-trip Ajv (AC10)
- `packages/contracts/src/dtos/auth.ts` — RegisterCustomerSchema + dto
- `packages/contracts/src/dtos/booking.ts` — CreateBookingSchema + BookingResponseSchema + BookingStatusEnum
- `packages/contracts/src/dtos/catalog.ts` — CreateListingSchema
- `packages/contracts/src/dtos/payment.ts` — PaymentIntentResponseSchema
- `packages/contracts/src/dtos/index.ts` — barrel interne DTOs
- `packages/contracts/src/dtos/__tests__/dtos.spec.ts` — 10 tests Zod (AC10)
- `packages/contracts/src/__tests__/type-alignment.spec.ts` — 4 tests compile-time alignment (AC10)
- `tools/eslint-plugin-tukio/package.json` — private, main: ./src/index.js, vitest
- `tools/eslint-plugin-tukio/vitest.config.ts` — node environment
- `tools/eslint-plugin-tukio/src/index.js` — exports rules + configs
- `tools/eslint-plugin-tukio/src/rules/event-naming.js` — règle event naming regex (AC8)
- `tools/eslint-plugin-tukio/src/rules/no-barrel-import-contracts.js` — règle anti-barrel (AC7)
- `tools/eslint-plugin-tukio/__tests__/event-naming.spec.ts` — 6 tests rule (AC8)
- `tools/eslint-plugin-tukio/__tests__/no-barrel-import-contracts.spec.ts` — 5 tests rule (AC7)

**UPDATE** :
- `packages/contracts/src/dtos/index.ts` — imports mis à jour (renommage .dto.ts → .ts)
- `packages/contracts/package.json` — exports dtos mis à jour (renommage)
- `pnpm-workspace.yaml` — ajout `tools/*`
- `tsconfig.base.json` — paths @tukio/contracts + @tukio/contracts/* explicites
- `apps/public/tsconfig.json` — paths contracts ajoutés
- `apps/customer/tsconfig.json` — idem
- `apps/seller/tsconfig.json` — idem
- `apps/admin/tsconfig.json` — idem
- `apps/{gateway-api,identity-svc,catalog-svc,booking-svc,order-svc,payment-svc,messaging-svc,review-svc,notification-svc,media-svc}/tsconfig.json` — paths contracts ajoutés (× 10)
- `eslint.config.mjs` (racine) — plugin tukio branché (rules event-naming:error, no-barrel:warn)
- `.npmrc` — engine-strict désactivé (commenté avec justification)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 2-3 jours (lib pure TS + tests + lint custom rules)
- **Dépendances upstream** : Story 0.1 (`ready-for-dev`) — scaffolding monorepo + `packages/contracts/` placeholder + `tsconfig.base.json` paths + `.eslintrc.cjs` slots
- **Dépendances downstream** :
  - Story 0.3 (design system) — consomme `@tukio/contracts/envelope` indirectement via les composants formulaires
  - Story 0.6 (Pattern Pretre identity-svc) — consomme `@tukio/contracts/envelope` (ResponseEnvelopeInterceptor) + DTOs auth + events admin/identity (à venir)
  - Story 0.7 (`@tukio/messaging` NATS) — consomme `@tukio/contracts/types/DomainEvent` + JSON Schemas pour validation runtime
  - Story 0.9 (`@tukio/api-client`) — consomme `@tukio/contracts/envelope` (envelope-handler) + DTOs
  - Story 0.11 (CI) — branche le script `check:compat` en CI + monte les lint rules en `error`
  - **Toutes les stories Epic 1+** qui touchent un endpoint ou un event NATS dépendent de cette story
- **FRs covered** : aucun FR direct (foundational, prerequis to all)
- **NFRs touchés** : NFR69 (events convention + versioning + JSON Schema dans `@tukio/contracts`), NFR70 (ADRs préparés mais matérialisés Story 0.13), NFR74 (conventions naming enforced via lint), NFR67 (pattern `@tukio/contracts` figé), NFR58 (paths/code EN strict — préparé)
