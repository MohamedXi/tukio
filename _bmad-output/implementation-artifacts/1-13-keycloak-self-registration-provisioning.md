# Story 1.13: Provisioning realm Keycloak pour self-registration + social IdP

Status: in-progress

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

claude-opus-4-7[1m] (dev-story, 2026-05-25)

### Debug Log References

- Static validation (sans Keycloak live) : `python3 -m json.tool` OK sur `realm-base.json` + `identity-providers.json` ; `bash -n` OK sur `bootstrap-keycloak-realm.sh`, `smoke-test-keycloak-realm.sh`, `provision-secrets.sh`.
- **Validation LIVE via CI (job « Keycloak realm smoke »)** — itération 1 : T9 (default-role client) ✅, T10 (TERMS enabled+default) ✅, T11 (IdP skip) ⏭️ → **mes blocs 1.13 validés live**. MAIS T5 (test existant Story 1.1) ❌ : `TERMS_AND_CONDITIONS` en `defaultAction: true` est ré-ajouté par Keycloak aux users Admin-API **même avec `requiredActions:[]` au create** → bloque le password-grant de T5. **Fix (itération 2)** : T5 purge les `requiredActions` du user smoke (PUT) avant le grant. Re-run CI.
- ⚠️ **Effet de bord interim** : tant que l'inscription customer passe par l'Admin API (Story 1.2, avant cutover 1.14), les users créés auront `TERMS_AND_CONDITIONS` pending → page CGU redondante au 1er login Authorization-Code (le form Tukio capture déjà `acceptTerms`). Non-bloquant pour le flow réel (seul le password-grant est dur-bloqué, non utilisé par les customers). Optionnel : `keycloakAdmin.createUser` pourrait purger `requiredActions` post-création — acceptable jusqu'au cutover 1.14.

### Completion Notes List

> ⚠️ **Implémenté + validé STATIQUEMENT, validation LIVE en attente** (pas de Keycloak en cours d'exécution — accord Ismael « implémenter config now, différer validation »). Les cases Tasks restent décochées tant que `smoke-test-keycloak-realm.sh` n'a pas tourné vert contre un realm réel. Statut : `in-progress`.

**Implémenté :**
- **Task 1 (default-role)** : bloc bootstrap `kcadm add-roles --rname default-roles-tukio --rolename client` (idempotent). Assertion smoke-test T9.
- **Task 2 (CGU + marketing)** : `realm-base.json` → `requiredActions` `TERMS_AND_CONDITIONS` (enabled + defaultAction) ; `register.ftl` → checkbox `user.attributes.marketing_consent` + clé i18n `marketingConsent` (fr/en) ; bloc bootstrap GET-modify-PUT `users/profile` pour déclarer l'attribut `marketing_consent` (préserve les attributs managés). Assertion smoke-test T10.
- **Task 3 (IdP)** : `identity-providers.json` (Google + Microsoft, secrets via `$VAR`) + bloc bootstrap (substitution python des `$VAR`, **skip si secrets absents**) ; clés `provision-secrets.sh` (google/microsoft client id/secret). Assertion smoke-test T11 (conditionnelle). **Apple différé.**
- **Task 4 (smoke-test)** : T9 (default-role client) + T10 (Terms) + T11 (IdP, conditionnel).

**Prérequis externes Ismael (bloquants pour la validation live de l'IdP) :**
- Enregistrer les apps OAuth : **Google Cloud Console** (Web client) + **Azure Entra ID** (app registration). Redirect URI : `https://auth.tukio.one/realms/tukio/broker/{google|microsoft}/endpoint`.
- `provision-secrets.sh apps` → renseigner `google_client_id/secret`, `microsoft_client_id/secret`.

**Validation live à exécuter (Ismael) :** `pnpm docker:up:wait && pnpm docker:bootstrap` puis `smoke-test-keycloak-realm.sh` → vérifier T9/T10/T11 verts + rebuild thème (`infra/scripts/build-keycloak-themes.sh`) pour le champ marketing + tester un self-register (rôle `client` + CGU + checkbox marketing persistée).

**À reconfirmer en live :** schéma déclaratif user-profile (`marketing_consent` permissions) ; provider IdP Microsoft (`microsoft` vs `oidc` générique selon version KC) ; `add-roles` idempotence exacte.

### File List

- `infra/keycloak/realm-config/realm-base.json` (M) — requiredActions TERMS_AND_CONDITIONS
- `infra/keycloak/realm-config/identity-providers.json` (NEW) — Google + Microsoft IdP (secrets via env)
- `infra/keycloak/themes/tukio/login/register.ftl` (M) — checkbox marketing_consent
- `infra/keycloak/themes/tukio/login/messages/messages_fr.properties` (M) — clé marketingConsent
- `infra/keycloak/themes/tukio/login/messages/messages_en.properties` (M) — clé marketingConsent
- `infra/scripts/bootstrap-keycloak-realm.sh` (M) — default-role + IdP + user-profile blocks + secret reads
- `infra/scripts/provision-secrets.sh` (M) — clés google/microsoft client id/secret
- `infra/scripts/smoke-test-keycloak-realm.sh` (M) — assertions T9/T10/T11

### Change Log

- 2026-05-25 — Implémentation config (Tasks 1-4) + validation statique. Validation live + creds IdP externes en attente (Ismael). Statut `in-progress`.
