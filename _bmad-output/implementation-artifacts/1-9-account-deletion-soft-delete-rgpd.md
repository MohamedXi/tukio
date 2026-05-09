# Story 1.9: Account deletion soft-delete + RGPD (`DELETE /v1/me`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Customer / Pro qui veut exercer son **droit à l'effacement RGPD** (Art. 17 RGPD + NFR1 + NFR25),
**I want** un flow de suppression de compte **sécurisé + RGPD-compliant + cohérent rétention légale FR comptable 10 ans** : (Step 1) page `apps/customer/{locale}/account/settings` (NEW Story 1.9 MVP — settings page minimaliste qui contient juste section "Supprimer mon compte" pour MVP, futures settings ajoutées V1+) ou `apps/seller/{locale}/seller/settings` pour Pro → click bouton danger `<Button variant="destructive">Supprimer mon compte</Button>` ; (Step 2) modale destructrice `<Modal variant="destructive" requireExplicitClose>` (Story 0.5 atomic) avec : warning explicite `"Cette action est IRRÉVERSIBLE. Vos données personnelles seront anonymisées immédiatement. Vos données comptables (factures, réservations, paiements) seront conservées 10 ans pour conformité légale française."` + 2 confirmations required : (a) checkbox `<Checkbox label="Je comprends que cette action est irréversible" required>` + (b) input `<FormField label="Tapez SUPPRIMER pour confirmer" pattern="^SUPPRIMER$">` (en français) ou `"DELETE"` (EN) → CTA `<Button variant="destructive" disabled={!checkboxChecked || typedConfirmation !== 'SUPPRIMER/DELETE'}>Supprimer définitivement mon compte</Button>` ; (Step 3) frontend appelle `DELETE /v1/me` avec CSRF header, identity-svc workflow : (a) **pre-check active bookings** via HTTP sync call booking-svc `GET /internal/bookings/active?userId={id}` (Story 4.x exposera, Story 1.9 stub MVP returns 0 si booking-svc pas encore wired) — si count > 0 → throw `IdentityConflictException('IDENTITY-CONFLICT-003', 'Active bookings prevent deletion')` + 409 enveloppe avec `{ activeBookingsCount, sampleBookings: [...] }` payload pour UI affichage liste, (b) **soft-delete UserProfile aggregate** : domain method `userProfile.softDelete()` qui set `deleted_at = NOW()` + appelle `userProfile.anonymize()` qui replace PII : `email = 'deleted-{userId}@deleted.tukio.one'`, `firstName = 'Utilisateur supprimé'` (FR) / `'Deleted user'` (EN) selon locale, `lastName = ''`, `phone = null`, `address = null`, `marketingOptIn = false`, (c) **soft-delete ProProfile** (si role=pro) avec anonymisation similaire mais **garder companyName + SIRET intacts** (rétention légale comptable — facturation 10 ans FR), `kyc_decision_reason = '[ANONYMIZED]'`, KYC docs R2 keys préservés (purgés Story 2.8 retention 90j post-rejet OU Story 1.10 cron 10 ans final purge), (d) **Keycloak disable** : `kcAdminClient.users.update({id, enabled: false, attributes: {locale: [], status: ['deleted']}})` + `kcAdminClient.users.logout({id})` (revoke all sessions Story 1.5 pattern) — **NE PAS DELETE** Keycloak user (audit trail Keycloak conservé), (e) **publish `identity.user.deleted.v1`** audit event (consume Story 2.7 audit + downstream services pour anonymise leurs caches/copies — messaging-svc, review-svc, etc.), (f) return 204 No Content ; (Step 4) frontend post-success : (a) call `POST /v1/auth/logout` (Story 1.4 réutilisé — revoke Keycloak session + clear cookies), (b) redirect `tukio.one/{locale}/?account-deleted=true` query param qui affiche toast `"Compte supprimé. Merci d'avoir utilisé Tukio."` ; **affichage "Utilisateur supprimé" propagé** : Stories 5.7 (reviews display) + Story 5.2 (messages thread) + Story 3.11 (pro-public-profile reviews list) consomment l'aggregate user via `useMe()` Story 1.8 ou via batch GET endpoints — quand userProfile.deletedAt != null, le frontend affiche `firstName + lastName` qui retournera déjà `"Utilisateur supprimé"` (anonymisation Story 1.9) + avatar fallback default icon (pattern existing `<Avatar>` Story 0.4) ; **cron job purge 10 ans** : `apps/identity-svc/src/tasks/purge-deleted-accounts.task.ts` (NEW Story 1.9, NestJS `@Cron('0 4 * * *')` quotidien 4am UTC) qui SELECT `WHERE deleted_at < NOW() - INTERVAL '10 years'` → hard delete UserProfile + ProProfile + Keycloak user via Admin API + R2 KYC docs purge + publish `identity.user.purged.v1` (no-op MVP réel — aucun user n'a 10 ans d'ancienneté, mais code ready) ; **re-création compte avec même email** : autorisé car ancien email anonymisé `deleted-uuid@deleted.tukio.one` ≠ collision — Story 1.2 register vérifie via `findByEmail(input.email)` qui ne retournera pas l'old user (différent email persisté) ; **NFR1 + NFR25 RGPD compliance** : soft-delete + anonymisation PII immédiate (≤ 1s response) + conservation comptable 10 ans + purge automatique post-10y + audit event traçable (10 ans archivable Backups Story 0.12 RPO/RTO),
**so that** les users peuvent exercer leur droit RGPD Art. 17 en autonomie (réduit charge support customer Story 6.x), Tukio respecte la conformité légale FR (rétention comptable 10 ans + droit à l'effacement RGPD), les Stories Epic 5-7 (reviews, messaging, audit) gèrent gracefully les users supprimés via affichage standardisé, le **pattern complet "soft-delete + anonymisation + cron purge"** devient template Story 6.5 (admin suspend/ban — bannissement définitif avec hash anti-recréation R10), Story 9.x V1 (subscription cancel + delete pro), Stories Epic 4 (booking cancel — delete vs cancel patterns différents), et le **pattern "modale destructrice avec type-to-confirm"** devient pattern réutilisable Story 6.5 (admin ban), Story 3.6 (delete listing), Story 9.x (cancel subscription).

> **Outcome attendu** : à la fin de cette story, un Customer authentifié sur `customer.tukio.one/fr/account/settings` voit le bouton danger "Supprimer mon compte" → click → modale destructrice s'ouvre avec warning + 2 confirmations → user check + tape "SUPPRIMER" → click "Supprimer définitivement" → frontend appelle `DELETE /v1/me` → identity-svc pre-check bookings (returns 0 stub MVP) → soft-delete UserProfile + anonymise PII + Keycloak disable + publish `identity.user.deleted.v1` → 204 → frontend logout + redirect `tukio.one/fr/?account-deleted=true` → toast `"Compte supprimé. Merci d'avoir utilisé Tukio."` ; côté DB, le row `user_profiles` montre `deleted_at = NOW()`, `email = 'deleted-{uuid}@deleted.tukio.one'`, `first_name = 'Utilisateur supprimé'` ; côté Keycloak, le user a `enabled: false` ; un Pro avec 1 booking actif qui essaie de supprimer son compte → 409 + UI affiche `<Modal>` warning `"Vous avez 1 booking en cours, annulez-le d'abord"` + liste avec lien `<Link href="/seller/bookings/{id}">` ; un user qui essaie de re-créer un compte Customer avec son ancien email → Story 1.2 check passe (email anonymisé, plus en conflit) → nouveau user créé (UUID différent, history zéro) ; un test cron job manuel `pnpm tsx apps/identity-svc/src/tasks/purge-deleted-accounts.task.ts --dry-run` retourne le SQL qui serait exécuté sur des users déletés > 10 ans (vide MVP, ready V1+) ; un test `pnpm playwright test --grep "account delete"` passe en FR ET EN, axe-core 0 violations, 8 scénarios.

## Acceptance Criteria

1. **AC1 — Frontend pages settings + modale destructrice** : Given un user authentifié, When il accède `customer.tukio.one/{locale}/account/settings` (ou `seller.tukio.one/{locale}/seller/settings`), Then :
   - **Page Settings (Story 1.9 MVP minimaliste)** :
     - Server Component layout (réutilise pattern Story 1.8 profile)
     - Section header `<h1>Paramètres</h1>` (FR) / `<h1>Settings</h1>` (EN)
     - **Section "Sécurité"** (placeholder Story 1.x V1+) : `<small>Bientôt disponible : changement mot de passe + sessions actives</small>`
     - **Section "Danger Zone"** : Card `<Card variant="danger" border>` avec :
       - Title : `<h2>Supprimer mon compte</h2>` Fraunces
       - Description : `<p>La suppression de votre compte anonymise vos données personnelles immédiatement. Vos données comptables (factures, réservations) seront conservées 10 ans pour conformité légale française. Cette action est irréversible.</p>`
       - CTA : `<Button variant="destructive">Supprimer mon compte</Button>` → trigger modale
   - **Modale destructrice `<DeleteAccountModal>`** (Client Component) :
     - `<Modal variant="destructive" requireExplicitClose>` (Story 0.5 — `requireExplicitClose` = no Escape key dismiss, no overlay click dismiss, force confirmation)
     - Title : `"⚠️ Suppression définitive"` (FR) / `"⚠️ Permanent deletion"` (EN)
     - Warning body :
       ```
       Vous êtes sur le point de supprimer votre compte Tukio.
       
       ✓ Vos données personnelles (nom, email, téléphone, adresse) seront anonymisées immédiatement
       ✓ Vos données comptables (factures, réservations, paiements) seront conservées 10 ans (obligation légale FR)
       ✓ Vos avis publiés resteront affichés sous "Utilisateur supprimé"
       ✗ Vous ne pourrez plus accéder à votre compte
       ✗ Cette action est IRRÉVERSIBLE
       ```
     - **Pre-check active bookings** (server action ou client fetch lors d'ouverture modale) : `GET /v1/me/active-bookings` (NEW endpoint Story 1.9 — peut être inclus dans `GET /v1/me` Story 1.8 augmenté) → si count > 0 → render different modale state :
       - Title : `"❌ Suppression impossible"` (FR) / `"❌ Cannot delete"` (EN)
       - Body : `"Vous avez {count} réservation(s) en cours. Annulez ou terminez-les avant de supprimer votre compte."` + `<ul>` liste des bookings avec links vers `/seller/bookings/{id}` ou `/account/bookings/{id}` selon role
       - CTA : `<Button variant="primary">Voir mes réservations</Button>`
     - **2 confirmations required** :
       - `<Checkbox label="Je comprends que cette action est irréversible et que mes données personnelles seront anonymisées" required>`
       - `<FormField label="Tapez SUPPRIMER pour confirmer (en majuscules)">` validé regex `/^SUPPRIMER$/` (FR) ou `/^DELETE$/` (EN selon locale)
     - **CTA final** : `<Button variant="destructive" size="lg" disabled={!checkboxChecked || typedConfirmation !== confirmWord}>Supprimer définitivement mon compte</Button>`
     - **Lien escape** : `<Button variant="ghost">Annuler</Button>` close modale
   - **Submit handler** :
     1. Loading state pendant API call (~1-3s)
     2. POST `DELETE /v1/me` via `useDeleteMyAccount` hook (NEW Story 1.9)
     3. On success : call `useLogout()` Story 1.4 (clear cookies + Keycloak revoke) → `window.location.assign('/{locale}/?account-deleted=true')` (full reload, hors zone)
     4. On error 409 IDENTITY-CONFLICT-003 : refresh modale state pour afficher liste bookings actifs
     5. On error generic 5xx : toast `"Erreur, réessayez ou contactez le support"`
   - **Toast post-redirect** : page `/{locale}/?account-deleted=true` lit query param + affiche `<Toast variant="success">Compte supprimé. Merci d'avoir utilisé Tukio.</Toast>` (5s auto-dismiss)
   - **i18n strict** (memory) : namespace `account.settings.deleteAccount.*` (~20 keys) — wording sensible RGPD, à valider linguistiquement (translation review FR + EN par native speaker MVP)
   - **Accessibilité RGAA AA** : modale focus-trap, keyboard navigable (Tab/Shift-Tab/Esc disabled forced), `role="alertdialog"` `aria-modal="true"`, axe-core 0 violations
   - **Tests E2E** : (cf. AC9) — happy path FR/EN, active bookings blocking, modale escape, double-click protection (idempotent — submit déclenche disabled button immédiat)

2. **AC2 — gateway-api endpoint `DELETE /v1/me`** : Given user authentifié, When il appelle `DELETE /v1/me` :
   - **Endpoint** :
     ```ts
     @Delete('/')
     @UseGuards(KeycloakJwtGuard, CsrfGuard) // Story 0.8 + Story 1.4 CSRF
     @HttpCode(204)
     async deleteMe(@CurrentActor() actor: Actor): Promise<void> {
       return this.meForwarder.getInstance().deleteMe({ actor });
     }
     ```
   - **Forwarder** : appelle identity-svc `DELETE /internal/users/by-id/{userId}` avec actor + `X-Internal-Service-Token`
   - **Réponse success** : `204 No Content` (pas de body — RGPD action confirmée par status code)
   - **Réponse error** :
     - 409 `IDENTITY-CONFLICT-003` (active bookings) avec body :
       ```json
       {
         "method": "DELETE",
         "code": 409,
         "error": {
           "tukioCode": "IDENTITY-CONFLICT-003",
           "title": "Cannot delete account with active bookings",
           "detail": "User has 2 active booking(s). Cancel them first.",
           "instance": "/v1/me",
           "context": {
             "activeBookingsCount": 2,
             "sampleBookings": [
               { "id": "abc-uuid", "providerName": "Marc Loueur", "scheduledDate": "2026-06-15", "url": "/seller/bookings/abc-uuid" }
             ]
           }
         },
         "meta": { ... }
       }
       ```
     - 502 `IDENTITY-EXTERNAL-001` (Keycloak DOWN) — non-fatal côté DB (DB delete already done, Keycloak disable retry sera Story 1.10 reconciliation)
   - **Tests E2E** : valid no bookings → 204. Avec bookings actifs (mock booking-svc returns 2) → 409 + payload. Sans CSRF → 403. Non-authenticated → 401.

3. **AC3 — gateway-api endpoint `GET /v1/me/active-bookings` (helper pour modale UI)** : Given user authentifié, When il appelle `GET /v1/me/active-bookings` (consommé par modale Step 2 pre-open check) :
   - **Endpoint** :
     ```ts
     @Get('/active-bookings')
     @UseGuards(KeycloakJwtGuard)
     @HttpCode(200)
     async getActiveBookings(@CurrentActor() actor: Actor): Promise<{ count: number; sampleBookings: BookingSummary[] }> {
       return this.meForwarder.getInstance().getActiveBookings({ actor });
     }
     ```
   - **Forwarder** : appelle booking-svc HTTP `GET /internal/bookings/active?userId={id}&limit=5` (Story 4.x exposera ; Story 1.9 stub MVP : si booking-svc unreachable, return `{ count: 0, sampleBookings: [] }` graceful default)
   - **Réponse** :
     ```json
     {
       "method": "GET",
       "code": 200,
       "data": {
         "count": 2,
         "sampleBookings": [
           { "id": "uuid", "providerName": "...", "scheduledDate": "...", "status": "confirmed", "url": "/seller/bookings/{id}" }
         ]
       },
       "meta": { ... }
     }
     ```
   - **Caching** : pas de cache MVP (data fresh per call). V1+ : cache 30s.
   - **Tests E2E** : avec bookings → 200 + count + samples. Sans booking-svc (unreachable mock) → 200 + count:0 (graceful).

4. **AC4 — identity-svc use case `DeleteMyAccountUseCase`** : Given Pretre architecture, When je consulte `apps/identity-svc/src/usecases/delete-my-account.usecase.ts` :
   ```ts
   @Injectable()
   export class DeleteMyAccountUseCase {
     constructor(
       @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepo: IUserProfileRepository,
       @Inject(PRO_PROFILE_REPOSITORY) private readonly proProfileRepo: IProProfileRepository, // Story 1.3
       @Inject(KEYCLOAK_ADMIN) private readonly keycloakAdmin: IKeycloakAdmin,
       @Inject(BOOKING_SVC_CLIENT) private readonly bookingSvcClient: IBookingSvcClient, // NEW Story 1.9 — port to booking-svc HTTP
       @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
     ) {}

     async execute(input: { userId: string; locale: 'fr' | 'en' }): Promise<void> {
       // 1. Pre-check active bookings (sync HTTP call booking-svc)
       const activeBookings = await this.bookingSvcClient.getActiveBookings({ userId: input.userId });
       if (activeBookings.count > 0) {
         throw new IdentityConflictException('IDENTITY-CONFLICT-003', `User has ${activeBookings.count} active bookings`);
       }

       // 2. Fetch UserProfile
       const userProfile = await this.userProfileRepo.findById(input.userId);
       if (!userProfile || userProfile.deletedAt) throw new IdentityNotFoundException('IDENTITY-NOT-FOUND-001');

       // 3. Domain methods : softDelete + anonymize
       userProfile.softDelete(); // sets deletedAt = NOW()
       userProfile.anonymize({ locale: input.locale }); // replaces PII fields

       // 4. If Pro, soft-delete + partial anonymize ProProfile (keep companyName + SIRET for legal retention)
       let proProfile;
       if (userProfile.role === 'pro') {
         proProfile = await this.proProfileRepo.findByUserProfileId(userProfile.id);
         if (proProfile) {
           proProfile.softDelete();
           proProfile.anonymizePartial(); // anonymize kyc_decision_reason, contactPhone — keep companyName + SIRET (10y retention)
         }
       }

       // 5. Keycloak disable (non-fatal — drift R8 OK)
       try {
         await this.keycloakAdmin.updateUser({
           keycloakUserId: userProfile.keycloakUserId,
           updates: { enabled: false, attributes: { status: ['deleted'] } },
         });
         await this.keycloakAdmin.logoutAllSessions({ keycloakUserId: userProfile.keycloakUserId });
       } catch (e) {
         // Log + alert + continue (DB anonymize is the source of truth, Keycloak reconciliation Story 1.10)
       }

       // 6. Persist + publish event (atomic transaction)
       await this.userProfileRepo.runInTransaction(async (txn) => {
         await txn.userProfileRepo.save(userProfile);
         if (proProfile) await txn.proProfileRepo.save(proProfile);

         await txn.eventPublisher.publish({
           eventType: 'identity.user.deleted',
           eventVersion: 'v1',
           aggregate: { type: 'UserProfile', id: userProfile.id },
           actor: { userId: userProfile.id, role: userProfile.role },
           payload: {
             userProfileId: userProfile.id,
             role: userProfile.role,
             deletedAt: userProfile.deletedAt!.toISOString(),
             reason: 'user-initiated', // V1+ : 'admin-suspended' for Story 6.5 ban
             retentionUntil: new Date(userProfile.deletedAt!.getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
           },
         });
       });
     }
   }
   ```
   - Tests unit ≥ 90 % : 8+ cases (happy path Customer, happy path Pro, active bookings → 409, user not found, already deleted idempotent, Keycloak DOWN non-fatal, booking-svc DOWN graceful, anonymize fields validation)

5. **AC5 — Domain methods UserProfile.softDelete() + UserProfile.anonymize() + ProProfile.softDelete() + .anonymizePartial()** : Given Pretre architecture, When je consulte `apps/identity-svc/src/domain/`, Then :
   - **Update `UserProfile` aggregate** (Story 1.2) :
     ```ts
     softDelete(): void {
       if (this.deletedAt) return; // idempotent
       this.deletedAt = new Date();
       this.updatedAt = new Date();
     }
     anonymize(options: { locale: 'fr' | 'en' }): void {
       const anonymousFirstName = options.locale === 'fr' ? 'Utilisateur supprimé' : 'Deleted user';
       this.email = Email.of(`deleted-${this.id}@deleted.tukio.one`); // unique per user — no collision
       this.firstName = anonymousFirstName;
       this.lastName = '';
       this.phone = null;
       this.address = null;
       this.marketingOptIn = false;
       // Keep : id, keycloakUserId, role, locale (for display), createdAt, deletedAt, acquisition_* (analytics anonymized)
       // Acquisition fields kept for historical analytics (no PII — anonymous funnel data)
       this.updatedAt = new Date();
     }
     ```
   - **Update `ProProfile` aggregate** (Story 1.3) :
     ```ts
     softDelete(): void {
       if (this.deletedAt) return;
       this.deletedAt = new Date();
       this.updatedAt = new Date();
     }
     anonymizePartial(): void {
       // Keep : companyName, siret, vatNumber (legal accounting retention — TVA invoices link to siret)
       // Anonymize : contactPhone, address (siège — PII), kyc_decision_reason
       this.contactPhone = '';
       this.address = Address.empty(); // or null — siège social peut être conservé legalement, à clarifier avec avocat. **Décision MVP** : siège social = data légale comptable, kept. Anonymize uniquement le contactPhone (PII operational).
       this.kycDecisionReason = '[ANONYMIZED]';
       // KYC docs R2 keys preserved — purged Story 1.10 cron 10y final OR Story 2.8 retention 90j post-rejet (cf. Story 1.3 Dev Notes)
       this.updatedAt = new Date();
     }
     ```
   - Tests unit aggregate `softDelete` (idempotent, set deletedAt) + `anonymize` (PII fields replaced, retention fields kept) — 6+ cases

6. **AC6 — `IBookingSvcClient` port + stub MVP** : Given booking-svc Story 4.x pas encore implémenté, When Story 1.9 doit pre-check active bookings, Then :
   - **Domain port** `apps/identity-svc/src/domain/ports/booking-svc-client.port.ts` (NEW) :
     ```ts
     export interface IBookingSvcClient {
       getActiveBookings(input: { userId: string; limit?: number }): Promise<{
         count: number;
         sampleBookings: Array<{ id: string; providerName: string; scheduledDate: string; status: 'pending' | 'confirmed'; }>;
       }>;
     }
     export const BOOKING_SVC_CLIENT = Symbol('BOOKING_SVC_CLIENT');
     ```
   - **Infrastructure impl `BookingSvcHttpClient`** (NEW — `apps/identity-svc/src/infrastructure/external/booking-svc/booking-svc.client.ts`) :
     - Wraps axios call `GET ${BOOKING_SVC_URL}/internal/bookings/active?userId={id}&limit=5` avec `X-Internal-Service-Token` HMAC
     - Timeout 3s
     - **Graceful fallback MVP** : si booking-svc unreachable (404 endpoint not yet exposed Story 4.x OR connection error) → return `{ count: 0, sampleBookings: [] }` (allow delete to proceed). Log warning.
     - **NB important** : ce graceful fallback est un trade-off MVP — Story 4.x doit obligatoirement implémenter le endpoint avant que les bookings réels existent. Sinon, un user pourrait supprimer son compte avec bookings actifs (drift). **Mitigation** : Story 4.1 (booking-svc Pretre) doit livrer le `GET /internal/bookings/active` endpoint MÊME si juste avec count=0 hardcoded retourné.
   - **`apps/identity-svc/.env.example`** : ajouter `BOOKING_SVC_URL=http://localhost:4003` (placeholder Story 4.x port)
   - Tests integration : nock mock booking-svc + tester graceful fallback si unreachable

7. **AC7 — Cron job `purge-deleted-accounts.task.ts` (10 ans retention)** : Given le scope RGPD long-term retention, When je consulte `apps/identity-svc/src/tasks/`, Then :
   - **NEW `apps/identity-svc/src/tasks/purge-deleted-accounts.task.ts`** :
     ```ts
     import { Injectable } from '@nestjs/common';
     import { Cron, CronExpression } from '@nestjs/schedule'; // NEW dep Story 1.9 — `pnpm --filter=identity-svc add @nestjs/schedule`
     
     @Injectable()
     export class PurgeDeletedAccountsTask {
       constructor(/* ... */) {}
       
       @Cron('0 4 * * *') // Daily at 4am UTC — low-traffic window
       async handlePurge() {
         const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000);
         const candidates = await this.userProfileRepo.findDeletedBefore(tenYearsAgo, 100); // batch 100/run
         
         for (const userProfile of candidates) {
           try {
             // 1. Hard delete Keycloak user (audit trail Keycloak archive — V1 backup retention)
             await this.keycloakAdmin.deleteUser({ keycloakUserId: userProfile.keycloakUserId });
             // 2. Hard delete R2 KYC docs (if Pro)
             if (userProfile.role === 'pro') {
               const proProfile = await this.proProfileRepo.findByUserProfileId(userProfile.id);
               if (proProfile?.kycIdCardR2Key) await this.mediaStorage.delete({ bucket, key: proProfile.kycIdCardR2Key });
               // ... rib + kbis
             }
             // 3. Hard delete DB rows (TypeORM cascade FK pro_profiles + email_verification_tokens + password_reset_tokens)
             await this.userProfileRepo.hardDelete(userProfile.id);
             // 4. Publish event audit
             await this.eventPublisher.publish({
               eventType: 'identity.user.purged',
               eventVersion: 'v1',
               aggregate: { type: 'UserProfile', id: userProfile.id },
               actor: { userId: 'system-cron', role: 'system' },
               payload: { userProfileId: userProfile.id, originalDeletedAt: userProfile.deletedAt!.toISOString(), purgedAt: new Date().toISOString(), retentionExpiredAt: tenYearsAgo.toISOString() },
             });
           } catch (e) {
             // Log + alert (manual intervention if persistent failure)
           }
         }
         
         // Metrics
         this.metrics.increment('tukio_purge_deleted_accounts_total', candidates.length);
       }
     }
     ```
   - **Update `apps/identity-svc/src/app.module.ts`** : `import { ScheduleModule } from '@nestjs/schedule'; @Module({ imports: [ScheduleModule.forRoot(), ...] })`
   - **CLI dry-run mode** : ajouter `apps/identity-svc/src/tasks/purge-deleted-accounts.task.ts --dry-run` flag (returns SQL preview without executing) — utilisé pour audits/tests manuels
   - **`pnpm` alias** : `"purge:dry-run": "tsx apps/identity-svc/src/tasks/purge-deleted-accounts.task.ts --dry-run"` dans `package.json` racine
   - **Test unitaire** : mock UserProfileRepo + KeycloakAdmin + MediaStorage + EventPublisher + tester batch processing + error handling per-user (un fail ne bloque pas les autres)
   - **NB MVP** : ce cron est essentiellement no-op à court terme (aucun user n'a 10 ans d'ancienneté). Story 1.9 livre le code ready. V2+ ajoutera observability complète (dashboard, alertes).

8. **AC8 — `@tukio/contracts` extensions + propagation downstream services** (AC: #4) :
   - **NEW `events/identity/user-deleted.v1.{schema.json,ts}`** : audit event payload `{ userProfileId, role, deletedAt, reason: 'user-initiated' | 'admin-suspended' | 'cron-purge', retentionUntil }`
   - **NEW `events/identity/user-purged.v1.{schema.json,ts}`** : event final 10y purge
   - **Update `types/error-codes.ts`** : ajouter `IDENTITY-NOT-FOUND-001` (déjà ?), `IDENTITY-CONFLICT-003` (active bookings)
   - **Propagation downstream services** (out of scope direct Story 1.9, mais documenté) :
     - **review-svc** Story 5.7 : consume `identity.user.deleted.v1` → updater le `displayed_author_name` cache
     - **messaging-svc** Story 5.2 : idem
     - **catalog-svc** Story 3.11 (pro-public-profile) : si Pro deleted → masquer la fiche pro (status `inactive`)
     - **booking-svc** Story 4.x : conservation bookings legacy avec `customer_anonymized = true` flag

9. **AC9 — Tests Playwright e2e flow FR/EN + axe-core** : Given `apps/customer/e2e/account/delete-account.spec.ts` + `apps/seller/e2e/seller/delete-account.spec.ts` (NEW), 8 tests :
   - **Test 1 (Customer happy path FR)** : login Customer → naviguer `/fr/account/settings` → click "Supprimer mon compte" → modale s'ouvre → check checkbox + tape "SUPPRIMER" → click "Supprimer définitivement" → vérifier redirect `tukio.one/fr/?account-deleted=true` + toast → naviguer `customer.tukio.one/fr/account/profile` → vérifier redirect login (sessions cleared) → essayer login avec ancien email + password → vérifier 401 (Keycloak disabled). **Vérifier DB** : `SELECT * FROM user_profiles WHERE keycloak_user_id = ?` → `deleted_at != NULL`, `email LIKE 'deleted-%@deleted.tukio.one'`, `first_name = 'Utilisateur supprimé'`.
   - **Test 2 (Customer happy path EN)** : idem avec confirmation `DELETE` (anglais)
   - **Test 3 (Pro avec bookings actifs)** : pré-créer Pro + 1 booking actif (mock booking-svc OR test fixture si Story 4.x dev) → naviguer settings → click "Supprimer" → modale s'ouvre déjà en état "Cannot delete" → vérifier display count + sampleBookings + CTA "Voir mes réservations"
   - **Test 4 (modale escape disabled)** : ouvrir modale → press Escape key → vérifier modale reste open (`requireExplicitClose`)
   - **Test 5 (modale overlay click disabled)** : ouvrir modale → click outside (overlay) → modale reste open
   - **Test 6 (CTA disabled until both confirmations)** : ouvrir modale → check checkbox seulement → vérifier CTA disabled. Tape "SUPPRIMER" sans checkbox → CTA disabled. Both → CTA enabled.
   - **Test 7 (re-creation après delete)** : delete account → essayer register avec même email Story 1.2 → vérifier success (nouveau user UUID, ancien email anonymisé donc no collision)
   - **Test 8 (axe-core)** : modale focus-trap, keyboard nav, role="alertdialog" — 0 violations
   - **Coverage** : ≥ 80 % gateway endpoint, ≥ 90 % use case, ≥ 80 % frontend modale + form

10. **AC10 — Documentation runbook + observability + RGPD compliance docs** :
    - **`docs/runbook/account-deletion-debug.md`** (NEW ~60 lignes) : flow + troubleshooting (active bookings false-positive, Keycloak drift post-delete, R2 KYC docs orphelins, cron purge dry-run)
    - **`docs/runbook/rgpd-compliance.md`** (NEW ~80 lignes — important legal) : Art. 17 RGPD droit à l'effacement, NFR1 + NFR25, retention 10 ans légale FR comptable, anonymisation policy détaillée (champs PII vs champs comptables), backup retention V1 (Story 0.12), audit trail Keycloak archive, droits autres RGPD (accès Story 1.x V1, rectification Story 1.8, portabilité V1)
    - **`docs/runbook/account-deletion-cascade-impacts.md`** (NEW ~40 lignes) : downstream services consume `user-deleted.v1` event (review-svc, messaging-svc, catalog-svc, booking-svc) — Stories 5.7, 5.2, 3.11, 4.x
    - **Update `packages/contracts/README.md`** : section Identity events + RGPD compliance notes
    - **Métriques Prom** : `tukio_account_deletion_attempts_total{result=success|active_bookings_blocked|keycloak_external|user_not_found}`, `tukio_account_deletion_duration_seconds`, `tukio_purge_deleted_accounts_total`
    - **Dashboard Grafana** : 4 panels (delete rate, blocked rate, post-delete Keycloak drift, cron purge runs)
    - **Audit log** : event `identity.user.deleted.v1` consume Story 2.7 — admin audit log permet de retrouver toutes les deletions historiques (audit trail RGPD-compliant 10 ans)

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` extensions** (AC: #4, #8)
  - [ ] 1.1 — Créer events `identity/user-deleted.v1.{schema.json,ts}` + `identity/user-purged.v1.{schema.json,ts}`
  - [ ] 1.2 — Update `types/error-codes.ts` : `IDENTITY-CONFLICT-003`
  - [ ] 1.3 — Build + test

- [ ] **Task 2 — identity-svc : domain methods + use case + tests** (AC: #4, #5)
  - [ ] 2.1 — Update `domain/model/user-profile.aggregate.ts` : ajouter `softDelete()` + `anonymize({locale})`
  - [ ] 2.2 — Update `domain/model/pro-profile.aggregate.ts` : ajouter `softDelete()` + `anonymizePartial()`
  - [ ] 2.3 — Update `domain/ports/keycloak-admin.port.ts` (Story 1.5 had `logoutAllSessions`) : confirme exists
  - [ ] 2.4 — Créer `domain/ports/booking-svc-client.port.ts` (IBookingSvcClient interface + Symbol BOOKING_SVC_CLIENT)
  - [ ] 2.5 — Créer `domain/ports/user-profile.repository.port.ts` extension : `findDeletedBefore(date, limit)` + `hardDelete(id)`
  - [ ] 2.6 — Créer `usecases/delete-my-account.usecase.ts` + spec (8+ cases)

- [ ] **Task 3 — identity-svc : infrastructure (BookingSvcClient + repository extensions + cron)** (AC: #6, #7)
  - [ ] 3.1 — Installer `@nestjs/schedule` (latest stable) — `pnpm --filter=identity-svc add @nestjs/schedule`
  - [ ] 3.2 — Update `app.module.ts` : import `ScheduleModule.forRoot()`
  - [ ] 3.3 — Créer `infrastructure/external/booking-svc/booking-svc.client.ts` (implements IBookingSvcClient, axios + graceful fallback)
  - [ ] 3.4 — Créer `infrastructure/external/booking-svc/booking-svc.module.ts`
  - [ ] 3.5 — Update `infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts` : ajouter `findDeletedBefore` + `hardDelete`
  - [ ] 3.6 — Update `pro-profile.typeorm.repository.ts` : `findByUserProfileId` (déjà ?) + `softDelete` cascade-aware
  - [ ] 3.7 — Créer `tasks/purge-deleted-accounts.task.ts` (Cron 4am quotidien)
  - [ ] 3.8 — Update `app.module.ts` : ajouter `PurgeDeletedAccountsTask` provider
  - [ ] 3.9 — Update `.env.example` : `BOOKING_SVC_URL`
  - [ ] 3.10 — Tests integration : nock booking-svc graceful fallback + Postgres testcontainer purge cron simulation

- [ ] **Task 4 — identity-svc : controller + UseCasesProxyModule wiring** (AC: #2, #3)
  - [ ] 4.1 — Update `infrastructure/http/controllers/me.controller.ts` (Story 1.8) : ajouter `@Delete('/by-id/:id')` + `@Get('/by-id/:id/active-bookings')` endpoints internal
  - [ ] 4.2 — DTOs Zod
  - [ ] 4.3 — Update `usecases-proxy.module.ts` : ajouter `DELETE_MY_ACCOUNT_USECASES_PROXY`
  - [ ] 4.4 — Tests E2E

- [ ] **Task 5 — gateway-api : 2 endpoints `DELETE /v1/me` + `GET /v1/me/active-bookings`** (AC: #2, #3)
  - [ ] 5.1 — Update `usecases/me/me.forwarder.ts` (Story 1.8) : ajouter `deleteMe` + `getActiveBookings`
  - [ ] 5.2 — Update `domain/ports/identity-svc.port.ts` + `identity-svc.client.ts` : 2 méthodes
  - [ ] 5.3 — Update `infrastructure/http/controllers/me.controller.ts` (Story 1.8) : 2 endpoints
  - [ ] 5.4 — Throttle config : `'me-delete'` 3/h/user (anti-spam suppression)
  - [ ] 5.5 — Tests E2E (5+ cases AC2+3)

- [ ] **Task 6 — Frontend pages + modale + hook** (AC: #1)
  - [ ] 6.1 — Créer `packages/api-client/src/hooks/identity/{use-delete-my-account,use-active-bookings}.ts`
  - [ ] 6.2 — Créer `apps/customer/src/app/[locale]/account/settings/page.tsx` (Server Component)
  - [ ] 6.3 — Créer `apps/customer/src/features/account/settings/components/{SettingsLayout,DangerZoneSection,DeleteAccountModal}.tsx`
  - [ ] 6.4 — Créer `apps/seller/src/app/[locale]/seller/settings/page.tsx` (similaire customer + Pro variant)
  - [ ] 6.5 — Update `apps/customer/messages/{fr,en}.json` namespace `account.settings.deleteAccount.*`
  - [ ] 6.6 — Update `apps/seller/messages/{fr,en}.json` similaire
  - [ ] 6.7 — Update `apps/public/src/app/[locale]/page.tsx` (homepage Story 0.x) : lire `?account-deleted=true` query param + afficher toast 5s

- [ ] **Task 7 — Tests Playwright e2e + axe-core** (AC: #9)
  - [ ] 7.1 — Créer 2 spec files (customer + seller delete-account)
  - [ ] 7.2 — Helpers : pré-créer user fixture, mock booking-svc
  - [ ] 7.3 — Test re-creation post-delete (avec même email)
  - [ ] 7.4 — Tests axe-core focus-trap modale

- [ ] **Task 8 — Documentation RGPD + observability + commit** (AC: #10)
  - [ ] 8.1 — Créer `docs/runbook/account-deletion-debug.md` + `rgpd-compliance.md` + `account-deletion-cascade-impacts.md`
  - [ ] 8.2 — Métriques Prom + dashboard
  - [ ] 8.3 — Update `packages/contracts/README.md`
  - [ ] 8.4 — Lint + typecheck + tests + coverage
  - [ ] 8.5 — Commit `feat(identity): account deletion soft-delete + RGPD anonymization (DELETE /v1/me + active bookings pre-check + Keycloak disable + cron purge 10y + audit event + Playwright e2e)` — Story 1.9 done

## Dev Notes

### Pourquoi Story 1.9 = closing du flow user lifecycle

Stories 1.2/1.3 (register) → 1.4 (login) → 1.5 (password reset) → 1.6 (email verify) → 1.7 (admin TOTP) → 1.8 (profile edit) → **Story 1.9 (delete)**. Story 1.9 ferme le **lifecycle complet user** : un user peut maintenant register → use platform → exit avec data anonymized + RGPD-compliant.

Story 1.9 = template "soft-delete + anonymisation + cron purge" réutilisable :
- **Story 6.5** (admin suspend/ban — sanction graduée + bannissement avec hash anti-recréation R10)
- **Story 9.x V1** (subscription cancel pro)
- **Stories Epic 4** (booking cancel — pattern différent : cancel ≠ delete, mais réutilise audit event)

### Décisions techniques majeures actées

1. **Soft-delete + anonymisation immédiate** (vs hard delete + retention backup) — RGPD Art. 17 strict + NFR1 conservation comptable 10 ans
2. **Email anonymisé `deleted-{userId}@deleted.tukio.one`** — unique per user (no collision), domain `deleted.tukio.one` réservé pour ce usage
3. **Anonymisation partielle ProProfile** — keep companyName + SIRET (legal facturation 10y), anonymize PII operational (contactPhone, kyc_decision_reason)
4. **Keycloak disable (pas delete)** — audit trail Keycloak archive 10y, hard delete au cron purge 10y
5. **Pre-check active bookings sync HTTP** — graceful fallback MVP si booking-svc unreachable. Story 4.1 obligatoire d'exposer endpoint avant production
6. **Modale destructrice avec type-to-confirm** — UX best practice OWASP/RGPD anti-erreur — pattern réutilisable
7. **Cron purge `@nestjs/schedule`** — daily 4am UTC, batch 100/run, error per-user non-bloquant
8. **Re-creation autorisée même email** — ancien email anonymisé donc no collision
9. **`identity.user.deleted.v1` event downstream propagation** — review-svc, messaging-svc, catalog-svc, booking-svc consume + anonymize leurs caches
10. **Frontend logout post-delete** — réutilise Story 1.4 logout flow

### Versions à utiliser

| Lib | Rôle | Version |
|---|---|---|
| **`@nestjs/schedule`** | Cron job purge | latest stable |
| **Existing**: KeycloakAdminClient (Story 1.2), TypeORM (Story 0.6), Stories 1.4-1.8 patterns | — | — |

### Project Structure cible

```
packages/contracts/src/
├─ events/identity/{user-deleted,user-purged}.v1.{schema.json,ts}  # NEW (4)
└─ types/error-codes.ts                                             # UPDATE — IDENTITY-CONFLICT-003

apps/identity-svc/src/
├─ domain/
│  ├─ model/user-profile.aggregate.ts                               # UPDATE Story 1.2 — softDelete + anonymize
│  ├─ model/pro-profile.aggregate.ts                                # UPDATE Story 1.3 — softDelete + anonymizePartial
│  ├─ ports/booking-svc-client.port.ts                              # NEW
│  └─ ports/user-profile.repository.port.ts                         # UPDATE — findDeletedBefore + hardDelete
├─ usecases/delete-my-account.usecase.ts + spec                     # NEW
├─ tasks/purge-deleted-accounts.task.ts                             # NEW (Cron @nestjs/schedule)
└─ infrastructure/
   ├─ external/booking-svc/{booking-svc.client.ts,booking-svc.module.ts,errors.ts}  # NEW (3)
   ├─ persistence/typeorm/repositories/{user-profile,pro-profile}.typeorm.repository.ts  # UPDATE — findDeletedBefore + hardDelete + softDelete cascade
   └─ http/controllers/me.controller.ts                             # UPDATE Story 1.8 — DELETE + GET active-bookings

apps/identity-svc/.env.example                                      # UPDATE — BOOKING_SVC_URL

apps/gateway-api/src/
├─ usecases/me/me.forwarder.ts                                      # UPDATE Story 1.8 — deleteMe + getActiveBookings
├─ infrastructure/external/identity-svc/identity-svc.client.ts      # UPDATE — 2 méthodes
└─ infrastructure/http/controllers/me.controller.ts                 # UPDATE Story 1.8 — 2 endpoints

apps/customer/src/
├─ app/[locale]/account/settings/page.tsx                           # NEW Story 1.9
├─ features/account/settings/components/{SettingsLayout,DangerZoneSection,DeleteAccountModal}.tsx  # NEW (3)
└─ messages/{fr,en}.json                                            # UPDATE — namespace

apps/customer/e2e/account/delete-account.spec.ts                    # NEW

apps/seller/src/
├─ app/[locale]/seller/settings/page.tsx                            # NEW
├─ features/seller/settings/components/{SettingsLayout,DangerZoneSection,DeleteAccountModal}.tsx  # NEW (3)
└─ messages/{fr,en}.json                                            # UPDATE

apps/seller/e2e/seller/delete-account.spec.ts                       # NEW

apps/public/src/app/[locale]/page.tsx                               # UPDATE — read ?account-deleted=true + toast

packages/api-client/src/hooks/identity/{use-delete-my-account,use-active-bookings}.ts  # NEW (2)

infra/k8s/grafana-dashboards/account-deletion.json                  # NEW
docs/runbook/{account-deletion-debug,rgpd-compliance,account-deletion-cascade-impacts}.md  # NEW (3)

# Estimation total fichiers : ~40 nouveaux + ~15 updates = ~55 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 1.2-1.8 + memories.

1. **Pretre + Symbol DI tokens + Envelope ADR-014 + Outbox transactional** (réutilisés)
2. **Soft-delete index unique partial Story 1.3** : `pro_profiles.siret WHERE deleted_at IS NULL` — soft-delete libère le SIRET pour future re-registration (acceptable RGPD + cohérent SIRET = company legal entity)
3. **Anonymisation immédiate PII** (Art. 17 RGPD)
4. **Conservation 10 ans comptable** (NFR1 légal FR)
5. **Audit event 10 ans archive** (backups Story 0.12)
6. **i18n + EN strict** réutilisés
7. **Keycloak disable non-fatal** (drift R8 — reconciliation Story 1.10)
8. **Cron purge graceful per-user error handling** — un fail ne bloque pas les autres

### Previous Story Intelligence

**Story 1.2** : 🔴 UserProfile aggregate (Story 1.9 ajoute softDelete + anonymize), KeycloakAdminService updateUser (Story 1.6 ajoute, Story 1.9 utilise pour disable).

**Story 1.3** : ProProfile aggregate (Story 1.9 ajoute softDelete + anonymizePartial), media-storage R2 (Story 1.9 cron purge utilise).

**Story 1.4** : logout flow (Story 1.9 reuse post-delete).

**Story 1.5** : `IdentityExpiredException` pattern (Story 1.9 réutilise pour 410 codes).

**Story 1.6** : force-refresh utility (pas applicable Story 1.9 — user logged out post-delete).

**Story 1.7** : RolesGuard pattern (pas applicable Story 1.9 — endpoint simply requires JWT).

**Story 1.8** : me.controller (Story 1.9 ajoute 2 endpoints DELETE + GET active-bookings).

### What this story does NOT do (out of scope)

- ❌ **Admin suspend/ban (sanction graduée)** → Story 6.5 (réutilise pattern Story 1.9 mais reason='admin-suspended' + hash anti-recréation R10)
- ❌ **Subscription cancel Pro** → V1 Story 9.x
- ❌ **Booking cancel** → Story 4.8 (pattern différent — cancel ≠ delete user)
- ❌ **Data export (RGPD portability)** → V1 Story 1.x (token-based pattern Story 1.5/1.6 réutilisé)
- ❌ **review-svc, messaging-svc, catalog-svc, booking-svc consumers** → Stories 5.7, 5.2, 3.11, 4.x (Story 1.9 publish event only, downstream consume est leur responsabilité)
- ❌ **Backup retention 10 years archive** → Story 0.12 ArgoCD + Hetzner backup config (Story 1.9 documente policy)

### Files to UPDATE vs CREATE

(cf. Project Structure cible)

### Testing Standards

- Coverage ≥ 90 % use case + 80 % endpoints + 80 % frontend
- Tests unit Vitest mocks + integration testcontainers (Postgres + Keycloak + booking-svc nock mock)
- Tests E2E Playwright FR/EN + axe-core (8 cases AC9)
- Performance NFR48 ≤ 3s p90 delete (incluant Keycloak disable + cron-trigger event publish)

### Project Structure Notes

✅ Aligné avec architecture, PRD §FR15 + NFR1 + NFR25, epics, Stories 1.2-1.8, memories.

⚠️ **Décision documentée** : graceful fallback booking-svc unreachable MVP — Story 4.1 doit obligatoirement exposer endpoint (cf. Décisions §5).

⚠️ **Décision documentée** : ProProfile siège social conservé partiellement (legal accounting) vs full anonymize (RGPD strict) — à valider avec avocat numérique avant launch (cf. NFR21 audit avocat obligatoire).

⚠️ **À noter** : Story 6.5 (admin sanction graduée) réutilisera massivement Story 1.9 patterns avec `reason: 'admin-suspended' | 'admin-banned'` + hash anti-recréation R10.

### References

- [Source: epics.md#Epic-1-Story-1.9 — Lines 1208-1220]
- [Source: prd.md#FR15 — Account delete soft-delete + RGPD]
- [Source: prd.md#NFR1 — RGPD conservation 10 ans]
- [Source: prd.md#NFR25 — Soft-delete anonymisation]
- [Source: prd.md#NFR21 — Audit avocat numérique obligatoire]
- [Source: 1-2 (UserProfile + KeycloakAdmin), 1-3 (ProProfile + R2), 1-4 (logout), 1-5 (IdentityExpired pattern), 1-8 (me.controller)]
- [External: https://eur-lex.europa.eu/eli/reg/2016/679/oj — RGPD Art. 17 droit à l'effacement]
- [External: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045766965 — Code commerce art. L123-22 conservation 10 ans]
- [External: https://docs.nestjs.com/techniques/task-scheduling — @nestjs/schedule]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md]

## Dev Agent Record

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 2 (9ᵉ story Epic 1)
- **Estimation effort** : 4-5 jours (1 dev fullstack — story moyenne complexité, ~55 fichiers, attention RGPD wording + audit avocat numérique pour validation finale)
- **Dépendances upstream** :
  - Stories 1.2 (UserProfile), 1.3 (ProProfile + R2), 1.4 (logout flow), 1.5 (IdentityExpired pattern), 1.8 (me.controller)
- **Dépendances downstream** :
  - **Story 1.10** (consolidation + reconciliation) — consume `identity.user.deleted.v1` + cron purge déjà livré Story 1.9
  - **Story 4.1** (booking-svc) — 🔴 **doit exposer `GET /internal/bookings/active`** avant production deletion
  - **Story 5.2** (messaging-svc) — consume event pour anonymize message threads
  - **Story 5.7** (review-svc display) — consume event pour anonymize author display
  - **Story 3.11** (pro-public-profile) — masquer Pro deleted
  - **Story 6.5** (admin sanction) — réutilise patterns Story 1.9
  - **Story 2.7** (audit log) — consume event
- **FRs covered** :
  - **FR15** ✅ Account delete soft-delete + anonymisation
- **NFRs touchés** :
  - **NFR1** ✅ RGPD conservation 10 ans
  - **NFR9** ✅ HTTPS + CSRF
  - **NFR25** ✅ Soft-delete anonymisation
  - **NFR48** ✅ UX
  - **NFR71** ✅ Coverage

> **Prochaine story → Story 1.10** (identity-svc Pretre consolidation + reconciliation jobs)

---

**Dev agent next steps :**
1. Lire ce file en entier
2. Vérifier upstream Stories 1.2-1.8 implémentées
3. **CRITIQUE** : valider wording RGPD modale + emails avec avocat numérique avant launch (NFR21)
4. **CRITIQUE** : Story 4.1 doit exposer `GET /internal/bookings/active` endpoint avant que des bookings réels existent (graceful fallback MVP acceptable mais risque d'évasion delete)
5. Implémenter Tasks 1-8
6. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test && pnpm playwright test --grep "delete account"`
7. Commit Story 1.9 quand : 8/8 e2e tests passent + coverage thresholds + axe-core 0 violations + RGPD wording validé
8. Update sprint-status : `1-9-account-deletion-soft-delete-rgpd: review` puis `done`
