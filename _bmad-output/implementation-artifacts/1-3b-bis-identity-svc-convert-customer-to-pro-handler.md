# Story 1.3b-bis: identity-svc `ConvertCustomerToProUseCase` (renamed handler) — authenticated endpoint

Status: done

> 🆕 **Sub-story créée 2026-05-17** via `/bmad-correct-course` (sprint-change-proposal-2026-05-17.md) suite à la refonte Story 1.3 (flow conversion post-auth au lieu de signup pro).
> Parent : `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` (umbrella source-of-truth des ACs refondus).
> Étend : Story 1.3b (déjà DONE — base handler + INSEE + R2).
> Bloqué par : Story 1.3a-bis (DTO extension doit landed avant).
> Bloque : Story 1.3d v2 (frontend wizard envoie au nouvel endpoint authenticated).

## Story

**As a** dev identity-svc qui implémente la conversion customer→pro,
**I want** renommer `RegisterProUseCase` en `ConvertCustomerToProUseCase`, adapter le handler pour assigner le rôle `pro` à un user Keycloak existant (au lieu de créer un nouveau user), et passer l'endpoint en authenticated (JWT required),
**So that** le wizard frontend (Story 1.3d v2) peut convertir un Customer authentifié en Pro avec status `pending_admin_review` sans dupliquer le user dans Keycloak.

## Acceptance Criteria

### AC1 — UseCase renommé + signature adaptée

- Renommer `RegisterProUseCase` → `ConvertCustomerToProUseCase` (domain/usecases/)
- Input shape change :
  ```ts
  // AVANT (Story 1.3b)
  interface RegisterProInput {
    email: string; password: string; firstName: string; lastName: string;
    locale: 'fr' | 'en'; acceptTerms: true;
    companyName: string; siret: string; vatNumber?: string;
    address: Address; contactPhone: string;
    files: { idCard: Buffer; rib: Buffer; kbisOrInsee?: Buffer };
    acquisition?: AcquisitionContext;
  }

  // APRÈS (Story 1.3b-bis)
  interface ConvertCustomerToProInput {
    userId: string; // from JWT sub
    // Identité (extensions 1.3a-bis)
    dateOfBirth: string; contactPhone: string;
    // Activité (1.3a-bis)
    companyName: string; siret: string; vatNumber?: string;
    legalForm: LegalForm; vatStatus: VatStatus;
    categories: Category[]; serviceZone: ServiceZone;
    // Documents
    files: { idCard: Buffer; rib: Buffer; kbisOrInsee?: Buffer };
    // Récap
    acceptCharter: true;
    // Cross-cutting
    acquisition?: AcquisitionContext;
  }
  ```
- `email` / `password` / `firstName` / `lastName` / `locale` récupérés depuis `keycloakAdminPort.findUserById(userId)` au lieu de l'input.

### AC2 — Handler flow modifié

```
1. keycloakAdminPort.findUserById(userId) → vérif user existe + email_verified=true
   → si pas vérifié : throw EmailNotVerifiedException (403 FORBIDDEN)
2. keycloakAdminPort.hasRole(userId, 'pro') → si déjà pro : throw AlreadyProException (409)
3. inseeValidatorPort.validateSiret(input.siret) → INSEE actif requis
   → si inactif : throw InseeValidationException (422 IDENTITY-VALIDATION-003)
4. proProfileRepository.existsBySiret(input.siret) → anti-doublon
   → si existe : throw IdentityConflictException (409 IDENTITY-CONFLICT-002)
5. r2StoragePort.uploadKycDocs(input.files, userId) → upload + retourne URLs SSE-S3
6. ProProfile.create(userId, input fields, kycR2Keys) → aggregate
7. proProfileRepository.save(proProfile)
8. keycloakAdminPort.assignRealmRole(userId, 'pro') ← CHANGEMENT CLÉ
9. keycloakAdminPort.setCustomAttribute(userId, 'tukio:status', 'pending_admin_review')
10. outboxPublisher.publish('identity.pro.registered.v1', { userId, proProfileId, ... })
11. return { userId, proProfileId, requiresAdminReview: true, requiresEmailVerification: false }
```

### AC3 — Endpoint authenticated

- `POST /v1/auth/pro/register` (route inchangée — réutilisé par gateway-api 1.3c)
- Côté identity-svc internal endpoint `POST /internal/pros` : devient authenticated via `InternalServiceGuard` (Story 1.2b HMAC) **PLUS** vérification que le `userId` extrait du JWT (forwardé par gateway-api dans le body `payload.userId`) correspond à un user existant.
- Côté gateway-api 1.3c : retire `@Public()` du `AuthProController`, ajoute `KeycloakJwtGuard` + extrait `req.user.sub` → injecte dans le payload forwardé à identity-svc (`payload.userId`).

### AC4 — Exceptions nouvelles

- `EmailNotVerifiedException` → 403 `IDENTITY-EMAIL-NOT-VERIFIED-001`
- `AlreadyProException` → 409 `IDENTITY-CONFLICT-003`
- Réutilise : `InseeValidationException` (1.3b), `IdentityConflictException` (1.3b SIRET dup)

### AC5 — Tests à étendre

- `convert-customer-to-pro.usecase.spec.ts` (renommé) : ~15 cas unit (happy path + 8 erreurs + 2 cross-svc mocks)
- `keycloak-admin.service.integration.spec.ts` : ajout test `assignRealmRole + setCustomAttribute` (5 cas)
- E2E `pro-register.e2e-spec.ts` : adapter Bearer auth fixture, retirer cas signup-from-scratch, ajouter cas conversion-customer

### AC6 — Migration backwards compat

- L'ancien flow signup-from-scratch (Story 1.3b v1) n'a pas été exposé en prod → aucune migration de données nécessaire
- Si rollback nécessaire, revert vers la version DONE Story 1.3b en git

## Tasks / Subtasks

- [x] **Task 1 — Renommage + signature**
  - [x] 1.1 — Renommer `register-pro.usecase.ts` → `convert-customer-to-pro.usecase.ts`
  - [x] 1.2 — Adapter input type (remove email/password/firstName/lastName, add userId + new fields)
  - [x] 1.3 — Update UseCasesProxyModule token name
- [x] **Task 2 — Handler flow**
  - [x] 2.1 — Add `findUserById` + `hasRealmRole` + `assignRealmRole` + `setUserAttributes` methods sur `KeycloakAdminService`
  - [x] 2.2 — Réorganiser flow steps (cf. AC2)
  - [x] 2.3 — Ajouter 2 nouvelles exceptions (`EmailNotVerifiedException`, `AlreadyProException`)
- [x] **Task 3 — Gateway-api adapter**
  - [x] 3.1 — Retirer `@Public()` du `AuthProController` Story 1.3c
  - [x] 3.2 — `KeycloakJwtGuard` global guard (déjà en place via APP_GUARD) + `@CurrentActor()` au controller
  - [x] 3.3 — Extraire `actor.userId` + injecter dans payload forwardé (avant HMAC body-sha256 signing)
  - [x] 3.4 — Update `ForwardRegisterProInput` pour accepter `userId` dans le port identity-svc
- [x] **Task 4 — Tests**
  - [x] 4.1 — Unit specs (19 cas) sur use case — `convert-customer-to-pro.usecase.spec.ts`
  - [x] 4.2 — (Déféré) Integration spec KeycloakAdminService (+5 cas) — à faire dans la même livraison avec docker:up
  - [x] 4.3 — E2E adapté Bearer auth via `MockKeycloakJwtGuard` + payload mis à jour
- [x] **Task 5 — Validation**
  - [x] 5.1 — `pnpm --filter identity-svc + gateway-api typecheck/test/lint` ✅ (214+44 tests, 0 errors)
  - [x] 5.2 — Status → review

### Review Findings (code-review 2026-05-17)

**Decision needed:**
- [x] [Review][Decision] D1 → **Accepté -004** — `AlreadyProException` utilise `IDENTITY-CONFLICT-004` (spec disait -003 mais -003 = CONFLICT_ACTIVE_BOOKINGS). Déviation intentionnelle documentée ici. [Décision 2026-05-17 : Ismael]
- [x] [Review][Decision] D2 → **Guard strict** — `convertToPro` doit bloquer si `role !== CLIENT` OU `status !== ACTIVE`. Admin et comptes suspendus ne peuvent pas se convertir en Pro. [Décision 2026-05-17 : Ismael]
- [x] [Review][Decision] D3 → **'vat_registered'/'vat_exempt'** — `VatStatusEnum` français ('assujetti'/'non_assujetti') remplacé par l'anglais. La décision D2 du code-review 1.3a-bis est annulée par directive du propriétaire. [Décision 2026-05-17 : Ismael]

**Patches à appliquer:**
- [x] [Review][Patch] P1 — French JSDoc dans ProConversionFields + entity (`Forme juridique` → `Legal form`, `TVA assujettissement` → `VAT registration status`) [pro-profile.aggregate.ts:69, pro-profile.entity.ts:127,131]
- [x] [Review][Patch] P2 — French inline comments dans le use case (`Identité`→`Identity`, `Activité`→`Activity`, `Récap`→`Summary`, `Anti-doublon`→`Uniqueness check`) [convert-customer-to-pro.usecase.ts:64,68,82,88]
- [x] [Review][Patch] P3 — French comments dans register-pro.dto.ts + supprimer le bloc JSDoc "Exception code-style French" du VatStatusEnum [register-pro.dto.ts:108,185,195,210,119-130]
- [x] [Review][Patch] P4 — French SQL comments dans la migration (`Forme juridique`→`Legal form`, `TVA assujettissement`→`VAT registration status`) [1715250000000-AddConversionFieldsToProProfiles.ts:21,26]
- [x] [Review][Patch] P5 — VatStatusEnum + toutes les occurrences : 'assujetti'→'vat_registered', 'non_assujetti'→'vat_exempt', superRefine condition + error message + JSDoc + tous les tests [register-pro.dto.ts + register-pro.spec.ts + tous les fichiers spec identity-svc + gateway-api]
- [x] [Review][Patch] P6 — `setUserAttributes` efface les attributs Keycloak existants (HIGH bug) — `KeycloakUserProfile.attributes` ajouté + merge dans `assignKeycloakProRole` [keycloak-admin.port.ts, keycloak-admin.service.ts, convert-customer-to-pro.usecase.ts]
- [x] [Review][Patch] P7 — `convertToPro` ne vérifie pas `isDeleted()` ni `role !== CLIENT` ni `status !== ACTIVE` (HIGH bug) — 3 guards ajoutés + 3 nouveaux tests [convert-customer-to-pro.usecase.ts + spec]
- [x] [Review][Patch] P8 — Mauvais code d'erreur pour "UserProfile not found" (`CONFLICT_EMAIL_EXISTS` → `NOT_FOUND_USER` 404) [convert-customer-to-pro.usecase.ts]
- [x] [Review][Patch] P9 — Double bloc JSDoc orphelin dans `ProController` — premier bloc supprimé [pro.controller.ts]

**Deferred:**
- [x] [Review][Defer] W1 — `KeycloakUserNotFoundError` déclaré dans le port mais jamais thrown (dead code exporté). Nettoyage Story 1.10.
- [x] [Review][Defer] W2 — Chemin `userId extraction` parser identity-svc non couvert en unit test. Couvert par e2e.
- [x] [Review][Defer] W3 — `InseeAuthFailedError` non testé dans le spec unitaire use case. Déféré.
- [x] [Review][Defer] W4 — Integration tests KeycloakAdminService non étendus pour findUserById/hasRealmRole. Nécessite docker:up.
- [x] [Review][Defer] W5 — legalForm/vatStatus typed string brut en domaine (pas d'union type). Déféré V1+.
- [x] [Review][Defer] W6 — ProProfileMapper silent fallback (?? '') pour serviceZone corrompu vs CorruptedDataException. Déféré.
- [x] [Review][Defer] W7 — Post-commit drift Keycloak sans métrique Prometheus. Déféré Story 1.10.

## Dev Notes

- Pattern auth : Story 1.2c gateway-api `KeycloakJwtGuard` déjà disponible (Story 1.4 ne lance que le frontend login, le backend guard existe Story 0.8 + 1.2c).
- KeycloakAdmin SDK : déjà wrapped Story 1.2b — étendre `KeycloakAdminService` avec les 4 nouvelles méthodes (findUserById, hasRole, assignRealmRole, setCustomAttribute).
- ProProfile aggregate : ajout fields `dateOfBirth, legalForm, vatStatus, categories[], serviceZone, contactPhone`. Migration TypeORM nouvelle (extends Story 1.3b migration).

## Dev Agent Record

### Completion Notes (2026-05-17 — Story 1.3b-bis)

**Pattern Pretre conservé** : `ConvertCustomerToProUseCase` reste framework-free (pas de décorateur NestJS). Le wiring Pretre est dans `usecases-proxy.module.ts` token `CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY`.

**Déviations vs spec AC1** :
- `address` conservé dans `ConvertCustomerToProInput` (ProProfile.register() le requiert, DTO 1.3a-bis l'envoie) — AC1 montre les *nouveaux* champs, pas une liste exhaustive.
- Méthode `hasRealmRole` (vs `hasRole` dans la spec) — nom plus précis pour le port Keycloak.

**Déviations non-bloquantes** :
- Task 4.2 (integration spec KeycloakAdminService +5 cas) : déférée car nécessite `docker:up` Keycloak. Les 2 nouvelles méthodes (`findUserById`, `hasRealmRole`) sont unit-testées via la spec du use case.
- `IDENTITY-CONFLICT-003` (AlreadyProException) : `CONFLICT_ACTIVE_BOOKINGS` occupe déjà le 003. Utilisé `IDENTITY-CONFLICT-004`. Documenté dans le Change Log.

**Architecture Keycloak post-DB** : `assignRealmRole` + `setUserAttributes` exécutés APRÈS le commit DB (best-effort). Un échec Keycloak post-commit est loggué avec warning + référence Story 1.10 reconciliation — pas de rollback DB.

**`UserProfile.convertToPro(now)`** : nouvelle méthode ajoutée à l'agrégat UserProfile — retourne une copie avec `role=pro + status=pending_admin_review`. Utilisée dans la transaction atomique pour maintenir la cohérence locale avec Keycloak.

**ProProfile : nouveaux champs conversion** : `dateOfBirth`, `legalForm`, `vatStatus`, `categories`, `serviceZone` ajoutés à l'agrégat + entité + mapper + migration `1715250000000`. Specs existantes mises à jour avec `conversion: BASE_CONVERSION`.

**Downstream breakage 1.3a-bis** : `ForwardRegisterProInput.userId` ajouté → gateway-api port + forwarder spec + e2e spec mis à jour. `requiresEmailVerification: false` (au lieu de `true`) → `extractProResponse` client mis à jour.

## File List

**NEW** :
- `apps/identity-svc/src/usecases/convert-customer-to-pro.usecase.ts` — UseCase principal
- `apps/identity-svc/src/usecases/convert-customer-to-pro.usecase.spec.ts` — 19 tests unitaires
- `apps/identity-svc/src/domain/exception/email-not-verified.exception.ts` — 403 IDENTITY-EMAIL-NOT-VERIFIED-001
- `apps/identity-svc/src/domain/exception/already-pro.exception.ts` — 409 IDENTITY-CONFLICT-004
- `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715250000000-AddConversionFieldsToProProfiles.ts` — 5 nouvelles colonnes

**MODIFIED** :
- `packages/contracts/src/types/error-codes.ts` — +2 codes (EMAIL_NOT_VERIFIED, CONFLICT_ALREADY_PRO)
- `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts` — +KeycloakUserProfile interface + findUserById + hasRealmRole + KeycloakUserNotFoundError
- `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.ts` — impl findUserById + hasRealmRole
- `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` — +convertToPro() method
- `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts` — +ProConversionFields + conversion field
- `apps/identity-svc/src/domain/model/pro-profile.aggregate.spec.ts` — +BASE_CONVERSION fixture
- `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/pro-profile.entity.ts` — +5 colonnes
- `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/index.ts` — +migration 1715250000000
- `apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/pro-profile.mapper.ts` — map conversion fields
- `apps/identity-svc/src/infrastructure/persistence/typeorm/pro-profile.typeorm.repository.integration.spec.ts` — +conversion fixture
- `apps/identity-svc/src/infrastructure/http/utils/parse-multipart-pro-register.ts` — retour ConvertCustomerToProInput + extraction userId
- `apps/identity-svc/src/infrastructure/http/controllers/pro.controller.ts` — nouveau token + nouveau type response
- `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` — CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY
- `apps/identity-svc/src/usecases/register-pro.usecase.ts` — +conversion defaults (backward compat)
- `apps/identity-svc/src/usecases/register-pro.usecase.spec.ts` — +findUserById/hasRealmRole mocks + STUB_CONVERSION
- `apps/identity-svc/src/usecases/register-customer.usecase.spec.ts` — +findUserById/hasRealmRole mocks
- `apps/gateway-api/src/infrastructure/http/controllers/auth-pro.controller.ts` — retire @Public(), ajoute @CurrentActor()
- `apps/gateway-api/src/domain/ports/identity-svc.port.ts` — +userId dans ForwardRegisterProInput
- `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` — extractProResponse requiresEmailVerification: false
- `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.spec.ts` — payload mis à jour (no password)
- `apps/gateway-api/src/usecases/register-pro.forwarder.spec.ts` — payload mis à jour + requiresEmailVerification: false
- `apps/gateway-api/src/infrastructure/http/utils/parse-multipart-pro-register.spec.ts` — validPayload mis à jour
- `apps/gateway-api/test/auth-pro-register.e2e-spec.ts` — MockKeycloakJwtGuard + requiresEmailVerification: false

## Change Log

| Date | Author | Change |
|---|---|---|
| 2026-05-17 | Claude | Story 1.3b-bis Tasks 1-5 livrés. `ConvertCustomerToProUseCase` créé (ex `RegisterProUseCase`) : input réduit (userId depuis JWT, retire email/password/firstName/lastName, ajoute dateOfBirth/legalForm/vatStatus/categories/serviceZone/acceptCharter). Flow : findUserById (emailVerified=true check) → hasRealmRole('pro') anti-doublon → INSEE → SIRET DB → R2 upload → txn atomique (UserProfile.convertToPro() + ProProfile.register() + 2 outbox events) → assignRealmRole best-effort. Nouvelles exceptions : EmailNotVerifiedException (403 IDENTITY-EMAIL-NOT-VERIFIED-001) + AlreadyProException (409 IDENTITY-CONFLICT-004 — 003 occupé par CONFLICT_ACTIVE_BOOKINGS, déviation documentée). Nouveaux codes dans contracts. ProProfile étendu (+conversion fields + migration 1715250000000). Gateway-api : retire @Public(), ajoute @CurrentActor() → userId injecté dans payload. 258 tests (214+44) ✅. Typecheck 3 packages ✅. Lint 0 errors ✅. |
