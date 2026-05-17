# Sprint Change Proposal — 2026-05-17

**Trigger story** : Story 1.3d (frontend wizard pro, PR #45 mergée vers `develop` 2026-05-17)
**Author** : Claude (dev agent) + Ismael (approbation)
**Scope classification** : **Moderate** — backlog reorganization + PRD revisions + targeted rollback
**Workflow** : `/bmad-correct-course` Incremental mode, 7 edits approved

## Section 1 — Issue Summary

### Problem statement

L'implémentation Story 1.3d (Pro registration frontend wizard) a été livrée conforme à la spec Story 1.3 — mais cette spec **diverge fondamentalement du design source Cloud Design** `docs/cloud-design-bundle/project/screens/mvp-pro-onboarding.jsx` (611 lignes, MVP bundle officiel).

### Discovery context

Erreur identifiée par Ismael lors de la review visuelle du wizard livré au dev server. Citation : *"Pour moi, on s'inscrit, c'est la même page, le même champ que le customer. Une fois que l'inscription est faite, l'adresse e-mail validée, c'est à ce moment-là qu'on peut faire une demande pour devenir professionnel."*

### Evidence — Gap spec vs design

| Dimension | Story 1.3 spec actuelle | `mvp-pro-onboarding.jsx` design |
|---|---|---|
| **Trigger** | Signup `tukio.one/fr/auth/sign-up?role=pro` (visitor) | Post-auth Customer email-verified → CTA "Devenir pro" dropdown avatar |
| **Localisation wizard** | `apps/public` | `apps/seller/[locale]/seller/onboarding/{step}` |
| **Nombre steps** | 3 (Compte / Société / Documents) | 4 MVP-scope (Identité / Activité / Documents / Récap) |
| **Step Identité** | Email + password + acceptTerms (compte complet) | Prénom/Nom/Email pro/Téléphone/Date de naissance (pré-remplis depuis Customer) |
| **Step Activité** | companyName + SIRET + VAT + adresse + phone | + Forme juridique (select 5 options) + Statut TVA (radio) + Catégories (2 max pills) + Zone d'intervention (lieu + rayon) |
| **Step Récap** | ❌ absent | Card read-only 4 lignes + checkbox certif charte pros |
| **Layout** | AuthShell split form/editorial | Header simple "Brouillon sauvegardé" + step indicator barres + single column 720px max |
| **Page pending** | Placeholder text + back-to-home | `ProOnbPendingScreen` icône clock + "Pendant ce temps préparez votre vitrine" 3 PendingTask |

### Root cause

La **PRD elle-même** est incohérente :
- **FR3** `Pro registration (Epic 1) + onboarding/KYC (Epic 2)` clivait le flow en 2 surfaces séparées
- **FR13** `Conversion customer → pro` était taggée **V1** alors que le design MVP montre **cette même conversion** comme le flow principal Pro
- **Story 2.2** (Epic 2 V1) prévoyait un wizard 4 steps post-auth distinct du wizard signup Story 1.3

Le design Cloud Design `mvp-pro-onboarding.jsx` montre **un seul flow unifié** = la "conversion V1" appliquée au MVP. La PRD/Epics avaient anticipé une architecture plus complexe que ce que le design exige.

## Section 2 — Impact Analysis

### Epic Impact

| Epic | Story | Impact | Rationale |
|---|---|---|---|
| Epic 1 | 1.3 parent | 🔴 **Refonte AC** | Story = wizard conversion post-auth, plus signup pro |
| Epic 1 | 1.3a contracts | 🟢 **Conservé + extension** | DTO à étendre via 1.3a-bis (dateOfBirth, legalForm, vatStatus, categories[], serviceZone) |
| Epic 1 | 1.3b identity-svc | 🟢 **Conservé + adaptation** | Handler à adapter via 1.3b-bis (assignRealmRole 'pro' au lieu de createUser) |
| Epic 1 | 1.3c gateway-api | 🟢 **Conservé** | Endpoint POST /v1/auth/pro/register inchangé, juste appelé depuis seller (auth required maintenant) |
| Epic 1 | 1.3d v1 | 🔴 **Rollback** (done puis revert) | Wizard frontend + i18n + Playwright à supprimer |
| Epic 1 | 1.3d v2 | 🆕 **NEW story** | Conversion wizard 4 steps sur seller + "Devenir pro" CTA |
| Epic 1 | 1.6 email verify | 🟠 **Ajustement AC** | Redirect post-verify toujours `/account/dashboard` |
| Epic 2 | 2.1 Stripe Connect | 🟢 Inchangé | Reste backend Stripe |
| Epic 2 | 2.2 wizard frontend | 🟠 **Re-scope** | Réduite à Stripe step + redirect 1ère fiche |

### Artifact Impact

| Artefact | Section | Action |
|---|---|---|
| **PRD** | FR3 (ligne 488) | Reformuler split Epic 1/2 |
| **PRD** | FR13 (ligne 498) | **V1 → MVP** |
| **Epics.md** | Story 1.3 (lignes 1117-1132) | Refonte intégrale |
| **Epics.md** | Story 1.6 AC2 (ligne 1174) | Ajustement redirect |
| **Epics.md** | Story 2.2 (lignes 1272-1289) | Re-scope |
| **UX spec** | lignes 952-958 | Déjà aligné avec le nouveau flow ; ligne 953 "wizard step 1 Profil" à clarifier |
| **Architecture** | — | Aucun impact (cross-zone redirect déjà géré par Vercel rewrites ADR-013) |
| **sprint-status.yaml** | Stories 1.3d/1.3a-bis/1.3b-bis/1.3d-v2 | Ajout entries + transitions |

### Technical / Code Impact (rollback Story 1.3d v1)

**À supprimer** (apps/public) :
- `src/features/auth/sign-up-pro/` (8 fichiers : index.ts, wizard-state.ts, services/, components/)
- `e2e/auth/pro-register.spec.ts`
- `e2e/fixtures/{idCard.jpg, rib.pdf, kbis.pdf, idCard-wrong-mime.exe}`

**À reverter** (apps/public) :
- `src/app/[locale]/auth/sign-up/page.tsx` (retirer switch `?role=pro`)
- `src/messages/{fr,en}.json` (retirer namespace `auth.signupPro.*` ~120 keys)

**Conservé / adapté** :
- `packages/api-client/src/hooks/identity/use-register-pro.ts` — adapter pour Bearer auth
- `apps/seller/src/middleware/pending-admin-review-{decision,redirect}.ts` — déjà au bon endroit
- `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx` — à enrichir conforme `ProOnbPendingScreen`
- `apps/gateway-api/src/infrastructure/metrics/pro-registration.metrics.ts` — inchangé
- `apps/identity-svc/src/infrastructure/metrics/{insee,r2-kyc}.metrics.ts` — inchangé
- `infra/k8s/grafana-dashboards/pro-registration.json` — inchangé
- 3 runbooks (pro-registration-debug, kyc-docs-retention, insee-sirene-integration) — mise à jour mineure

**À ajouter** (apps/seller, Story 1.3d v2) :
- Adoption next-intl (était déféré Story 7.1, à anticiper)
- `src/features/seller-onboarding/` wizard + 4 step components + service
- `src/messages/{fr,en}.json` (~150 keys `seller.onboarding.*`)
- `playwright.config.ts` + e2e spec 12 cases × 2 projects
- Dropdown CTA "Devenir pro" dans `apps/public` zone authenticated

## Section 3 — Recommended Approach

**Hybride Option 1 + Option 3** (Direct Adjustment + PRD MVP Review).

### Justification

- **Option 1 (Direct Adjustment)** ✅ — Modifier les stories existantes + ajouter quelques nouvelles (1.3a-bis, 1.3b-bis, 1.3d v2) sans rip-up architecture. Backend Story 1.3a/b/c reste valide.
- **Option 2 (Full Rollback)** ❌ — Inutile. Le backend est correct. Seule la couche frontend doit être refaite.
- **Option 3 (PRD MVP Review)** ✅ — Nécessaire pour FR13 V1→MVP et FR3 split clarification.

### Effort & Timeline

| Story | Effort | Timing |
|---|---|---|
| Rollback Story 1.3d v1 code | 0.5j | Immédiat |
| Story 1.3a-bis (DTO extension) | 1j | Sprint courant |
| Story 1.3b-bis (handler conversion) | 1j | Sprint courant |
| Story 1.3d v2 (wizard + CTA + e2e + i18n + next-intl adoption seller) | 4-5j | Sprint courant |
| PRD/Epics edits | 0.5j | Immédiat |
| **Total** | **~7j** | 1-1.5 sprint |

### Risks

| Risk | Sévérité | Mitigation |
|---|---|---|
| Adoption next-intl dans apps/seller (was Story 7.1) anticipée | 🟡 Medium | Bornée à ~150 keys + middleware ; Story 7.1 reste ouverte pour i18n routing global |
| Conversion handler nécessite Story 1.4 login complète pour tests E2E | 🟡 Medium | Story 1.4 deps directe ; e2e Playwright avec helper auth fixture peut shorter |
| Rollback Story 1.3d v1 sur develop déjà mergée | 🟢 Low | Branch revert ou nouvelle PR cleanup |

## Section 4 — Detailed Change Proposals

### Edit 1 — PRD FR13 promotion V1→MVP

```diff
FILE: _bmad-output/planning-artifacts/prd.md
LINE: 498

- | FR13 | Epic 1 | V1 | Conversion customer → pro |
+ | FR13 | Epic 1 | MVP | Conversion customer → pro (wizard 4 steps : Identité / Activité / Documents / Récap → `pending_admin_review`) |
```

### Edit 2 — PRD FR3 split clarification

```diff
FILE: _bmad-output/planning-artifacts/prd.md
LINE: 488

- | FR3 | Epic 1 + Epic 2 | MVP | Pro registration (Epic 1) + onboarding/KYC (Epic 2) |
+ | FR3 | Epic 1 + Epic 2 | MVP | Pro conversion wizard Identité+Activité+Documents+Récap (Epic 1 — voir FR13) → Stripe Connect + 1ère fiche (Epic 2) |
```

### Edit 3 — Epics.md Story 1.3 refonte intégrale

Cf. Section 2 du présent doc + spec dans le file change ci-dessous. Story renommée : "Customer→Pro conversion wizard". 10 ACs refondus.

### Edit 4 — Sub-stories 1.3a-bis + 1.3b-bis (NEW)

**Story 1.3a-bis** : Extend `RegisterProInputSchema` (add Identity + Activity fields)
- Ajout : `dateOfBirth`, `legalForm` (enum), `vatStatus` (enum), `categories[]` (1-2), `serviceZone {city, radiusKm}`, `acceptCharter` (literal true)
- Retire : `email`, `password`, `acceptTerms` (déjà sur compte Customer)

**Story 1.3b-bis** : identity-svc `ConvertCustomerToProUseCase` (renamed)
- Input shape modifiée (userId from JWT, plus password)
- Flow : `assignRealmRole('pro')` + `setCustomClaim('tukio:status', 'pending_admin_review')` au lieu de `createUser`
- Endpoint passe authenticated (`KeycloakJwtGuard` required, plus de `@Public`)

### Edit 5 — Story 1.3d v2 NEW (replace v1)

12 ACs incluant : "Devenir pro" CTA (apps/public dropdown) + wizard layout `mvp-pro-onboarding.jsx` + 4 steps + page pending enrichie + middleware reuse + Playwright e2e 12 cases + observability reuse + i18n adoption next-intl seller + rollback v1 code.

### Edit 6 — Epics.md Story 2.2 re-scope

```diff
FILE: _bmad-output/planning-artifacts/epics.md
LINE: 1272

- #### Story 2.2: Pro onboarding wizard frontend (4 steps : Profil + Stripe + KYC + 1ère fiche)
+ #### Story 2.2: Stripe Connect step extension + first listing redirect (post conversion-wizard)
```
9 ACs réduits à 5. Steps Profil/KYC/Documents déplacées Story 1.3.

### Edit 7 — Epics.md Story 1.6 AC2 ajustement

```diff
FILE: _bmad-output/planning-artifacts/epics.md
LINE: 1174

- ...CTA "Continuer" (vers `/account/dashboard` si client, `/seller/onboarding` si pro pending).
+ ...CTA "Continuer" vers `/account/dashboard` (default Customer — l'option "Devenir pro" est accessible ensuite depuis le dropdown avatar pour démarrer le wizard conversion, cf. Story 1.3).
```

## Section 5 — Implementation Handoff

**Scope classification** : **Moderate** — backlog reorganization + targeted code rollback + backend extensions

**Handoff recipients** :
- **Developer agent (Claude)** — execute :
  1. Appliquer les 7 edits (PRD + epics + ajout/refonte story files)
  2. Mettre à jour `sprint-status.yaml` (ajout 1.3a-bis, 1.3b-bis, 1.3d-v2 ; marquer 1.3d v1 'rollback')
  3. Lancer rework via `/bmad-dev-story` séquentiellement : 1.3a-bis → 1.3b-bis → 1.3d v2
- **Sprint planning (Ismael)** — décide :
  - Si rework démarre immédiatement ou après priorisation autres stories
  - Si rollback Story 1.3d v1 fait sur branche dédiée ou directement dans 1.3d v2

**Success criteria** :
- Wizard conversion conforme `mvp-pro-onboarding.jsx` visuel + fields
- Backend 1.3a/b/c étendus + opérationnels via JWT auth
- 0 vestige Story 1.3d v1 dans le code (cleanup complet)
- sprint-status.yaml + epics.md + PRD cohérents
- Playwright e2e 12 cases passent (post docker:up)
- Code-review parallèle ✅ avant merge final

## Section 6 — Approval Trail

| Étape | Date | Acteur | Status |
|---|---|---|---|
| Trigger | 2026-05-17 | Ismael (review visuelle) | ✅ |
| Edits 1-7 incremental approval | 2026-05-17 | Ismael (AskUserQuestion) | ✅ 7/7 approved |
| Final proposal approval | 2026-05-17 | _en attente_ | ⏳ |
| Apply edits | 2026-05-17 | Claude (dev agent) | ⏳ |
| Workflow complete | 2026-05-17 | Claude + Ismael | ⏳ |

---

## Annexes

### Annexe A — Référence design source

`docs/cloud-design-bundle/project/screens/mvp-pro-onboarding.jsx` :
- Step 1 `ProOnbStep1Screen` (Identité) — lignes 127-179
- Step 2 `ProOnbStep2Screen` (Activité) — lignes 181-253
- Step 4 `ProOnbStep4Screen` (Paiement — Stripe Connect, déféré Story 2.1) — lignes 255-350
- Step 5 `ProOnbStep5Screen` (Récap) — lignes 352-439
- `ProOnbPendingScreen` (page pending validation) — lignes 441-541
- Helpers : `OnbShell` (lignes 5-108), `OnbField` (lignes 110-124), `RadioCard` (lignes 579-605), `PendingTask` (lignes 543-577)

### Annexe B — UX spec references

`_bmad-output/planning-artifacts/ux-design-specification.md` :
- Ligne 211 — *"Bundle a déjà un pro-onboarding.jsx + mvp-pro-onboarding.jsx... 4 étapes guidées..."*
- Lignes 262-263 — Pro onboarding wizard `/seller/onboarding/{step}` ✅ Figé MVP
- Lignes 952-958 — Liste des écrans avec routes + statut design
- Ligne 1029 — *"Client qui devient Pro (conversion compte) → Bouton 'Devenir pro' dans dropdown avatar customer + intro flow V1"*

### Annexe C — Code Story 1.3d v1 livré (à rollback / conserver)

Cf. Section 2 "Technical / Code Impact" détaillé.
