# Story 5.10: Notification preferences MVP minimal — closes Epic 5 MVP 10/10 (FR118, NFR1, NFR50, NFR54, NFR82, NFR83)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As a** Customer ou Pro authentifié sur Tukio,
**I want** **configurer mes préférences de notification minimales MVP** sur la page `/fr/account/notifications` (ou `/en/...`) — (1) opt-out emails marketing Tukio (default `false` — RGPD strict, opt-in required) + (2) fréquence digest messages chat (radio `immediate | 5-min digest | hourly digest` — Story 5.4 baseline FR123 5-min default modifiable) + (3) info read-only que les notifications transactionnelles critiques (booking, paiement, sécurité Stripe webhooks, password reset, account deletion) sont **toujours envoyées sans opt-out possible** (FR119 strict — security/compliance enforced),
**So that** je **ne suis pas spammé par les emails marketing** tout en restant informé des notifications critiques business — la **granularité fine per channel × per type** (in-app cloche + push web + SMS V1 + transactional per-type opt-in) est **déférée V1+ Story 11.4** (Story 5.10 MVP minimal opt-out marketing + digest frequency only — pas blocking pour MVP launch) — Tukio respecte **RGPD strict** (NFR1 — opt-in marketing required + opt-out instantané + Brevo contact list sync < 24h cron — V1+ Epic 16 livre cron full, Story 5.10 MVP livre persistence + STUB cron).

Story 5.10 livre :

- (a) **Page Next.js `/{locale}/account/notifications`** dans `apps/public/src/app/[locale]/(authenticated)/account/notifications/page.tsx` NEW (Server Component fetch initial preferences via `getCurrentUserPreferences()` + Client Component `<NotificationPreferencesFormClient>` hydrate) :
  - **Section "Communication marketing"** : `<Checkbox>` Story 0.4 atom "Recevoir les emails marketing Tukio (offres, nouveautés, conseils Pros)" + default `false` (RGPD strict opt-in required) + help text "Vous pouvez vous désinscrire à tout moment. Lien désinscription dans chaque email marketing (NFR59 Story 5.4 baseline footer disabled transactionnels)."
  - **Section "Notifications messages chat"** : `<RadioGroup>` Story 0.4 atom 3 options :
    - `immediate` "Immédiat — chaque message reçu déclenche un email instantané"
    - `5-min digest` default — Story 5.4 baseline FR123 — "Regroupement 5 min (recommandé)"
    - `hourly digest` "Regroupement horaire (1 email max/heure)"
  - **Section read-only info** `<Alert variant="info">` "Les notifications transactionnelles critiques (confirmation de réservation, paiement, sécurité du compte) sont toujours envoyées par email. Cette catégorie ne peut pas être désactivée (FR119)."
  - **CTA** `<Button variant="primary">` "Enregistrer mes préférences" — disabled si pas de changement (compare state vs initial)
  - **Layout** : `<AccountLayout>` Story 1.8 baseline pour Customer + `<SellerLayout>` Story 2.x baseline pour Pro côté `seller.tukio.one/seller/notifications` (mirror page)

- (b) **Gateway-api `PATCH /v1/me/notification-preferences` endpoint NEW** :
  - Controller `apps/gateway-api/src/users/users.controller.ts` Story 1.8 baseline EXTEND avec `@Patch('/me/notification-preferences')`
  - `@UseGuards(KeycloakJwtGuard)` Story 1.4 baseline (any authenticated user)
  - `@Throttle({ updatePreferences: { limit: 10, ttl: 60_000 } })` (anti-spam — 10 updates/min max)
  - DTO Zod `{ marketingOptIn: boolean, messagesDigestFrequency: 'immediate' | '5-min digest' | 'hourly digest' }`
  - Forwarder `UpdateNotificationPreferencesForwarderUseCase` Story 1.2c pattern → PATCH `/internal/users/:id/notification-preferences` identity-svc (HMAC body-sha256 Story 1.2b)
  - Response envelope ADR-014 `200 { method: 'PATCH', code: 200, data: { marketingOptIn, messagesDigestFrequency, updatedAt }, meta }`

- (c) **identity-svc EXTEND** (Story 1.10 baseline réutilisé) :
  - Migration `<ts>-AddNotificationPreferencesToUserProfiles.ts` (NFR83 backward-compatible) :
    ```sql
    ALTER TABLE user_profiles
      ADD COLUMN marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN messages_digest_frequency VARCHAR(20) NOT NULL DEFAULT '5-min digest'
        CHECK (messages_digest_frequency IN ('immediate', '5-min digest', 'hourly digest'));
    ```
  - **`UserProfile` aggregate Story 1.2a/1.10 baseline EXTEND** : add 2 fields + `updateNotificationPreferences(marketingOptIn, messagesDigestFrequency)` mutation method + invariants (frequency must be valid enum + marketingOptIn boolean strict)
  - **NEW `UpdateNotificationPreferencesUseCase`** dans `apps/identity-svc/src/usecases/` (4 steps : fetch UserProfile by userId + mutate aggregate + save + outbox publish `identity.notification-preferences-updated.v1`)
  - **NEW endpoint `PATCH /internal/users/:id/notification-preferences`** dans `apps/identity-svc/src/infrastructure/controllers/internal-users.controller.ts` Story 1.10 baseline EXTEND + `InternalServiceGuard` HMAC
  - **NEW event schema `identity.notification-preferences-updated.v1`** `packages/contracts/src/events/identity/notification-preferences-updated.v1.{schema.json,ts}` strict Zod `{ userId, marketingOptIn, messagesDigestFrequency, updatedAt, correlationId }`

- (d) **notification-svc Story 5.4 baseline EXTEND** (consume `messagesDigestFrequency` for FR123 logic) :
  - **`AggregateMessageForDigestUseCase` Story 5.4 baseline EXTEND** : avant de queue digest dans Redis, fetch recipient's `messagesDigestFrequency` via cross-svc `IUserPreferencesPort` NEW (read from identity-svc cache Redis 5min OR snapshot denormalized — pragmatic MVP : Redis cache lookup with 5min TTL, cross-svc fetch on miss)
  - **Logic conditional** :
    - `frequency === 'immediate'` → bypass digest queue + invoke `SendEmailNotificationUseCase` directly avec template `messages-immediate-notification.{fr,en}.tsx` NEW (12ème template Story 5.4 baseline EXTEND — 24 fichiers totale post-Story 5.10) + emit `messaging.message.sent.v1` consumer flow standard
    - `frequency === '5-min digest'` (default) → existing Story 5.4 baseline flow (Redis INCR + flush cron 5min)
    - `frequency === 'hourly digest'` → similar Redis pattern mais clé `digest:pending-hourly:<recipientId>` + NEW cron `flush-digest-hourly.task.ts @Cron('0 * * * *')` (every hour top of hour) — Story 5.10 livre cron baseline
  - **NEW `IUserPreferencesPort`** domain port + impl `UserPreferencesCachedAdapter` (Redis 5min TTL cache + cross-svc HTTP fetch on miss via `GET /internal/users/:id/snapshot` Story 1.10 baseline EXTEND avec preferences fields)

- (e) **NEW consumer `identity-notification-preferences-updated-consumer.handler.ts`** dans `apps/notification-svc/src/infrastructure/messaging/` Story 5.4 baseline EXTEND :
  - `@EventPattern('identity.notification-preferences-updated.v1')` + InboxConsumer Story 0.7 dedup
  - Invalidate Redis cache `user:preferences:<userId>` (force re-fetch fresh sur prochaine digest tick)
  - Pas de logic supplémentaire — cache invalidation suffit

- (f) **NEW 12ème template `messages-immediate-notification.{fr,en}.tsx`** Story 5.4 baseline EXTEND :
  - Template React Email + 7 shared components Story 5.4 baseline réutilisés
  - Subject "Nouveau message de {senderFirstName}" / "New message from {senderFirstName}"
  - Body : `<BodyText>` "Vous avez reçu un nouveau message via Tukio." + sender display name + preview snippet 80 chars + CTA "Voir la conversation" `/account/messages/<conversationId>`
  - UPDATE `apps/notification-svc/src/templates/registry.ts` Story 5.4 baseline boot validation — 12 templates × 2 locales = 24 fichiers totale post-Story 5.10
  - UPDATE `apps/notification-svc/src/messages/{fr,en}/emails.json` Story 5.4 baseline — add namespace `messages_immediate_notification` ~8 strings × 2 locales

- (g) **Story 2.7 `audit_log` Story 1.10 baseline consumer EXTEND** : consume `identity.notification-preferences-updated.v1` + INSERT audit row `{ actorId, action: 'notification-preferences-updated', aggregateId: userId, before: {...}, after: {...}, correlationId }` — Story 1.10 audit_log pattern réutilisé (immutable trigger Postgres baseline)

- (h) **STUB event schema `marketing.campaign-send.v1` V1+ reserved** dans `packages/contracts/src/events/marketing/campaign-send.v1.{schema.json,ts}` :
  - STUB only — pas émis MVP (Epic 16 V1+ livre actual marketing campaign infrastructure)
  - notification-svc Story 5.10 livre **stub consumer** `marketing-campaign-send-consumer.handler.ts` STUB skeleton (just logs warning + throws "Not implemented MVP — V1+ Epic 16") — quand Epic 16 livre, ce consumer EXTEND avec SKIP logic `marketingOptIn === false`
  - Reserved : marketing-svc NEW service V1+ (out of scope MVP)

- (i) **Brevo sync cron V1+ deferred + STUB documentation** :
  - Story 5.10 livre **STUB cron** `apps/identity-svc/src/infrastructure/scheduling/sync-marketing-preferences-brevo.task.ts` `@Cron('0 4 * * *')` daily 4am Europe/Paris — **logs only MVP** + TODO marker "V1+ Epic 16 livre actual Brevo API sync"
  - Runbook `docs/runbook/brevo-marketing-sync-v1.md` NEW — documente V1+ implementation plan (Brevo API key + contact list update + batched 1000 contacts/tick + retry exp)
  - Pourquoi STUB MVP : Brevo intégration coûteuse (€39/mois Lite tier post free 300 contacts) + Epic 16 V1+ livre full marketing infrastructure — Story 5.10 MVP livre persistence + STUB cron sufficient pour FR118 compliance MVP launch

- (j) **2 NEW frontend hooks `@tukio/api-client/hooks/users/`** :
  - `useGetCurrentUserPreferences()` `useQuery` `GET /v1/me/notification-preferences` (fetch from JWT) — staleTime 30s (faible — user might toggle then return to page)
  - `useUpdateNotificationPreferences()` `useMutation` PATCH `/v1/me/notification-preferences` + invalidate `useGetCurrentUserPreferences` cache + success toast Story 0.4 atom

- (k) **i18n FR/EN ~15 strings** dans `apps/public/messages/{fr,en}/customer.json` + `apps/seller/messages/{fr,en}/seller.json` namespace `notification_preferences` :
  - `notification_preferences.page_title` "Préférences de notification" / "Notification preferences"
  - `notification_preferences.section_marketing.title` "Communication marketing"
  - `notification_preferences.section_marketing.checkbox_label` "Recevoir les emails marketing Tukio"
  - `notification_preferences.section_marketing.help` "Offres, nouveautés, conseils Pros. Vous pouvez vous désinscrire à tout moment via le lien dans chaque email."
  - `notification_preferences.section_messages.title` "Notifications messages chat"
  - `notification_preferences.section_messages.help` "Comment recevoir les emails quand un Pro / Customer vous écrit."
  - `notification_preferences.frequency.immediate` "Immédiat (chaque message reçu)"
  - `notification_preferences.frequency.5min` "Regroupement 5 min (recommandé)"
  - `notification_preferences.frequency.hourly` "Regroupement horaire (1 email max/heure)"
  - `notification_preferences.section_transactional.title` "Notifications critiques"
  - `notification_preferences.section_transactional.info` "Les notifications transactionnelles critiques (confirmation de réservation, paiement, sécurité du compte) sont toujours envoyées par email. Cette catégorie ne peut pas être désactivée (FR119)."
  - `notification_preferences.cta_save` "Enregistrer mes préférences"
  - `notification_preferences.success_toast` "Préférences enregistrées"
  - `notification_preferences.error_toast` "Erreur, réessayez"
  - `notification_preferences.full_granularity_v1_note` "La gestion fine par type de notification (in-app, SMS, push) arrive en V1." (info bas page tease V1+ Story 11.4)

- (l) **A11y RGAA AA** : `<Checkbox>` + `<RadioGroup>` Story 0.4 baseline ARIA + keyboard navigation arrow + `<Alert>` `role="status"` info read-only + `<Button>` disabled state + focus management after submit (success toast announced `aria-live="polite"`) + axe-core 0 violations + Lighthouse Accessibility ≥ 90

- (m) **Tests** :
  - **Playwright E2E 5 scenarios** : (1) Customer visits `/account/notifications` → form rendered avec defaults (marketingOptIn=false + 5min digest) ; (2) toggle marketingOptIn=true + submit → success toast + reload page → state persisted ; (3) change digest hourly + submit → user receives subsequent test message → hourly digest cron emits 1 email at top of hour (mock time) instead of immediate ; (4) Pro side `/seller/notifications` → same form same i18n strings ; (5) submit without change → CTA disabled
  - **axe-core 0 violations** + Lighthouse Accessibility ≥ 90
  - **Hooks unit 4 scenarios** MSW
  - **Gateway E2E 5 scenarios** PATCH endpoint (200 + 422 invalid + 401 + 429 throttle + happy path with audit event emitted)
  - **identity-svc E2E** internal endpoint 4 scenarios
  - **Usecases unit** `UpdateNotificationPreferencesUseCase` 5 scenarios (happy + invariants + outbox publish + idempotent same payload + correlation propagation)
  - **Integration testcontainer** notification-svc digest consumer 6 scenarios (immediate bypass + 5min default + hourly + cache invalidation on `identity.notification-preferences-updated.v1` + cross-svc fallback miss + Redis cache hit)
  - **Migration test** 2 scenarios (apply + revert + verify Story 1.2 existing rows backfilled DEFAULT)

> **Outcome attendu** : à la fin de cette story, un Customer authentifié sur `https://tukio.one/fr/account/notifications` → voit le form 3 sections (marketing + messages + read-only transactional info) — défaut `marketingOptIn=false` (RGPD opt-in strict) + `messagesDigestFrequency='5-min digest'` (Story 5.4 baseline FR123) ; toggle marketing → submit → toast "Préférences enregistrées" + `identity.notification-preferences-updated.v1` outbox émis + `audit_log` row inserted (Story 2.7 baseline) + Brevo sync cron STUB logs warning V1+ ; un Customer change digest hourly + envoie 5 messages chat → notification-svc consume `messaging.message.sent.v1` Story 5.3 → query cache Redis `user:preferences:<userId>` → frequency='hourly' → queue dans Redis `digest:pending-hourly:<userId>` → cron `flush-digest-hourly.task @Cron('0 * * * *')` top of hour → 1 email digest envoyé (au lieu de 5 immediates) ; lint+typecheck+test green ; Lighthouse Accessibility ≥ 90 + axe-core 0 ; `sprint-status.yaml` flip Story 5.10 = ready-for-dev → **closes Epic 5 MVP 10/10**.

## Acceptance Criteria

1. **AC1 — Frontend page `/{locale}/account/notifications` + `<NotificationPreferencesFormClient>` + Server Component** : Given `apps/public/src/app/[locale]/(authenticated)/account/notifications/page.tsx` NEW, When user visits : (a) Server Component fetch initial preferences via `@tukio/api-client/server` `getCurrentUserPreferences()` → pass to Client Component initial state ; (b) Client Component render 3 sections (marketing Checkbox + messages RadioGroup + transactional Alert info read-only) ; (c) RHF zodV4Resolver Story 1.2d pattern — schema `{ marketingOptIn: boolean, messagesDigestFrequency: enum }` ; (d) CTA disabled si state === initial (compare) ; (e) Submit → `useUpdateNotificationPreferences.mutateAsync` → success toast Story 0.4 atom + state mirror updated initial pour CTA disabled again ; (f) Mirror Pro page `/seller/notifications` `apps/seller/src/app/[locale]/seller/notifications/page.tsx` NEW. Tests Playwright E2E 4 scenarios + axe-core.

2. **AC2 — Gateway-api `PATCH /v1/me/notification-preferences` + Throttler + envelope ADR-014** : Given gateway-api Story 1.8 baseline `users.controller.ts`, When Story 5.10 EXTEND : (a) `@Patch('/me/notification-preferences')` + `@UseGuards(KeycloakJwtGuard)` + `@Throttle({ updatePreferences: { limit: 10, ttl: 60_000 } })` ; (b) Zod DTO `{ marketingOptIn: boolean, messagesDigestFrequency: 'immediate' | '5-min digest' | 'hourly digest' }` ; (c) Forwarder `UpdateNotificationPreferencesForwarderUseCase` Story 1.2c pattern → PATCH `/internal/users/:id/notification-preferences` identity-svc HMAC body-sha256 — `userId` extracted from JWT `req.user.sub` ; (d) Response envelope 200 `{ data: { marketingOptIn, messagesDigestFrequency, updatedAt }, meta }` ; (e) Errors : 422 invalid enum + 401 no JWT + 429 throttle. Tests E2E 5 scenarios.

3. **AC3 — identity-svc UserProfile aggregate EXTEND + 2 columns migration NFR83 + UpdateNotificationPreferencesUseCase NEW** : Given Story 1.2a/1.10 baseline `UserProfile`, When Story 5.10 EXTEND : (a) Migration `<ts>-AddNotificationPreferencesToUserProfiles.ts` ADD COLUMN `marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE` + `messages_digest_frequency VARCHAR(20) NOT NULL DEFAULT '5-min digest' CHECK (...)` (NFR83 backward-compatible — existing rows auto-backfilled) ; (b) `UserProfile` aggregate EXTEND avec 2 fields + `updateNotificationPreferences(marketingOptIn, messagesDigestFrequency)` mutation method + Zod-style invariants (frequency must be enum + boolean strict) ; (c) NEW `UpdateNotificationPreferencesUseCase` (4 steps : fetch + mutate + save + outbox `identity.notification-preferences-updated.v1`) ; (d) NEW endpoint `PATCH /internal/users/:id/notification-preferences` controller Story 1.10 baseline EXTEND + InternalServiceGuard HMAC + DTO Zod ; (e) Tests unit 5 scenarios + integration testcontainer 3 + migration 2.

4. **AC4 — NATS event `identity.notification-preferences-updated.v1` NEW + outbox publish + audit_log consumer Story 2.7 baseline** : Given Story 0.7 OutboxPublisher pattern, When Story 5.10 NEW event : (a) Schema `packages/contracts/src/events/identity/notification-preferences-updated.v1.{schema.json,ts}` strict Zod `{ userId UUID, marketingOptIn boolean, messagesDigestFrequency enum, updatedAt ISO, correlationId UUID }` ; (b) `UpdateNotificationPreferencesUseCase` STEP 4 outbox publish atomic transaction ; (c) Subject `identity.notification-preferences-updated.v1` ; (d) Story 2.7 baseline `audit_log` consumer EXTEND consume (Story 1.10 pattern réutilisé) → INSERT row `{ actorId: userId, action: 'notification-preferences-updated', aggregateId: userId, after: { marketingOptIn, messagesDigestFrequency }, correlationId }` ; (e) Tests Zod parse + audit consumer integration.

5. **AC5 — notification-svc digest frequency conditional logic + NEW IUserPreferencesPort + cache invalidation consumer** : Given Story 5.4 baseline `AggregateMessageForDigestUseCase`, When Story 5.10 EXTEND :
   - NEW domain port `IUserPreferencesPort.findByUserId(userId): Promise<{ marketingOptIn, messagesDigestFrequency }>` 
   - NEW adapter `UserPreferencesCachedAdapter` impl : Redis 5min TTL cache `user:preferences:<userId>` + cross-svc HTTP fetch `GET /internal/users/:id/snapshot` identity-svc Story 1.10 baseline EXTEND avec preferences fields on miss
   - `AggregateMessageForDigestUseCase` Story 5.4 EXTEND : fetch user preferences via port + conditional logic :
     - `frequency === 'immediate'` → bypass digest queue + directly invoke `SendEmailNotificationUseCase` avec NEW 12ème template `messages-immediate-notification.{locale}.tsx`
     - `frequency === '5-min digest'` (default) → existing Story 5.4 baseline flow
     - `frequency === 'hourly digest'` → Redis INCR key `digest:pending-hourly:<userId>` (distinct du 5min) + new cron flush
   - NEW cron `flush-digest-hourly.task.ts @Cron('0 * * * *')` (every hour top of hour) — Story 5.4 baseline `flush-digest-pending.task` réutilisé pattern (logic similar)
   - NEW consumer `identity-notification-preferences-updated-consumer.handler.ts` Story 5.4 baseline EXTEND — `@EventPattern('identity.notification-preferences-updated.v1')` → DEL Redis `user:preferences:<userId>` (cache invalidation — next digest tick fetches fresh)
   - Tests integration testcontainer 6 scenarios

6. **AC6 — NEW 12ème template `messages-immediate-notification.{fr,en}.tsx` Story 5.4 EXTEND + registry update 24 fichiers totale** : Given Story 5.4 baseline 11 templates × 2 locales = 22 fichiers (post-Story 5.6 + Story 5.10 ajoute 1) → 12 templates × 2 = 24 fichiers totale, When Story 5.10 :
   - NEW 2 fichiers `apps/notification-svc/src/templates/messages-immediate-notification.{fr,en}.tsx` (réutilise 7 shared components Story 5.4 baseline Header/Footer/CTAButton/Heading/BodyText/Hr/Divider)
   - Subject (FR) "Nouveau message de {senderFirstName}" / (EN) "New message from {senderFirstName}"
   - Body sender display name + preview snippet 80 chars (NO content full NFR82 — same baseline Story 5.3 pattern) + CTA "Voir la conversation" → `/account/messages/<conversationId>`
   - UPDATE `apps/notification-svc/src/templates/registry.ts` Story 5.4 baseline boot Zod validation — 12 × 2 = 24 fichiers totale
   - UPDATE `apps/notification-svc/src/messages/{fr,en}/emails.json` Story 5.4 baseline — add namespace `messages_immediate_notification` ~8 strings × 2 locales
   - Tests snapshot 2 templates HTML

7. **AC7 — STUB event `marketing.campaign-send.v1` V1+ reserved + STUB consumer notification-svc** : Given Epic 16 V1+ marketing infrastructure deferred, When Story 5.10 reserve : (a) NEW STUB schema `packages/contracts/src/events/marketing/campaign-send.v1.{schema.json,ts}` (not emitted MVP) ; (b) NEW STUB consumer `apps/notification-svc/src/infrastructure/messaging/marketing-campaign-send-consumer.handler.ts` → `@EventPattern('marketing.campaign-send.v1')` + log warning "Not implemented MVP — V1+ Epic 16" + skip ; (c) TODO marker in consumer for Epic 16 future EXTEND : check `marketingOptIn === false` SKIP logic ; (d) Documentation runbook `docs/runbook/marketing-campaigns-v1.md` NEW V1+ plan.

8. **AC8 — Brevo sync cron STUB MVP + V1+ documentation** : Given Brevo Lite tier €39/mois post free 300 contacts + Epic 16 V1+ livre full marketing : (a) NEW STUB cron `apps/identity-svc/src/infrastructure/scheduling/sync-marketing-preferences-brevo.task.ts` `@Cron('0 4 * * *')` daily 4am Europe/Paris — logs only MVP + TODO marker ; (b) NEW runbook `docs/runbook/brevo-marketing-sync-v1.md` documente V1+ : Brevo API key + contact list update + batched 1000 contacts/tick + retry exp ; (c) Pour MVP launch : `marketingOptIn === false` enforced **côté notification-svc consumer** (AC7) — Brevo lag pas critique car aucun marketing actif MVP (Epic 16 V1+).

9. **AC9 — 2 NEW frontend hooks `@tukio/api-client/hooks/users/`** : Given Story 1.8 baseline `users` hooks pattern, When Story 5.10 NEW : (a) `useGetCurrentUserPreferences()` `useQuery` GET `/v1/me/notification-preferences` + 30s staleTime + initialData SSR hydration ; (b) `useUpdateNotificationPreferences()` `useMutation` PATCH + onSuccess invalidate `['current-user-preferences']` + show toast Story 0.4 atom ; (c) Tests unit MSW 4 scenarios.

10. **AC10 — i18n FR/EN ~15 strings + zero hardcoded + tease V1+ note** : Given Story 1.2d next-intl pattern, When Story 5.10 : (a) UPDATE `apps/public/messages/{fr,en}/customer.json` + `apps/seller/messages/{fr,en}/seller.json` namespace `notification_preferences` 15 strings × 2 locales × 2 apps = 60 strings totale ; (b) tease V1+ note `full_granularity_v1_note` "La gestion fine par type de notification (in-app, SMS, push) arrive en V1." (informative — pas blocking MVP) ; (c) Verify lint no hardcoded text NFR56-57 enforced.

11. **AC11 — A11y RGAA AA + axe-core 0 violations + Lighthouse Accessibility ≥ 90** : Given Story 0.4 atoms + Story 1.2d a11y pattern, When Story 5.10 form render : (a) `<Checkbox>` `role="switch"` (or `role="checkbox"` selon Story 0.4 baseline) + aria-checked + keyboard space toggle ; (b) `<RadioGroup>` ARIA `role="radiogroup"` + 3 `<input type="radio">` + keyboard arrow Up/Down + Tab navigation ; (c) `<Alert variant="info">` `role="status"` informative read-only ; (d) `<Button disabled={isPristine}>` aria-disabled + tooltip "Aucun changement à enregistrer" si hover ; (e) Submit success → toast `aria-live="polite"` announce ; (f) Lighthouse Accessibility ≥ 90 + axe-core 0 violations sur 2 pages (public + seller). Tests Playwright + axe-core.

12. **AC12 — Coverage NFR71 maintained + tests structure complete** : Given Story 5.5 baseline coverage thresholds, When Story 5.10 :
    - **Domain unit** maintained : UserProfile aggregate EXTEND 2 fields + updateNotificationPreferences method (3 scenarios)
    - **Usecases unit** : UpdateNotificationPreferencesUseCase 5 + AggregateMessageForDigestUseCase Story 5.4 EXTEND 4 = 9
    - **Infrastructure integration testcontainer** : migration 2 + identity-svc endpoint E2E 4 + notification-svc digest consumer EXTEND 6 + cache invalidation consumer 2 + 12ème template snapshot 2 = 16
    - **Hooks frontend** 4 scenarios + Gateway E2E 5 + Playwright E2E 5 + a11y 2 = 16
    - **Total Story 5.10 : ~44 test scenarios**

## Tasks / Subtasks

- [ ] **Task 1 — identity-svc UserProfile EXTEND + migration NFR83 + UpdateNotificationPreferencesUseCase NEW** (AC: #3, #4)
  - [ ] 1.1 — NEW migration `apps/identity-svc/src/infrastructure/persistence/migrations/<ts>-AddNotificationPreferencesToUserProfiles.ts`
  - [ ] 1.2 — UPDATE `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` Story 1.2a/1.10 baseline — add 2 fields + `updateNotificationPreferences` mutation
  - [ ] 1.3 — UPDATE `apps/identity-svc/src/infrastructure/persistence/entities/user-profile.entity.ts` — add 2 columns
  - [ ] 1.4 — NEW `apps/identity-svc/src/usecases/update-notification-preferences.usecase.ts` (4 steps)
  - [ ] 1.5 — UPDATE `apps/identity-svc/src/usecases-proxy/usecases-proxy.module.ts` — add `UPDATE_NOTIFICATION_PREFERENCES_USECASES_PROXY`
  - [ ] 1.6 — NEW event schema `packages/contracts/src/events/identity/notification-preferences-updated.v1.{schema.json,ts}` strict Zod
  - [ ] 1.7 — Tests unit 5 + migration 2

- [ ] **Task 2 — identity-svc internal endpoint PATCH /internal/users/:id/notification-preferences** (AC: #3)
  - [ ] 2.1 — UPDATE `apps/identity-svc/src/infrastructure/controllers/internal-users.controller.ts` Story 1.10 baseline — add `@Patch('/:id/notification-preferences')` + InternalServiceGuard HMAC
  - [ ] 2.2 — NEW DTO `apps/identity-svc/src/infrastructure/controllers/dtos/update-notification-preferences-body.dto.ts` (Zod)
  - [ ] 2.3 — UPDATE `apps/identity-svc/src/infrastructure/controllers/internal-users.controller.ts` — extend `GET /internal/users/:id/snapshot` response avec `marketingOptIn + messagesDigestFrequency` fields (Story 5.10 AC5 consumer fallback)
  - [ ] 2.4 — Tests E2E 4 scenarios

- [ ] **Task 3 — gateway-api PATCH /v1/me/notification-preferences + Throttler** (AC: #2)
  - [ ] 3.1 — UPDATE `apps/gateway-api/src/users/users.controller.ts` Story 1.8 baseline — add `@Patch('/me/notification-preferences')`
  - [ ] 3.2 — NEW `apps/gateway-api/src/users/usecases/update-notification-preferences-forwarder.usecase.ts`
  - [ ] 3.3 — UPDATE `apps/gateway-api/src/users/clients/identity-svc.client.ts` Story 1.8 baseline — add patch method
  - [ ] 3.4 — UPDATE `apps/gateway-api/src/throttler/throttler.config.ts` — add `updatePreferences: 10/min` scope
  - [ ] 3.5 — NEW DTOs Zod request + response
  - [ ] 3.6 — Tests E2E 5 scenarios

- [ ] **Task 4 — gateway-api GET /v1/me/notification-preferences endpoint** (AC: #9)
  - [ ] 4.1 — UPDATE `users.controller.ts` add `@Get('/me/notification-preferences')` (réutilise existing user snapshot fetch)
  - [ ] 4.2 — NEW forwarder `get-current-user-preferences-forwarder.usecase.ts`
  - [ ] 4.3 — Tests E2E 2 scenarios

- [ ] **Task 5 — Frontend page /account/notifications + form + 2 hooks** (AC: #1, #9, #11)
  - [ ] 5.1 — NEW `apps/public/src/app/[locale]/(authenticated)/account/notifications/page.tsx` (Server Component initial fetch)
  - [ ] 5.2 — NEW `apps/public/src/features/notifications/components/NotificationPreferencesFormClient.tsx` (RHF zodV4Resolver + 3 sections)
  - [ ] 5.3 — NEW `packages/api-client/src/hooks/users/use-get-current-user-preferences.ts` + `use-update-notification-preferences.ts`
  - [ ] 5.4 — UPDATE `packages/api-client/src/hooks/index.ts` — export subpath
  - [ ] 5.5 — Mirror Pro page `apps/seller/src/app/[locale]/seller/notifications/page.tsx` + features mirror (pragmatic copy)
  - [ ] 5.6 — Tests Playwright E2E 5 scenarios + axe-core a11y + Lighthouse

- [ ] **Task 6 — i18n FR/EN ~15 strings × 2 locales × 2 apps = 60 strings** (AC: #10)
  - [ ] 6.1 — UPDATE `apps/public/messages/{fr,en}/customer.json` — add `notification_preferences` namespace
  - [ ] 6.2 — UPDATE `apps/seller/messages/{fr,en}/seller.json` — mirror namespace
  - [ ] 6.3 — Verify no hardcoded text lint

- [ ] **Task 7 — notification-svc digest frequency conditional logic + IUserPreferencesPort + cache invalidation** (AC: #5)
  - [ ] 7.1 — NEW `apps/notification-svc/src/domain/ports/user-preferences-port.ts` (`IUserPreferencesPort.findByUserId`)
  - [ ] 7.2 — NEW `apps/notification-svc/src/infrastructure/adapters/user-preferences-cached.adapter.ts` (Redis 5min TTL + cross-svc HTTP fallback)
  - [ ] 7.3 — UPDATE `apps/notification-svc/src/usecases/aggregate-message-for-digest.usecase.ts` Story 5.4 baseline — fetch user preferences + conditional logic 3 frequencies
  - [ ] 7.4 — NEW `apps/notification-svc/src/usecases/send-immediate-message-notification.usecase.ts` (invoke SendEmailNotificationUseCase avec template `messages-immediate-notification`)
  - [ ] 7.5 — NEW `apps/notification-svc/src/infrastructure/scheduling/flush-digest-hourly.task.ts` (`@Cron('0 * * * *')` similar to 5min flush Story 5.4 baseline)
  - [ ] 7.6 — NEW `apps/notification-svc/src/infrastructure/messaging/identity-notification-preferences-updated-consumer.handler.ts` (cache invalidation Redis DEL)
  - [ ] 7.7 — UPDATE `apps/notification-svc/src/usecases-proxy/usecases-proxy.module.ts` — add 2 new PROXY tokens
  - [ ] 7.8 — Tests integration testcontainer 6 scenarios

- [ ] **Task 8 — 12ème template `messages-immediate-notification.{fr,en}.tsx` Story 5.4 baseline EXTEND** (AC: #6)
  - [ ] 8.1 — NEW `apps/notification-svc/src/templates/messages-immediate-notification.fr.tsx`
  - [ ] 8.2 — NEW `apps/notification-svc/src/templates/messages-immediate-notification.en.tsx`
  - [ ] 8.3 — UPDATE `apps/notification-svc/src/templates/registry.ts` Story 5.4 — boot Zod validation 12 × 2 = 24 fichiers
  - [ ] 8.4 — UPDATE `apps/notification-svc/src/messages/{fr,en}/emails.json` Story 5.4 — add namespace `messages_immediate_notification` ~8 strings × 2 locales
  - [ ] 8.5 — Tests snapshot 2 templates

- [ ] **Task 9 — STUB event marketing.campaign-send.v1 V1+ reserved + STUB consumer** (AC: #7)
  - [ ] 9.1 — NEW STUB `packages/contracts/src/events/marketing/campaign-send.v1.{schema.json,ts}` (not emitted MVP)
  - [ ] 9.2 — NEW STUB `apps/notification-svc/src/infrastructure/messaging/marketing-campaign-send-consumer.handler.ts` (log warning + TODO Epic 16)
  - [ ] 9.3 — NEW runbook `docs/runbook/marketing-campaigns-v1.md` V1+ plan

- [ ] **Task 10 — Brevo sync cron STUB MVP + V1+ runbook** (AC: #8)
  - [ ] 10.1 — NEW STUB `apps/identity-svc/src/infrastructure/scheduling/sync-marketing-preferences-brevo.task.ts` `@Cron('0 4 * * *')` logs only + TODO
  - [ ] 10.2 — NEW runbook `docs/runbook/brevo-marketing-sync-v1.md`

- [ ] **Task 11 — Story 2.7 audit_log consumer EXTEND `identity.notification-preferences-updated.v1`** (AC: #4)
  - [ ] 11.1 — UPDATE Story 2.7 baseline audit_log consumer Story 1.10 pattern — add new event subscription
  - [ ] 11.2 — Tests integration 2 scenarios

- [ ] **Task 12 — Documentation + ADR updates + Epic 5 close-out documentation** (no AC — docs)
  - [ ] 12.1 — NEW `docs/runbook/notification-preferences-mvp.md` (operator manual user journey + V1+ Story 11.4 granularity tease)
  - [ ] 12.2 — NEW `docs/runbook/brevo-marketing-sync-v1.md` (Task 10.2)
  - [ ] 12.3 — NEW `docs/runbook/marketing-campaigns-v1.md` (Task 9.3)
  - [ ] 12.4 — UPDATE `docs/adr/0006-saga-choreographed.md` — note Story 5.10 ajoute event `identity.notification-preferences-updated.v1` + STUB `marketing.campaign-send.v1` V1+
  - [ ] 12.5 — UPDATE `docs/project-context.md` — extend Notifications section + tease V1+ Story 11.4 granular preferences
  - [ ] 12.6 — UPDATE `_bmad-output/implementation-artifacts/5-4-notification-svc-pretre-resend-templates.md` Completion Notes — note 12ème template + cache invalidation consumer + digest frequency conditional logic Story 5.10 EXTEND
  - [ ] 12.7 — UPDATE `_bmad-output/implementation-artifacts/1-10-identity-svc-pretre-implementation.md` Completion Notes — note UserProfile EXTEND 2 fields + UpdateNotificationPreferencesUseCase NEW + audit_log consumer EXTEND

- [ ] **Task 13 — Validation & Commit — **CLOSES EPIC 5 MVP 10/10****
  - [ ] 13.1 — `pnpm lint && pnpm typecheck` 0 errors
  - [ ] 13.2 — `pnpm test --coverage` NFR71 maintained
  - [ ] 13.3 — Tests integration testcontainer green
  - [ ] 13.4 — Playwright E2E 5 scenarios + axe-core 0 + Lighthouse ≥ 90 green
  - [ ] 13.5 — Commit `feat(identity-svc,gateway-api,notification-svc,api-client,public,seller,contracts,docs): Story 5.10 notification preferences MVP minimal FR118 + UserProfile EXTEND 2 fields + UpdateNotificationPreferencesUseCase + NEW event identity.notification-preferences-updated.v1 + Story 2.7 audit_log consumer EXTEND + gateway PATCH/GET /v1/me/notification-preferences + Throttler updatePreferences 10/min + 2 hooks @tukio/api-client + frontend page /account/notifications + Pro mirror + ~15 i18n strings × 2 locales × 2 apps + notification-svc digest frequency conditional immediate/5min/hourly + IUserPreferencesPort + UserPreferencesCachedAdapter Redis 5min TTL + 12ème template messages-immediate-notification + flush-digest-hourly cron + cache invalidation consumer + STUB marketing.campaign-send.v1 V1+ + STUB Brevo sync cron + 3 runbooks NEW + a11y RGAA AA + axe-core 0 + Lighthouse 90 — **CLOSES EPIC 5 MVP 10/10**`
  - [ ] 13.6 — PR title `Story 5.10 — Notification preferences MVP minimal — closes Epic 5 MVP` ; target `develop`

## Dev Notes

### Story 5.10 livre — closes Epic 5 MVP 10/10

**Backend (identity-svc + gateway-api + notification-svc) :**

1. **UserProfile aggregate EXTEND** 2 fields (`marketing_opt_in BOOLEAN DEFAULT FALSE` RGPD opt-in strict + `messages_digest_frequency VARCHAR DEFAULT '5-min digest'` Story 5.4 baseline + CHECK enum) + migration NFR83 backward-compatible
2. **`UpdateNotificationPreferencesUseCase` NEW** identity-svc (4 steps : fetch + mutate aggregate + save + outbox publish)
3. **NEW event `identity.notification-preferences-updated.v1`** strict Zod + audit_log consumer Story 2.7 baseline EXTEND
4. **2 gateway endpoints** : PATCH/GET `/v1/me/notification-preferences` + Throttler `updatePreferences: 10/min`
5. **notification-svc digest frequency conditional logic** : `immediate` (bypass queue + send instant via NEW 12ème template) + `5-min digest` (existing Story 5.4 baseline) + `hourly digest` (NEW Redis key + NEW cron `flush-digest-hourly @Cron('0 * * * *')`)
6. **`IUserPreferencesPort` NEW** + `UserPreferencesCachedAdapter` (Redis 5min TTL + cross-svc HTTP fallback identity-svc snapshot endpoint EXTEND)
7. **NEW consumer `identity-notification-preferences-updated-consumer.handler.ts`** notification-svc — cache invalidation Redis DEL
8. **NEW 12ème template `messages-immediate-notification.{fr,en}.tsx`** Story 5.4 baseline EXTEND — 24 fichiers totale registry boot validation update
9. **STUB event `marketing.campaign-send.v1` V1+ reserved** + STUB consumer notification-svc (log + TODO Epic 16)
10. **STUB Brevo sync cron** `sync-marketing-preferences-brevo.task.ts` identity-svc — logs MVP + V1+ Epic 16 runbook

**Frontend (public + seller) :**

1. **Page `/account/notifications`** Next.js Server Component + Client Component form RHF zodV4Resolver Story 1.2d
2. **3 sections** : marketing Checkbox + messages RadioGroup 3 options + transactional Alert info read-only
3. **2 NEW hooks `@tukio/api-client/hooks/users/`** : useGetCurrentUserPreferences + useUpdateNotificationPreferences
4. **Mirror Pro page** `/seller/notifications` (pragmatic copy)
5. **~15 i18n strings × 2 locales × 2 apps = 60 strings totale** namespace `notification_preferences` + tease V1+ Story 11.4
6. **A11y RGAA AA** + axe-core 0 + Lighthouse ≥ 90

**Tests : ~44 scenarios totale**

### Story 5.10 NE livre PAS (déféré V1+)

- ❌ **Full granularité per channel × per type** (in-app, SMS, push, transactional per-type opt-in) → **V1+ Story 11.4**
- ❌ **Brevo API actual sync cron** → **V1+ Epic 16** (Story 5.10 livre STUB cron + runbook V1+ plan)
- ❌ **Marketing campaign emails** → **V1+ Epic 16** (Story 5.10 livre STUB event schema reserved)
- ❌ **SMS notifications** → **V1+ Story 11.x** (Twilio integration)
- ❌ **Push web notifications** → **V1+ Epic 11 Story 11.2** (PWA + push web)
- ❌ **In-app cloche notifications** → **V1+ Epic 11 Story 11.1** (real-time SSE feed)

### Dependencies inputs (Stories livrées)

| Story | Livrable réutilisé Story 5.10 |
|-------|--------------------------------|
| 0.2 | `@tukio/contracts` envelope + event schemas pattern |
| 0.4 | `<Checkbox>` + `<RadioGroup>` + `<Alert>` + `<Button>` + `<Toast>` atoms |
| 0.6 | Pretre scaffolding + envelope interceptor |
| 0.7 | `@tukio/messaging` OutboxPublisher + InboxConsumer + CorrelationContext |
| 0.9 | testcontainer helpers + axe-core Playwright |
| 0.11 | CI workflow + Lighthouse |
| 1.2a/1.10 | **identity-svc UserProfile aggregate baseline** + Pretre canonical (Story 5.10 EXTEND 2 fields + 1 mutation method + 1 NEW usecase) |
| 1.2b | UNIQUE conflict catch pattern (not applicable Story 5.10 — pas de UNIQUE) |
| 1.2c | **gateway forwarder pattern** + ThrottlerModule + EnvelopeExceptionFilter |
| 1.2d | RHF zodV4Resolver + a11y RGAA AA + form submit UX patterns |
| 1.4 | KeycloakJwtGuard |
| 1.8 | **`/account/notifications` AccountLayout baseline** + users.controller pattern |
| 1.10 | **identity-svc Pretre + audit_log consumer pattern** (Story 5.10 EXTEND audit consumer pour new event) |
| 2.7 | **audit_log baseline** consume admin actions Story 1.10 pattern réutilisé — Story 5.10 EXTEND consume `identity.notification-preferences-updated.v1` |
| 5.3 | NFR82 pattern strict event schemas no PII content |
| 5.4 | **notification-svc baseline + AggregateMessageForDigestUseCase + SendEmailNotificationUseCase + 11 templates (Story 5.6 22 fichiers) + 7 shared components + IUserPreferencesPort baseline IF locale-resolver-port pattern réutilisé + flush-digest-pending.task @Cron 5min**. Story 5.10 EXTEND : 12ème template + cron hourly + cache invalidation consumer + digest frequency conditional |
| 5.5/5.7/5.8 | Pas applicable Story 5.10 (review-svc pas concerné) |

### Architecture compliance

- ✅ **ADR-001 Clean Architecture Pretre 1ère référence identity-svc Story 1.10 maintained** : `UpdateNotificationPreferencesUseCase` orchestre domain ports + aggregate mutation. Lint boundaries strict.
- ✅ **ADR-003 DB per service** : `tukio_identity` exclusively — `marketing_opt_in + messages_digest_frequency` colonnes ajoutées sur `user_profiles` table existing Story 1.2 baseline (pas de nouvelle table).
- ✅ **ADR-006 Saga choreographed** : Story 5.10 émet 1 NEW event (`identity.notification-preferences-updated.v1`) + 1 STUB reserved V1+ (`marketing.campaign-send.v1`) — pure choreography.
- ✅ **ADR-007 Transactional outbox** : `UpdateNotificationPreferencesUseCase` STEP 4 atomic transaction (save UserProfile + outbox publish).
- ✅ **ADR-014 envelope REST canonique** : 2 gateway endpoints wrap response.
- ✅ **NFR1 RGPD opt-in marketing strict** : default `marketing_opt_in = FALSE` (opt-in required) + Brevo sync cron STUB V1+ + opt-out instant côté notification-svc consumer (Story 5.10 livre logic dans STUB consumer + Epic 16 V1+ finalise Brevo actual sync).
- ✅ **NFR50/54 a11y RGAA AA + Lighthouse ≥ 90** : enforced.
- ✅ **NFR56-57 zero hardcoded text** : ~60 i18n strings.
- ✅ **NFR71 coverage** : maintained.
- ✅ **NFR82 audit immutable** : audit_log consume new event Story 2.7 baseline pattern Story 1.10.
- ✅ **NFR83 migrations backward-compatible** : ADD COLUMN DEFAULT — existing rows auto-backfilled.

### File structure

```
apps/identity-svc/src/
  domain/model/user-profile.aggregate.ts                             # UPDATE Story 1.2a/1.10 — add 2 fields + updateNotificationPreferences mutation
  usecases/update-notification-preferences.usecase.ts                # NEW Story 5.10
  usecases-proxy/usecases-proxy.module.ts                            # UPDATE — add PROXY token
  infrastructure/
    persistence/
      entities/user-profile.entity.ts                                # UPDATE — add 2 columns
      migrations/<ts>-AddNotificationPreferencesToUserProfiles.ts    # NEW NFR83
    controllers/
      internal-users.controller.ts                                   # UPDATE Story 1.10 — add PATCH endpoint + EXTEND GET snapshot
      dtos/update-notification-preferences-body.dto.ts               # NEW Zod
    scheduling/
      sync-marketing-preferences-brevo.task.ts                       # NEW STUB MVP (Epic 16 V1+)

apps/gateway-api/src/users/
  users.controller.ts                                                # UPDATE Story 1.8 — add PATCH + GET /me/notification-preferences
  usecases/{update,get-current-user}-preferences-forwarder.usecase.ts  # NEW × 2
  clients/identity-svc.client.ts                                     # UPDATE — add patch method
  dtos/{update-notification-preferences-body,preferences-response}.dto.ts  # NEW Zod
apps/gateway-api/src/throttler/throttler.config.ts                    # UPDATE — add updatePreferences 10/min

apps/notification-svc/src/
  domain/ports/user-preferences-port.ts                              # NEW
  usecases/
    aggregate-message-for-digest.usecase.ts                          # UPDATE Story 5.4 — fetch user preferences + conditional 3 frequencies
    send-immediate-message-notification.usecase.ts                   # NEW Story 5.10
  usecases-proxy/usecases-proxy.module.ts                            # UPDATE — add 2 PROXY tokens
  infrastructure/
    adapters/user-preferences-cached.adapter.ts                       # NEW (Redis 5min TTL + cross-svc fallback)
    messaging/
      identity-notification-preferences-updated-consumer.handler.ts  # NEW (cache invalidation)
      marketing-campaign-send-consumer.handler.ts                    # NEW STUB V1+
    scheduling/flush-digest-hourly.task.ts                            # NEW @Cron('0 * * * *')
  templates/
    messages-immediate-notification.fr.tsx                            # NEW
    messages-immediate-notification.en.tsx                            # NEW
    registry.ts                                                       # UPDATE Story 5.4 — 12 templates × 2 = 24 fichiers
  messages/{fr,en}/emails.json                                         # UPDATE Story 5.4 — add namespace messages_immediate_notification

packages/contracts/src/events/
  identity/notification-preferences-updated.v1.{schema.json,ts}      # NEW Story 5.10
  marketing/campaign-send.v1.{schema.json,ts}                        # NEW STUB V1+

packages/api-client/src/hooks/users/
  use-get-current-user-preferences.ts                                # NEW
  use-update-notification-preferences.ts                             # NEW
  index.ts                                                            # UPDATE subpath exports

apps/public/src/
  app/[locale]/(authenticated)/account/notifications/page.tsx        # NEW Server Component
  features/notifications/components/NotificationPreferencesFormClient.tsx  # NEW Client Component

apps/seller/src/
  app/[locale]/seller/notifications/page.tsx                          # NEW Pro mirror
  features/notifications/components/                                  # MIRROR pragmatic copy

apps/{public,seller}/messages/
  fr/customer.json + en/customer.json                                # UPDATE Customer (~15 keys × 2)
  fr/seller.json + en/seller.json                                    # UPDATE Pro mirror

docs/
  runbook/notification-preferences-mvp.md                            # NEW
  runbook/brevo-marketing-sync-v1.md                                 # NEW V1+ plan
  runbook/marketing-campaigns-v1.md                                  # NEW V1+ plan
  adr/0006-saga-choreographed.md                                     # UPDATE — 1 NEW event + 1 STUB V1+
  project-context.md                                                 # UPDATE Notifications section

_bmad-output/implementation-artifacts/
  5-4-notification-svc-pretre-resend-templates.md                    # UPDATE Completion Notes (12ème template + cache invalidation + digest frequency conditional)
  1-10-identity-svc-pretre-implementation.md                         # UPDATE Completion Notes (UserProfile EXTEND + UpdateNotificationPreferences + audit consumer EXTEND)
```

### Lib / framework choices

| Lib | Usage Story 5.10 | Version | Why |
|-----|------------------|---------|-----|
| RHF + zodV4Resolver | Form validation | latest (Story 1.2d baseline) | Pattern réutilisé |
| TanStack Query | useQuery + useMutation | latest (Story 0.9 baseline) | Cache invalidation |
| `@tukio/ui` Checkbox + RadioGroup + Alert + Button + Toast | UI atoms | workspace (Story 0.4 baseline) | Réutilisés |
| Zod | DTO validation gateway + identity-svc + frontend | latest | No class-validator |
| `@nestjs/schedule` | 2 NEW cron tasks (hourly digest + Brevo STUB) | latest (Story 1.9 baseline) | Réutilisé |
| `ioredis` | UserPreferencesCachedAdapter Redis cache | latest (Story 5.1 baseline) | Réutilisé |
| axios + axios-retry | gateway forwarder + cross-svc HTTP fallback | latest (Story 1.2c baseline) | Réutilisé |
| `@react-email/components` | 12ème template | latest (Story 5.4 baseline) | Réutilisé |
| Playwright + axe-core | E2E + a11y | latest (Story 0.11 baseline) | NFR50/54 |

### Previous Story Intelligence (5.4 + 1.10 + 1.2d)

- **Story 5.4 patterns réutilisés (notification-svc 3ème référence Pretre)** :
  - `SendEmailNotificationUseCase` (Story 5.10 invoke pour immediate frequency)
  - `AggregateMessageForDigestUseCase` Story 5.4 baseline EXTEND avec frequency conditional
  - `flush-digest-pending.task @Cron 5min` baseline → Story 5.10 ajoute parallel `flush-digest-hourly.task @Cron 1h`
  - React Email templates 7 shared components (Story 5.10 réutilise pour 12ème template)
  - `registry.ts` boot validation pattern (Story 5.10 update 12 × 2 = 24)
  - `IUserPreferencesPort` PATTERN similar à Story 5.4 `ILocaleResolverPort` (Redis cache + cross-svc fallback)

- **Story 1.10 patterns réutilisés (identity-svc 1ère référence Pretre)** :
  - UserProfile aggregate baseline (Story 5.10 EXTEND 2 fields)
  - audit_log table + immutable trigger Postgres + NATS consumer pattern (Story 5.10 EXTEND consume new event)
  - `IConfigService` pattern (pas applicable Story 5.10 directement)

- **Story 1.2d patterns réutilisés** :
  - RHF zodV4Resolver client validation
  - A11y RGAA AA (aria-busy + focus management)
  - i18n strings via next-intl useTranslations
  - Server Component initial fetch + Client Component hydration

- **Story 1.8 patterns réutilisés** :
  - `<AccountLayout>` Customer wrapper
  - users.controller pattern
  - useUpdateProfile mutation pattern (Story 5.10 reproduit useUpdateNotificationPreferences)

### Project Context Reference

- **PRD §FR118** — Customer/Pro configure préférences notifications opt-in marketing + critique non-désactivable — **Story 5.10 livre full MVP minimal**
- **PRD §FR119** — System envoie emails transactionnels critiques toujours — **Story 5.10 respecte strict via Alert read-only info + notification-svc enforce**
- **PRD §FR123** — Digest 5 min messages — **Story 5.4 baseline + Story 5.10 EXTEND frequency choice**
- **PRD §NFR1** — RGPD strict opt-in marketing — **Story 5.10 default FALSE enforce**
- **PRD §NFR50/54** — A11y RGAA AA + Lighthouse — enforced
- **PRD §NFR56-57** — Zero hardcoded text
- **PRD §NFR71** — Coverage maintained
- **PRD §NFR82** — Audit immutable — audit_log consume new event
- **PRD §NFR83** — Migrations backward-compatible
- **Architecture §Pattern Pretre canonique** — identity-svc 1ère + notification-svc 3ème maintained
- **Architecture §Saga choreographed ADR-006** — 1 NEW + 1 STUB V1+
- **Architecture §DB-per-service ADR-003** — UserProfile EXTEND columns existing table
- **Architecture §Envelope REST ADR-014** — 2 gateway endpoints wrap
- **ADR-001/003/006/007/014** — strict respect
- **Stories livrées** : 0.2, 0.4, 0.6, 0.7, 0.9, 0.11, 1.2a, 1.2b, 1.2c, 1.2d, 1.4, 1.8, 1.10, 2.7, 5.3, 5.4
- **Memories Tukio** : `feedback_clean_architecture_explicit`, `feedback_api_envelope_response`, `feedback_tech_layer_english`, `feedback_i18n_frontend`, `feedback_comprehensive_briefs`

### Project Structure Notes

- 1 NEW usecase identity-svc + 1 EXTEND aggregate + 1 migration NFR83 + 1 NEW event schema + 2 NEW gateway endpoints + 1 EXTEND identity-svc endpoint + 2 NEW hooks + 1 NEW page Next.js (×2 apps mirror) + ~60 i18n strings totale + 1 EXTEND notification-svc usecase + 1 NEW usecase notification-svc + 1 NEW port + 1 NEW adapter + 1 NEW cron + 1 NEW consumer + 1 EXTEND consumer + 1 NEW 12ème template (×2 locales) + 1 STUB event + 1 STUB consumer + 1 STUB cron + 3 NEW runbooks + ADR-006 update
- Coverage NFR71 maintained
- ~44 test scenarios totale
- A11y RGAA AA enforced

### Testing

| Layer | Framework | Coverage cible | Story 5.10 scenarios |
|-------|-----------|----------------|----------------------|
| Domain | Jest unit | ≥ 80 % (Story 5.5 baseline maintained) | UserProfile EXTEND 2 fields + updateNotificationPreferences mutation = 3 |
| Usecases | Jest unit | ≥ 70 % | UpdateNotificationPreferencesUseCase 5 + AggregateMessageForDigestUseCase EXTEND 4 = 9 |
| Infrastructure | Jest integration testcontainer | ≥ 50 % | migration (2) + identity-svc endpoint E2E (4) + notification-svc digest consumer EXTEND (6) + cache invalidation consumer (2) + 12ème template snapshot (2) = 16 |
| Hooks frontend | @testing-library/react + MSW | All hooks tested | 2 hooks × 2 = 4 |
| Gateway E2E | Jest E2E supertest | 2 endpoints × ~3 | 5 + 2 = 7 |
| Playwright E2E | Playwright + axe-core | 5 critical paths | 5 scenarios |
| A11y + Lighthouse | axe-core + Lighthouse CI | 0 violations 2 pages + ≥ 90 | 4 specs |
| **Total** | | | **~44 test scenarios** |

### References

- [Source: epics.md#Story-5.10 (lines 2029-2042)]
- [Source: epics.md#Epic-5 (lines 1813-1822)] — **closes Epic 5 MVP 10/10**
- [Source: prd.md#FR118 (notification preferences opt-in marketing)]
- [Source: prd.md#FR119 (transactional always sent)]
- [Source: prd.md#FR123 (digest 5min)]
- [Source: prd.md#NFR1 (RGPD opt-in strict)]
- [Source: prd.md#NFR50/54 (a11y + Lighthouse)]
- [Source: prd.md#NFR56-57 (zero hardcoded)]
- [Source: prd.md#NFR71 (coverage)]
- [Source: prd.md#NFR82 (audit immutable)]
- [Source: prd.md#NFR83 (migrations backward-compatible)]
- [Source: architecture.md#Pattern-Pretre-canonique]
- [Source: architecture.md#Saga-choreographed (ADR-006)]
- [Source: architecture.md#DB-per-service (ADR-003)]
- [Source: architecture.md#Envelope-REST (ADR-014)]
- [Source: implementation-artifacts/5-4-notification-svc-pretre-resend-templates.md (notification-svc baseline + AggregateMessageForDigest + 11 templates + flush-digest-pending cron + IUserPreferencesPort similar pattern)]
- [Source: implementation-artifacts/1-10-identity-svc-pretre-implementation.md (identity-svc Pretre + UserProfile aggregate + audit_log consumer pattern)]
- [Source: implementation-artifacts/1-2d-frontend-signup-middleware-e2e-observability.md (RHF zodV4Resolver + a11y RGAA AA + form submit UX)]
- [Source: implementation-artifacts/1-8-profile-management.md (AccountLayout + users.controller pattern)]
- [Source: implementation-artifacts/2-7-audit-trail-actions-admin-immutabilite.md (audit_log baseline pattern)]
- [Source: .agents/context/pretre-pattern.md]
- [Source: .agents/context/rest-envelope.md]
- [Source: .agents/context/i18n.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-create-story workflow `_bmad/bmm/skills/bmad-create-story` adapté ACS Tukio (`{user_name}=Ismael`, `{communication_language}=Français`, `{document_output_language}=Français`)

### Debug Log References

(populated during dev-story)

### Completion Notes List

(populated during dev-story)

### File List

(populated during dev-story)
