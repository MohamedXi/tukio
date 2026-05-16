# Story 1.3a: @tukio/contracts pro DTOs/events + identity-svc ProProfile domain + RegisterProUseCase (unit tests)

Status: ready-for-dev

> 🧩 **Sub-story 1/4 de Story 1.3** (décomposée 2026-05-16 via `/bmad-correct-course`).
> Parent : `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` (umbrella source-of-truth des ACs/Dev Notes complets).
> Proposal : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-16.md`.
> Sub-stories suivantes (séquentielles) : `1-3b-identity-svc-infrastructure-insee-r2-controller` → `1-3c-gateway-api-pro-register-multipart-forwarder` → `1-3d-frontend-wizard-seller-middleware-e2e-observability`.

## Story

**As a** dev backend qui implémente Epic 1 Story 1.3 (Pro B2B registration),
**I want** que le pattern Pretre "register pro" soit posé proprement dans :
1. `@tukio/contracts` : DTOs `register-pro.dto.ts` (Zod schemas `RegisterProInput`, `ProAddress`, `RegisterProResponse`), util partagé `siret.ts` (`siretLuhnCheck` function + tests unitaires sur 5+ SIRETs réels), événement JSON Schema `pro-registered.v1` + types TS dérivés, ajout `IDENTITY-VALIDATION-002/003` + `IDENTITY-EXTERNAL-002/003` à `error-codes.ts`, ajout `'pro-pending-admin-review'` templateId à `email-templates.ts`, barrel + subpath exports ;
2. `apps/identity-svc/src/domain/` : aggregate `ProProfile` (factory `register()` + invariants companyName/siret/INSEE-active), 4 VOs (`Siret` avec Luhn check, `VatNumber` FR pattern, `Address`, `PhoneNumber` E.164 FR normalize), 3 ports (`IInseeSiretValidator`, `IMediaStorage`, `IProProfileRepository`) avec Symbol tokens, exception `IdentityValidationException` (httpStatus 422), extension de `ExternalServiceException` Story 1.2a pour codes 002/003 ;
3. `apps/identity-svc/src/usecases/register-pro.usecase.ts` : implémentation use case (mocks ports) avec **coverage ≥ 90 % en tests unit Vitest (10+ cases)**,
**so that** les sous-stories suivantes (1.3b infrastructure, 1.3c gateway-api BFF, 1.3d frontend wizard) puissent s'y brancher sans ambiguïté, **et que cette story devienne la 2ᵉ référence Pretre canonique** (après 1.2a) couvrant "register avec external validation API + uploads".

> **Outcome attendu** : à la fin de 1.3a, `pnpm --filter=@tukio/contracts build && pnpm --filter=@tukio/contracts test` passe (Luhn tests 5+ SIRETs réels valid + 5+ invalid, schemas Zod valid, JSON Schema valid), `pnpm --filter=identity-svc test usecases/register-pro.usecase.spec.ts` passe avec **coverage ≥ 90 %** sur le use case, **aucun appel I/O réel** (Keycloak / INSEE / R2 / Postgres / NATS mockés via ports). Pas d'infrastructure exécutée, pas de migration appliquée, pas d'endpoint HTTP, pas de gateway, pas de frontend.

## Acceptance Criteria (héritées de Story 1.3)

Cette story couvre **AC2** (DTOs + events + siret util) intégralement et **AC4 partiel** (use case + tests unit + factory + VOs, sans infra). Les ACs 1, 3, 5, 6, 7, 8, 9, 10 sont couvertes par les sub-stories 1.3b/c/d.

### AC1 (1.3a) — DTOs + util SIRET + event schemas dans `@tukio/contracts`
Voir parent ligne 45-189 pour le détail des schemas Zod + JSON Schema + format SIRET Luhn.

- `packages/contracts/src/dtos/identity/register-pro.dto.ts` (NEW) — `ProAddressSchema` + `RegisterProInputSchema` (réutilise `LocaleSchema` Story 1.2a + `AcquisitionInputSchema` Story 1.2a) + `RegisterProResponseSchema` (`{ userId, proProfileId, requiresAdminReview:true, requiresEmailVerification:true }`)
- `packages/contracts/src/utils/siret.ts` (NEW) — `siretLuhnCheck(siret: string): boolean` fonction pure exportée (utilisée frontend + backend), doc JSDoc avec lien Wikipedia Luhn
- `packages/contracts/src/utils/siret.spec.ts` (NEW) — 10+ cases Vitest (validés contre validateur officiel INSEE) :
  - `35600000000048` (La Poste) → true
  - `73282932000074` (Google France) → true
  - `35280000000027` (BNP Paribas Personal Finance — exemple) → true
  - 3+ autres SIRETs valides issus de https://annuaire-entreprises.data.gouv.fr/
  - Invalid : `00000000000000`, `12345678901234`, `12345678901235` (Luhn fail), `1234567890123` (13 digits), `123456789012345` (15 digits), `1234567890123A` (non-numeric)
- `packages/contracts/src/events/identity/pro-registered.v1.schema.json` (NEW) — JSON Schema Draft 7 cohérent existing pattern user-registered.v1 Story 1.2a ; required `correlationId` + `causationId` + `actor.locale` ; `aggregate.type: 'ProProfile'`
- `packages/contracts/src/events/identity/pro-registered.v1.ts` (NEW) — types TS hand-written + `PRO_REGISTERED_V1_TYPE` const
- `packages/contracts/src/types/error-codes.ts` (UPDATE) — ajouter à `IdentityErrorCodes` : `VALIDATION_SIRET_INVALID: 'IDENTITY-VALIDATION-002'`, `VALIDATION_SIRET_INACTIVE: 'IDENTITY-VALIDATION-003'`, `EXTERNAL_INSEE_UNREACHABLE: 'IDENTITY-EXTERNAL-002'`, `EXTERNAL_R2_UPLOAD_FAILED: 'IDENTITY-EXTERNAL-003'`
- `packages/contracts/src/types/email-templates.ts` (UPDATE) — ajouter `'pro-pending-admin-review'` au `EmailTemplateId` enum + `EMAIL_TEMPLATE_IDS` array
- `packages/contracts/src/index.ts` + `package.json` (UPDATE) — barrel + 3 nouveaux subpath exports : `./dtos/identity/register-pro`, `./utils/siret`, `./events/identity/pro-registered.v1`

### AC2 (1.3a) — identity-svc ProProfile domain layer (aggregate + VOs + ports + exceptions)

Voir parent ligne 282-558 pour le détail factory + saga + invariants.

- `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts` (NEW) — aggregate root avec factory static `register({ companyName, siret, vatNumber?, address, contactPhone, inseeData })` + invariants (companyName 1-200 chars, siret VO valide, INSEE active obligatoire passé en param `inseeData.etatAdministratif === 'A'`)
- `apps/identity-svc/src/domain/model/value-objects/siret.value-object.ts` (NEW) — `Siret` VO encapsulant 14 digits + Luhn check (réutilise `siretLuhnCheck` `@tukio/contracts/utils/siret`)
- `apps/identity-svc/src/domain/model/value-objects/vat-number.value-object.ts` (NEW) — `VatNumber` VO optional, validation pattern FR `^FR\d{11}$`
- `apps/identity-svc/src/domain/model/value-objects/address.value-object.ts` (NEW) — `Address` VO `{ street, postalCode (5 digits FR), city, country: 'FR' }`
- `apps/identity-svc/src/domain/model/value-objects/phone-number.value-object.ts` (NEW) — `PhoneNumber` VO normalize en E.164 (`+33[1-9]\d{8}$`)
- `apps/identity-svc/src/domain/ports/insee-siret-validator.port.ts` (NEW) — interface `IInseeSiretValidator { validate(siret: Siret): Promise<{ etatAdministratif: 'A' | 'C', denomination: string, dateCreation: string, categorieJuridique: string, address: Address }> }` + Symbol `INSEE_SIRET_VALIDATOR`
- `apps/identity-svc/src/domain/ports/media-storage.port.ts` (NEW) — interface `IMediaStorage { upload(input: { bucket, key, body, contentType, metadata }): Promise<{ key, etag }>; getSignedUrl(input: { bucket, key, ttlSeconds }): Promise<string>; delete(input: { bucket, key }): Promise<void> }` + Symbol `MEDIA_STORAGE`
- `apps/identity-svc/src/domain/ports/pro-profile.repository.port.ts` (NEW) — interface `IProProfileRepository { findBySiret(siret: Siret): Promise<ProProfile | null>; save(profile: ProProfile, ctx?: TransactionContext): Promise<ProProfile>; runInTransaction<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> }` + Symbol `PRO_PROFILE_REPOSITORY`
- `apps/identity-svc/src/domain/ports/tokens.ts` (UPDATE) — ajouter les 3 Symbol tokens
- `apps/identity-svc/src/domain/exception/identity-validation.exception.ts` (NEW) — `IdentityValidationException` extends `DomainException`, httpStatus 422, tukioCodes `IDENTITY-VALIDATION-001/002/003`
- `apps/identity-svc/src/domain/exception/external-service.exception.ts` (UPDATE Story 1.2a) — étendre pour accepter `IDENTITY-EXTERNAL-002` (INSEE) + `IDENTITY-EXTERNAL-003` (R2)

### AC3 (1.3a) — RegisterProUseCase + tests unit Vitest ≥ 90% coverage

Voir parent ligne 357-558 pour le squelette annoté de la saga compensable (~150 lignes).

- `apps/identity-svc/src/usecases/register-pro.usecase.ts` (NEW) — implémentation saga compensable :
  1. Pré-check `proProfileRepo.findBySiret` → throw `IdentityConflictException('IDENTITY-CONFLICT-002')` si déjà actif
  2. `inseeValidator.validate(siret)` → throw `IdentityValidationException('IDENTITY-VALIDATION-003')` si `etatAdministratif !== 'A'`
  3. `keycloakAdmin.createUser({ role: 'pro', claims: { 'tukio:status': 'pending_admin_review', 'tukio:locale': locale } })` → on fail compensate nothing (rien créé)
  4. `runInTransaction(async (ctx) => { upload 3 files via mediaStorage (parallèle) ; userProfileRepo.save(userProfile) ; proProfileRepo.save(proProfile) ; outbox.publish(['identity.pro.registered.v1', 'notification.email.send.v1']) })`
  5. On DB fail après Keycloak créé + R2 uploadé → `compensate()` : `keycloakAdmin.deleteUser` + `mediaStorage.delete × 3`
  6. Return `{ userId, proProfileId, requiresAdminReview: true, requiresEmailVerification: true }`
- `apps/identity-svc/src/usecases/register-pro.usecase.spec.ts` (NEW) — Vitest + mocks ports, **≥ 90 % coverage**, **10+ cases minimum** :
  1. happy path → 201 + 2 events publiés via mock `IEventPublisher` (`identity.pro.registered.v1` + `notification.email.send.v1` template `pro-pending-admin-review`)
  2. SIRET déjà actif en DB → throw `IdentityConflictException('IDENTITY-CONFLICT-002')`
  3. INSEE `etatAdministratif === 'C'` → throw `IdentityValidationException('IDENTITY-VALIDATION-003')` + verify Keycloak/R2/DB non-appelés (early return)
  4. INSEE 404 SIRET inconnu → throw `IdentityValidationException('IDENTITY-VALIDATION-003')` même code (semantically equivalent)
  5. INSEE rate-limit (`InseeRateLimitError`) → throw `ExternalServiceException('IDENTITY-EXTERNAL-002')` avec retryAfter populated
  6. INSEE 5xx down (`InseeUnreachableError`) → throw `ExternalServiceException('IDENTITY-EXTERNAL-002')`
  7. Keycloak 409 race condition → throw `IdentityConflictException` (email déjà pris)
  8. Keycloak DOWN → throw `ExternalServiceException('IDENTITY-EXTERNAL-001')` + verify INSEE déjà appelé (cache)
  9. R2 upload fail → throw `ExternalServiceException('IDENTITY-EXTERNAL-003')` + verify `compensate()` appelle `keycloakAdmin.deleteUser` (Keycloak rollback)
  10. DB save fail après Keycloak + R2 uploads → verify compensate appelle `keycloakAdmin.deleteUser` + `mediaStorage.delete × 3` (full rollback)
  11. (bonus) `vatNumber` undefined accepté
  12. (bonus) `acquisition` undefined → defaults `'unknown'` cohérent Story 1.2a

### AC4 (1.3a) — Tests unit aggregate + VOs

- `apps/identity-svc/src/domain/model/pro-profile.aggregate.spec.ts` (NEW) — factory `register()` valid + invariants
- `apps/identity-svc/src/domain/model/value-objects/siret.value-object.spec.ts` (NEW) — 10+ cases Luhn (réutilise fixtures `@tukio/contracts/utils/siret.spec.ts`)
- `apps/identity-svc/src/domain/model/value-objects/vat-number.value-object.spec.ts` (NEW) — FR pattern valid/invalid
- `apps/identity-svc/src/domain/model/value-objects/address.value-object.spec.ts` (NEW) — postal code 5 digits FR valid/invalid
- `apps/identity-svc/src/domain/model/value-objects/phone-number.value-object.spec.ts` (NEW) — `+33...`/`0...` valid → normalize E.164

## Tasks / Subtasks

- [ ] **Task 1 — Étendre `@tukio/contracts` avec DTOs + util SIRET + events Pro** (AC: #1) — Story 1.3 parent Task 1
  - [ ] 1.1 — Créer `packages/contracts/src/utils/siret.ts` (`siretLuhnCheck` fonction pure + JSDoc Wikipedia link)
  - [ ] 1.2 — Créer `packages/contracts/src/utils/siret.spec.ts` (10+ cases, fixtures SIRET réels validés via annuaire-entreprises.data.gouv.fr)
  - [ ] 1.3 — Créer `packages/contracts/src/dtos/identity/register-pro.dto.ts` (`ProAddressSchema`, `RegisterProInputSchema`, `RegisterProResponseSchema`)
  - [ ] 1.4 — Créer `packages/contracts/src/events/identity/pro-registered.v1.schema.json` (Draft 7 cohérent user-registered.v1)
  - [ ] 1.5 — Créer `packages/contracts/src/events/identity/pro-registered.v1.ts` (types TS + `PRO_REGISTERED_V1_TYPE`)
  - [ ] 1.6 — Update `packages/contracts/src/types/error-codes.ts` (4 nouveaux codes IDENTITY-VALIDATION-002/003 + IDENTITY-EXTERNAL-002/003)
  - [ ] 1.7 — Update `packages/contracts/src/types/email-templates.ts` (ajouter `pro-pending-admin-review`)
  - [ ] 1.8 — Update `packages/contracts/src/index.ts` + `package.json` exports (3 nouveaux subpath)
  - [ ] 1.9 — `pnpm --filter=@tukio/contracts lint && typecheck && test` → tests Luhn passent + DTOs valid + JSON Schema valid + zero new lint warnings

- [ ] **Task 2 — Étendre identity-svc domain : ProProfile aggregate + VOs + ports + exceptions** (AC: #2) — Story 1.3 parent Task 2
  - [ ] 2.1 — Créer 4 VOs sous `apps/identity-svc/src/domain/model/value-objects/{siret,vat-number,address,phone-number}.value-object.ts`
  - [ ] 2.2 — Créer `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts` (factory `register()` + invariants)
  - [ ] 2.3 — Créer `apps/identity-svc/src/domain/ports/{insee-siret-validator,media-storage,pro-profile.repository}.port.ts` + Symbol tokens
  - [ ] 2.4 — Update `apps/identity-svc/src/domain/ports/tokens.ts` (ajouter `INSEE_SIRET_VALIDATOR`, `MEDIA_STORAGE`, `PRO_PROFILE_REPOSITORY`)
  - [ ] 2.5 — Créer `apps/identity-svc/src/domain/exception/identity-validation.exception.ts` (httpStatus 422)
  - [ ] 2.6 — Update `apps/identity-svc/src/domain/exception/external-service.exception.ts` (codes 002/003)
  - [ ] 2.7 — Tests unit aggregate + 4 VOs (Vitest, coverage ≥ 80%)

- [ ] **Task 3 — Implémenter `RegisterProUseCase` + tests unit Vitest ≥ 90%** (AC: #3) — Story 1.3 parent Task 3
  - [ ] 3.1 — Créer `apps/identity-svc/src/usecases/register-pro.usecase.ts` (~150 lignes, cf. parent ligne 357+ squelette)
  - [ ] 3.2 — Créer `apps/identity-svc/src/usecases/register-pro.usecase.spec.ts` (Vitest + mocks 7 ports, 10+ cases)
  - [ ] 3.3 — `pnpm --filter=identity-svc test register-pro.usecase.spec.ts --coverage` → coverage ≥ 90% sur use case (NFR71)
  - [ ] 3.4 — `pnpm --filter=identity-svc lint && typecheck` → 0 errors

## Dev Notes

### Dépendances pré-requises
- ✅ Story 1.2a `LocaleSchema`, `AcquisitionInputSchema`, `IdentityErrorCodes` const, `IConflictException`, `IExternalServiceException`, `IEventPublisher` port → tous déjà livrés
- ✅ Story 0.7 `OutboxPublisher` + `TransactionContext` → déjà disponible dans `@tukio/messaging`
- ✅ Story 0.2 envelope + JSON Schema validation pipeline → opérationnel

### Patterns à respecter (cohérent Story 1.2a)
- VOs immutables avec validation dans constructor (throw `InvalidXxxException` si invalide)
- Ports = interfaces TS pures sans dépendance NestJS (Pattern Pretre domain)
- Use case orchestre les ports, jamais d'I/O directe
- Saga compensable : compensate() invoqué seulement si l'étape précédente a réussi
- Tests unit use case = ZERO infrastructure, tous les ports mockés via `vi.fn()`

### Hors scope 1.3a (couvert 1.3b/c/d)
- InseeSiretValidatorService impl (1.3b)
- R2MediaStorageService impl (1.3b)
- ProProfileTypeormRepository impl (1.3b)
- Migration Postgres (1.3b)
- Controller HTTP (1.3b + 1.3c)
- Frontend wizard (1.3d)
- E2E Playwright (1.3d)
- Observability + runbooks (1.3d)

## File List
_(à remplir pendant le dev par le dev-story workflow)_

## Change Log
_(à remplir pendant le dev)_

## Story Completion Status
- [ ] All tasks complete
- [ ] Coverage ≥ 90% use case (NFR71)
- [ ] `pnpm --filter=@tukio/contracts test` pass
- [ ] `pnpm --filter=identity-svc test` pass (régression Story 1.2a)
- [ ] Status updated to `review` then `done` after code-review
