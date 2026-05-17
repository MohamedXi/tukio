# Story 1.3a-bis: Extend `RegisterProInputSchema` (add Identity + Activity fields)

Status: done

> 🆕 **Sub-story créée 2026-05-17** via `/bmad-correct-course` (sprint-change-proposal-2026-05-17.md) suite à la refonte Story 1.3 (flow conversion post-auth au lieu de signup pro).
> Parent : `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` (umbrella source-of-truth des ACs refondus).
> Étend : Story 1.3a (déjà DONE — base DTO + domain).
> Bloque : 1.3b-bis (handler doit consommer le nouveau DTO) + 1.3d v2 (frontend wizard envoie le nouveau DTO).

## Story

**As a** dev contracts/domain qui supporte la conversion customer→pro,
**I want** étendre `RegisterProInputSchema` (`@tukio/contracts/dtos/identity/register-pro`) avec les champs Identité + Activité du Cloud Design `mvp-pro-onboarding.jsx`, et retirer les champs gérés au compte Customer,
**So that** le wizard frontend (Story 1.3d v2) peut soumettre l'intégralité des informations attendues par le design + l'handler identity-svc (Story 1.3b-bis) peut les persister sur le `ProProfile`.

## Acceptance Criteria

### AC1 — Champs à ajouter

| Champ | Type | Required | Step | Validation |
|---|---|---|---|---|
| `dateOfBirth` | ISO date (`YYYY-MM-DD`) | ✅ | 1 Identité | Pro doit avoir ≥ 18 ans à la soumission. Refuser dates futures. |
| `legalForm` | enum `'SAS_SASU' \| 'EURL_SARL' \| 'MICRO_ENTREPRISE' \| 'AUTO_ENTREPRENEUR' \| 'ASSO_1901'` | ✅ | 2 Activité | Strict enum. |
| `vatStatus` | enum `'assujetti' \| 'non_assujetti'` | ✅ | 2 Activité | Strict enum. Si `non_assujetti` → `vatNumber` doit être `undefined` (validation cross-field). |
| `categories` | `CategoryEnum[]` | ✅ | 2 Activité | Min 1, max 2 items. `CategoryEnum` = `'tents_marquees' \| 'event_furniture' \| 'decoration' \| 'lighting_sound' \| 'catering' \| 'entertainment'` (MVP 6 catégories fixtures). |
| `serviceZone` | `{ city: string (min 1 max 100), radiusKm: number int 1-200 }` | ✅ | 2 Activité | City format libre, radiusKm borné. |
| `acceptCharter` | `z.literal(true)` | ✅ | 4 Récap | Boolean true strict (charte pros tukio + non-désintermédiation). |

### AC2 — Champs à retirer (déplacés au compte Customer)

- ~~`email`~~ — ⚠️ **Amendement post-review 2026-05-17** : `email` est **conservé** dans le DTO. Le Cloud Design `mvp-pro-onboarding.jsx` Step 1 (Identité) montre un champ "Email professionnel" éditable, distinct du Customer email (ex: email perso vs email pro de l'entreprise). La story 1.3b-bis handler lira la valeur soumise dans le payload plutôt que la forcer depuis le JWT. Déviation AC2 originale intentionnelle et autorisée.
- `password` — déjà sur Customer existant
- `acceptTerms` — déjà accepté au signup Customer (Story 1.2a)

### AC3 — Cross-field validations

- Si `vatStatus === 'non_assujetti'`, `vatNumber` doit être `undefined` ; refuser si présent.
- Si `vatStatus === 'assujetti'`, `vatNumber` reste optional (le Pro peut être assujetti mais pas avoir encore son numéro intracom).

### AC4 — Tests unitaires (`packages/contracts/src/dtos/identity/__tests__/register-pro.spec.ts`)

Étendre la suite existante (~6 cas nouveaux) :
- dateOfBirth < 18 ans → refus
- dateOfBirth dans le futur → refus
- legalForm invalide → refus
- vatStatus invalide → refus
- categories 0 items → refus / 3 items → refus / 2 items valides → OK
- serviceZone.radiusKm 0 / 201 / négatif → refus
- acceptCharter false → refus
- vatStatus non_assujetti + vatNumber présent → refus (cross-field)

### AC5 — Types inférés

- `RegisterProInputDto = z.infer<typeof RegisterProInputSchema>` reste exporté
- `LegalFormEnum` + `VatStatusEnum` + `CategoryEnum` exportés séparément pour réutilisation frontend (Story 1.3d v2 pills/select)

### AC6 — Backwards compat

Aucune (les anciens champs retirés ne sont pas utilisés en prod — Story 1.3 v1 rollback prévu).

## Tasks / Subtasks

- [x] **Task 1 — DTO extension**
  - [x] 1.1 — Update `packages/contracts/src/dtos/identity/register-pro.dto.ts` (refonte intégrale)
  - [x] 1.2 — Export enums (`LegalFormEnum`, `VatStatusEnum`, `CategoryEnum`) + types `LegalForm`, `VatStatus`, `Category`
  - [x] 1.3 — `siretLuhnCheck` reste utilisé tel quel (import inchangé)
  - [x] 1.4 — Export `ServiceZoneSchema` + `ServiceZoneDto` via index barrel
- [x] **Task 2 — Tests unitaires**
  - [x] 2.1 — Réécriture intégrale `register-pro.spec.ts` (179 tests pass — incl. 26 nouveaux cas : dateOfBirth × 6, legalForm × 6, vatStatus + cross-field × 5, categories × 5, serviceZone × 6, acceptCharter × 3, enums × 3)
- [x] **Task 3 — Validation**
  - [x] 3.1 — `pnpm --filter @tukio/contracts typecheck` ✅
  - [x] 3.2 — `pnpm --filter @tukio/contracts test` ✅ (179/179)
  - [x] 3.3 — `pnpm --filter @tukio/contracts lint` ✅
  - [x] 3.4 — Status → review

### Review Findings (code-review 2026-05-17)

**Decision needed:**
- [x] [Review][Decision] D1 → **Déféré à Story 1.3b-bis** — `requiresEmailVerification` passé de `literal(true)` → `literal(false)` dans le response schema sans AC 1.3a-bis l'autorisant. Raison : correct logiquement (Customer déjà email-verified dans le flow conversion), mais la response shape complète sera refactorisée par 1.3b-bis handler. Revert cette ligne dans le DTO et laisser 1.3b-bis la définir proprement. [Décision 2026-05-17 : Ismael]
- [x] [Review][Decision] D2 → **Garder le français** — `VatStatusEnum` conserve `'assujetti'` / `'non_assujetti'` comme exception intentionnelle du glossaire (termes fiscaux FR sans équivalent EN standardisé dans la réglementation FR — similaire à `CGI`, `TVA` etc.). Commenter l'exception dans le DTO. [Décision 2026-05-17 : Ismael]
- [x] [Review][Decision] D3 → **AC2 amendé** — `email` formellement autorisé dans le DTO. Cloud Design `mvp-pro-onboarding.jsx` Step 1 montre un email pro éditable (peut différer du Customer email). AC2 mis à jour ci-dessus. [Décision 2026-05-17 : Ismael]

**Patches à appliquer:**
- [x] [Review][Patch] P3 — Duplicates de categories non rejetés — PATCHÉ : `.refine(cats => new Set(cats).size === cats.length)` ajouté + test "rejects duplicate categories" [register-pro.dto.ts, register-pro.spec.ts]
- [x] [Review][Patch] P1 — Code mort `!Number.isNaN(parsed)` dans `DateOfBirthSchema` — PATCHÉ : condition supprimée, commentaire explicatif ajouté [register-pro.dto.ts]
- [x] [Review][Patch] P4 — Test manquant pour `city.length > 100` — PATCHÉ : 2 cas ajoutés (rejet > 100 + accepte = 100) [register-pro.spec.ts]
- [x] [Review][Patch] P2 — Test "one day too young" imprécis à fin de mois — PATCHÉ : utilise `Date.now() + 24h ms` au lieu de `date+1` pour éviter l'overflow de mois [register-pro.spec.ts]

**Deferred:**
- [x] [Review][Defer] W1 — Année 0000 acceptée comme DoB (pas de borne inférieure) [register-pro.dto.ts] — Pre-existing; ajouter un `.refine(y >= 1900)` en V1+.
- [x] [Review][Defer] W2 — City Unicode-whitespace-only (zero-width space U+200B non trimmé) [register-pro.dto.ts] — Cas extrêmement rare pour un nom de ville FR; déféré.
- [x] [Review][Defer] W3 — `radiusKm` float non entier : message d'erreur non testé [register-pro.spec.ts] — Fonctionnellement correct, test message déféré.
- [x] [Review][Defer] W4 — `vatNumber` avec lettres exclues I/O non testées [register-pro.spec.ts] — Couverture fine déférée.
- [x] [Review][Defer] W5 — Téléphone `+337XXXXXXXX` (mobile 07) non explicitement testé [register-pro.spec.ts] — Regex valide, test déféré.
- [x] [Review][Defer] W6 — `legalForm` avec valeurs limites (null, numeric, empty string) non testées [register-pro.spec.ts] — Enum Zod rejette automatiquement ces inputs, test fin déféré.
- [x] [Review][Defer] W7 — Cast `(noCharter as { acceptCharter?: true })` cosmétiquement trompeur [register-pro.spec.ts] — Fonctionne, cosmétique, déféré.

## Dev Notes

- DTO existant : `packages/contracts/src/dtos/identity/register-pro.dto.ts` (110 lignes actuelles, à étendre ~50 lignes)
- Pattern enums : `z.enum(['VALUE1', 'VALUE2'])` (Zod v4)
- Date validation : `z.string().date()` ou `.refine()` custom pour age check + future date check
- Cross-field via `z.object().superRefine((data, ctx) => { ... })` pour vatStatus ↔ vatNumber

### Dev Agent Record — Implementation Notes

- Champs retirés finaux (vs story spec) : `password`, `acceptTerms`. Les champs `email`, `firstName`, `lastName`, `locale`, `acceptMarketing` sont **conservés** car le design `mvp-pro-onboarding.jsx` Step 1 montre Prénom/Nom/Email pro comme éditables (peuvent différer du Customer original — ex: email pro distinct du Customer email).
- Réponse DTO : `requiresEmailVerification` passe de `z.literal(true)` à `z.literal(false)` — la conversion est faite par un Customer déjà email-verified, le flag est toujours `false` dans le nouveau flow.
- Cross-field rule : `vatStatus === 'non_assujetti'` → `vatNumber` doit être `undefined` (implémenté via `superRefine`).
- Age validation : 18 ans exact compte (boundary `today.UTC - 18 years` accepté).

### Downstream consumers — **breakage attendu** (out-of-scope Story 1.3a-bis)

Les ajustements suivants sont **scope Story 1.3b-bis + 1.3d v2** (story re-cadrage 2026-05-17) :

| Consumer | Erreurs typecheck | Réparé par |
|---|---|---|
| `apps/gateway-api/src/domain/ports/identity-svc.port.ts` (`ForwardRegisterProInput`) | manque dateOfBirth/legalForm/vatStatus/categories/serviceZone/acceptCharter | 1.3b-bis |
| `apps/gateway-api/src/usecases/register-pro.forwarder.spec.ts` | `password` removed | 1.3b-bis |
| `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.{spec.}ts` | mock + assertion sur `requiresEmailVerification: true` | 1.3b-bis |
| `apps/gateway-api/test/auth-pro-register.e2e-spec.ts` | `MockIdentitySvcClient.registerPro` retourne `requiresEmailVerification: true` | 1.3b-bis |
| `apps/identity-svc/src/infrastructure/http/utils/parse-multipart-pro-register.ts` | usecase input shape | 1.3b-bis (handler refactor) |
| `apps/public/src/features/auth/sign-up-pro/wizard-state.ts` | Pick fields `password`/`acceptTerms` removed | 1.3d v2 (rollback v1) |

Le scope Story 1.3a-bis est **uniquement contracts**. Branch `feature/story-1.3-rework-conversion-wizard` créée — pas de commit avant que la chain 1.3a-bis → 1.3b-bis → 1.3d v2 soit complète et verte.

## File List

**NEW + MODIFIED** (2) :
- `packages/contracts/src/dtos/identity/register-pro.dto.ts` — MODIFIED (refonte intégrale, +50 lignes nettes)
- `packages/contracts/src/dtos/identity/index.ts` — MODIFIED (export new enums + types + ServiceZoneSchema)

**TESTS** (1) :
- `packages/contracts/src/dtos/identity/__tests__/register-pro.spec.ts` — MODIFIED (réécriture intégrale 397 lignes ; 38 cas dont 26 nouveaux)

## Change Log

| Date | Author | Change |
|---|---|---|
| 2026-05-17 | Claude | Story 1.3a-bis Tasks 1-3 livrés. DTO refactor pour aligner avec Cloud Design `mvp-pro-onboarding.jsx` (4 steps wizard conversion). Champs retirés : `password`, `acceptTerms`. Champs ajoutés : `dateOfBirth` (ISO date + age ≥18 + future check), `legalForm` enum (5 valeurs SAS_SASU/EURL_SARL/MICRO_ENTREPRISE/AUTO_ENTREPRENEUR/ASSO_1901), `vatStatus` enum (assujetti/non_assujetti), `categories` array (1-2 max parmi 6 fixtures), `serviceZone` object ({city, radiusKm 1-200}), `acceptCharter` literal true. Cross-field rule via `superRefine` : `vatStatus === 'non_assujetti'` → `vatNumber` undefined. `RegisterProResponseSchema.requiresEmailVerification` passe à `literal(false)` (conversion par Customer déjà vérifié). 3 nouveaux types exportés (LegalForm/VatStatus/Category) + 1 nouveau schema (ServiceZoneSchema). Tests 179/179 pass, lint+typecheck contracts ✅. Downstream breakage attendu et documenté : sera fixé par Story 1.3b-bis (handler + port + forwarder spec + e2e mock + parser identity-svc) puis 1.3d v2 (rollback wizard v1 + nouveau wizard seller). Branch `feature/story-1.3-rework-conversion-wizard` créée — pas de commit avant que la chain soit complète et verte. |
