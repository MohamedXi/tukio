# Sprint Change Proposal — Répercussion ADR-0018 (inscription sur page Keycloak)

- **Date** : 2026-05-25
- **Auteur** : Bob (Scrum Master) via `/bmad-correct-course`
- **Décideur** : Ismael (founder) — décision actée (ADR-0018, PR #96 mergée)
- **Scope classification** : **Major** (réorganisation backlog + revirement de code livré + SPI Keycloak de zéro)

---

## Section 1 — Résumé de l'issue

ADR-0018 acte que **l'inscription bascule sur la page Keycloak hostée** (themée), comme le login,
avec social IdP (Google/Microsoft). Aujourd'hui : le login redirige vers Keycloak, mais l'inscription
est un **formulaire local Next.js** (Story 1.2 : `SignUpForm` + `POST /v1/auth/customer/register` →
identity-svc Admin API), incohérent et divergent du doc UX §B.1.

Particularité : **Story 1.2 (et 1.2a-d) est `done` + mergée**. La répercussion **déprécie donc du code
livré** et **inverse le modèle de création** du `user_profile` (dual-write synchrone 1.2b → création
réactive sur événement Keycloak).

---

## Section 2 — Analyse d'impact

### Impact Epic

- **Epic 1 (Identity & Auth, in-progress)** : 12 → **15 stories** (14 actives ; 1.11 annulée, 1.2
  superseded mais conservée done). +3 stories NEW (1.13/1.14/1.15).
- **Epic 2 (Pro Onboarding)** : non impacté (la conversion pro opère sur un customer existant ;
  comment le customer est créé ne change pas le flux pro).

### Impact Story

| Story | Statut | Action |
|---|---|---|
| 1.2 (+1.2a-d) | done | **Superseded** (bandeau) — non rouvertes. Form local + endpoint + contracts `register-customer` à déprécier→retirer via 1.13-1.15. |
| 1.6 (email-verify) | ready-for-dev | **Re-scopée** : vérification native Keycloak ; ne reste que thème `verify-email.ftl` + pages `verify-email-required` FR17 + redirect via resolver. Suppression du custom verify endpoint + landing + table tokens. |
| **1.13** (realm provisioning) | NEW → ready-for-dev | default-role `client`, IdP Google+Microsoft, Terms required-action, champ marketing `register.ftl`. |
| **1.14** (front redirect + dépréciation) | NEW → backlog | initiate-register gateway + redirect « S'inscrire » + retrait form/endpoint/contracts. Dépend 1.13+1.15. |
| **1.15** (user_profile réactif) | NEW → ready-for-dev | SPI Keycloak event-listener → NATS → identity-svc inbox ; remplace dual-write 1.2b. **Gros morceau.** |

### Conflits artefacts

- **PRD** : pas de conflit de fond (le résultat — un customer rôle `client` — est inchangé).
- **Architecture** : ADR-0018 déjà au journal (PR #96). L'inversion `user_profile` réactif est documentée.
- **Code livré à déprécier** (surface ~20 fichiers) : `SignUpForm.tsx`, e2e ×4, identity-svc
  (controller/usecase/DTO/aggregate/migration), gateway (controller/DTO/metrics/proxy/client),
  `register-customer` contracts.
- **Infra** : SPI Keycloak à construire (Java) — `infra/keycloak/spi` ne contient qu'un README.

### Impact technique

- **Inversion du modèle de création** `user_profile` (dual-write synchrone → event-driven). Le plus
  structurant.
- **SPI Keycloak de zéro** (Java) — compétence/outillage spécifiques (build dans le pipeline thème jar).
- Déprécation deprecate-then-remove (pas de rollback brutal — l'existant tourne jusqu'au cutover).

---

## Section 3 — Approche recommandée

**Option 1 — Direct Adjustment (hybride : superseder + re-scoper + ajouter)**, en deprecate-then-remove.

- **Rollback** (Option 2) : non — on ne revert pas 1.2 ; on la laisse `done` et on migre via nouvelles stories.
- **MVP review** (Option 3) : N/A — périmètre MVP inchangé (même résultat fonctionnel).

**Effort** : **élevé** (surtout 1.15/SPI) · **Risque** : moyen (inversion backend + dépréciation large) ·
**Timeline** : +3 stories dont une lourde.

**Séquencement** : **1.13 + 1.15** (parallélisables) → **1.14** (cutover front + dépréciation) → retrait
de `POST /v1/auth/customer/register` quand trafic = 0.

---

## Section 4 — Propositions de changement détaillées (appliquées)

> Appliquées sur la branche `docs/correct-course-adr-0018` après approbation d'Ismael (mode incrémental).

- **EP-1** — `epics.md` + `sprint-status.yaml` : bandeau « superseded par ADR-0018 » sur Story 1.2 (reste `done`, non rouverte).
- **EP-2** — `epics.md` : bandeau re-scope Story 1.6 (vérification native KC ; réduite aux pages gating + redirect).
- **EP-3** — `epics.md` + `sprint-status.yaml` : NEW **Story 1.13** (provisioning realm : default-role, IdP Google/Microsoft, Terms, champ marketing).
- **EP-4** — `epics.md` + `sprint-status.yaml` : NEW **Story 1.14** (initiate-register + redirect front + déprécation form/endpoint/contracts ; dépend 1.13+1.15).
- **EP-5** — `epics.md` + `sprint-status.yaml` : NEW **Story 1.15** (SPI Keycloak → NATS → identity-svc réactif ; remplace dual-write 1.2b).
- **EP-6** — `sprint-status.yaml` : entrées 1.13 `ready-for-dev` / 1.14 `backlog` / 1.15 `ready-for-dev` + total Epic 1 (15/14 actives).

---

## Section 5 — Handoff d'implémentation

**Scope : Major** → PO/DEV + Architect ponctuel + SM.

| Rôle | Responsabilité |
|---|---|
| **SM (Bob)** | Drafter les fichiers détaillés des Stories 1.13/1.14/1.15 via `*draft` ; re-écrire la Story 1.6 re-scopée. |
| **Architect (Winston)** | Consulté sur le design du **SPI Keycloak → NATS** (event mapping, idempotence, build jar) si besoin avant 1.15. |
| **DEV (Amelia)** | Implémenter 1.13 + 1.15 (parallèle), puis 1.14 (cutover), puis retrait endpoint. |
| **Platform/Infra** | Provisionner Google/Microsoft IdP (secrets), intégrer le SPI dans le build thème. |

**Critères de succès** :
- Self-registration Keycloak themée fonctionnelle, rôle `client` auto-assigné, CGU + marketing capturés.
- `user_profile` créé réactivement sur événement KC (idempotent), dual-write 1.2b retiré.
- Login social Google/Microsoft opérationnel.
- Form local + `POST /v1/auth/customer/register` + contracts `register-customer` retirés sans régression.
- Story 1.6 réduite au flow natif KC + pages gating FR17.

---

*Fin du Sprint Change Proposal ADR-0018 — 2026-05-25.*
