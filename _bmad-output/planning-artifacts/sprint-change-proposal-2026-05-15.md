# Sprint Change Proposal — Story 1.2 décomposition

**Date** : 2026-05-15
**Auteur** : Ismael (via `/bmad-correct-course` Claude)
**Sprint** : Sprint 1 (Epic 1 — Identity & Authentication Backbone)
**Scope** : Décomposition Story 1.2 (Customer B2C registration) en 4 sous-stories atomiques

---

## Section 1 — Issue Summary

### Trigger
Story `1-2-customer-b2c-registration` (créée 2026-05-09, status `ready-for-dev`) a été activée pour implémentation via `/bmad-dev-story`. À la lecture intégrale du fichier story (~1450 lignes), le scope effectif s'avère incompatible avec une livraison atomique single-session :

- **Estimation explicite** : 5-7 jours pour 1 dev fullstack senior (story line 1398)
- **Empreinte fichiers** : ~75 fichiers touchés (~50-55 nouveaux + ~20 updates, story line 1264)
- **10 Tasks** × 73 subtasks au total
- **Surface technique** : 4 apps (`identity-svc`, `gateway-api`, `public`, `customer`) + 4 packages (`contracts`, `api-client`, `auth-client`, `auth`) + infra (Grafana dashboards, runbooks)
- **Infrastructure dépendante** : testcontainers Keycloak + Postgres + NATS, Playwright multi-browser FR/EN, axe-core RGAA AA, mesure perf NFR48 p90, coverage ≥ 80-90 %
- **Bloqueur découvert pendant l'audit** : `apps/gateway-api/src/` n'a PAS encore reçu sa replication Pretre Story 0.6 (juste les 4 fichiers Nest scaffold) — Task 6 prérequis bloquant

### Type d'issue
**Technical limitation discovered during implementation** — capacité single-session vs scope monolithique. Pas un changement de scope produit, pas un revirement stratégique. C'est un problème de granularité de découpage des stories au moment de la planification (Story 1.2 a été créée comme bloc unique alors qu'elle agrège 4 préoccupations distinctes : contracts/domain, infrastructure, gateway BFF, frontend).

### Evidence
1. Story file line 1398 : `Estimation effort: 5-7 jours (1 dev fullstack senior)`
2. Story file line 1264 : `Estimation total fichiers : ~50-55 nouveaux + ~20 updates = ~75 fichiers touchés`
3. Audit live `apps/gateway-api/src/` : `app.controller.spec.ts`, `app.controller.ts`, `app.module.ts`, `app.service.ts`, `main.ts` — pas de `domain/`, `usecases/`, `infrastructure/` (vs `apps/identity-svc/` qui a la structure complète)
4. Story file Task 6 line 689 : `Scaffolder gateway-api Pretre structure (si pas déjà fait)` — explicitement noté comme prérequis Story 1.2 si pas exécuté avant
5. Story file Dev Notes line 1312 : `Story 1.2 dépend de gateway-api scaffold opérationnel`

---

## Section 2 — Impact Analysis

### Epic Impact
- **Epic 1** (Identity & Authentication Backbone) reste intégralement couvert. La décomposition ne touche que la granularité Story-level.
- **Epic 1 stories aval** (1.3, 1.4, 1.5, 1.6, 1.8, 1.9, 1.10) restent dépendantes des **patterns** posés par 1.2 (factory `register()`, use case Pretre, outbox transactional, frontend RHF/Zod). Le découpage **améliore** la lisibilité du pattern canonique — Story 1.2a sera la **référence Pretre pure** que 1.3-1.10 copieront.
- **Aucune autre Epic** (2-16) impactée.

### Story Impact

| Avant | Après | Status transition |
|---|---|---|
| `1-2-customer-b2c-registration` (ready-for-dev) | Marquée `done` avec comment "split via correct-course 2026-05-15" — sert d'umbrella audit | ready-for-dev → done |
| — | `1-2a-contracts-identity-domain-usecase` (NEW, ready-for-dev) | NEW |
| — | `1-2b-identity-svc-infrastructure-controller` (NEW, ready-for-dev) | NEW |
| — | `1-2c-gateway-api-pretre-forwarder` (NEW, ready-for-dev) | NEW |
| — | `1-2d-frontend-signup-middleware-e2e-observability` (NEW, ready-for-dev) | NEW |

### Artifact Conflicts

| Artefact | Impact | Action |
|---|---|---|
| **PRD** (`_bmad-output/planning-artifacts/prd.md`) | Aucun — FR1, FR8, FR17, NFR9, NFR10, NFR48, NFR71 tous couverts par les 4 sous-stories combinées | Pas de modification |
| **Architecture** (`architecture.md`) | Aucun — Pattern Pretre, ADR-014 envelope, outbox NATS, ThrottlerModule Redis, tous préservés | Pas de modification |
| **UX-spec** (`ux-design-specification.md`) | Aucun — UX-DR9 sign-up funnel + `<FormField>` pattern implémentés par 1.2d | Pas de modification |
| **Epics** (`epics.md`) | Section §1.2 reste valide ; on note que 4 sous-stories matérialisent l'implémentation | Ajouter note "Décomposée en 1.2a/b/c/d 2026-05-15" sous le titre Story 1.2 |
| **sprint-status.yaml** | Update obligatoire : 1.2 → done + ajout 4 entries | Update |
| **Story file 1-2-customer-b2c-registration.md** | Conservé comme document source-of-truth des ACs/Dev Notes. Status header → `superseded-split-2026-05-15` | Update header seulement (1 ligne) |
| **Memory files** | Ajouter une memory `story_1_2_split_2026_05_15` documentant la décomposition pour rétroactivité | Ajout |
| **CI workflows** (`.github/workflows/`) | Aucun — pas de changement du pipeline | Pas de modification |

### Technical Impact
- **Pas de code livré jusqu'ici** — split avant `in-progress`, donc aucun rollback nécessaire.
- **Pas de dépendance npm modifiée** — toutes les libs (`@keycloak/keycloak-admin-client`, `@nestjs/throttler`, etc.) restent identiques, juste réparties par sous-story.
- **Migration Postgres** : `1715230000000-AddCustomerRegistrationFields.ts` reste planifiée dans 1.2b (cohérent : la migration appartient au layer infrastructure).
- **Pattern Pretre canonical reference** : 1.2a devient la story de référence "use case + domain pur" copiable par 1.3-1.10. Bénéfice net du split.

---

## Section 3 — Recommended Approach

### Path forward : **Option 1 — Direct Adjustment (Split via 4 sub-stories)**

**Justification** :
- ✅ Préserve intégralement le scope MVP (FR1, FR8, FR17, NFR9, NFR10, NFR48, NFR71)
- ✅ Aucun rollback nécessaire (rien implémenté)
- ✅ Aligne avec les patterns BMad (atomic story = atomic commit = atomic code-review)
- ✅ Permet exécution incrémentale session-par-session avec `/bmad-dev-story` sur chaque sous-story
- ✅ Renforce la valeur "template canonique" de 1.2a pour 9 stories aval (1.3-1.10)
- ✅ Désentrelace les responsabilités : `1.2a = domain logic`, `1.2b = infrastructure`, `1.2c = BFF`, `1.2d = surface user-facing`
- ✅ Effort agrégé identique (5-7 j) mais réparti en 4 unités testables/commitables

**Trade-offs considérés** :
- ❌ Option 2 (Rollback) — N/A (rien à rollback)
- ❌ Option 3 (MVP Review / scope reduction) — non justifié, le scope est correct, c'est la granularité qui pose problème
- ❌ Tout-en-un avec qualité dégradée — refusé par Ismael (coûte la valeur "template canonique" + risque coverage/E2E non vérifiés)

### Effort estimate per sub-story

| Sub-story | Empreinte | Estimation | Bloque |
|---|---|---|---|
| **1.2a** Contracts + identity-svc domain + use case unit | ~25 fichiers | 1.5-2 j | — |
| **1.2b** identity-svc infrastructure + controller interne | ~15 fichiers | 1.5-2 j | 1.2a |
| **1.2c** gateway-api Pretre + forwarder + E2E backend | ~10 fichiers | 1 j | 1.2a, 1.2b |
| **1.2d** Frontend sign-up + middleware + Playwright + observability | ~25 fichiers | 1.5-2 j | 1.2a, 1.2b, 1.2c |
| **Total** | ~75 fichiers | 5-7 j | — |

### Risk assessment
- **Risque technique** : faible. Découpage clean par layer (contracts → domain → infra → BFF → frontend). Pas de coupure transversale.
- **Risque planning** : nul. Estimation globale inchangée.
- **Risque qualité** : positif. Permet code-review focalisée par layer, coverage vérifiable par sous-story, E2E e2e isolés.

---

## Section 4 — Detailed Change Proposals

### 4.1 — Création de 4 fichiers story (NEW)

#### 1-2a-contracts-identity-domain-usecase.md
**Scope** : Tasks 1-3 du Story 1.2 source ; ACs 2 + 5 (use case + tests unit, sans infra)
**Header** :
```markdown
# Story 1.2a: @tukio/contracts identity DTOs/events + identity-svc domain layer + RegisterCustomerUseCase

Status: ready-for-dev
Parent: Story 1.2 (décomposée 2026-05-15)
Sub-story: 1/4

## Story
**As a** dev backend qui implémente Epic 1,
**I want** que le pattern Pretre "register customer" soit posé proprement dans `@tukio/contracts` (DTOs + 2 events JSON Schema + IdentityErrorCodes) et `apps/identity-svc/src/{domain,usecases}/` (factory UserProfile.register + ports KeycloakAdmin/EmailVerificationToken + Email/Locale/AcquisitionSource VOs + exceptions IdentityConflict/ExternalService + RegisterCustomerUseCase avec coverage ≥ 90% unit tests Vitest mockés),
**so that** les sous-stories 1.2b (infrastructure), 1.2c (gateway-api), 1.2d (frontend) puissent s'y brancher, et que 1.3-1.10 disposent d'un template canonique.
```
**Tasks** : Tasks 1.1-1.8 + 2.1-2.11 + 3.1-3.3 extraites de 1-2.md (22 subtasks)
**ACs** : AC2 + AC5 (partie use case + factory + tests unit avec mocks)
**Dev Notes** : sections "Décisions techniques majeures" §1,2,4,5 + "Pattern Pretre strict" + "EN strict couche tech" + "Pattern code RegisterCustomerUseCase" copiées de 1-2.md
**Hors scope** : tout ce qui touche `infrastructure/` (KeycloakAdminService, repos, migration) → 1.2b
**Validation** : `pnpm --filter=@tukio/contracts build && pnpm --filter=identity-svc test usecases/register-customer.usecase.spec.ts` passe avec coverage ≥ 90%

#### 1-2b-identity-svc-infrastructure-controller.md
**Scope** : Tasks 4-5 du Story 1.2 source ; ACs 6 + 7
**Header** :
```markdown
# Story 1.2b: identity-svc infrastructure (KeycloakAdminService + repos + migration + controller POST /internal/customers)

Status: ready-for-dev
Parent: Story 1.2 (décomposée 2026-05-15)
Sub-story: 2/4
Depends on: 1.2a (done)
```
**Tasks** : Tasks 4.1-4.12 + 5.1-5.8 extraites (20 subtasks)
**ACs** : AC6 (KeycloakAdminService + EmailVerificationTokenTypeOrmRepository + UserProfileRepo extensions + migration 1715230000000) + AC7 (CustomerController + InternalServiceGuard HMAC + integration tests testcontainers)
**Dev Notes** : sections "Décisions techniques §1,3,6,8" + "Pattern Pretre infrastructure" + "Compensation pattern Keycloak ↔ DB" copiées
**Hors scope** : gateway-api (1.2c), frontend (1.2d)
**Validation** : `pnpm docker:up:wait && pnpm --filter=identity-svc test:e2e customer-register.e2e-spec.ts` passe + 6 cases (cf. AC7 fin)

#### 1-2c-gateway-api-pretre-forwarder.md
**Scope** : Tasks 6-7 du Story 1.2 source ; ACs 3 + 4
**Header** :
```markdown
# Story 1.2c: gateway-api Pretre replication + RegisterCustomerForwarder + ThrottlerModule Redis + POST /v1/auth/customer/register

Status: ready-for-dev
Parent: Story 1.2 (décomposée 2026-05-15)
Sub-story: 3/4
Depends on: 1.2a (done), 1.2b (done)
```
**Tasks** : Tasks 6.1-6.5 + 7.1-7.10 extraites (15 subtasks)
**ACs** : AC3 (controller + forwarder + IdentitySvcClient axios + retry) + AC4 (ZodValidationPipe + ThrottlerModule sensitive 5/min/IP + Redis storage + 429 enveloppé + tests E2E gateway-api)
**Dev Notes** : section "Décisions techniques §7,10" + "gateway-api Pretre légère BFF" + "Rate-limiting Redis-backed" copiées
**Prérequis explicite** : Task 6.1 `bash infra/scripts/replicate-pretre-structure.sh --target=gateway-api` (bloque tout le reste de 1.2c)
**Hors scope** : frontend (1.2d), observability (1.2d)
**Validation** : `pnpm --filter=gateway-api test:e2e auth-customer-register.e2e-spec.ts` passe + 5 cases (cf. AC4 fin)

#### 1-2d-frontend-signup-middleware-e2e-observability.md
**Scope** : Tasks 8-10 du Story 1.2 source ; ACs 1 + 8 + 9 + 10
**Header** :
```markdown
# Story 1.2d: Frontend sign-up form + middleware tk_acq/email_verified + Playwright e2e FR/EN + observability + commit final

Status: ready-for-dev
Parent: Story 1.2 (décomposée 2026-05-15)
Sub-story: 4/4
Depends on: 1.2a (done), 1.2b (done), 1.2c (done)
```
**Tasks** : Tasks 8.1-8.11 + 9.1-9.7 + 10.1-10.8 extraites (26 subtasks)
**ACs** : AC1 (sign-up page + RHF/Zod form + i18n FR/EN + a11y RGAA AA + atomics @tukio/ui) + AC8 (cookie tk_acq + hooks useAcquisitionTracking/useRegisterCustomer + middleware email_verified + verify-email-required page) + AC9 (9 Playwright e2e + axe-core + NFR48 perf) + AC10 (Prometheus metrics + Grafana dashboard + runbook + lint no-bypass-envelope + commit final)
**Dev Notes** : sections "Décisions techniques §11,12" + "i18n strict frontend" + "Anti-énumération NFR9" + "Pattern code SignUpForm.tsx" copiées
**Hors scope** : aucun (story de clôture)
**Validation** : `pnpm playwright test --project=chromium-fr --project=chromium-en` passe 9/9 + axe-core 0 violations + NFR48 ≤ 30s p90 + `/check` global pass + commit `feat(identity): customer B2C registration end-to-end`

---

### 4.2 — Update sprint-status.yaml

**Avant** (ligne 67) :
```yaml
  1-2-customer-b2c-registration: ready-for-dev
  1-3-pro-registration-pending-admin-review: ready-for-dev
```

**Après** :
```yaml
  # Story 1.2 décomposée en 4 sous-stories atomiques (correct-course 2026-05-15)
  # cf. _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md
  1-2-customer-b2c-registration: done  # split umbrella — voir 1.2a-d ci-dessous
  1-2a-contracts-identity-domain-usecase: ready-for-dev
  1-2b-identity-svc-infrastructure-controller: ready-for-dev
  1-2c-gateway-api-pretre-forwarder: ready-for-dev
  1-2d-frontend-signup-middleware-e2e-observability: ready-for-dev
  1-3-pro-registration-pending-admin-review: ready-for-dev
```

**Note** : mettre 1.2 en `done` permet à `bmad-dev-story` de skipper l'umbrella et de prendre `1-2a-...` comme prochaine ready-for-dev. Le statut `done` est légèrement abusif sémantiquement mais préserve l'audit trail dans le yaml. Une alternative serait d'ajouter un statut custom `superseded` dans STATUS DEFINITIONS — refusé pour ne pas modifier le contrat BMad standard.

**Update également last_updated header** :
```yaml
# last_updated: 2026-05-16 ...
```
→
```yaml
# last_updated: 2026-05-17 (Story 1.2 décomposée en 4 sub-stories 1.2a/b/c/d via correct-course — scope 75 fichiers réparti par layer pour livraison atomique session-par-session ; 1.2 marqué done umbrella, sub-stories ready-for-dev. Reference: sprint-change-proposal-2026-05-15.md)
```

---

### 4.3 — Update story file 1-2-customer-b2c-registration.md (1 ligne)

**Avant** (ligne 3) :
```markdown
Status: ready-for-dev
```

**Après** :
```markdown
Status: superseded-split-2026-05-15

> ⚠️ **Story décomposée 2026-05-15** : ce fichier reste document source-of-truth des ACs/Dev Notes. L'implémentation est répartie sur les 4 sous-stories `1-2a-contracts-identity-domain-usecase`, `1-2b-identity-svc-infrastructure-controller`, `1-2c-gateway-api-pretre-forwarder`, `1-2d-frontend-signup-middleware-e2e-observability`. Voir `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md`.
```

---

### 4.4 — Update epics.md (ajout note sous §Story 1.2)

**Insertion ligne 1098 après le titre** :
```markdown
#### Story 1.2: Customer B2C registration (`POST /v1/auth/customer/register`)

> 📌 **Décomposée 2026-05-15** : voir sub-stories `1.2a/b/c/d` (sprint-change-proposal-2026-05-15.md). Ce bloc ACs reste autorité fonctionnelle.

**As a** Visitor,
...
```

---

### 4.5 — Add memory file

**`_/Users/i.mohamed/.claude/projects/.../memory/story_1_2_split_2026_05_15.md`** (NEW) :
```markdown
---
name: story-1-2-split-2026-05-15
description: Story 1.2 (customer B2C register) décomposée en 4 sub-stories atomiques 1.2a/b/c/d via correct-course
metadata:
  type: project
---

Story `1-2-customer-b2c-registration` (créée 2026-05-09, ~75 fichiers, 5-7 j) a été décomposée en 4 sous-stories le 2026-05-15 via `/bmad-correct-course` avant tout dev :
- 1.2a — contracts + identity-svc domain + use case unit (~25 fichiers, 1.5-2 j, no infra)
- 1.2b — identity-svc infrastructure + controller interne (~15 fichiers, 1.5-2 j, testcontainers)
- 1.2c — gateway-api Pretre + forwarder + E2E (~10 fichiers, 1 j)
- 1.2d — frontend sign-up + middleware + Playwright + observability (~25 fichiers, 1.5-2 j)

**Why:** Scope trop large pour livraison atomique single-session (perte de qualité coverage/e2e/perf), gateway-api Pretre replication encore à faire (prérequis), pattern Pretre canonique mieux exposé en isolant le domain (1.2a) comme template pour Stories 1.3-1.10.

**How to apply:** quand on dev Stories 1.3-1.10 ou tout register-like flow, lire d'abord 1.2a (factory + use case + tests Vitest mocks) comme référence Pretre. La logique d'infrastructure (Keycloak Admin, transaction outbox) est dans 1.2b. Le BFF gateway-api dans 1.2c. La surface user-facing dans 1.2d.

Référence: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md` + `_bmad-output/implementation-artifacts/1-2-customer-b2c-registration.md` (umbrella conservé en source-of-truth ACs/Dev Notes).
```

---

## Section 5 — Implementation Handoff

### Scope classification : **Moderate**
Backlog reorganization (4 nouvelles entries + 5 fichiers stories) + mise à jour sprint-status. Pas de code livré, pas de migration DB exécutée, pas de modification PRD/Architecture/UX. Reste sous le contrôle d'un seul rôle (Dev/PO consolidé chez Ismael en mode solo).

### Handoff recipients
- **Developer agent (Claude via Ismael)** : exécution incrémentale `/bmad-dev-story` sur 1.2a → 1.2b → 1.2c → 1.2d (séquentiel, respecter les dépendances)
- **Aucune escalation PM/Architect** nécessaire (pas de changement stratégique)

### Deliverables produits par cette session (Sprint Change Proposal)
1. ✅ Ce fichier `sprint-change-proposal-2026-05-15.md`
2. ⏳ 4 fichiers story `1-2{a,b,c,d}-*.md` dans `_bmad-output/implementation-artifacts/` (à créer après approbation)
3. ⏳ Update `sprint-status.yaml` (à appliquer après approbation)
4. ⏳ Update header `1-2-customer-b2c-registration.md` (à appliquer après approbation)
5. ⏳ Update `epics.md` ligne 1098 (à appliquer après approbation)
6. ⏳ Memory `story_1_2_split_2026_05_15.md` (à créer après approbation)

### Success criteria
- Les 4 sous-stories sont créées avec ACs/Tasks/Dev Notes complets, autosuffisants pour `bmad-dev-story` (chaque sous-story DOIT pouvoir être implémentée sans relire 1-2.md, sauf pour les sections Dev Notes croisées)
- `sprint-status.yaml` cohérent : 1.2 = done, 1.2a-d = ready-for-dev
- Prochain `/bmad-dev-story` (sans arg) sélectionne automatiquement `1-2a-contracts-identity-domain-usecase`
- Audit trail préservé : 1-2.md reste lisible comme source-of-truth des ACs originaux

### Next steps après approbation
1. Créer les 4 fichiers story (1.2a, 1.2b, 1.2c, 1.2d)
2. Update sprint-status.yaml + header story 1.2 + epics.md
3. Saver memory `story_1_2_split_2026_05_15`
4. Confirmer à Ismael : "Découpage formalisé. Tu peux relancer `/bmad-dev-story` qui prendra 1.2a comme prochaine ready-for-dev."

---

## Approval gate

> Cette proposal est soumise à approbation explicite d'Ismael avant exécution. Aucun fichier hors `sprint-change-proposal-2026-05-15.md` n'est créé/modifié à ce stade.
