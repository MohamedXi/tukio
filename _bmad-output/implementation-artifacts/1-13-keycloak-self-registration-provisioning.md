# Story 1.13: Provisioning realm Keycloak pour self-registration + social IdP

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> 🆕 **Story créée le 2026-05-25** via `/bmad-create-story`, suite au `/bmad-correct-course` d'**ADR-0018** (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-25-adr-0018.md`). Première brique de la bascule inscription → Keycloak hostée. **Débloque** Story 1.14 (redirect front). Réalisable en parallèle de Story 1.15.

## Story

**As a** plateforme Tukio,
**I want** que le realm Keycloak `tukio` permette une auto-inscription themée — rôle assigné, CGU, consentement marketing, et login social Google/Microsoft,
**so that** l'inscription puisse basculer du formulaire local sur la page Keycloak hostée (Stories 1.14/1.15), cohérente avec le login.

## Acceptance Criteria

1. **Given** le realm `tukio`, **When** un utilisateur s'auto-inscrit (self-registration), **Then** le rôle `client` lui est assigné automatiquement — en composant `client` dans le composite `default-roles-tukio` (versionné dans `infra/keycloak/realm-config/` + appliqué idempotemment par `bootstrap-keycloak-realm.sh`).
2. **Given** la page `register.ftl` (thème `tukio`, existante), **When** elle s'affiche, **Then** elle inclut un champ **consentement marketing** (case opt-in, non cochée par défaut, label i18n FR/EN) mappé sur l'attribut user `marketing_consent` (déclaré dans le user-profile Keycloak / via mapper), et la **required-action native « Terms and Conditions »** est activée (CGU obligatoires à l'inscription).
3. **Given** les identity providers, **When** un utilisateur choisit « Continuer avec Google » ou « Continuer avec Microsoft » sur la page d'inscription/login, **Then** le brokering Keycloak fonctionne (boutons IdP rendus par `register.ftl`/`login.ftl`, `client_id`/`secret` lus depuis les secrets — pattern Story 1.1) ; **Apple est explicitement différé** (pas dans cette story).
4. **Given** `infra/keycloak/realm-config/*` + `bootstrap-keycloak-realm.sh`, **When** on bootstrappe un realm vierge OU qu'on ré-applique sur un realm existant, **Then** la config (default-role `client`, IdP, required-action Terms, attribut `marketing_consent`) est **idempotente** (GET-then-create/update, pattern existant du script).
5. **Given** `smoke-test-keycloak-realm.sh`, **When** il tourne, **Then** il **assert** : `default-roles-tukio` contient `client`, la required-action Terms est `enabled`, les IdP `google`+`microsoft` existent, et l'attribut `marketing_consent` est déclaré.

## Tasks / Subtasks

- [ ] **Task 1 — Default role `client`** (AC: 1, 4)
  - [ ] Composer `client` dans `default-roles-tukio` (réalm). Versionner dans `infra/keycloak/realm-config/roles.json` (composite) ou via une commande kcadm dédiée dans `bootstrap-keycloak-realm.sh` (pattern `kcadm` ligne ~302-311).
  - [ ] Vérifier qu'un user auto-inscrit reçoit `client` (et NON `pro` — invariant ADR-0017).
- [ ] **Task 2 — CGU + consentement marketing** (AC: 2, 4)
  - [ ] Activer la required-action `TERMS_AND_CONDITIONS` (realm-base.json `requiredActions` + bootstrap).
  - [ ] Déclarer l'attribut user `marketing_consent` (declarative user profile Keycloak) ; ajouter le champ checkbox dans `infra/keycloak/themes/tukio/login/register.ftl` (+ messages i18n FR/EN du thème).
  - [ ] Rebuild du jar thème via `infra/scripts/build-keycloak-themes.sh`.
- [ ] **Task 3 — Social IdP Google + Microsoft** (AC: 3, 4)
  - [ ] Provisionner les IdP `google` et `microsoft` via kcadm dans le bootstrap (`identity-provider/instances`), `clientId`/`clientSecret` lus depuis les secrets (pattern secret files Story 1.1 / provision-secrets).
  - [ ] Versionner la config IdP (sans secrets) dans `infra/keycloak/realm-config/` (nouveau `identity-providers.json` ou section dédiée).
  - [ ] S'assurer que `register.ftl`/`login.ftl` rendent les boutons IdP (`social.providers`).
  - [ ] **Apple différé** — documenter, ne pas implémenter.
- [ ] **Task 4 — Smoke test** (AC: 5)
  - [ ] Étendre `infra/scripts/smoke-test-keycloak-realm.sh` : assertions default-role `client`, Terms required-action enabled, IdP google+microsoft présents, attribut `marketing_consent` déclaré.

## Dev Notes

### Contexte réel (lu dans le code)

- **Realm déjà prêt côté flags** : `infra/keycloak/realm-config/realm-base.json` (et `realm-export/tukio.realm.json`) → `registrationAllowed: true`, `verifyEmail: true`, `registrationEmailAsUsername: true`, `loginTheme: tukio`. Pas besoin de les changer.
- **Realm-config splitté** : `infra/keycloak/realm-config/{realm-base.json, roles.json, protocol-mappers.json, authentication-flows/, client-scopes/, clients/}`. `roles.json` définit `client`/`pro`/`admin-*` (pas de composite default-roles visible → à ajouter).
- **Bootstrap via kcadm** : `infra/scripts/bootstrap-keycloak-realm.sh` exécute `kcadm` dans le conteneur (`docker exec`), pattern create-or-update idempotent (realm `:281-286`, roles `:302-311`, flows `:322-330`). **Ajouter ici** : composition default-role, IdP, required-action.
- **Thème** : `infra/keycloak/themes/tukio/login/register.ftl` existe (form firstName/lastName/email/username/password) mais **sans** champ terms/marketing → à étendre. Build : `infra/scripts/build-keycloak-themes.sh` → `dist/tukio-keycloak-themes.jar`.
- **Secrets** : suivre le pattern Story 1.1 (secret files / provision-secrets) pour `GOOGLE_CLIENT_SECRET` / `MICROSOFT_CLIENT_SECRET` — **jamais commiter de secret**.

### Ne pas faire

- Pas d'Apple (différé). Pas de modification du flow login (Story 1.4, livré). Pas de rôle `pro` à l'inscription (invariant ADR-0017).

### Project Structure Notes

- Réutilise l'arbo `infra/keycloak/realm-config/` + le script bootstrap idempotent. Nouveau fichier probable : `infra/keycloak/realm-config/identity-providers.json` (config IdP sans secrets).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` #Story 1.13]
- [Source: `docs/adr/0018-registration-keycloak-hosted-social-idp.md` #Decision pt.3, pt.5, pt.6 + Implementation Notes]
- [Source: `infra/keycloak/realm-config/realm-base.json`, `roles.json`] — flags realm + rôles.
- [Source: `infra/scripts/bootstrap-keycloak-realm.sh:281-330`] — pattern kcadm idempotent.
- [Source: `infra/keycloak/themes/tukio/login/register.ftl`] — form à étendre.
- [Source: `infra/scripts/smoke-test-keycloak-realm.sh`] — assertions realm.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
