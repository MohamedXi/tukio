# Story 1.15: Création réactive de `user_profile` sur événement d'inscription Keycloak

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> 🆕 **Story créée le 2026-05-25** via `/bmad-create-story` (ADR-0018, cf. `sprint-change-proposal-2026-05-25-adr-0018.md`).
>
> ✅ **Design simplifié vs le correct-course** : ce n'est **PAS** un SPI Keycloak Java de zéro. Story 1.1 a déjà adopté **Phasetwo Webhooks Extension** (`quay.io/phasetwo/phasetwo-keycloak`) — `bootstrap-keycloak-realm.sh` configure déjà un webhook `LOGIN_ERROR → identity-svc` (HMAC `X-Tukio-Signature`). On **réutilise ce mécanisme** : abonner le webhook à l'event `REGISTER` + bâtir le récepteur identity-svc. (Le « SPI Java » du README `infra/keycloak/spi` est le Plan B non retenu.)

## Story

**As a** identity-svc,
**I want** créer le `user_profile` en **réaction** à l'inscription Keycloak (au lieu de l'orchestrer en dual-write synchrone),
**so that** l'auto-inscription Keycloak (Story 1.13/1.14) reste la source de vérité tout en peuplant la base Tukio, sans duplication de logique d'identité.

## Acceptance Criteria

1. **Given** le webhook Phasetwo du realm `tukio` (déjà configuré pour `LOGIN_ERROR` dans `bootstrap-keycloak-realm.sh:526+`), **When** on l'étend, **Then** il est abonné aux events **`REGISTER`** (self-registration) et **`IDENTITY_PROVIDER_FIRST_LOGIN`** (premier login social Google/Microsoft) → `POST IDENTITY_SVC_WEBHOOK_URL` (`/internal/keycloak-events`) avec header HMAC-SHA256 `X-Tukio-Signature`.
2. **Given** un NOUVEAU contrôleur identity-svc `POST /internal/keycloak-events`, **When** il reçoit un event, **Then** il **vérifie la signature HMAC** (`KEYCLOAK_WEBHOOK_SECRET`) avant tout traitement ; signature invalide → 401, jamais de side-effect.
3. **Given** un event `REGISTER` (ou first social login) valide, **When** identity-svc le traite, **Then** il crée le `user_profile` (rôle `client`, `locale`, `marketing_consent` lu de l'attribut KC) + écrit l'**outbox** `user-registered.v1` — **remplaçant** le dual-write synchrone de `register-customer.usecase.ts` (`keycloakAdmin.createUser` + save). Les champs `acquisition*` de `user-registered.v1` sont **null** (ADR-0018 abandonne l'UTM à l'inscription).
4. **Given** la redélivrance possible des webhooks Keycloak/Phasetwo, **When** le même event arrive 2×, **Then** le traitement est **idempotent** (dédup sur l'`id` d'event KC ou `keycloakUserId` — pattern inbox `@tukio/messaging` / table dédup) ; un seul `user_profile` + un seul event outbox.
5. **Given** `user-profile.aggregate.ts` (champs registration ajoutés par la migration Story 1.2b), **When** on réconcilie, **Then** les champs nécessaires sont peuplés depuis l'event KC ; `marketing_consent` est persisté (colonne user_profile ou attribut) ; les champs orphelins (acquisition) sont mis à null/optionnels.
6. **Given** tests, **When** ils tournent, **Then** : (a) unit du vérificateur HMAC + du handler REGISTER, (b) intégration testcontainer (PG + NATS) du consumer → `user_profile` + outbox, (c) idempotence (double delivery), (d) signature invalide rejetée.

## Tasks / Subtasks

- [ ] **Task 1 — Abonner le webhook Phasetwo à REGISTER** (AC: 1)
  - [ ] Étendre la section Phasetwo de `bootstrap-keycloak-realm.sh:526+` : ajouter `REGISTER` + `IDENTITY_PROVIDER_FIRST_LOGIN` aux `eventTypes` du webhook (GET-then-PUT idempotent, pattern P-M7 existant).
- [ ] **Task 2 — Récepteur webhook identity-svc** (AC: 2, 3, 4)
  - [ ] NEW `apps/identity-svc/src/infrastructure/http/controllers/keycloak-events.controller.ts` : `POST /internal/keycloak-events`, vérif HMAC `X-Tukio-Signature` (réutiliser un guard / util, cf. `internal-service.guard.ts` pour le pattern HMAC interne).
  - [ ] Use case `CreateUserProfileFromKeycloakEvent` (Pretre) : map event → `UserProfile.register(...)` (rôle client) + outbox `user-registered.v1` via `OutboxPublisher` (`@tukio/messaging`), dans une transaction (pattern Story 0.7).
  - [ ] Dédup idempotente (table inbox ou contrainte unique `keycloak_user_id`).
- [ ] **Task 3 — Lire `marketing_consent` + locale** (AC: 3, 4)
  - [ ] Extraire `marketing_consent` (attribut KC, Story 1.13) + `locale` de l'event ; persister sur `user_profile`. Acquisition → null.
- [ ] **Task 4 — Retrait du dual-write synchrone** (AC: 3) — _coordonné avec Story 1.14 (cutover)_
  - [ ] Marquer `register-customer.usecase.ts` (`keycloakAdmin.createUser` + save synchrone) comme remplacé par le flux réactif ; le retrait effectif se fait avec la dépréciation de l'endpoint (Story 1.14).
- [ ] **Task 5 — Tests** (AC: 6)
  - [ ] Unit HMAC + handler ; intégration testcontainer PG+NATS (`@tukio/testing`) ; idempotence ; signature invalide → 401.

## Dev Notes

### Contexte réel (lu dans le code) — design Phasetwo webhook

- **Phasetwo déjà en place** : `bootstrap-keycloak-realm.sh` configure le webhook `LOGIN_ERROR → identity-svc` (`:526+`), avec `KEYCLOAK_WEBHOOK_SECRET` (`:60,109`), `IDENTITY_SVC_WEBHOOK_URL` = `…/internal/keycloak-events` (`:63,122`), header HMAC `X-Tukio-Signature`. Doc : `infra/keycloak/spi/README.md` (Phasetwo, pas de SPI Java au MVP).
- **Récepteur à CRÉER** : aucun `/internal/keycloak-events` aujourd'hui (contrôleurs identity-svc = `customer`, `health`, `pro`, `user`). C'est le cœur de cette story.
- **Dual-write actuel à remplacer** : `apps/identity-svc/src/usecases/register-customer.usecase.ts` — `keycloakAdmin.createUser(...)` (`:122`) puis `UserProfile.register(...)` + `txn.eventPublisher.publish(userRegisteredEvent)` (`:156,186`). En réactif, c'est Keycloak qui crée l'user ; identity-svc ne fait QUE le `user_profile` + outbox.
- **Event existant** : `packages/contracts/src/events/identity/user-registered.v1.ts` (`{ userId, email, role:'client', locale, acquisition* }`). Acquisition → null (ADR-0018). `marketing_consent` à ajouter (payload ou colonne user_profile).
- **Messaging** : `@tukio/messaging` exporte `OutboxPublisher` + `INBOX_CONSUMER` ; migration `1715210000000-AddOutboxInboxTables` présente côté identity-svc. HMAC interne : pattern `internal-service.guard.ts`.

### Décision de design (importante)

**Phasetwo webhook**, pas de SPI Java. Cohérent avec Story 1.1 (LOGIN_ERROR bridge), réutilise l'infra existante, reste 100 % TypeScript côté Tukio. → Effort **modéré** (et non « SPI Java de zéro » comme l'esquissait le correct-course).

### Project Structure Notes

- NEW : `keycloak-events.controller.ts` + use case `create-user-profile-from-keycloak-event.usecase.ts` (Pretre : usecase orchestre domain + ports) + dédup.
- Réconcilier `user-profile.aggregate.ts` + migration `marketing_consent` si colonne.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` #Story 1.15]
- [Source: `docs/adr/0018-registration-keycloak-hosted-social-idp.md` #Consequences (backend inversion) + Implementation Notes]
- [Source: `infra/keycloak/spi/README.md`] — Phasetwo Webhooks (pas de SPI Java au MVP).
- [Source: `infra/scripts/bootstrap-keycloak-realm.sh:526+`] — webhook Phasetwo existant à étendre (REGISTER).
- [Source: `apps/identity-svc/src/usecases/register-customer.usecase.ts:122,156,186`] — dual-write à remplacer.
- [Source: `packages/contracts/src/events/identity/user-registered.v1.ts`] — event payload.
- [Source: `apps/identity-svc/src/infrastructure/http/guards/internal-service.guard.ts`] — pattern HMAC interne.
- Dépendances : Story 1.13 (attribut `marketing_consent` + default-role) ; cutover avec Story 1.14.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
