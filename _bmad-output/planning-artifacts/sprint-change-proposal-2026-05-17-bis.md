# Sprint Change Proposal — 2026-05-17-bis

**Trigger story** : Story 1.4 (login flow Keycloak Authorization Code + PKCE), `ready-for-dev` (jamais démarrée)
**Author** : Claude (dev agent) + Ismael (approbation)
**Scope classification** : **Moderate** — backlog reorganization (split umbrella → 4 sub-stories) sans rollback de code
**Workflow** : `/bmad-correct-course` Incremental mode, 7 édits approuvés
**Précédents** : sprint-change-proposal-2026-05-15.md (split Story 1.2), sprint-change-proposal-2026-05-16.md (split Story 1.3), sprint-change-proposal-2026-05-17.md (re-cadrage Story 1.3 v1 → v2 conversion wizard)

---

## ⚠️ ADDENDUM — Révision 2026-05-17 17h (dual-portal, supersedes Customer-first matinale)

**Trigger** : Ismael, ~17h post-application des 7 édits initiaux : *"il faut bien garder le côté inscription pour un professionnel et notre côté inscription pour un client"*.

**Décision** : la décision matinale "Customer-first pure" (action 2 de la Section 3) est **partiellement révisée**. On garde **2 portails UX distincts** (apex `tukio.one` Customer + `seller.tukio.one` Pro) mais on conserve **1 backend Customer-first unique** (`POST /v1/auth/customer/register` → role=client systématique). Le rôle Pro effectif reste obtenu via conversion post-auth Story 1.3 v2 (wizard 4 steps livré).

**Ce qui reste valide de l'édition initiale** :
- ✅ Split umbrella → 1.4a/b/c/d (action 3) : intact, pattern de décomposition canonique inchangé
- ✅ `apps/customer` → `apps/public` ADR-016 (action 1) : intact
- ✅ Backend Customer-first unique (pas de duplication endpoint register) : intact
- ✅ Pas de `?role=pro` au signup sur la page login customer apex (Story 1.4c) : intact

**Ce qui est révisé** :
- 🔄 Le rationale **"Customer-first pure UX"** n'est plus valable : il y aura bien un signup form Pro distinct sur `seller.tukio.one`, livré par **Story 1.11 NEW**.
- 🔄 Le **CTA "Devenir pro"** dans le header global apex (visible toutes pages) est ajouté au scope de Story 1.11 (pas dans Story 1.4c).
- 🔄 Un **flag intent Pro** mécanique est introduit : DB column `user_profile.signup_intent VARCHAR(20) NULL` (migration Story 1.11) + cookie 24h `tukio-signup-intent=pro` (Domain=.tukio.one) pour happy-path immédiat. Robuste multi-device via fallback DB column. Consommé par Story 1.6 post-email-verify pour redirect intelligent (`seller.tukio.one/seller/onboarding/identity` si flag, sinon `tukio.one/account/dashboard`).
- 🔄 Le **DTO `RegisterCustomerInputSchema`** (Story 1.2a) est étendu d'un field optionnel `signupOrigin?: 'customer_portal' | 'pro_portal'` (default `'customer_portal'`) consommé par `RegisterCustomerUseCase` (Story 1.2b) pour set la DB column.

**Nouveau artefact** : `_bmad-output/implementation-artifacts/1-11-seller-signup-portal.md` (NEW Story 1.11, scope ~12-15 fichiers / 2-3j).

**Sub-story 1.4c amendée** : warning + AC1 lien Pro + AC7 e2e cases reformulés pour refléter dual-portal (CTA Pro dans header global apex géré par Story 1.11, pas dans la page login customer).

**Sub-stories 1.4a/b/d intactes** : aucun impact dual-portal (utils backend pure + endpoints + middlewares + observability — neutres vis-à-vis du signup UX).

**Memory replacée** : `project_signup_flow_customer_first.md` (supprimée) → `project_signup_dual_portal_2026_05_17.md` (nouvelle). Index `MEMORY.md` mis à jour.

**Voir aussi** :
- `[[project-signup-dual-portal-2026-05-17]]` (memory) — architecture finale + 9-step flow
- `[[story-1-11-seller-signup-portal-planned]]` (memory) — spec détaillée Story 1.11
- `[[story-1-4-split]]` (memory) — note révision pending par sub-story

---

## Section 1 — Issue Summary

### Problem statement

La spec Story 1.4 a été écrite **2026-05-09**. Entre cette date et aujourd'hui (2026-05-17), deux décisions structurelles l'ont rendue obsolète sans qu'elle ne soit révisée, et un troisième problème structurel (scope ~85 fichiers / 5-8 jours) la rend non-livrable en l'état :

1. **Décision A — ADR-016 / Story 0.14 (2026-05-15)** : `apps/customer` a été mergé dans `apps/public` (apex `tukio.one` unifié visiteurs + Customer authentifiés). La spec Story 1.4 référence encore `apps/customer/...` lignes 8, 502-506 + plusieurs `customer.tukio.one/.../account/dashboard` lignes 9, 16, 22, 23, 95.
2. **Décision B — Customer-first signup (2026-05-17, post-Story 1.3 v2)** : Tous les users s'inscrivent en Customer ; le rôle Pro s'obtient via conversion post-auth (CTA "Devenir pro" dropdown avatar → wizard 4 steps livré Story 1.3 v2). Plus de signup Pro direct. La spec Story 1.4 contient encore : (1) le **param `?role=pro`** (AC1 ligne 46), (2) le **lien "S'inscrire en tant que Pro"** (AC1 ligne 46), et liste les deux comme features.
3. **Problème C — Scope massif** : Story 1.4 monolithique = ~85 fichiers touchés / 5-8 jours dev (estimation propre de la spec ligne 538 + ligne 840). Le pattern atomique BMad (suivi pour Stories 1.2 et 1.3) imposerait une décomposition en 3-4 sub-stories.

### Discovery context

Identifiée par Ismael après le merge done de Story 1.3 v2 (2026-05-17, PR #46 verte) :

> *"Effectivement, on n'a plus de customers parce que tout a été mergé et fusionné avec le public, puisqu'il n'y avait pas d'intérêt d'avoir des customers au public. Pour moi, c'était la même chose. Ensuite, note bien que maintenant, tout le monde doit s'inscrire d'abord en tant que client pour ensuite faire des demandes pour devenir un professionnel."*

### Evidence — Gap spec vs décisions actées

| Dimension | Story 1.4 spec actuelle | Réalité 2026-05-17 |
|---|---|---|
| **Frontend Customer authenticated zone** | `apps/customer/` (lignes 502-506) | `apps/public/[locale]/(authenticated)/...` (ADR-016) |
| **Redirect post-login Customer** | `customer.tukio.one/{locale}/account/dashboard` | `tukio.one/{locale}/account/dashboard` (apex unifié) |
| **Lien signup secondaire sur page login** | "Pas de compte ? S'inscrire" + `?role=pro` switch | "Pas de compte ? S'inscrire" Customer-first uniquement (zéro mention Pro) |
| **Param `?role=pro`** propagé à la page login | Supporté (AC1 ligne 46) | Supprimé — rôle Pro via conversion post-auth (Story 1.3 v2) |
| **Scope** | ~85 fichiers, 5-8j (monolithique) | À décomposer en 4 sub-stories atomiques (pattern 1.2/1.3) |

### Root cause

La spec Story 1.4 (rédigée 2026-05-09) est antérieure :
- À l'**ADR-016** (2026-05-15, Story 0.14 done) qui a unifié `apps/public` + `apps/customer`.
- À la décision **Customer-first** (2026-05-17, post-Story 1.3 v2) actée par Ismael après constat que le wizard de conversion Pro déjà livré rendait redondante toute "signup pro direct".

La pratique de **dev en sub-stories atomiques** (Stories 1.2 → 4 splits + Story 1.3 → 4 + 2 bis) n'a pas été appliquée prospectivement à Story 1.4 lors de la création BMad. Le scope ~85 fichiers viole notre threshold cible (~25-30 fichiers / sub-story).

## Section 2 — Impact Analysis

### Epic Impact

| Epic | Story | Impact | Rationale |
|---|---|---|---|
| Epic 1 | 1.4 parent | 🟠 **Refonte spec + split umbrella** | Spec → status `split-umbrella` + ACs/Tasks délégués aux sub-stories ; cleanup refs `apps/customer` + `?role=pro` |
| Epic 1 | 1.4a (NEW) | 🟢 **NEW sub-story** | contracts + utils + KeycloakOAuthClient |
| Epic 1 | 1.4b (NEW) | 🟢 **NEW sub-story** | 5 endpoints gateway-api + 5 use cases + CsrfGuard + e2e |
| Epic 1 | 1.4c (NEW) | 🟢 **NEW sub-story** | login page + callback + AuthProvider ×3 + LogoutButton ×3 |
| Epic 1 | 1.4d (NEW) | 🟢 **NEW sub-story** | middlewares ×3 + auth-client hooks finalize + observability |
| Epic 1 | 1.5 password reset | 🟡 **Flag à recadrer plus tard** | Hérite du pattern Customer-first + `apps/public` — vérifier au `/bmad-correct-course` Story 1.5 |
| Epic 1 | 1.6 email verify | 🟡 **Flag à recadrer plus tard** | Idem, c'est le gate qui débloque "Devenir pro" |
| Epic 1 | 1.7 admin TOTP | 🟢 Inchangé | Admin reste séparé (`tukio-admin` client) |
| Epic 1 | 1.8 profile mgmt | 🟡 **Flag à recadrer plus tard** | Un seul profile, Customer + optionnellement Pro |
| Epic 1 | 1.9 account delete | 🟡 **Flag à recadrer plus tard** | Customer-first delete cascade Pro si existant |
| Epic 1 | 1.10 identity-svc consolidation | 🟢 Inchangé | Consume audit event login |
| Epic 2-7 | toutes pages authentifiées | 🟢 Inchangé | Consomment AuthProvider + middleware Story 1.4 |

### Artifact Impact

| Artefact | Section | Action |
|---|---|---|
| **PRD** | — | ✅ **Aucun impact** (FR4/FR9/FR17 + NFR9-13 intacts) |
| **Architecture** | — | ✅ **Aucun impact** (OAuth proxied + 4 cookies + PKCE inchangés) |
| **UX spec** | ligne 1147 (login screen) | 🟢 Vérifier que la maquette login ne mentionne plus le lien Pro (déjà neutre — pas de modification requise) |
| **epics.md** | Story 1.4 (lignes 1141-1156) | 🟢 Ajout commentaire pointeur split en sub-stories (édit 7) ; ACs haut niveau déjà cohérents (ligne 1151 mentionne ADR-016, ligne 1156 lien signup générique) |
| **Story 1.4 file** | Intégral | 🟠 Refonte umbrella (édit 1) |
| **4 NEW story files** | `1-4a/b/c/d-*.md` | 🟢 NEW (édits 2-5) |
| **sprint-status.yaml** | Epic 1 entries | 🟢 Ajout 1-4a/b/c/d ready-for-dev + 1-4 → `split-umbrella` (édit 6) ; ajout définition status `split-umbrella` |

### Technical / Code Impact

✅ **Zéro code à rollback** — Story 1.4 jamais démarrée (`ready-for-dev` depuis 2026-05-09).

🟢 Seul impact code : finalisation `apps/public/src/middleware.ts` (extension auth-gate sur Story 0.13/1.2d existant) au lieu de modifier un nouveau `apps/customer/src/middleware.ts` qui n'existe plus.

## Section 3 — Recommended Approach

**Option 1 pure — Direct Adjustment** (modification spec + split en sub-stories).

### Justification

- **Option 1 (Direct Adjustment)** ✅ — Spec jamais démarrée donc juste réécrire + splitter. Pas de rollback code. Pas de PRD/Architecture à toucher. Effort recadrage spec ~3-4h, puis dev des 4 sub-stories ~7-8j cumulé.
- **Option 2 (Rollback)** ❌ — N/A (rien à rollback).
- **Option 3 (PRD MVP Review)** ❌ — N/A (FRs intacts).

### Effort & Timeline

| Item | Effort | Timing |
|---|---|---|
| Recadrage Story 1.4 parent (umbrella) | 0.5j | Immédiat (post-approbation) |
| Création 4 sub-stories 1.4a/b/c/d | 0.5j | Immédiat (post-approbation, fait dans la foulée) |
| Edits sprint-status.yaml + epics.md | 0.25j | Immédiat |
| **Dev Story 1.4a** (contracts + utils + KeycloakOAuthClient) | 1-1.5j | Sprint courant |
| **Dev Story 1.4b** (5 endpoints + 5 use cases + CsrfGuard + e2e) | 2j | Sprint courant |
| **Dev Story 1.4c** (login page + callback + AuthProvider + LogoutButton) | 2-2.5j | Sprint courant |
| **Dev Story 1.4d** (middlewares + hooks + observability) | 2-2.5j | Sprint courant |
| **Total** | **~8j** dev + 1.25j prep | 1.5 sprint |

### Risks

| Risk | Sévérité | Mitigation |
|---|---|---|
| Coordination 4 sub-stories séquentielles (1.4a → 1.4b → 1.4c → 1.4d) | 🟡 Medium | Pattern déjà éprouvé sur Stories 1.2/1.3. /bmad-dev-story en séquence stricte. |
| Tests testcontainer Keycloak (Story 0.9 helper) en 1.4b | 🟡 Medium | Story 0.9 ready-for-dev mais non encore dev. Possible dépendance bloquante à clarifier en début 1.4b. |
| Stories 1.5/1.6/1.8/1.9 héritent obsolescence (apps/customer + Customer-first) | 🟡 Medium | Flag noté dans [[project-story-1-4-correct-course-pending]] (memory) ; correct-course similaire à prévoir avant dev de chacune. |
| Tournée 4 PRs successives (1 par sub-story) vs 1 PR umbrella | 🟢 Low | Pattern stable Stories 1.2/1.3. PR par sub-story = code-review focused. |

## Section 4 — Detailed Change Proposals

### Edit 1 — Story 1.4 parent : refonte umbrella

**File** : `_bmad-output/implementation-artifacts/1-4-login-flow-keycloak-authorization-code-pkce.md`
**Section** : Status + ADR-016 warning + AC1 + Tasks/Subtasks + project structure

**Changements clés** :

```diff
-Status: ready-for-dev
+Status: split-umbrella  # décomposée en 1.4a/b/c/d via /bmad-correct-course 2026-05-17-bis

-> ⚠️ **ADR-016 / Story 0.14 (2026-05-15) — frontend topology pivot — IMPACT LOURD sur cette story**
-> `apps/customer` a été mergé dans `apps/public` (apex `tukio.one` unifié, visiteurs + customers B2C). Conséquences sur ce flow login : ...
+> ✅ **ADR-016 / Story 0.14 — `apps/customer` est désormais `apps/public/[locale]/(authenticated)/...`**
+> Routes authentifiées Customer vivent sous `apps/public` (middleware unifié). Cette spec acte le pivot ;
+> toutes les sub-stories ci-dessous référencent `apps/public`.
+
+> ✅ **Customer-first signup (2026-05-17)** : plus de `?role=pro` au signup ni de lien
+> "S'inscrire en tant que Pro" sur la page login. Le rôle Pro est obtenu via conversion
+> post-auth (Story 1.3 v2 ✅ livrée).
```

AC1 frontend login — purge `?role=pro` :

```diff
-   - **Lien secondaire 2** : `<Link href="/{locale}/auth/sign-up">Pas de compte ? S'inscrire</Link>` (Story 1.2 Customer) ou `?role=pro` selon contexte (Story 1.3 Pro)
+   - **Lien secondaire 2** : `<Link href="/{locale}/auth/sign-up">Pas de compte ? S'inscrire</Link>` (Customer-first — Story 1.2 ; le rôle Pro s'obtient via conversion post-auth Story 1.3, pas de signup pro direct)
-   - **Param `?role=pro`** : si présent, modifie le label du lien sign-up vers `"Pas de compte ? S'inscrire en tant que Pro"` + `href` vers `?role=pro` (cohérent Story 1.3 entry).
+   (paragraphe supprimé)
```

Toutes refs `apps/customer/` → `apps/public/[locale]/(authenticated)/...` (lignes 8-9, 22, 23, 95, 502-506, 699-702).

Ajout pointeur split en bas de la spec :

```diff
+## Split en sub-stories
+
+Story 1.4 est décomposée en 4 sub-stories atomiques (correct-course 2026-05-17-bis,
+cf. `sprint-change-proposal-2026-05-17-bis.md`). Cette umbrella conserve le contexte
+architectural et les décisions techniques transverses ; les ACs/Tasks/tests sont
+définis dans chaque sub-story file.
+
+- **1.4a** — `@tukio/contracts` (5 NATS events + 1 DTO + 7 error codes) + gateway-api **utils** (pkce, state-jwt, cookie-helpers, redirect-resolver) + `KeycloakOAuthClient` + unit tests
+- **1.4b** — gateway-api **5 endpoints** (login + callback + refresh + logout + whoami) + `CsrfGuard` + 5 use cases (Pretre) + e2e specs avec testcontainer Keycloak
+- **1.4c** — `apps/public` login page (FR/EN i18n) + callback route handler + `AuthProvider` wiring sur 3 apps (public + seller + admin) + `LogoutButton` ×3 + Playwright e2e login.spec.ts
+- **1.4d** — middleware finalisation (public unifié + seller + admin) + auth-client hooks finalisation (`useAuth` + `useLogout` + `useRole` + `RefreshTokenRotation` + `CookieManager`) + observability (Grafana dashboard auth-flow + 3 runbooks)
```

### Edit 2 — Story 1.4a (NEW)

**File** : `_bmad-output/implementation-artifacts/1-4a-contracts-utils-keycloak-oauth-client.md` (NEW)
**Scope** : contracts (5 NATS events + 1 DTO + 7 error codes) + 4 utils gateway-api + KeycloakOAuthClient + 9 ACs + tests unit
**Estimation** : ~17 fichiers nouveaux + ~5 updates, **1-1.5j**
**Dépendances** : Story 1.1 + Story 1.2c
**Successeur** : 1.4b

### Edit 3 — Story 1.4b (NEW)

**File** : `_bmad-output/implementation-artifacts/1-4b-gateway-api-endpoints-usecases-csrf-e2e.md` (NEW)
**Scope** : 5 endpoints HTTP (`/v1/auth/{login,callback,refresh,logout,whoami}`) + 5 use cases Pretre + CsrfGuard + env config + e2e testcontainer Keycloak + 10 ACs
**Estimation** : ~12 fichiers nouveaux + ~4 updates, **2j**
**Dépendances** : 1.4a + Story 0.8 (KeycloakJwtGuard) + Story 0.9 (testing helpers)
**Successeur** : 1.4c

### Edit 4 — Story 1.4c (NEW)

**File** : `_bmad-output/implementation-artifacts/1-4c-frontend-login-callback-authprovider-logout.md` (NEW)
**Scope** : `apps/public` login page + callback route handler + AuthProvider wiring 3 apps + LogoutButton ×3 + redirect-url sanitization + Playwright e2e + 7 ACs
**Estimation** : ~12 fichiers nouveaux + ~5 updates, **2-2.5j**
**Dépendances** : 1.4b + Story 0.4 + Story 0.8
**Successeur** : 1.4d

### Edit 5 — Story 1.4d (NEW)

**File** : `_bmad-output/implementation-artifacts/1-4d-middlewares-auth-client-hooks-observability.md` (NEW)
**Scope** : middlewares 3 apps (public auth-gate + seller status finalize + admin role/TOTP) + auth-client hooks finalize (Story 0.8 placeholders → impls) + axios interceptor 401→refresh + Grafana dashboard + 3 runbooks + 12 ACs
**Estimation** : ~14 fichiers nouveaux + ~8 updates, **2-2.5j**
**Dépendances** : 1.4a + 1.4b + 1.4c + Story 0.8 + Story 0.13
**Successeurs** : Stories 1.5/1.6/1.7/1.8/1.9 + Epic 2-7

### Edit 6 — sprint-status.yaml

**File** : `_bmad-output/implementation-artifacts/sprint-status.yaml`
**Action** : Ajout définition `split-umbrella` dans STATUS DEFINITIONS + ajout 4 sub-stories ready-for-dev + 1-4 → `split-umbrella` + commentaire `last_updated`

```diff
 # Story Status:
 ...
 #   - rolled-back: ...
+#   - split-umbrella: Story decomposed into atomic sub-stories via /bmad-correct-course (e.g., 1.2 → 1.2a-d).
+#                     Parent file conserved for context + cross-cutting decisions ; ACs/Tasks delegated.
+#                     See sprint-change-proposal-{date}.md for rationale + sub-story keys.
```

```diff
   1-3d-v2-conversion-wizard-seller-mvp-pro-onboarding: done
-  1-4-login-flow-keycloak-authorization-code-pkce: ready-for-dev
+  # Story 1.4 RE-CADRÉE 2026-05-17-bis via /bmad-correct-course
+  # (sprint-change-proposal-2026-05-17-bis.md) :
+  # - apps/customer → apps/public (ADR-016 / Story 0.14)
+  # - suppression signup Pro direct + lien `?role=pro` (Customer-first 2026-05-17)
+  # - split en 4 sub-stories 1.4a/b/c/d (scope ~85 fichiers / 5-8j)
+  1-4-login-flow-keycloak-authorization-code-pkce: split-umbrella
+  1-4a-contracts-utils-keycloak-oauth-client: ready-for-dev
+  1-4b-gateway-api-endpoints-usecases-csrf-e2e: ready-for-dev
+  1-4c-frontend-login-callback-authprovider-logout: ready-for-dev
+  1-4d-middlewares-auth-client-hooks-observability: ready-for-dev
   1-5-password-reset-flow: ready-for-dev
```

### Edit 7 — epics.md Story 1.4 commentaire split

**File** : `_bmad-output/planning-artifacts/epics.md`
**Section** : ligne 1141 (Story 1.4 header)

```diff
 #### Story 1.4: Login flow Keycloak (`POST /v1/auth/login` + Authorization Code + PKCE)

+> ⚠️ **Décomposée en 4 sub-stories** via `/bmad-correct-course` 2026-05-17-bis
+> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md`) :
+> 1.4a (contracts + utils + KeycloakOAuthClient) → 1.4b (5 endpoints + 5 use cases + CsrfGuard + e2e)
+> → 1.4c (login page + callback + AuthProvider ×3 + LogoutButton ×3) → 1.4d (middlewares ×3
+> + auth-client hooks finalize + observability). Customer-first signup acté : zéro `?role=pro`
+> au signup, zéro lien "S'inscrire en tant que Pro" — le rôle Pro s'obtient via conversion
+> post-auth (Story 1.3 v2 ✅ livrée).

 **As a** Customer / Pro / Admin,
```

Aucun changement sur les 8 ACs haut niveau (lignes 1149-1156) — la ligne 1151 mentionne déjà "apex unifié, ADR-016", la ligne 1156 cite "Pas de compte ? S'inscrire" générique Customer-first. ✅

## Section 5 — Implementation Handoff

**Scope classification** : **Moderate** — backlog reorganization (split umbrella → 4 sub-stories atomiques) sans modification PRD/Architecture/code.

**Handoff recipients** :

- **Developer agent (Claude)** — execute :
  1. Appliquer les 7 édits (Story 1.4 parent refonte + 4 NEW sub-stories + sprint-status.yaml + epics.md commentaire)
  2. Mettre à jour la mémoire (résoudre `project_story_1_4_correct_course_pending` → soit suppression soit pivotage vers "done")
  3. Lancer dev via `/bmad-dev-story` séquentiellement : **1.4a → 1.4b → 1.4c → 1.4d** (1 PR par sub-story)
- **Sprint planning (Ismael)** — décide :
  - Si dev démarre immédiatement Story 1.4a ou si on priorise d'autres stories (Story 2.1 Stripe Connect aussi `ready-for-dev` par ex.)
  - Si on attaque le correct-course Stories 1.5/1.6/1.8/1.9 maintenant ou au moment de chacune

**Success criteria** :
- 1.4a/b/c/d ready-for-dev avec ACs/Tasks/Dev Notes complets + cohérents Customer-first + apps/public
- 0 référence à `apps/customer/...` dans Story 1.4 parent ou sub-stories
- 0 référence à `?role=pro` ou "S'inscrire en tant que Pro" dans aucun artefact (PRD, epics, stories)
- sprint-status.yaml + epics.md + Story 1.4 cohérents (cross-références fonctionnent)
- Status `split-umbrella` documenté dans sprint-status.yaml STATUS DEFINITIONS

## Section 6 — Approval Trail

| Étape | Date | Acteur | Status |
|---|---|---|---|
| Trigger identifié | 2026-05-17 | Ismael (post-Story 1.3 v2 done) | ✅ |
| Memory persistée (avant compact) | 2026-05-17 | Claude | ✅ |
| Workflow `/bmad-correct-course` lancé | 2026-05-17 | Ismael | ✅ |
| Édits 1-7 incremental approval | 2026-05-17 | Ismael (1-by-1 `[a]`) | ✅ 7/7 approved |
| Final proposal approval | 2026-05-17 | _en attente_ | ⏳ |
| Apply edits | 2026-05-17 | Claude (dev agent) | ⏳ |
| Workflow complete | 2026-05-17 | Claude + Ismael | ⏳ |

---

## Annexes

### Annexe A — Stories 1.5/1.6/1.8/1.9 à recadrer ultérieurement (flag)

Ces stories ont été écrites 2026-05-09 et héritent des mêmes obsolescences que Story 1.4 (apps/customer + Customer-first pas appliqué). À auditer via `/bmad-correct-course` **au moment du dev de chacune** :

- **Story 1.5** (password reset) — flow unifié Customer.
- **Story 1.6** (email verify) — c'est le gate qui débloque le CTA "Devenir pro" Story 1.3 ; AC2 redirect post-verify déjà ajusté Sprint Change Proposal 2026-05-17 → `/account/dashboard` toujours.
- **Story 1.8** (profile management) — un seul profile, le compte est Customer + optionnellement Pro.
- **Story 1.9** (account delete) — supprime Customer = supprime aussi le Pro associé si existant.

Ne nécessite pas de correct-course immédiat ; flag noté dans `project-signup-flow-customer-first.md` memory.

### Annexe B — Pattern de décomposition stable BMad tukio.one

Cette correct-course est la **4ᵉ application** d'un pattern stable pour les stories Epic 1+ scope > ~50 fichiers ou > ~3j dev :

| Story parent | Date split | Sub-stories | Sprint Change Proposal |
|---|---|---|---|
| Story 1.2 (Customer register) | 2026-05-15 | 1.2a/b/c/d (4) | `sprint-change-proposal-2026-05-15.md` |
| Story 1.3 (Pro register) | 2026-05-16 | 1.3a/b/c/d (4) | `sprint-change-proposal-2026-05-16.md` |
| Story 1.3 v2 (conversion wizard) | 2026-05-17 | + 1.3a-bis + 1.3b-bis + 1.3d-v2 | `sprint-change-proposal-2026-05-17.md` |
| **Story 1.4 (login flow)** | **2026-05-17** | **1.4a/b/c/d (4)** | **ce doc** |

Distribution canonique des sub-stories d'Epic 1 Auth :
- **Sub-story `a`** = contracts (`@tukio/*`) + utils pure + clients externes
- **Sub-story `b`** = backend (identity-svc ou gateway-api) endpoints + use cases + e2e
- **Sub-story `c`** = frontend pages + components + i18n + tests
- **Sub-story `d`** = middlewares + hooks finalisation + observability + e2e cross-app

### Annexe C — References

- `docs/adr/0016-frontend-topology-pivot-apex-unified.md` (Story 0.14)
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md` (Story 1.2 split)
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-16.md` (Story 1.3 split)
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17.md` (Story 1.3 v2 conversion wizard)
- Memory: `project_signup_flow_customer_first.md` (Customer-first 2026-05-17)
- Memory: `project_story_1_4_correct_course_pending.md` (cette correct-course)
- Memory: `story_0_14_apex_merge_2026_05_15.md` (ADR-016)
