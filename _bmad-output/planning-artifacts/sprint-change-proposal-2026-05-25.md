# Sprint Change Proposal — Répercussion ADR-0017 (auth client-first + conversion pro)

- **Date** : 2026-05-25
- **Auteur** : Bob (Scrum Master) via `/bmad-correct-course`
- **Décideur** : Ismael (founder)
- **Déclencheur** : ADR-0017 (PR #94) + découvertes d'analyse d'impact
- **Scope classification** : **Moderate** (réorganisation de backlog — 1 story annulée, 1 ajoutée, 2 amendées, 1 ADR corrigé)

---

## Section 1 — Résumé de l'issue

ADR-0017 acte le modèle d'authentification **client-first + conversion-only** : inscription unique
sur l'apex `tukio.one`, rôle `pro` obtenu uniquement par conversion, et un routeur post-login par rôle.

En préparant la répercussion sur le sprint, l'analyse de code (correct-course) a révélé **deux écarts
entre la prémisse de l'ADR/brief et la réalité du code** :

1. **Fausse prémisse « inscription pro directe à supprimer ».** L'endpoint `POST /v1/auth/pro/register`
   n'est **pas** une inscription directe : depuis la Story 1.3b-bis (2026-05-17) c'est un endpoint de
   **conversion Customer→Pro authentifié** (`auth-pro.controller.ts` — pas de `@Public()`, `@CurrentActor()`
   injecte le `sub` JWT). Le `?role=pro` au signup avait déjà été retiré lors du re-cadrage de la Story 1.4
   (2026-05-17). **Le modèle conversion-only voulu par l'ADR est donc déjà implémenté côté backend** — rien
   à supprimer.

2. **Le routeur par rôle existe en partie, côté gateway, pas apex.** L'implémenté (Story 1.4) et le plan
   (Story 1.6) calculent un redirect par rôle/status **côté `gateway-api`** ; le callback apex relaie le
   `Location` (`apps/public/.../auth/callback/route.ts:54-62`). Cela contredisait ADR-0017 AC3 (« routeur
   server-side sur l'apex »). **Décision 2026-05-25 : gateway-side unifié** (plus centralisé pour N fronts,
   conforme à l'existant).

**Type d'issue** : *misunderstanding of original requirements* — l'ADR reposait sur une lecture datée du code.
Conséquence positive : le plan réel est **plus léger** que prévu.

---

## Section 2 — Analyse d'impact

### Impact Epic

- **Epic 1 (Identity & Auth, in-progress)** : reste réalisable, **allégé** — −1 story (1.11 annulée), +1 story
  (1.12 resolver). Total 12 stories dont 11 actives.
- **Epic 2 (Pro Onboarding, in-progress)** : non impacté — le wizard de conversion (Story 1.3 v2) est livré
  et conforme.
- **Autres epics** : aucun impact.

### Impact Story

| Story | Statut avant | Action | Statut après |
|---|---|---|---|
| 1.3c (`/v1/auth/pro/register`) | done | **Aucune suppression** — c'est l'endpoint de conversion authentifié. Rename `register`→`convert` optionnel/déféré. | done (inchangé) |
| 1.11 (seller signup portal) | ready-for-dev | **Annulée** — dual-portal abandonné (page sign-up seller + `signup_intent` + cookie). | **cancelled** |
| 1.6 (email-verify) | ready-for-dev | **Amendée** — redirect par rôle conservé mais doit consommer le resolver unifié 1.12 ; pas de `signup_intent`. | ready-for-dev (amendée) |
| 1.4c (login/callback) | review | **Note de dépendance** — son redirect est absorbé par le resolver 1.12 ; ne pas hardcoder `/account/dashboard`. Pas d'extension de scope. | review (inchangé) |
| **1.12 (resolver post-login par rôle, gateway)** | — | **NEW** — pure function `post-login-destination-resolver.ts` consommée par 1.4 + 1.6. | **ready-for-dev** |

### Conflits artefacts

- **PRD** : aucune référence à l'inscription pro directe / `signup_intent` → pas de conflit.
- **Architecture** (`architecture.md`) : journal ADR déjà patché (ADR-017). Le resolver gateway est documenté
  dans la Story 1.12.
- **UX** : flux conversion conforme. Seul retrait = page sign-up dédiée `seller.tukio.one/auth/*` (jamais
  construite).
- **ADR-0017** (`docs/adr/0017-…md`, Proposed, PR #94) : **corrigé** — retrait de la fausse « suppression
  d'endpoint », AC3 reformulé gateway-side, Context/Consequences/Implementation Notes alignés.
- **Epics.md** : Story 1.11 marquée annulée, Story 1.6 amendée, Story 1.12 ajoutée.
- **sprint-status.yaml** : 1.11 `cancelled`, 1.12 `ready-for-dev`, note 1.4c.

### Impact technique

- **Aucune suppression de code / migration destructive.** L'endpoint de conversion reste.
- Travail réel = **1 story** (resolver gateway unifié) + alignement de 1.6 au moment du dev.
- Dette de nommage optionnelle (`register`→`convert`) — déférée.

---

## Section 3 — Approche recommandée

**Option 1 — Direct Adjustment (hybride)** : amender + annuler + ajouter, dans la structure d'epic existante.

- **Rollback** (Option 2) : non viable / inutile — rien à annuler côté code (le backend matche déjà).
- **MVP review** (Option 3) : N/A — le MVP est inchangé (même légèrement allégé).

**Effort** : Low-Medium · **Risque** : Low · **Impact timeline** : neutre à légèrement positif (−1 story de
dev grâce à l'annulation de 1.11).

**Justification** : la décision produit (ADR-0017) est conservée ; l'analyse n'a fait que corriger des
prémisses datées. Aucune régression, momentum préservé, backlog clarifié.

---

## Section 4 — Propositions de changement détaillées (appliquées)

> Toutes les éditions ci-dessous ont été **appliquées** sur la branche `docs/adr-0017-auth-client-first`
> (PR #94) après approbation d'Ismael (mode incrémental).

### EP-1 — Correction ADR-0017 (`docs/adr/0017-auth-client-first-conversion-pro.md`)

- Context : remplacement du « hybride de 3 visions » par l'état réel (backend déjà conversion-only, seul
  manque = le routeur).
- Décision pt.1 : retrait de « no direct pro registration — `?role=pro`… dropped » → « déjà le cas backend ;
  l'endpoint est une conversion authentifiée ; cet ADR ratifie + annule 1.11 ».
- Décision pt.3 : « routeur apex `/auth/callback` » → « resolver unifié **gateway-api**, relayé par les
  callbacks front ».
- Consequences/Negative : retrait du « deprecate then remove » → « pas de suppression, endpoint juste
  misnamed ».
- Implementation Notes : suppression de la « migration sequence » → « no endpoint migration » + résolveur
  gateway-side + répercussions backlog.

### EP-2 — Annulation Story 1.11 (dual-portal)

- `sprint-status.yaml` : `1-11-seller-signup-portal: cancelled`.
- `epics.md` : en-tête Story 1.11 → bandeau 🗑️ ANNULÉE, liste des éléments supprimés + ce qui survit ailleurs.

### EP-3 — Amendement Story 1.6 (email-verify)

- `epics.md` : bandeau 🔄 + AC de redirect reformulée (délègue au resolver 1.12, pas de `signup_intent`).
- `1-6-…md` : bandeau d'alignement (consommer `post-login-destination-resolver.ts` 1.12, pas de resolver dédié).

### EP-4 — Nouvelle Story 1.12 (resolver post-login par rôle, gateway)

- `epics.md` : section Story 1.12 complète (5 AC) + total epic mis à jour (12 / 11 actives).
- `sprint-status.yaml` : `1-12-post-login-role-router: ready-for-dev`.

### EP-5 — Note de dépendance Story 1.4c

- `sprint-status.yaml` : commentaire au-dessus de 1.4c (redirect absorbé par 1.12, ne pas hardcoder).

---

## Section 5 — Handoff d'implémentation

**Scope : Moderate** → coordination PO/DEV + SM.

| Rôle | Responsabilité |
|---|---|
| **SM (Bob)** | Drafter le fichier de Story 1.12 via `*draft` (spec complète : resolver gateway + consommation 1.4/1.6 + tests). |
| **DEV (Amelia)** | Implémenter Story 1.12 (resolver gateway unifié) puis brancher 1.4c (en review) + 1.6 dessus. |
| **Architect (Winston)** | Aucune action requise — ADR-0017 corrigé est cohérent. (Consultable si un point gateway-side ressurgit.) |

**Critères de succès** :
- `post-login-destination-resolver.ts` (gateway) : pure function, ≥ 90 % coverage, précédence admin→pro→client.
- 1.4 (login) et 1.6 (email-verify) consomment ce resolver unique ; les callbacks front relaient le `Location`.
- Aucune route n'assigne `pro` à l'inscription ; le seul chemin pro = wizard de conversion (Story 1.3 v2).
- Story 1.11 retirée du sprint ; ADR-0017 cohérent avec le code avant merge PR #94.

**Petit point ouvert (non bloquant)** : l'UX « client qui atterrit sur `seller.tukio.one` racine » (ex-AC de
1.11) → à confirmer/folder dans le middleware seller (bounce vers `become-pro`/apex). À traiter au draft de 1.12
ou en note de la story seller-root.

---

*Fin du Sprint Change Proposal — 2026-05-25.*
