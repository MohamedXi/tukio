# Story 1.2a: @tukio/contracts identity DTOs/events + identity-svc domain layer + RegisterCustomerUseCase (unit tests)

Status: done

> 🧩 **Sub-story 1/4 de Story 1.2** (décomposée 2026-05-15 via `/bmad-correct-course`).
> Parent : `_bmad-output/implementation-artifacts/1-2-customer-b2c-registration.md` (umbrella source-of-truth des ACs/Dev Notes complets).
> Proposal : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md`.
> Sub-stories suivantes (séquentielles) : `1-2b-identity-svc-infrastructure-controller` → `1-2c-gateway-api-pretre-forwarder` → `1-2d-frontend-signup-middleware-e2e-observability`.

## Story

**As a** dev backend qui implémente Epic 1,
**I want** que le pattern Pretre "register customer" soit posé proprement dans :
1. `@tukio/contracts` : DTOs `register-customer.dto.ts` + `acquisition.dto.ts`, événements JSON Schema `user-registered.v1` + `email-send.v1` (+ types TS dérivés via build pipeline Story 0.2), `IdentityErrorCodes` const ;
2. `apps/identity-svc/src/domain/` : factory `UserProfile.register()` (+ 8 champs `status`, `marketingOptIn`, `emailVerified`, `acceptTerms`, `acceptTermsAt`, `acquisition*`), VOs `Email` (RFC 5322) / `Locale` / `AcquisitionSource`, ports `IKeycloakAdmin` + `IEmailVerificationTokenRepository`, exceptions `IdentityConflictException` + `ExternalServiceException` ;
3. `apps/identity-svc/src/usecases/register-customer.usecase.ts` : implémentation use case (mocks ports) avec **coverage ≥ 90 % en tests unit Vitest (7+ cases)**,
**so that** les sous-stories suivantes (1.2b infrastructure, 1.2c gateway-api BFF, 1.2d frontend) puissent s'y brancher sans ambiguïté, **et que cette story devienne la référence Pretre canonique** copiable par Stories 1.3 (Pro register), 1.5 (password reset), 1.8 (profile update), 1.9 (account delete) et Stories Epic 2-6.

> **Outcome attendu** : à la fin de 1.2a, `pnpm --filter=@tukio/contracts build && pnpm --filter=@tukio/contracts test` passe (types TS générés depuis JSON Schema), `pnpm --filter=identity-svc test usecases/register-customer.usecase.spec.ts` passe avec **coverage ≥ 90 %** sur le use case, **aucun appel I/O réel** (Keycloak/Postgres/NATS mockés via ports). Pas d'infrastructure exécutée, pas de migration appliquée, pas d'endpoint HTTP, pas de gateway, pas de frontend.

## Acceptance Criteria (héritées de Story 1.2)

Cette story couvre les ACs **2** (DTOs + events) et **5 partiel** (use case + factory + tests unit). Les ACs 1, 3, 4, 6, 7, 8, 9, 10 sont couvertes par les sub-stories 1.2b/c/d.

**AC1 (1.2a) — DTOs + event schemas dans `@tukio/contracts`** : couvre intégralement l'AC2 de Story 1.2. Voir `1-2-customer-b2c-registration.md` lignes 41-174 pour le détail des schemas Zod + JSON Schema.

- `packages/contracts/src/dtos/identity/register-customer.dto.ts` (NEW) — `RegisterCustomerInputSchema` (Zod) + `RegisterCustomerResponseSchema`
- `packages/contracts/src/dtos/identity/acquisition.dto.ts` (NEW) — `AcquisitionSourceSchema` (enum 7 valeurs) + `AcquisitionInputSchema`
- `packages/contracts/src/events/identity/user-registered.v1.schema.json` (NEW) + `.ts` (types dérivés)
- `packages/contracts/src/events/notification/email-send.v1.schema.json` (NEW) + `.ts`
- `packages/contracts/src/types/error-codes.ts` (UPDATE) — `IdentityErrorCodes` const (10+ codes)
- `packages/contracts/src/index.ts` (UPDATE) — barrel + subpath exports `./dtos/identity`, `./events/identity`, `./events/notification`

**AC2 (1.2a) — identity-svc domain layer (factory + VOs + ports + exceptions)** : couvre la partie domain de l'AC5 de Story 1.2. Voir `1-2-customer-b2c-registration.md` lignes 288-356 (use case + domain) et 311-355 (factory `register()`).

- `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` (UPDATE) — factory static `register()` + 8 nouveaux fields
- `apps/identity-svc/src/domain/model/email.value-object.ts` (UPDATE) — validation RFC 5322 stricte (Story 0.6 placeholder)
- `apps/identity-svc/src/domain/model/locale.value-object.ts` (NEW) — `'fr' | 'en'`
- `apps/identity-svc/src/domain/model/acquisition-source.value-object.ts` (NEW) — enum 7 valeurs
- `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts` (NEW) — interface `IKeycloakAdmin` + Symbol `KEYCLOAK_ADMIN`
- `apps/identity-svc/src/domain/ports/email-verification-token-repository.port.ts` (NEW) — interface + Symbol
- `apps/identity-svc/src/domain/ports/user-profile.repository.port.ts` (UPDATE) — ajouter `findByEmail`, `save`, `runInTransaction` au interface (impls dans 1.2b)
- `apps/identity-svc/src/domain/exception/identity-conflict.exception.ts` (NEW) — extends `DomainException`, `tukioCode: IDENTITY-CONFLICT-001|002|003`, httpStatus 409
- `apps/identity-svc/src/domain/exception/external-service.exception.ts` (NEW) — httpStatus 502, `tukioCode: IDENTITY-EXTERNAL-001|002`

**AC3 (1.2a) — RegisterCustomerUseCase + tests unit Vitest** : couvre la partie use case + tests de l'AC5 de Story 1.2. Voir `1-2-customer-b2c-registration.md` lignes 916-1057 (squelette use case annoté).

- `apps/identity-svc/src/usecases/register-customer.usecase.ts` (NEW) — implémentation conforme au squelette parent ligne 918+
- `apps/identity-svc/src/usecases/register-customer.usecase.spec.ts` (NEW) — Vitest + mocks ports, **≥ 90 % coverage**, **7+ cases minimum** :
  1. happy path → 201 + 2 events publiés via mock `IEventPublisher`
  2. email déjà existant en DB → throw `IdentityConflictException('IDENTITY-CONFLICT-001')`
  3. Keycloak retourne 409 race → throw `IdentityConflictException`
  4. Keycloak DOWN → throw `ExternalServiceException('IDENTITY-EXTERNAL-001')` + vérifier rollback non appelé (compensation skipped si Keycloak n'a rien créé)
  5. DB save fail après Keycloak créé → vérifier `keycloakAdmin.deleteUser` appelé (rollback compensation)
  6. `marketingOptIn` `true|false|undefined` → persistence correcte avec defaults
  7. Acquisition fields → persistence correcte avec defaults `'unknown'` si absent
  8. (bonus) Verify token UUID v4 généré avec expiry 7 jours
  9. (bonus) `firstName` / `lastName` trimés

**AC4 (1.2a) — Tests unit aggregate + VOs** : tests focalisés sur les invariants domain.

- `apps/identity-svc/src/domain/model/user-profile.aggregate.spec.ts` (UPDATE) — ajouter cases factory `register()` valid, invariants firstName/lastName non vides
- `apps/identity-svc/src/domain/model/email.value-object.spec.ts` (UPDATE Story 0.6 placeholder) — RFC 5322 valid/invalid cases, normalisation lowercase
- `apps/identity-svc/src/domain/model/locale.value-object.spec.ts` (NEW) — `'fr'`/`'en'` valid, throw sur autre
- `apps/identity-svc/src/domain/model/acquisition-source.value-object.spec.ts` (NEW) — 7 valeurs valid, throw sur autre

## Tasks / Subtasks

- [x] **Task 1 — Étendre `@tukio/contracts` avec DTOs + events identity** (AC: #1)
  - [x] 1.1 — Créer `packages/contracts/src/dtos/identity/register-customer.dto.ts` (Zod 4 syntax `z.email()`, `z.uuid()`, password ≥12 chars + complexity regex, `acceptTerms: z.literal(true)`, `acceptMarketing.default(false)`, optional `acquisition`)
  - [x] 1.2 — Créer `packages/contracts/src/dtos/identity/acquisition.dto.ts` (réutilise `ACQUISITION_SOURCES` const from `types/Acquisition.ts` ; truncation guard 200 chars sur medium/campaign/content/term)
  - [x] 1.3 — Créer `packages/contracts/src/events/identity/user-registered.v1.schema.json` (JSON Schema 2020-12 cohérent existing pattern booking-accepted ; required `correlationId`+`causationId`+`actor.locale` ; aggregate.type `user-profile`)
  - [x] 1.4 — Créer `packages/contracts/src/events/identity/user-registered.v1.ts` (types TS hand-written cohérent pattern Story 0.2 — pas de codegen ; export const `USER_REGISTERED_V1_TYPE`)
  - [x] 1.5 — Créer `packages/contracts/src/events/notification/email-send.v1.schema.json` + `.ts` (9 templateId enum, `to.email` required + optional userId/name, `params` additionalProperties: true)
  - [x] 1.6 — Créer `packages/contracts/src/types/error-codes.ts` (NEW file ; 4 const objects : `IdentityErrorCodes`, `AuthErrorCodes`, `ValidationErrorCodes`, `RateLimitErrorCodes` + types TS dérivés)
  - [x] 1.7 — Update `packages/contracts/src/index.ts` racine + `types/index.ts` + `dtos/index.ts` barrel exports + `package.json` 6 nouveaux subpath exports (`./types/error-codes`, `./events/identity/...`, `./events/notification/...`, `./dtos/identity{,/register-customer,/acquisition}`)
  - [x] 1.8 — `pnpm --filter=@tukio/contracts lint && typecheck && test` → 89 tests pass (+24 nouveaux : 16 DTOs + 6 user-registered.v1 + 6 email-send.v1 + 4 acquisition + 3 response), lint 0 warnings, typecheck OK. Régression identity-svc typecheck OK.

- [x] **Task 2 — Étendre identity-svc domain layer** (AC: #2)
  - [x] 2.1 — Update `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` : factory `register()` (customer-specific, role=client, status=active, emailVerified=false, acceptTerms=true, acceptTermsAt=now, marketingOptIn from input, acquisition first-touch wins) + 5 nouveaux fields (`status`, `emailVerified`, `marketingOptIn`, `acceptTerms`, `acceptTermsAt`) — fields **optionnels avec defaults** dans `UserProfileProps` pour compat backward avec mapper Story 0.6 (acquisition fields déjà existants via `AcquisitionContext` Story 0.13)
  - [x] 2.2 — Update `apps/identity-svc/src/domain/model/email.value-object.ts` : ajout getter `asString` (regex RFC-sane déjà présent Story 0.6, pas besoin de réécrire — déviation justifiée Completion Notes)
  - [x] 2.3 — **Skip** `locale.value-object.ts` : type `Locale` déjà exporté par `@tukio/contracts/types/Locale` (pas de duplication — pattern cohérent `user-role.enum.ts`). Déviation justifiée.
  - [x] 2.4 — **Skip** `acquisition-source.value-object.ts` : `AcquisitionSource` + `isAcquisitionSource` guard déjà exposés par `@tukio/contracts/types/Acquisition` Story 0.13. Réutilisation strict. Déviation justifiée.
  - [x] 2.5 — Créer `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts` (interface `IKeycloakAdmin` + types `CreateKeycloakUserInput/Result` ; Symbol `KEYCLOAK_ADMIN` dans `tokens.ts`)
  - [x] 2.6 — Créer `apps/identity-svc/src/domain/ports/email-verification-token-repository.port.ts` (interface `IEmailVerificationTokenRepository` + types record/lookup ; Symbol `EMAIL_VERIFICATION_TOKEN_REPOSITORY`)
  - [x] 2.7 — Update `apps/identity-svc/src/domain/ports/user-profile.repository.port.ts` : ajouter `findByEmail` + `runInTransaction<T>` (avec type `TransactionContext` exposant `userProfileRepo` + `tokenRepo` + `eventPublisher`) ; stub minimal `findByEmail` impl + `runInTransaction` throw "Story 1.2b" dans `UserProfileTypeormRepository` pour préserver typecheck
  - [x] 2.8 — Créer `apps/identity-svc/src/domain/exception/identity-conflict.exception.ts` (extends `DomainException`, validation runtime `tukioCode ∈ CONFLICT_CODES`, httpStatus 409)
  - [x] 2.9 — Créer `apps/identity-svc/src/domain/exception/external-service.exception.ts` (httpStatus 502, validation runtime `tukioCode ∈ EXTERNAL_CODES`)
  - [x] 2.10 — Tests aggregate `user-profile.aggregate.spec.ts` (UPDATE) : 7 originaux préservés + 2 nouveaux (defaults Story 1.2a fields + reject unknown status) + 6 nouveaux factory `register()` (active+unverified+acceptTerms, marketingOptIn pass-through, acquisition defaults, acquisition fields persist, trim names, generate id when omitted) — **15 tests aggregate**
  - [x] 2.11 — **Skip** créer specs Locale/AcquisitionSource VOs (les VOs n'existent pas — voir 2.3/2.4). Email regex/getter `asString` couvert par tests existants `email.value-object.spec.ts`. Justifié.
  - **Bonus** : ajout `user-status.enum.ts` (UserStatus const + type + guard) cohérent pattern `user-role.enum.ts`. Mocks 4 fichiers test e2e/usecase mis à jour pour inclure `findByEmail` + `runInTransaction`.

### Review Findings (2026-05-15, code review via 3 parallel layers : Blind Hunter + Edge Case Hunter + Acceptance Auditor)

**Decision needed (1)** — must resolve before applying patches :

- [x] **[Review][Decision→Patch] `acquisition.content` & `acquisition.term` extended through AcquisitionContext + entity + event schema** — option (a) chosen. `AcquisitionContext` (`@tukio/contracts/types/Acquisition.ts`) + `RegisterAcquisitionInput` (aggregate) + `UserRegisteredV1Payload` (`acquisitionContent` + `acquisitionTerm` string\|null) + JSON schema all extended. Use case `buildUserRegisteredEvent` populates them. Tests cover propagation. **DB columns `acquisition_content` + `acquisition_term` deferred to 1.2b migration** (tracked in `deferred-work.md`). — `AcquisitionInputSchema` accepts `content` + `term` (200-char truncation each), use case forwards `input.acquisition` to `UserProfile.register({ acquisition })` but `RegisterAcquisitionInput` only declares `source/medium/campaign/referralId`. UTM `content` (ad creative variant) and `term` (paid search keyword) reach the spread then disappear — never persisted, never published in `identity.user.registered.v1`. Choice : (a) extend `AcquisitionContext` + entity + event schema to carry both, (b) strip at DTO layer with `.omit({ content: true, term: true })`, or (c) keep current behavior + document the loss explicitly. Source : Edge Case Hunter.

**Patches (15) — High severity (3)** :

- [x] **[Review][Patch] `EmailSendV1.actor.userId = 'system'` is a magic string violating Actor UUID semantics** [`apps/identity-svc/src/usecases/register-customer.usecase.ts:227`] — The notification event sends `actor: { userId: 'system', role: 'system', locale: ... }`. The `system` literal is not a UUID; consumers iterating `actor.userId` will crash on UUID parse or treat it as a real user FK → orphan join. Fix : sentinel UUID `'00000000-0000-0000-0000-000000000000'` OR add `userId: { ... | null }` to schema and pass `null`. Source : Blind Hunter (B2+B9).
- [x] **[Review][Patch] Compensation `.catch(() => {})` swallows ALL errors silently — no log, no metric in 1.2a** [`apps/identity-svc/src/usecases/register-customer.usecase.ts:180`] — Comment claims "alert via `tukio_keycloak_orphan_users_total` Story 1.10" but Story 1.10 hasn't shipped. Today the orphan drift R8 is silent. Fix : inject `ILogger` port + log warning with `correlationId` + `keycloakUserId`. Source : Blind Hunter (B3).
- [x] **[Review][Patch] Compensation `keycloakAdmin.deleteUser` has no timeout — hangs the request thread on Keycloak slow path** [`apps/identity-svc/src/usecases/register-customer.usecase.ts:180`] — DB transaction fails, then `deleteUser` hangs (network retransmit, slow DNS, half-open socket) → HTTP request never completes, orphan also never cleaned. Fix : wrap in `Promise.race` with bounded timeout (5s) using `AbortController` + bubble up the original DB error regardless. Source : Edge Case Hunter (E1).

**Patches — Med severity (7)** :

- [x] **[Review][Patch] Email normalization contract is inconsistent between Zod schema and Email VO** [`packages/contracts/src/dtos/identity/register-customer.dto.ts:15`] — Schema `z.email().min(5).max(254)` rejects `'  Alice@Example.COM '` before reaching `Email.create()` (which would normalize). Test case "email is normalized" only passes because it bypasses the schema. In production, gateway returns 422 instead of accepting normalized form. NFR9 anti-enumeration assumes case-insensitive comparison. Fix : prepend `.trim().toLowerCase()` in Zod via `.preprocess()` OR document that gateway-api must normalize before validation. Source : Blind Hunter (B5+B8) + Edge Case Hunter (E5) + Acceptance Auditor (A4).
- [x] **[Review][Patch] Two distinct `this.now()` calls drift `createdAt` vs `occurredAt`** [`apps/identity-svc/src/usecases/register-customer.usecase.ts:155, 218, 240`] — `UserProfile.register({ now: this.now() })` captures one instant; `buildUserRegisteredEvent.occurredAt = this.now().toISOString()` captures another; `tokenExpiresAt` uses `userProfile.createdAt.getTime() + 7d`. In production these differ by ms; tests mask via FIXED_NOW. Fix : `const now = this.now()` at top of `execute()`, pass to register/buildEvent/tokenExpiry. Source : Blind Hunter (B1) + Edge Case Hunter (E7).
- [x] **[Review][Patch] Concurrent registration race produces 500 instead of 409** [`apps/identity-svc/src/usecases/register-customer.usecase.ts:170`] — Two requests both pass `findByEmail` null; one wins DB commit, the other hits Postgres unique constraint → `QueryFailedError` propagates raw to `EnvelopeExceptionFilter` (no `IDENTITY-CONFLICT-001` mapping). Fix : in catch block detect PG code `23505` and re-throw `IdentityConflictException(CONFLICT_EMAIL_EXISTS)` BEFORE compensation runs. Also requires DB unique index on `lower(email)` (1.2b migration). Source : Edge Case Hunter (E4).
- [x] **[Review][Patch] Schema vs TS drift on `firstName`/`lastName` in `identity.user.registered.v1`** [`packages/contracts/src/events/identity/user-registered.v1.schema.json:65-72`, `user-registered.v1.ts:5-6`] — TS payload marks `firstName?` and `lastName?` optional; JSON Schema doesn't require them and permits empty strings. Future producer (replay, manual fix) could emit `{ firstName: '' }` → template renders `Bonjour ,`. Fix : add `"minLength": 1` + include both in `payload.required`; mark required in TS interface. Source : Edge Case Hunter (E6).
- [x] **[Review][Patch] `runInTransaction` test mock doesn't simulate rollback — production rollback contract untested** [`apps/identity-svc/src/usecases/register-customer.usecase.spec.ts:115-145`] — The stub always calls back + resolves; no test where the callback throws inside (e.g. `tokenRepo.save` fails after aggregate saved). If 1.2b's real impl forgets `queryRunner.rollbackTransaction()`, the suite still passes. Fix : add test case "txn callback throws inside → no partial side effects + compensation triggered". Source : Edge Case Hunter (E8) + Blind Hunter (B10).
- [x] **[Review][Patch] `email-send.v1` schema `aggregate.type` / `aggregate.id` lack UUID format — drift vs `user-registered.v1`** [`packages/contracts/src/events/notification/email-send.v1.schema.json:38-45`] — `user-registered.v1` enforces `aggregate.id: { format: uuid }` and `aggregate.type: { const: "user-profile" }`. `email-send.v1` permits any string for both — too permissive; `aggregate.id = 'anonymous'` passes. Fix : align with `user-registered.v1` pattern (format: uuid on id, restrict type to known enum). Source : Blind Hunter (B12).
- [x] **[Review][Patch] Password regex character class over-broad + excludes non-ASCII** [`packages/contracts/src/dtos/identity/register-customer.dto.ts:9`] — Current `[!@#$%^&*(),.?":{}|<>_\-+=[\]/\\;'\`~]` expands the parent spec's 18-char set (line 57 of parent) without documentation in Debug Log, includes backtick (shell interpolation risk downstream), excludes French accented chars + spaces. Bilingual product : FR users with passwords like `Façade-1234é!` fail. Fix : either narrow to parent spec set + document explicit decision OR replace with Unicode-aware `[^a-zA-Z0-9]` (any non-alphanum counts as "special"). Source : Blind Hunter (B7) + Acceptance Auditor (A3).

**Patches — Low severity (5)** :

- [x] **[Review][Patch] `acceptMarketing` double-defaulted (Zod + use-case fallback)** [`packages/contracts/src/dtos/identity/register-customer.dto.ts:23`, `register-customer.usecase.ts:140`] — Zod schema applies `.default(false)`, use case applies `input.acceptMarketing ?? false` again. Test "marketingOptIn omitted → defaults to false" only works thanks to the second fallback (Zod default doesn't fire when input bypasses validation in unit tests). Fix : pick one canonical default (prefer Zod schema since it's the contract boundary), remove the use-case fallback. Source : Blind Hunter (B6).
- [x] **[Review][Patch] Magic strings `'client'` and `'active'` instead of `UserRole.CLIENT` / `UserStatus.ACTIVE`** [`apps/identity-svc/src/usecases/register-customer.usecase.ts:90-91`] — `keycloakAdmin.createUser({ role: 'client', status: 'active' })` uses string literals. Use case already imports these via the keycloak port. Fix : use enum constants. Source : Blind Hunter (B13+B14).
- [x] **[Review][Patch] `UserProfile.create()` doesn't validate `acceptTerms` ↔ `acceptTermsAt` coherence** [`apps/identity-svc/src/domain/model/user-profile.aggregate.ts:127-149`] — Caller can pass `acceptTerms: true, acceptTermsAt: null` (or `false` + a date). Defaults applied independently in `create()`. RGPD audit needs both consistent. Fix : `if (acceptTerms && acceptTermsAt === null) throw InvalidUserProfileException(...)` (and vice versa). Source : Edge Case Hunter (E9).
- [x] **[Review][Patch] Test `newUuid` queue underflows silently to `FIXED_EVENT_ID` — collisions hidden** [`apps/identity-svc/src/usecases/register-customer.usecase.spec.ts:165-171`] — Queue has 4 entries with `?? FIXED_EVENT_ID` fallback. If a future change calls `newUuid()` a 5th time (e.g. extra event), IDs collide silently. Fix : `throw new Error('uuid queue underflow')` in fallback. Source : Edge Case Hunter (E11).
- [x] **[Review][Patch] `verifyUrl` has no trailing-slash normalization on `publicBaseUrl`** [`apps/identity-svc/src/usecases/register-customer.usecase.ts:240`] — Template literal `${publicBaseUrl}/${locale}/auth/email/verify?token=${verifyToken}` produces `http://localhost:3000//fr/...` if config has trailing slash. Story 1.1's redirect Location fix was needed precisely for this class of bug. Fix : `new URL(`/${locale}/auth/email/verify`, publicBaseUrl)` + `searchParams.set('token', token)`. Source : Edge Case Hunter (E12).

**Deferred (3) — out of 1.2a scope, tracked in `deferred-work.md`** :

- [x] **[Review][Defer] `UserProfileTypeormRepository.runInTransaction` stub throws "Story 1.2b"** [`apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts:47`] — deferred, explicitly scoped to 1.2b (Dev Agent Record point 1).
- [x] **[Review][Defer] `TransactionContext.userProfileRepo = Pick<…, 'save'>` limits in-transaction reads** [`apps/identity-svc/src/domain/ports/user-profile.repository.port.ts:11`] — deferred, design choice; refining requires 1.2b real-impl context to know if in-txn `findByEmail` is needed for race safety beyond DB unique constraint.
- [x] **[Review][Defer] `UserProfileMapper.toEntity` drops the 5 new aggregate fields on save (lossy round-trip)** [`apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts:55-73`] — deferred, mapper extension is explicit 1.2b scope (Dev Agent Record point 3). MUST be sequenced before any production code calls `save()`.

**Dismissed (3)** :

- `aggregate.type` kebab-case (`user-profile` vs parent `UserProfile`) : documented override Task 1.3, repo convention.
- `eventType` `.v1` suffix (`identity.user.registered.v1` vs parent `identity.user.registered`) : documented override Task 1.3, acs.yaml convention.
- Verify token TTL implicit coupling to `userProfile.createdAt` : intentional, minor nit (Blind Hunter B11).

- [x] **Task 3 — Implémenter `RegisterCustomerUseCase` + tests unit Jest ≥ 90 % coverage** (AC: #3)
  - [x] 3.1 — Créer `apps/identity-svc/src/usecases/register-customer.usecase.ts` : **Pattern Pretre pur (PAS `@Injectable()`/`@Inject()` decorators)** cohérent `GetUserProfileByIdUseCase` Story 0.6. Constructor accepte `IUserProfileRepository`, `IKeycloakAdmin`, `publicBaseUrl: string`, `now: () => Date`, `newUuid: () => string` (deux derniers injectés pour testabilité déterministe). Flow : (1) findByEmail → conflict si exists ; (2) keycloak.createUser avec emailVerified=false role=client status=active ; map errors `KeycloakUserAlreadyExistsError` → IdentityConflict, `KeycloakUnreachableError` → ExternalService ; (3) UserProfile.register avec id injecté ; (4) verifyToken UUID + expiry +7j ; (5) `userProfileRepo.runInTransaction(txn => save userProfile + save token + publish 2 events `identity.user.registered.v1` + `notification.email.send.v1`)` ; (6) compensation `keycloak.deleteUser` si DB rollback (drift R8 swallowed).
  - [x] 3.2 — Créer **`register-customer.usecase.spec.ts`** — Jest (pas Vitest — déviation justifiée : identity-svc utilise Jest, cf. `package.json`) + mocks ports — **14 cases** :
    1. happy path → result + Keycloak args + DB save + token + 2 events publiés + verifyUrl correct
    2. email DB conflict → `IDENTITY-CONFLICT-001`, no Keycloak call
    3. Keycloak race conflict → `IDENTITY-CONFLICT-001`, no DB, no compensation
    4. Keycloak DOWN → `IDENTITY-EXTERNAL-001`, no DB, no compensation
    5. Unexpected Keycloak error → rethrow verbatim, no compensation
    6. DB transaction fail → compensation `deleteUser` appelé + rethrow original error
    7. Compensation lui-même fail → still rethrow original DB error (drift R8 swallowed)
    8. marketingOptIn=true → persist + propagate event
    9. marketingOptIn omitted → default false
    10. acquisition fields → persist + propagate (`acquisitionSource` + `acquisitionMedium` + `acquisitionCampaign` + `acquisitionReferralId`)
    11. acquisition omitted → defaults `source=unknown` + null fields in event
    12. correlationId omitted → generated + propagated to both events
    13. locale=en → verifyUrl avec `/en/` prefix + event.locale=en
    14. email normalization → trim + lowercase avant findByEmail et persistence
  - [x] 3.3 — Coverage validée : **`register-customer.usecase.ts` = 96.29 % stmts / 90 % branches / 100 % lines** (≥ 90 % cible Story 1.2a strict, dépasse les seuils repo 70 %). Total identity-svc : 98.97 % stmts / 95.5 % branches / 100 % lines / 65 tests passent dans 9 suites.

## Dev Notes

> **Source-of-truth complète** : `_bmad-output/implementation-artifacts/1-2-customer-b2c-registration.md` (sections Dev Notes lignes 742-1370). Cette story copie les sections pertinentes pour 1.2a (domain + use case + tests unit) — l'infrastructure (1.2b), le gateway (1.2c) et le frontend (1.2d) sont hors scope ici.

### Décisions techniques cadrant 1.2a (extraites parent §"Décisions techniques majeures")

1. **Keycloak gère password hashing nativement** (parent §1) — **dans 1.2a, le port `IKeycloakAdmin.createUser` accepte un `password: string` plaintext** ; l'implémentation infra (1.2b) déléguera à `@keycloak/keycloak-admin-client`. Aucune colonne `password_hash` dans `user_profiles`. PII redaction NFR16.
2. **Pas de saga distribuée register** (parent §4) — transaction TypeORM atomique côté identity-svc. Use case 1.2a appelle `userProfileRepo.runInTransaction(async (txn) => { ... save aggregate + token + 2 events outbox ... })`. L'impl `runInTransaction` est livrée 1.2b ; le contract (interface) est livré 1.2a.
3. **2 events publiés** (parent §5) — `identity.user.registered.v1` (business) + `notification.email.send.v1` (technical). Justification : separation of concerns business / infra notification.
4. **Verify token custom UUID v4** (parent §6) — pas Keycloak `Required Action: VERIFY_EMAIL`. Full control expiration 7 jours + templates Resend FR/EN. Stocké table `email_verification_tokens` (entité + migration livrées 1.2b).
5. **Compensation pattern Keycloak ↔ DB** (parent §3) — si DB transaction rollback après Keycloak user créé, `keycloakAdmin.deleteUser(keycloakUserId)` appelé. Si Keycloak DOWN au moment compensation → drift R8 accepté MVP, alerte Prom Story 1.10. Dans 1.2a, ce comportement est testé via mocks dans `register-customer.usecase.spec.ts` case #5.

### Pattern Pretre strict (parent §"Critical Architecture Constraints")

1. **`domain/` zéro dépendance externe** — eslint-plugin-boundaries enforce (Story 0.6 AC8 `FORBIDDEN_IN_DOMAIN`). Use case dépend uniquement des ports (interfaces).
2. **Symbol DI tokens SCREAMING_SNAKE_CASE** : `KEYCLOAK_ADMIN`, `EMAIL_VERIFICATION_TOKEN_REPOSITORY`, `USER_PROFILE_REPOSITORY`, `EVENT_PUBLISHER`, `CONFIG_SERVICE`.
3. **EN strict couche tech** (memory `feedback_tech_layer_english.md`) : `RegisterCustomerInput`, `IdentityConflictException`, `identity.user.registered.v1` — aucun FR dans le code.
4. **Anti-énumération NFR9** — message API distinct (`tukioCode: 'IDENTITY-CONFLICT-001'`) mais UI générique (sera implémenté 1.2d). 1.2a expose juste l'exception `IdentityConflictException` avec le bon code et message anglais "Email already registered" (pas masqué).

### Versions à utiliser (latest stable)

| Lib | Rôle | Cible 1.2a |
|---|---|---|
| `zod` | Validation schemas | latest stable (3.x) — déjà figé Story 0.2 |
| `vitest` | Test runner unit | latest stable — déjà figé Story 0.6 |
| `@tukio/contracts` | DTOs + events (workspace) | workspace:* — Story 1.2a ajoute |

### Files to UPDATE vs CREATE (scope 1.2a)

> **À UPDATE** (existants Story 0.2 / 0.6) :
> - `packages/contracts/src/types/error-codes.ts` — ajouter `IdentityErrorCodes`
> - `packages/contracts/src/index.ts` — barrel + subpath exports
> - `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` — factory `register()` + 8 fields
> - `apps/identity-svc/src/domain/model/email.value-object.ts` — RFC 5322 validation
> - `apps/identity-svc/src/domain/model/user-profile.aggregate.spec.ts` — cases factory
> - `apps/identity-svc/src/domain/model/email.value-object.spec.ts` — RFC 5322 cases
> - `apps/identity-svc/src/domain/ports/user-profile.repository.port.ts` — signatures findByEmail/save/runInTransaction

> **À CREATE** (nouveaux 1.2a) :
> - `packages/contracts/src/dtos/identity/{register-customer,acquisition}.dto.ts` (2)
> - `packages/contracts/src/events/identity/user-registered.v1.{schema.json,ts}` (2)
> - `packages/contracts/src/events/notification/email-send.v1.{schema.json,ts}` (2)
> - `apps/identity-svc/src/domain/model/{locale,acquisition-source}.value-object.ts` (2) + `.spec.ts` (2)
> - `apps/identity-svc/src/domain/ports/{keycloak-admin,email-verification-token-repository}.port.ts` (2)
> - `apps/identity-svc/src/domain/exception/{identity-conflict,external-service}.exception.ts` (2)
> - `apps/identity-svc/src/usecases/register-customer.usecase.ts` + `.spec.ts` (2)

> **Total 1.2a** : ~14 nouveaux + ~7 updates = ~21 fichiers touchés.

### Testing Standards (parent §"Testing Standards")

- Coverage cibles 1.2a :
  - identity-svc `usecases/register-customer.usecase`: **≥ 90 %** (NFR71 strict)
  - identity-svc `domain/model/*`: ≥ 80 %
  - `@tukio/contracts` `dtos/identity` + `events/identity`: ≥ 80 % (tests valid schemas via Zod parse)
- **Aucun test integration / E2E** dans 1.2a. Mocks via Vitest `vi.fn()` ou `vi.mocked()`. Pas de testcontainers (livré 1.2b).

### Out of scope (couvert par sub-stories ultérieures)

- ❌ `KeycloakAdminService` impl (`@keycloak/keycloak-admin-client`) → **1.2b**
- ❌ `EmailVerificationTokenTypeOrmRepository` impl → **1.2b**
- ❌ `UserProfileTypeOrmRepository` extensions (findByEmail/save/runInTransaction impls) → **1.2b**
- ❌ Migration `1715230000000-AddCustomerRegistrationFields.ts` → **1.2b**
- ❌ Controller `POST /internal/customers` + `InternalServiceGuard` → **1.2b**
- ❌ `UseCasesProxyModule` provider `REGISTER_CUSTOMER_USECASES_PROXY` → **1.2b**
- ❌ Tests integration testcontainers Keycloak/Postgres → **1.2b**
- ❌ Gateway-api forwarder + ThrottlerModule + endpoint public → **1.2c**
- ❌ Frontend sign-up form / hooks / middleware / page → **1.2d**
- ❌ Playwright e2e / axe-core / NFR48 perf → **1.2d**
- ❌ Observability (Prometheus + Grafana) + runbook → **1.2d**

## References

- [Parent: `_bmad-output/implementation-artifacts/1-2-customer-b2c-registration.md`] — source-of-truth ACs lignes 22-626 + Dev Notes lignes 742-1370
- [Sprint Change Proposal: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md`]
- [Architecture: `_bmad-output/planning-artifacts/architecture.md`] §Pattern Pretre + ADR-014 envelope + outbox NATS
- [PRD: `_bmad-output/planning-artifacts/prd.md`] FR1 / FR8 / FR17 / NFR9 / NFR16 / NFR48 / NFR71
- [Story 0.2: `0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md`] — `@tukio/contracts` build pipeline JSON Schema → TS
- [Story 0.6: `0-6-pattern-pretre-scaffolding-template-identity-svc.md`] — Pretre identity-svc + envelope ADR-014 + `DomainException` base class + `UseCasesProxyModule`
- [Memory: `feedback_clean_architecture_explicit.md`] — Pretre canonique
- [Memory: `feedback_tech_layer_english.md`] — code/DB/API/events EN strict

## Dev Agent Record

### Agent Model Used
Claude Opus 4.7 (1M context) — interactive `/bmad-dev-story` workflow.

### Debug Log References

**Audit pré-implémentation (corrections vs Dev Notes du parent 1-2.md)** :
- ❗ **Jest, pas Vitest** côté `identity-svc` : `package.json` → `"test": "jest --config jest.config.ts"`. Le parent story file mentionnait Vitest par erreur. `@tukio/contracts` utilise Vitest, identity-svc utilise Jest. Tests `register-customer.usecase.spec.ts` écrits en Jest API (`jest.fn()`, `jest.Mock`, etc.).
- ❗ **Pretre purity strict** : le squelette parent ligne 942-944 montrait `@Injectable()` + `@Inject(USER_PROFILE_REPOSITORY)`. Le code existant Story 0.6 (`GetUserProfileByIdUseCase`) commence par "Pattern Pretre — pure use case, NO NestJS decorators here". Suivi de la convention réelle : `RegisterCustomerUseCase` est une **classe pure sans decorators**. Le wiring `@Inject` se fera dans 1.2b `usecases-proxy.module.ts`.
- ❗ **Zod 4 syntax** : `package.json` `"zod": "^4.4.3"`. Le squelette parent ligne 49-55 utilisait Zod 3 (`z.string().email()`). Adapté Zod 4 : `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.enum(ACQUISITION_SOURCES)`.
- ❗ **`AcquisitionContext` déjà exposé** par `@tukio/contracts/types/Acquisition` (Story 0.13). Pas de duplication en VO. Le port utilise le type directement.
- ❗ **JSON Schema 2020-12** (pas Draft 7 du parent) : convention existante `booking-accepted.v1.schema.json`. Schemas alignés avec `correlationId` + `causationId` required + `actor.locale` required + `additionalProperties: false`.
- ❗ **`UserProfile.create()` factory existante** : préservée pour rehydration mapper Story 0.6. La nouvelle factory `register()` est customer-spécifique (role=client, status=active, emailVerified=false, acceptTerms=true). Les 5 nouveaux fields (`status/emailVerified/marketingOptIn/acceptTerms/acceptTermsAt`) sont **optionnels avec defaults** dans `UserProfileProps` pour compat backward avec mapper jusqu'à 1.2b.
- ❗ **`Email` exposes via `toString()`** côté Story 0.6 — getter `value` private. Ajout getter `asString` (pas `value` pour éviter collision avec le champ private) pour matcher pattern story (`userProfile.email.asString`).

**Décisions techniques 1.2a** :
- Email VO regex existante `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u` (Story 0.6, pragmatic RFC-sane, max 254 chars) **gardée intacte** — la story parent mentionnait "RFC 5322 strict" mais la version stricte est très complexe et apporte peu de valeur (Zod `z.email()` côté DTO fait la même chose en pratique). Justifié dans Completion Notes.
- VOs `Locale` et `AcquisitionSource` **skippés** — déjà disponibles dans `@tukio/contracts` (Story 0.2 + 0.13). Le pattern repo utilise const-object + type-guard (`user-role.enum.ts`), pas classe VO lourde. Création d'un wrapper VO serait duplication.
- `IConfigService.getPublicBaseUrl()` **non ajouté à l'interface** Story 1.2a — out-of-scope infra. À la place, `publicBaseUrl: string` injecté directement dans `RegisterCustomerUseCase` constructor. Wiring infra (`environment-config.service.ts`) sera mis à jour 1.2b.
- `runInTransaction` stub jeté `throw "Story 1.2b"` dans `UserProfileTypeormRepository` — préserve typecheck mais fail-fast en production avant 1.2b. `findByEmail` impl minimale fonctionnelle (TypeORM `findOne where email`).
- `KeycloakUserAlreadyExistsError` + `KeycloakUnreachableError` définies **dans le port** `keycloak-admin.port.ts` (pas dans infrastructure) — préserve Pretre purity : le use case importe les error types depuis domain, l'impl Story 1.2b les translate depuis `@keycloak/keycloak-admin-client`. Renommé `cause` → `underlyingError` pour éviter `TS4114` override modifier (`Error.cause` existe en TS 5+).
- `KeycloakUnreachableError`'s `underlyingError?` field is intentionally not used by the constructor's caller in 1.2a (will be wired in 1.2b), causing 80% function coverage on the file — acceptable.

### Completion Notes List

**Périmètre livré 1.2a** :
- **`@tukio/contracts`** : 2 DTOs (`register-customer` + `acquisition`) avec Zod 4, 2 JSON Schemas (`identity.user.registered.v1` + `notification.email.send.v1`) avec types TS hand-written, `IdentityErrorCodes` const (+ 3 autres : Auth/Validation/RateLimit), 6 nouveaux subpath exports.
- **identity-svc domain** : factory `UserProfile.register()` (5 nouveaux fields + acquisition first-touch wins), 2 ports (`IKeycloakAdmin`, `IEmailVerificationTokenRepository`) avec error types Pretre-pures, ports `IUserProfileRepository` étendu (`findByEmail` + `runInTransaction` avec `TransactionContext`), 2 exceptions (`IdentityConflict` 409, `ExternalService` 502), `UserStatus` const enum bonus.
- **identity-svc usecase** : `RegisterCustomerUseCase` Pretre-pur, 14 tests unit Jest (happy + conflict DB + conflict Keycloak race + Keycloak DOWN + unexpected error + DB fail compensation + compensation fail + marketingOptIn variants + acquisition variants + correlationId + locale=en + email normalization).
- **Stubs infra minimes** : `UserProfileTypeormRepository.findByEmail` (real impl) + `runInTransaction` (throws "Story 1.2b").

**Validation** :
- `pnpm --filter=@tukio/contracts lint && typecheck && test` : 89 tests pass, 0 errors.
- `pnpm --filter=identity-svc lint && typecheck && test` : 65 tests pass, 0 errors (1 warning pré-existant ligne 31 `email.value-object.spec.ts`).
- Coverage `register-customer.usecase.ts` : **96.29 % stmts / 90 % branches / 100 % lines** (≥ 90 % cible Story 1.2a).
- Coverage global identity-svc : **98.97 % stmts / 95.5 % branches / 100 % lines** (dépasse seuils repo).

**Points d'attention pour 1.2b** :
1. **Remplacer `runInTransaction` stub** par impl réelle TypeORM QueryRunner + partage avec `OutboxPublisher` Story 0.7. Test integration testcontainers obligatoire (drift R8 mitigation case 6).
2. **Étendre `IConfigService.getPublicBaseUrl()`** + impl `environment-config.service.ts` + env var `PUBLIC_BASE_URL`. Wirer dans `UseCasesProxyModule` (provider `REGISTER_CUSTOMER_USECASES_PROXY`) pour injecter `config.getPublicBaseUrl()` au use case.
3. **Migration `1715230000000-AddCustomerRegistrationFields`** doit ajouter colonnes DB : `tukio_status` (enum), `email_verified`, `marketing_opt_in`, `accept_terms`, `accept_terms_at`, `phone`. **Update mapper** `UserProfile.mapper.ts` pour map ces colonnes — les fields actuellement optional dans `UserProfileProps` peuvent rester optional ou devenir required selon design.
4. **`KeycloakAdminService` impl** (`@keycloak/keycloak-admin-client`) traduit les erreurs library en `KeycloakUserAlreadyExistsError` / `KeycloakUnreachableError` du port domain.
5. **`EmailVerificationTokenTypeOrmRepository`** + entity + migration table `email_verification_tokens`.
6. **`UseCasesProxyModule` provider `REGISTER_CUSTOMER_USECASES_PROXY`** wire les 4 dépendances : `USER_PROFILE_REPOSITORY`, `KEYCLOAK_ADMIN`, `EMAIL_VERIFICATION_TOKEN_REPOSITORY`, et `publicBaseUrl` (depuis config).

**Pattern canonique posé** (template pour Stories 1.3-1.10) :
- Use case = classe pure (pas `@Injectable`), constructor accepte ports + helpers (clock, uuid generator) pour testabilité déterministe.
- Erreurs domain (`IdentityConflictException`, `ExternalServiceException`) avec `tukioCode` validé runtime contre const-object whitelist (`CONFLICT_CODES` / `EXTERNAL_CODES`).
- Use case publie events via `runInTransaction(txn => { ... txn.eventPublisher.publish(event); ... })` — atomicité avec outbox Story 0.7.
- Anti-énumération NFR9 : message API distinct (`IdentityConflictException` avec message anglais), UI générique implémentée 1.2d.
- Compensation pattern Keycloak ↔ DB : `keycloak.deleteUser` appelé en rollback si DB save fail. Compensation fail swallowed (alerte Prom Story 1.10).

### File List

**Created (15 files)** :
- `packages/contracts/src/dtos/identity/register-customer.dto.ts`
- `packages/contracts/src/dtos/identity/acquisition.dto.ts`
- `packages/contracts/src/dtos/identity/index.ts`
- `packages/contracts/src/dtos/identity/__tests__/register-customer.spec.ts`
- `packages/contracts/src/events/identity/user-registered.v1.schema.json`
- `packages/contracts/src/events/identity/user-registered.v1.ts`
- `packages/contracts/src/events/notification/email-send.v1.schema.json`
- `packages/contracts/src/events/notification/email-send.v1.ts`
- `packages/contracts/src/types/error-codes.ts`
- `apps/identity-svc/src/domain/model/user-status.enum.ts`
- `apps/identity-svc/src/domain/model/user-status.enum.spec.ts`
- `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts`
- `apps/identity-svc/src/domain/ports/email-verification-token-repository.port.ts`
- `apps/identity-svc/src/domain/exception/identity-conflict.exception.ts`
- `apps/identity-svc/src/domain/exception/identity-conflict.exception.spec.ts`
- `apps/identity-svc/src/domain/exception/external-service.exception.ts`
- `apps/identity-svc/src/domain/exception/external-service.exception.spec.ts`
- `apps/identity-svc/src/usecases/register-customer.usecase.ts`
- `apps/identity-svc/src/usecases/register-customer.usecase.spec.ts`

**Modified (10 files)** :
- `packages/contracts/src/index.ts` (re-export error-codes)
- `packages/contracts/src/types/index.ts` (re-export error-codes)
- `packages/contracts/src/dtos/index.ts` (re-export identity DTOs)
- `packages/contracts/src/events/__tests__/events.spec.ts` (12 nouveaux cases AJV pour user-registered + email-send)
- `packages/contracts/package.json` (6 nouveaux subpath exports)
- `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` (factory `register()` + 5 fields + helpers `isEmailVerified` + `isActive`)
- `apps/identity-svc/src/domain/model/user-profile.aggregate.spec.ts` (10 nouveaux tests : defaults, register factory, isActive variants, assertName non-string)
- `apps/identity-svc/src/domain/model/email.value-object.ts` (getter `asString`)
- `apps/identity-svc/src/domain/ports/tokens.ts` (KEYCLOAK_ADMIN + EMAIL_VERIFICATION_TOKEN_REPOSITORY symbols)
- `apps/identity-svc/src/domain/ports/user-profile.repository.port.ts` (findByEmail + runInTransaction + TransactionContext type)
- `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts` (stubs minimal `findByEmail` + `runInTransaction` rejecting)
- `apps/identity-svc/src/usecases/get-user-profile.usecase.spec.ts` (mock repo extended)
- `apps/identity-svc/test/envelope.e2e-spec.ts` (mock repo extended)
- `apps/identity-svc/test/health.e2e-spec.ts` (mock repo extended)
- `apps/identity-svc/test/user.e2e-spec.ts` (mock repo extended)

**Total : 19 created + 15 modified = ~34 fichiers touchés** (vs estimation 1.2a story file ~21). L'overshoot vient des 4 fichiers tests existants à mettre à jour (mocks IUserProfileRepository extended) + tests pour combler les coverage gaps.

## Change Log

| Date | Action | Author |
|---|---|---|
| 2026-05-15 | Created via `/bmad-correct-course` split de Story 1.2 | Ismael + Claude |
| 2026-05-15 | Implémentation Task 1 (contracts DTOs/events/error-codes) → 89 tests pass | Claude (Opus 4.7) |
| 2026-05-15 | Implémentation Task 2 (identity-svc domain layer + factory `register()`) → 38 tests pass | Claude |
| 2026-05-15 | Implémentation Task 3 (`RegisterCustomerUseCase` + 14 tests Jest, coverage 96.29 %) → total 65 tests pass | Claude |
| 2026-05-15 | Status → review : tous ACs satisfaits, coverage ≥ 90 % cible, lint+typecheck pass | Claude |
| 2026-05-16 | Code review (Blind + Edge + Auditor parallel) : 31 findings raw → 18 uniques après dedup → 1 decision_needed + 15 patch + 3 defer + 3 dismiss | Claude (Opus 4.7) |
| 2026-05-16 | All 15 patches + E3 (decision→patch) applied : actor sentinel UUID, logger compensation, Promise.race timeout 5s, single now(), PG 23505→409, schema/TS firstName-lastName required+minLength, Unicode-aware password regex, email-send aggregate UUID format, email Zod normalization preprocess, removed double marketingOptIn default, UserRole/UserStatus enum constants in createUser, acceptTerms/acceptTermsAt invariant, newUuid queue throw, verifyUrl URL constructor, acquisition.content+term end-to-end. 73 tests identity-svc + 96 tests contracts pass. Coverage register-customer.usecase 97.29 % stmts / 90.62 % branches / 100 % lines. | Claude |
| 2026-05-16 | Status → done : all High/Med review findings resolved, 3 defer items tracked in deferred-work.md (mapper extension + runInTransaction impl + TransactionContext shape — all explicit 1.2b scope), 3 findings dismissed (documented overrides + intentional coupling). | Claude |

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-15
- **Created by** : `bmad-correct-course` workflow (split Story 1.2)
- **Parent** : Story 1.2 (umbrella)
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sub-story** : 1/4
- **Estimation effort** : 1.5-2 j (1 dev backend senior)
- **Dépendances upstream** :
  - Story 0.2 (`@tukio/contracts` envelope + DomainEvent + build pipeline JSON Schema → TS)
  - Story 0.6 (Pretre identity-svc + `DomainException` + `UseCasesProxyModule`)
  - Story 0.7 (`@tukio/messaging` — interface `IEventPublisher` exposée)
  - Story 0.13 (acquisition schema cols préparé)
- **Dépendances downstream** :
  - **1.2b** (infrastructure) — utilise les ports `IKeycloakAdmin`, `IEmailVerificationTokenRepository`, `IUserProfileRepository.findByEmail/save/runInTransaction` définis ici
  - **1.2c** (gateway-api) — utilise le DTO `RegisterCustomerInput` + `RegisterCustomerResponse` + `IdentityErrorCodes` définis ici
  - **1.2d** (frontend) — utilise le DTO côté frontend + types `AcquisitionInput` + `IdentityErrorCodes`
- **FRs covered (partiel — finalisé 1.2b/c/d)** : FR1 partiel (use case logic), FR8 partiel (event `notification.email.send.v1`)
- **NFRs touchés** : NFR9 partiel (anti-énum exception code), NFR16 (PII redaction — pas de password en logs), NFR42 (outbox via use case interface), NFR71 (coverage ≥ 90 % use case)

> **Prochaine sub-story** → **1.2b** (`1-2b-identity-svc-infrastructure-controller`)
