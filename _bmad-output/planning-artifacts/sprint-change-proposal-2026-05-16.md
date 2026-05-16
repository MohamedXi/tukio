# Sprint Change Proposal — Story 1.3 décomposition

**Date** : 2026-05-16
**Auteur** : Ismael (via `/bmad-correct-course` Claude)
**Sprint** : Sprint 1 (Epic 1 — Identity & Authentication Backbone)
**Scope** : Décomposition Story 1.3 (Pro B2B registration `pending_admin_review`) en 4 sous-stories atomiques

---

## Section 1 — Issue Summary

### Trigger
Story `1-3-pro-registration-pending-admin-review` (créée 2026-05-09, status `ready-for-dev`) a été activée pour implémentation via `/bmad-dev-story`. À la lecture intégrale du fichier story (1438 lignes), le scope effectif s'avère incompatible avec une livraison atomique single-session :

- **Empreinte tasks** : 10 Tasks majeures × ~75 sub-tasks
- **Surface technique** : 5 codebases touchées (`@tukio/contracts`, `apps/identity-svc`, `apps/gateway-api`, `apps/public`, `apps/seller`) + 1 package consumer (`@tukio/api-client`)
- **External integrations NEW** : 2 (INSEE SIRENE V3.11 + Cloudflare R2 KYC bucket) — premières intégrations tierces de l'application au-delà de Keycloak/Postgres/NATS
- **Pattern complexity** : saga compensable Pattern Pretre avec 7 ports (Keycloak + UserProfile repo + ProProfile repo + Insee validator + Media storage + Outbox + EventPublisher), multipart upload 3 fichiers chiffrés AES256, JWT claim middleware redirect cross-zone
- **Frontend wizard 3 steps** avec validation immédiate Zod + uploads R2 + i18n FR/EN ~40 keys
- **Tests** : E2E Playwright FR + EN + axe-core + perf NFR48 + ~30 tests unit/integration

### Type d'issue
**Technical limitation discovered during implementation** — capacité single-session vs scope monolithique. Pas un changement de scope produit, pas un revirement stratégique. C'est un problème de granularité de découpage des stories au moment de la planification (Story 1.3 a été créée comme bloc unique alors qu'elle agrège 4 préoccupations distinctes : contracts/domain, infrastructure, gateway BFF, frontend+seller). Pattern identique à Story 1.2 décomposée le 2026-05-15.

### Découverte INSEE Sirene auth model
Pendant l'audit pré-implémentation, test direct sur l'API INSEE Sirene V3.11 a révélé que l'authentification est **apiKey simple** via header `X-INSEE-Api-Key-Integration: <key>` — **PAS OAuth2 client_credentials** comme indiqué dans le parent Story 1.3 ligne 768 (`OAuth2 client_credentials + cache token + parse V3.11 response`). Le sub-story 1.3b doit déviser de la spec parent sur ce point :
- Pas de service `InseeTokenCacheService` (no token to cache, apiKey is static)
- Pas d'endpoint OAuth2 token endpoint
- Rate limit : 30 req/min par clé (header `x-rate-limit-limit: 30` + `x-rate-limit-reset` Unix ms)
- Endpoint canonique : `GET https://api.insee.fr/api-sirene/3.11/siret/{siret}` (14 digits)
- Test live confirmé sur SIRET La Poste `35600000000048` → 200 + `etatAdministratifUniteLegale: "A"`

### Découverte Cloudflare R2 KYC bucket
Bucket `tukio-kyc-staging` provisionné par Ismael 2026-05-16 :
- Account ID : `0e633032f5574da7906045d298e5ee83`
- Endpoint S3 : `https://0e633032f5574da7906045d298e5ee83.eu.r2.cloudflarestorage.com`
- Auth : AWS SDK v3 compatible (Access Key ID + Secret Access Key)
- SSE AES256 supporté nativement
- Credentials provisionnées en RAM (non commitées) ; iront dans `/home/tukio/tukio/secrets/` du droplet data pendant 1.3b (Docker secrets `r2_kyc_access_key_FILE` + `r2_kyc_secret_key_FILE`)

### Evidence
1. Story file `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` ligne 740-843 : 10 Tasks/75 subtasks listés
2. Story file Task 4 ligne 766-783 : 16 sub-tasks infra (INSEE + R2 + ProProfile + migration + tests integration)
3. Story file Task 7 ligne 807-817 : 9 sub-tasks frontend wizard 3 steps
4. Précédent split 1.2 → 1.2a/b/c/d (`sprint-change-proposal-2026-05-15.md`) validé succès : 4 sub-stories livrées en 4 sessions distinctes, code-review parallèle par layer, patterns Pretre canoniques posés
5. Mémoire `story_1_2_split_2026_05_15.md` : scope 75 fichiers / 5-7j réparti par layer

---

## Section 2 — Impact Analysis

### Epic Impact
- **Epic 1** (Identity & Authentication Backbone) reste intégralement couvert. La décomposition ne touche que la granularité Story-level.
- **Epic 1 stories aval** (1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10) restent dépendantes des **patterns** posés par 1.3 (factory `register()` pour Pro, saga compensable, multipart upload, middleware status-based redirect). Le découpage **améliore** la lisibilité du pattern KYC + external validation — 1.3b sera la **2ᵉ référence Pretre infrastructure canonique** que les stories 2.x (Epic 2 Pro Onboarding) copieront pour Stripe Connect Express.
- **Epic 2** (Pro Onboarding & Admin Verification) dépend explicitement de Story 1.3 (consumer ProProfile.kyc_status='pending_review'). Le découpage **renforce** la dépendance ; Stories 2.3-2.4 attendent 1.3d livré (frontend pro register flow complet).
- **Aucune autre Epic** (3-16) impactée.

### Story Impact

| Avant | Après | Status transition |
|---|---|---|
| `1-3-pro-registration-pending-admin-review` (ready-for-dev) | Marquée `done` avec comment "split via correct-course 2026-05-16" — sert d'umbrella audit | ready-for-dev → done |
| — | `1-3a-contracts-pro-domain-usecase` (NEW, ready-for-dev) | NEW |
| — | `1-3b-identity-svc-infrastructure-insee-r2-controller` (NEW, ready-for-dev) | NEW |
| — | `1-3c-gateway-api-pro-register-multipart-forwarder` (NEW, ready-for-dev) | NEW |
| — | `1-3d-frontend-wizard-seller-middleware-e2e-observability` (NEW, ready-for-dev) | NEW |

### Artifact Conflicts

| Artefact | Impact | Action |
|---|---|---|
| **PRD** (`_bmad-output/planning-artifacts/prd.md`) | Aucun — FR3, FR16, FR17, NFR15, NFR48, NFR71, NFR79 tous couverts par les 4 sous-stories combinées | Pas de modification |
| **Architecture** (`architecture.md`) | Aucun — Pattern Pretre, saga compensable, ADR-014 envelope, ThrottlerModule Redis, R2 SSE AES256 tous préservés | Pas de modification |
| **UX-spec** (`ux-design-specification.md`) | Aucun — UX-DR9 sign-up funnel + `<StepIndicator>` + `<FileUpload>` patterns Story 0.5 implémentés par 1.3d | Pas de modification |
| **Epics** (`epics.md`) | Section §1.3 reste valide ; ajouter note "Décomposée en 1.3a/b/c/d 2026-05-16" sous le titre Story 1.3 | Ajouter note |
| **sprint-status.yaml** | Update obligatoire : 1.3 → done + ajout 4 entries `ready-for-dev` | Update |
| **Story file 1-3-pro-registration-pending-admin-review.md** | Conservé comme document source-of-truth des ACs/Dev Notes. Status header → `superseded-split-2026-05-16` ; INSEE OAuth2 mention à flagger comme **deviated by sub-story 1.3b** (apiKey direct au lieu d'OAuth2) | Update header + add deviation note ligne 768 |
| **Memory files** | Ajouter une memory `story_1_3_split_2026_05_16` documentant la décomposition pour rétroactivité | Ajout |
| **CI workflows** (`.github/workflows/`) | Aucun — pas de changement du pipeline | Pas de modification |

### Technical Impact
- **Pas de code livré jusqu'ici** — split avant `in-progress`, donc aucun rollback nécessaire.
- **Nouvelles dépendances npm** : `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (identity-svc 1.3b), `form-data` (gateway-api 1.3c), `multer` + `@types/multer` (identity-svc 1.3b + gateway-api 1.3c si non bundle dans `@nestjs/platform-fastify`). À installer dans la sub-story qui les consomme.
- **Migration Postgres** : `1715240000000-CreateProProfilesTable.ts` reste planifiée dans 1.3b (cohérent : la migration appartient au layer infrastructure). À enregistrer dans `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/index.ts` (pattern Story 1.2b — auto-run on boot via `migrationsRun: true` PR #41).
- **Secrets droplet data** : 4 nouveaux fichiers Docker secrets à provisionner avant 1.3b deploy :
  - `insee_api_key` (X-INSEE-Api-Key-Integration value)
  - `r2_kyc_access_key`
  - `r2_kyc_secret_key`
  - `r2_kyc_endpoint` (`https://0e633032f5574da7906045d298e5ee83.eu.r2.cloudflarestorage.com`)
- **Pattern Pretre canonical reference 2** : 1.3b devient la story de référence "infrastructure avec external validation + S3-compatible storage" copiable par Stories 2.1 (Stripe Connect) + 3.4 (photo upload listing) + 4.x (booking modification attachments). Bénéfice net du split.

---

## Section 3 — Recommended Approach

### Path forward : **Option 1 — Direct Adjustment (Split via 4 sub-stories)**

**Justification** :
- ✅ Préserve intégralement le scope MVP (FR3, FR16, FR17, NFR15, NFR48, NFR71, NFR79)
- ✅ Aucun rollback nécessaire (rien implémenté)
- ✅ Aligne avec les patterns BMad (atomic story = atomic commit = atomic code-review)
- ✅ Permet exécution incrémentale session-par-session avec `/bmad-dev-story` sur chaque sous-story
- ✅ Calque rigoureusement le pattern 1.2 → 1.2a/b/c/d (succès confirmé, 4 sub-stories livrées + done + mergées 2026-05-15→16)
- ✅ Désentrelace les responsabilités : `1.3a = domain logic`, `1.3b = infrastructure (INSEE + R2)`, `1.3c = BFF multipart`, `1.3d = wizard frontend + seller middleware + e2e`
- ✅ Effort agrégé identique mais réparti en 4 unités testables/commitables

**Trade-offs considérés** :
- ❌ Option 2 (Rollback) — N/A (rien à rollback)
- ❌ Option 3 (MVP Review / scope reduction) — non justifié, le scope est correct, c'est la granularité qui pose problème
- ❌ Tout-en-un avec qualité dégradée — refusé par cohérence avec décision 1.2

### Effort estimate per sub-story

| Sub-story | Empreinte | Estimation | Bloque |
|---|---|---|---|
| **1.3a** Contracts + identity-svc domain Pro + use case unit | ~20 fichiers | 1.5-2 j | — |
| **1.3b** identity-svc infrastructure (INSEE + R2 + ProProfile + migration + controller internal) | ~20 fichiers | 2-3 j | 1.3a |
| **1.3c** gateway-api multipart endpoint + forwarder + E2E backend | ~10 fichiers | 1 j | 1.3a, 1.3b |
| **1.3d** Frontend wizard 3 steps + seller middleware + Playwright + observability | ~25 fichiers | 2-3 j | 1.3a, 1.3b, 1.3c |
| **Total** | ~75 fichiers | 6-9 j | — |

### Risk assessment
- **Risque technique** : faible. Découpage clean par layer (contracts → domain → infra → BFF → frontend). Pas de coupure transversale.
- **Risque INSEE auth deviation** : flaggé explicitement dans 1.3b Dev Notes ; algorithme apiKey direct au lieu d'OAuth2 réduit la complexité (no token cache, no refresh logic).
- **Risque R2 bucket** : moyen — premier usage R2 SDK dans le projet. Tests integration via `aws-sdk-client-mock` (Task 4.15 parent). À ship avec runbook ops dans 1.3b.
- **Risque planning** : nul. Estimation globale inchangée.
- **Risque qualité** : positif. Permet code-review focalisée par layer, coverage vérifiable par sous-story, E2E e2e isolés.

---

## Section 4 — Detailed Change Proposals

### 4.1 — Création de 4 fichiers story (NEW)

#### 1-3a-contracts-pro-domain-usecase.md
**Scope** : Tasks 1-3 du Story 1.3 source ; ACs 2 + 4 partiel (use case + tests unit, sans infra)
**Couvre** : DTOs `register-pro.dto.ts`, util `siretLuhnCheck`, JSON Schema `pro-registered.v1`, ProProfile aggregate factory `register()`, 4 VOs (Siret, VatNumber, Address, PhoneNumber), 3 ports (IInseeSiretValidator, IMediaStorage, IProProfileRepository), exceptions, RegisterProUseCase + tests unit Vitest ≥ 90% coverage (10+ cases)

#### 1-3b-identity-svc-infrastructure-insee-r2-controller.md
**Scope** : Tasks 4-5 du Story 1.3 source ; ACs 5, 6
**Couvre** : InseeSiretValidatorService (apiKey header X-INSEE-Api-Key-Integration — **deviation parent OAuth2**), R2MediaStorageService (AWS SDK S3 v3 + SSE AES256 + signed URLs 5 min), ProProfileEntity + Mapper + TypeormRepository, migration `1715240000000-CreateProProfilesTable.ts` + ajout au `migrations/index.ts` (auto-run boot), UseCasesProxyModule wire `REGISTER_PRO_USECASES_PROXY`, ProController `POST /internal/pros` avec InternalServiceGuard + multer multipart, tests integration nock + aws-sdk-client-mock + Postgres testcontainer
**Pré-requis ops** : 4 secrets droplet (`insee_api_key`, `r2_kyc_access_key`, `r2_kyc_secret_key`, `r2_kyc_endpoint`)

#### 1-3c-gateway-api-pro-register-multipart-forwarder.md
**Scope** : Task 6 du Story 1.3 source ; AC 3
**Couvre** : RegisterProForwarder, identity-svc.client.registerPro multipart via `form-data`, AuthProController `POST /v1/auth/pro/register`, multer config (5 MB/file, 3 files, MIME whitelist), ThrottlerModule scope `pro-register` 3/min, tests E2E (7 cases)

#### 1-3d-frontend-wizard-seller-middleware-e2e-observability.md
**Scope** : Tasks 7-10 du Story 1.3 source ; ACs 1, 7, 9, 10
**Couvre** : `useRegisterPro` hook (TanStack Query multipart FormData), `<ProSignUpWizard>` 3 steps avec `useReducer` state, sous-composants `<StepAccount>/<StepCompany>/<StepDocuments>`, i18n FR/EN ~40 keys, `apps/seller/src/middleware.ts` JWT claim redirect, page `/seller/onboarding/pending` placeholder, Playwright e2e (11 tests), axe-core, Grafana dashboard `pro-registration.json`, runbooks (`pro-registration-debug.md`, `kyc-docs-retention.md`, `insee-sirene-integration.md`)

### 4.2 — Update header parent Story 1.3
```diff
- Status: ready-for-dev
+ Status: superseded-split-2026-05-16
+
+ > ⚠️ **Cette story a été décomposée en 4 sub-stories le 2026-05-16** via `/bmad-correct-course`.
+ > Voir `sprint-change-proposal-2026-05-16.md`.
+ > Implémentation dans : `1-3a-contracts-pro-domain-usecase` + `1-3b-identity-svc-infrastructure-insee-r2-controller` + `1-3c-gateway-api-pro-register-multipart-forwarder` + `1-3d-frontend-wizard-seller-middleware-e2e-observability`.
+ > Ce fichier reste source-of-truth des ACs/Dev Notes complets — les sub-stories y pointent pour les détails.
+ >
+ > **Deviation INSEE auth** : ligne 768 mentionne OAuth2 client_credentials + cache token. **Faux après test live 2026-05-16** : l'API utilise un apiKey simple via header `X-INSEE-Api-Key-Integration: <key>`. Sub-story 1.3b dévie sur ce point — pas de `InseeTokenCacheService`.
```

### 4.3 — Update `_bmad-output/implementation-artifacts/sprint-status.yaml`
```diff
   1-2d-frontend-signup-middleware-e2e-observability: done
-  1-3-pro-registration-pending-admin-review: ready-for-dev
+  # Story 1.3 décomposée en 4 sous-stories atomiques (correct-course 2026-05-16)
+  # cf. _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-16.md
+  1-3-pro-registration-pending-admin-review: done  # split umbrella — voir 1.3a-d ci-dessous
+  1-3a-contracts-pro-domain-usecase: ready-for-dev
+  1-3b-identity-svc-infrastructure-insee-r2-controller: ready-for-dev
+  1-3c-gateway-api-pro-register-multipart-forwarder: ready-for-dev
+  1-3d-frontend-wizard-seller-middleware-e2e-observability: ready-for-dev
   1-4-login-flow-keycloak-authorization-code-pkce: ready-for-dev
```

### 4.4 — Update `_bmad-output/planning-artifacts/epics.md`
Ajouter une note sous le titre §1.3 indiquant la décomposition (pattern identique à §1.2 modifié 2026-05-15).

---

## Section 5 — Implementation Handoff

### Scope classification : **Moderate**
- Multiple sub-stories à créer
- Update sprint-status + epics + memory
- Pas de modification PRD/Architecture/UX (le scope reste identique, seule la granularité change)

### Handoff plan

| Rôle | Responsabilité | Deliverable |
|---|---|---|
| **`/bmad-correct-course` Claude (cette session)** | Produit les 4 sub-story files + sprint-change-proposal + updates sprint-status + epics + memory | ✅ Cette PR |
| **`/bmad-dev-story` Claude (sessions suivantes)** | Exécute chaque sub-story 1.3a → 1.3b → 1.3c → 1.3d séquentiellement (dépendances respectées) | 4 PRs successives `feature/story-1.3a-...`, `1.3b-...`, etc. |
| **`/bmad-code-review` Claude (après chaque sub-story)** | Review parallèle Blind + Edge + Acceptance Auditor (pattern Story 1.2) | Triage patches + defers + dismissed |
| **Ismael (avant 1.3b deploy)** | Provisionne 4 secrets dans `/home/tukio/tukio/secrets/` du droplet data : `insee_api_key`, `r2_kyc_access_key`, `r2_kyc_secret_key`, `r2_kyc_endpoint` | Secrets en place |

### Success criteria
- [ ] 4 sub-story files créés sous `_bmad-output/implementation-artifacts/1-3{a,b,c,d}-*.md` avec status `ready-for-dev`
- [ ] `sprint-status.yaml` mis à jour (1.3 → done + 4 entries)
- [ ] `epics.md` annoté avec note de décomposition
- [ ] Header parent Story 1.3 mis à jour avec deviation INSEE flaggée
- [ ] Memory `story_1_3_split_2026_05_16` créée
- [ ] User approve la proposal pour démarrer 1.3a via `/bmad-dev-story`
