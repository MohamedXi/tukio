# Story 1.8: Profile management (`GET /v1/me` + `PATCH /v1/me`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Customer / Pro authentifié,
**I want** consulter et éditer mon profil (`apps/customer/{locale}/account/profile` pour Customer / `apps/seller/{locale}/seller/profile` pour Pro avec extension Pro fields readonly), avec **`GET /v1/me`** retournant l'enveloppe ADR-014 `{ code:200, data:{ id, email, role, firstName, lastName, locale, phone?, address?, marketingOptIn, emailVerified, createdAt, ...prosFields? } }` (le shape `prosFields` = `{ companyName, siret, vatNumber?, address: {street, postalCode, city, country}, contactPhone, kycStatus, kycDocsUploaded: {idCard, rib, kbisOrInsee?} }` quand `role=='pro'`), **`PATCH /v1/me`** acceptant un body partial Zod-validé `{ firstName?, lastName?, phone?, address?, locale?, marketingOptIn?, contactPhone? (Pro), companyName? (Pro readonly check) }` qui (a) update le `UserProfile` aggregate + `ProProfile` aggregate (si Pro) en transaction TypeORM atomique, (b) sync les champs pertinents vers Keycloak Admin API `users.update({firstName, lastName, attributes: {locale: [newLocale]}})` (Story 1.2 KeycloakAdminService réutilisé), (c) publie NATS event `identity.user.profile-updated.v1` (audit + downstream consume Story 2.7), (d) si `locale` change → frontend force-refresh JWT (Story 1.6 utility) → middleware next-intl Story 0.9 détecte nouveau claim `tukio:locale` au prochain navigation → redirect `/{newLocale}/account/profile` ; **email NON mutable MVP** → 422 enveloppe `IDENTITY-VALIDATION-003 "Le changement d'email nécessite une procédure dédiée"` (déféré V1 FR via Story 1.x token-based confirmation pattern Story 1.5/1.6) ; **Pro fields sensibles readonly RGPD NFR1** : SIRET, KYC docs paths, kycStatus, companyName (legalement attaché au SIRET) → si user PATCH ces fields → 422 + `"Modification via support : support@tukio.one"` ; **UX-DR11 account settings** : Server Component layout fetch `GET /v1/me` côté server (avec cookies forwarded), Client Component form React Hook Form + Zod resolver (réutilise `RegisterCustomerInputSchema` partial Story 1.2 — DRY) avec validation inline + optimistic update via TanStack Query mutation + toast succès/erreur, support `<FormField>`/`<Input>`/`<Button>` Story 0.4 atomics + `<Address>` composite Story 1.3 ; **i18n strict** + **EN strict tech** (memories) + **accessibility RGAA AA** axe-core 0 violations,
**so that** les users peuvent maintenir leur info à jour en autonomie (réduit charge support customer Story 6.x), changer leur langue préférée propagée à toute la stack (next-intl + NATS events + emails Resend Story 5.4 + Meilisearch index Story 3.x), gérer leur opt-in marketing RGPD (NFR27) ; les Stories Epic 2-7 (admin verification queue Story 2.3, listing display Pro Story 3.11 pro-public-profile, messaging Story 5.2, reviews Story 5.7) consomment un **`<UserProfileCard>` shared atomic** alimenté par `useMe()` hook ; et le **pattern complet "self-service profile edit"** devient template Story 1.9 (account delete — pattern différent mais utilise même `<UserProfileCard>` + invalidation Story 1.4 sessions), Story 4.x (booking modification), Story 8.x V1 (B2B billing settings).

> **Outcome attendu** : à la fin de cette story, un Customer authentifié sur `customer.tukio.one/fr/account/profile` voit ses infos pré-remplies (Server Component fetch `GET /v1/me`) → édite firstName + locale `fr → en` → submit → toast succès `"Profil mis à jour"` → frontend force-refresh JWT → naviguer une autre page → middleware next-intl redirect `/en/account/profile` ; un Pro sur `seller.tukio.one/fr/seller/profile` voit ses infos personnelles (firstName, lastName, phone, locale) en mutable + ses infos société (companyName, SIRET, vatNumber, KYC docs links via signed URLs Story 1.3) en readonly avec mention "Modification via support" ; un Customer qui essaie de change son email via API (curl bypass UI) → 422 + `"IDENTITY-VALIDATION-003"` ; un Pro qui essaie de change son SIRET via API → 422 + `"Pro core fields are read-only, contact support"` ; un test `pnpm playwright test --grep "profile"` passe en FR ET EN, axe-core 0 violations, 8 scénarios (happy path Customer FR/EN edit name+locale, happy path Pro view + edit phone, Pro readonly fields blocked, email change blocked, locale change → force-refresh → redirect, optimistic update + rollback on error, marketing opt-in toggle, mobile responsive).

## Acceptance Criteria

1. **AC1 — Frontend Customer page `apps/customer/[locale]/account/profile`** : Given un Customer authentifié, When il accède `customer.tukio.one/{fr|en}/account/profile`, Then :
   - **Server Component layout** : fetch `GET /v1/me` côté server (avec cookies forwarded automatically Next.js — pattern Story 1.4 callback) → si erreur 401, redirect login → si OK, render avec data
   - **Hero** : `<h1>Mon profil</h1>` (FR) / `<h1>My profile</h1>` (EN), Fraunces 500
   - **Section "Informations personnelles"** (form Client Component `<CustomerProfileForm>`) :
     - `<FormField label="Email" type="email" disabled value={user.email}>` avec helper `<small>Pour modifier votre email, contactez le support</small>`
     - `<FormField label="Prénom" type="text" required>` avec value pre-filled
     - `<FormField label="Nom" type="text" required>` avec value pre-filled
     - `<FormField label="Téléphone (optionnel)" type="tel">` avec validation FR pattern `^(?:\+33|0)[1-9]\d{8}$`
     - `<select label="Langue préférée">` `Français` / `English` (default = current `locale`)
     - `<Checkbox label="Recevoir les nouveautés Tukio par email" name="marketingOptIn">` (RGPD opt-in)
   - **Section "Adresse (optionnel)"** : 4 `<FormField>` (street, postalCode, city, country=FR readonly MVP) — collapsible `<details>` open/closed
   - **CTA primary** : `<Button variant="primary" type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>Enregistrer les modifications</Button>` — disabled si form unchanged
   - **Optimistic update** : TanStack Query mutation `useUpdateMyProfile` setQueryData immédiat + rollback si error → toast `"Profil mis à jour"` ou `"Erreur, modifications annulées"`
   - **Locale change handling** : si user change locale + submit → après success, trigger `force-refresh.ts` (Story 1.6 utility) → window.location.assign(`/{newLocale}/account/profile`) (full reload pour middleware next-intl read new JWT claim)
   - **Lien tertiaire** : `<Link href="/{locale}/account/security">Sécurité (mot de passe, 2FA, sessions)</Link>` (placeholder Story 1.x V1+ Settings)
   - **Lien dangereux** : `<Link href="/{locale}/account/delete" variant="danger">Supprimer mon compte</Link>` (Story 1.9)
   - **i18n strict** : namespace `account.profile.*` (~25 keys) dans `apps/customer/messages/{fr,en}.json`
   - **Accessibilité RGAA AA** : labels associés, `aria-required`, `aria-invalid`, focus visible, errors `role="alert"`, axe-core 0 violations
   - **Tests E2E** : (cf. AC9) — happy path FR + EN, locale change flow, marketing toggle, axe-core

2. **AC2 — Frontend Pro page `apps/seller/[locale]/seller/profile`** : Given un Pro `tukio_status='active'` (validé Story 2.5), When il accède `seller.tukio.one/{fr|en}/seller/profile`, Then :
   - **Layout** : Server Component fetch `GET /v1/me` (response avec `prosFields`)
   - **Section "Informations personnelles"** : identique Customer (firstName, lastName, phone, locale, marketingOptIn) — mutable
   - **Section "Société (lecture seule)"** :
     - `<FormField label="Raison sociale" disabled value={user.prosFields.companyName}>`
     - `<FormField label="SIRET" disabled value={user.prosFields.siret}>` (formaté `XXX XXX XXX XXXXX` pour readability)
     - `<FormField label="N° TVA" disabled value={user.prosFields.vatNumber ?? '-'}>`
     - `<FormField label="Téléphone professionnel" disabled value={user.prosFields.contactPhone}>` — **Décision MVP** : Pro contactPhone = readonly (cohérent SIRET fixe). Si Pro veut changer → support. Alternative : autoriser mutable + sync via `PATCH /v1/me` body `proContactPhone?` — **décision finale Story 1.8** : MVP readonly, V1 mutable (Story 2.x) si demandé.
     - Address Pro (siège social) : 4 fields readonly — modification via support (cohérent SIRET legal)
     - Mention generale : `<small>Pour modifier ces informations, contactez <Link href="mailto:support@tukio.one">support@tukio.one</Link></small>`
   - **Section "Documents KYC (lecture seule)"** :
     - 3 entries with status badges :
       - "Pièce d'identité" : badge `kycStatus === 'approved' ? 'Validé' : 'En cours'` + lien `<Link href={signedUrl}>Télécharger</Link>` (signed URL 5 min via `GET /v1/me/kyc-doc/:type` endpoint NEW Story 1.8)
       - "RIB" : idem
       - "Kbis (optionnel)" : idem ou `"Non fourni"`
     - Mention : `<small>Pour remplacer un document, contactez le support</small>`
   - **Section "Statut Stripe Connect"** (placeholder Story 2.1 — Story 1.8 affiche juste `<Badge>` "Connecté" / "Non connecté" basé sur `prosFields.stripeConnected: boolean` retourné par `GET /v1/me`)
   - **Tests E2E** : verify rendering Pro fields readonly, signed URL download fonctionne (Story 1.3 R2 reused)

3. **AC3 — gateway-api endpoint `GET /v1/me`** : Given un user authentifié (any role), When il appelle `GET /v1/me` :
   - **Endpoint** :
     ```ts
     @Controller('/v1/me')
     export class MeController {
       @Get('/')
       @UseGuards(KeycloakJwtGuard) // Story 0.8 — requires JWT
       @HttpCode(200)
       async me(@CurrentActor() actor: Actor): Promise<MeResponse> {
         return this.meForwarder.getInstance().getMe({ actor });
       }
     }
     ```
   - **Forwarder** : appelle identity-svc `GET /internal/users/by-id/{userId}` (NEW endpoint Story 1.8) avec actor + `X-Internal-Service-Token`
   - **identity-svc use case `GetMyProfileUseCase`** : fetch `UserProfile` aggregate + (si role=pro) `ProProfile` aggregate + (si pro KYC docs uploaded) generate signed URLs 5 min via `MediaStorage.getSignedDownloadUrl` Story 1.3 → return shape :
     ```json
     {
       "method": "GET",
       "code": 200,
       "data": {
         "id": "uuid",
         "email": "user@example.com",
         "role": "client" | "pro" | "admin-...",
         "firstName": "Marie",
         "lastName": "Dupont",
         "locale": "fr",
         "phone": "+33612345678",
         "address": { "street": "1 rue de Rennes", "postalCode": "44000", "city": "Nantes", "country": "FR" },
         "marketingOptIn": true,
         "emailVerified": true,
         "tukioStatus": "active",
         "createdAt": "2026-05-09T10:30:00Z",
         "prosFields": {  // present if role==='pro'
           "companyName": "Marc Loueur SARL",
           "siret": "12345678901234",
           "vatNumber": "FR12345678901",
           "address": {...},
           "contactPhone": "+33240123456",
           "kycStatus": "approved",
           "kycDocs": {
             "idCard": { "uploaded": true, "signedUrl": "https://r2.tukio.one/...?signature=...", "expiresAt": "..." },
             "rib": {...},
             "kbisOrInsee": null  // not uploaded
           },
           "stripeConnected": false  // Story 2.1 will populate
         }
       },
       "meta": { ... }
     }
     ```
   - **Caching** : MVP no cache côté gateway-api (data fresh per call). V1+ : 30s edge cache si KYC signed URLs expiry > 5 min.
   - **Tests E2E** : Customer → response sans prosFields. Pro active → avec prosFields + signed URLs. Admin → ne devrait pas accéder `/v1/me` au sens user (admin a son propre `/v1/admin/me` Story 6.x — décision MVP : admin reçoit même shape `/v1/me` mais sans prosFields). Sans JWT → 401.

4. **AC4 — gateway-api endpoint `PATCH /v1/me`** : Given un user authentifié, When il appelle `PATCH /v1/me` avec body partial :
   - **Endpoint** :
     ```ts
     @Patch('/')
     @UseGuards(KeycloakJwtGuard, CsrfGuard) // CSRF Story 1.4 enforced
     @HttpCode(200)
     async updateMe(@Body() dto: UpdateMyProfileInput, @CurrentActor() actor: Actor): Promise<MeResponse> {
       return this.meForwarder.getInstance().updateMe({ actor, updates: dto });
     }
     ```
   - **Validation Zod** : `UpdateMyProfileInputSchema` partial (tous fields optional sauf cohérence) :
     ```ts
     export const UpdateMyProfileInputSchema = z.object({
       firstName: z.string().min(1).max(80).optional(),
       lastName: z.string().min(1).max(80).optional(),
       phone: z.string().regex(/^(?:\+33|0)[1-9]\d{8}$/).nullable().optional(),
       address: ProAddressSchema.partial().optional(), // Story 1.3 schema
       locale: LocaleSchema.optional(),
       marketingOptIn: z.boolean().optional(),
     }).refine(data => Object.keys(data).length > 0, 'At least one field required');
     ```
   - **Email change blocked** : si body contient `email` field (même via `(body as any).email`) → throw `IdentityValidationException('IDENTITY-VALIDATION-003', "Email change requires a dedicated procedure (V1)")` → 422 enveloppe
   - **Pro readonly fields blocked** : si role=pro et body contient `companyName`/`siret`/`vatNumber`/`proAddress`/`contactPhone` → throw `IdentityValidationException('IDENTITY-VALIDATION-005', "Pro core fields are read-only. Contact support@tukio.one")` → 422
   - **identity-svc use case `UpdateMyProfileUseCase`** :
     1. Fetch UserProfile aggregate via `findById(actor.userId)`
     2. Apply mutations via aggregate methods (domain encapsulated) : `userProfile.changeName(firstName, lastName)`, `userProfile.changePhone(phone)`, `userProfile.changeAddress(address)`, `userProfile.changeLocale(newLocale)`, `userProfile.setMarketingOptIn(opt)` — chaque méthode valide invariants + set `updatedAt = NOW()`
     3. Persist via `userProfileRepo.save(userProfile)` dans transaction
     4. Sync Keycloak via `keycloakAdmin.updateUser({ keycloakUserId, updates: { firstName, lastName, attributes: { locale: [newLocale] } } })` — **non-fatal si fail** (drift R8 mitigation Story 1.10 reconciliation)
     5. Publish event `identity.user.profile-updated.v1` (audit + downstream)
     6. Return updated UserProfile (re-fetched complète)
   - **Réponse** : same shape que `GET /v1/me` (full updated profile)
   - **Tests E2E** : valid update firstName → 200 + DB updated + Keycloak synced + event published. Locale change → 200 + KC attribute updated. Email in body → 422. Pro core field → 422. Empty body → 422.

5. **AC5 — gateway-api endpoint `GET /v1/me/kyc-doc/:type` (Pro signed URL on-demand)** : Given un Pro authentifié, When il appelle `GET /v1/me/kyc-doc/idCard` (or `rib`, `kbisOrInsee`) :
   - **Endpoint** :
     ```ts
     @Get('/kyc-doc/:type')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro')
     async getKycDocSignedUrl(@Param('type') type: 'idCard' | 'rib' | 'kbisOrInsee', @CurrentActor() actor: Actor): Promise<{ signedUrl: string; expiresAt: string }> {
       return this.meForwarder.getInstance().getKycDocSignedUrl({ actor, type });
     }
     ```
   - **identity-svc** : fetch ProProfile via `findByUserProfileId(userId)` → si type non uploaded → 404. Sinon, generate signed URL 5 min via `MediaStorage.getSignedDownloadUrl` Story 1.3 → return URL + expiresAt
   - **Throttle** : 30/min/user (anti-abuse — éviter qu'un user spam pour scraper signed URLs)
   - **Audit log** : publish event `identity.kyc-doc.accessed.v1` (Story 2.7 audit Pro accède ses KYC docs)
   - **Tests E2E** : Pro avec idCard → 200 + signedUrl. Pro sans kbis → 404 si type=kbisOrInsee. Customer (rôle client) → 403.

6. **AC6 — identity-svc use case `UpdateMyProfileUseCase` + UserProfile aggregate domain methods** : Given Pretre architecture, When je consulte `apps/identity-svc/src/`, Then :
   - **Update `domain/model/user-profile.aggregate.ts`** (Story 1.2) : ajouter méthodes domain :
     ```ts
     changeName(firstName: string, lastName: string): void {
       if (firstName.trim().length === 0 || lastName.trim().length === 0) throw new InvalidNameError();
       this.firstName = firstName.trim();
       this.lastName = lastName.trim();
       this.updatedAt = new Date();
     }
     changePhone(phone: string | null): void {
       if (phone && !/^(?:\+33|0)[1-9]\d{8}$/.test(phone)) throw new InvalidPhoneError();
       this.phone = phone;
       this.updatedAt = new Date();
     }
     changeAddress(address: Address | null): void {
       this.address = address;
       this.updatedAt = new Date();
     }
     changeLocale(locale: Locale): void {
       if (this.locale === locale) return; // idempotent
       this.locale = locale;
       this.updatedAt = new Date();
     }
     setMarketingOptIn(opt: boolean): void {
       if (this.marketingOptIn === opt) return;
       this.marketingOptIn = opt;
       this.updatedAt = new Date();
     }
     ```
   - **Update `infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts`** (Story 1.2) : ensure `save` upsert correctement (existing row update, pas insert new — vérifier `INSERT ... ON CONFLICT (id) DO UPDATE` ou `UPDATE WHERE id`)
   - **NEW use case `GetMyProfileUseCase`** (`apps/identity-svc/src/usecases/get-my-profile.usecase.ts`) :
     ```ts
     async execute(input: { userId: string }): Promise<MeResponse> {
       const userProfile = await this.userProfileRepo.findById(input.userId);
       if (!userProfile || userProfile.deletedAt) throw new IdentityNotFoundException('IDENTITY-NOT-FOUND-001');
       
       let prosFields = undefined;
       if (userProfile.role === 'pro') {
         const proProfile = await this.proProfileRepo.findByUserProfileId(userProfile.id);
         if (proProfile) {
           const kycDocs = await this.generateKycSignedUrls(proProfile);
           prosFields = ProProfileMapper.toMeResponse(proProfile, kycDocs);
         }
       }
       
       return UserProfileMapper.toMeResponse(userProfile, prosFields);
     }

     private async generateKycSignedUrls(proProfile: ProProfile): Promise<KycDocsSignedUrls> {
       const bucket = this.config.getR2KycBucket();
       const generateUrl = (key: string | null) => key ? this.mediaStorage.getSignedDownloadUrl({ bucket, key, expiresInSeconds: 300 }) : Promise.resolve(null);
       const [idCardUrl, ribUrl, kbisUrl] = await Promise.all([
         generateUrl(proProfile.kycIdCardR2Key),
         generateUrl(proProfile.kycRibR2Key),
         generateUrl(proProfile.kycKbisR2Key),
       ]);
       const expiresAt = new Date(Date.now() + 300 * 1000);
       return { idCard: { uploaded: true, signedUrl: idCardUrl, expiresAt }, rib: { uploaded: true, signedUrl: ribUrl, expiresAt }, kbisOrInsee: kbisUrl ? { uploaded: true, signedUrl: kbisUrl, expiresAt } : null };
     }
     ```
   - **NEW use case `UpdateMyProfileUseCase`** (`apps/identity-svc/src/usecases/update-my-profile.usecase.ts`) :
     ```ts
     async execute(input: { userId: string; updates: UpdateMyProfileInput }): Promise<MeResponse> {
       const userProfile = await this.userProfileRepo.findById(input.userId);
       if (!userProfile || userProfile.deletedAt) throw new IdentityNotFoundException('IDENTITY-NOT-FOUND-001');
       
       // Apply mutations via aggregate methods (validates invariants)
       const localeChanged = input.updates.locale && input.updates.locale !== userProfile.locale;
       if (input.updates.firstName !== undefined || input.updates.lastName !== undefined) {
         userProfile.changeName(input.updates.firstName ?? userProfile.firstName, input.updates.lastName ?? userProfile.lastName);
       }
       if (input.updates.phone !== undefined) userProfile.changePhone(input.updates.phone);
       if (input.updates.address !== undefined) userProfile.changeAddress(input.updates.address ? Address.of(input.updates.address) : null);
       if (input.updates.locale !== undefined) userProfile.changeLocale(input.updates.locale);
       if (input.updates.marketingOptIn !== undefined) userProfile.setMarketingOptIn(input.updates.marketingOptIn);
       
       // Persist + sync Keycloak + publish event in transaction
       await this.userProfileRepo.runInTransaction(async (txn) => {
         await txn.userProfileRepo.save(userProfile);
         
         // Publish audit event (always — even if Keycloak sync fails)
         await txn.eventPublisher.publish({
           eventType: 'identity.user.profile-updated',
           eventVersion: 'v1',
           aggregate: { type: 'UserProfile', id: userProfile.id },
           actor: { userId: userProfile.id, role: userProfile.role },
           payload: {
             userProfileId: userProfile.id,
             changes: input.updates, // PII — log redacted in observability layer Story 0.6
             localeChanged,
             updatedAt: new Date().toISOString(),
           },
         });
       });
       
       // Sync Keycloak (non-fatal — drift R8 mitigated Story 1.10 reconciliation)
       try {
         await this.keycloakAdmin.updateUser({
           keycloakUserId: userProfile.keycloakUserId,
           updates: {
             firstName: userProfile.firstName,
             lastName: userProfile.lastName,
             attributes: { locale: [userProfile.locale] },
           },
         });
       } catch (e) {
         // Log + continue (drift R8 acceptable MVP — reconciliation Story 1.10)
       }
       
       // Re-fetch + return updated
       return this.getMyProfileUseCase.execute({ userId: input.userId });
     }
     ```
   - **Tests unit** ≥ 90 % coverage (8+ cases each : happy path, invalid name, invalid phone, locale change, marketing toggle, idempotent locale, Keycloak sync fail non-fatal, user not found)

7. **AC7 — `@tukio/contracts` extensions : DTOs + event** (AC: #4) :
   - **NEW `dtos/identity/me.dto.ts`** :
     - `MeResponseSchema` (Customer + Pro variants — discriminated union via `role`)
     - `UpdateMyProfileInputSchema` (partial Zod)
   - **NEW `events/identity/user-profile-updated.v1.{schema.json,ts}`** : audit event avec payload `{ userProfileId, changes, localeChanged, updatedAt }`
   - **Update `types/error-codes.ts`** : ajouter `IDENTITY-NOT-FOUND-001` (déjà ?), `IDENTITY-VALIDATION-003` (email change blocked), `IDENTITY-VALIDATION-005` (Pro readonly)
   - **Build pipeline** : `pnpm --filter=@tukio/contracts build && test`

8. **AC8 — Frontend hooks `useMe` + `useUpdateMyProfile` + `useGetKycDocSignedUrl`** : Given `packages/api-client/src/hooks/identity/`, When je l'ouvre, Then :
   - **`use-me.ts`** : TanStack Query `useQuery({ queryKey: ['me'], queryFn: () => fetch('/v1/me'), staleTime: 60_000 })` — cache 1 min côté client (avoid refetch on every page nav)
   - **`use-update-my-profile.ts`** : TanStack Query `useMutation({ mutationFn: (updates) => fetch('PATCH /v1/me', {body: updates}), onMutate: async (newData) => { await queryClient.cancelQueries(['me']); const prev = queryClient.getQueryData(['me']); queryClient.setQueryData(['me'], oldMe => ({...oldMe, ...newData})); return { prev }; }, onError: (err, vars, ctx) => { queryClient.setQueryData(['me'], ctx?.prev); }, onSettled: () => queryClient.invalidateQueries(['me']) })` — optimistic update + rollback
   - **`use-get-kyc-doc-signed-url.ts`** : `useMutation` qui fetch on-demand quand user clique download (pas auto-fetch — éviter signed URL expiry)

9. **AC9 — Tests Playwright e2e flow FR/EN + axe-core (NFR48 + UX-DR11)** : Given `apps/customer/e2e/account/profile.spec.ts` + `apps/seller/e2e/seller/profile.spec.ts` (NEW), 8 tests :
   - **Test 1 (Customer happy path FR)** : login Customer → naviguer `/fr/account/profile` → vérifier fields pre-filled (Server Component) → édit firstName + lastName → submit → toast succès + DB updated (test query)
   - **Test 2 (Customer happy path EN)** : idem en `/en/account/profile`
   - **Test 3 (Customer locale change → force-refresh)** : login Customer FR → change locale to `en` → submit → vérifier toast succès → vérifier window.location.assign → naviguer next page → vérifier middleware redirect `/en/account/profile` (kc:locale claim refreshed)
   - **Test 4 (Customer marketing toggle)** : toggle `marketingOptIn` checkbox → submit → vérifier event NATS published (test query outbox table) + DB updated
   - **Test 5 (Customer email change blocked)** : intercept PATCH request + inject `email` field via fetch direct (bypass UI) → vérifier 422 + UI message générique
   - **Test 6 (Pro view + edit phone)** : login Pro → naviguer `/fr/seller/profile` → vérifier company fields readonly (visual + try edit) + KYC docs links rendered → édit phone → submit → vérifier persist OK
   - **Test 7 (Pro readonly fields blocked)** : intercept PATCH + inject `siret` field → 422
   - **Test 8 (axe-core)** : 0 violations critical/serious sur 2 pages (customer + seller profile)
   - **Coverage** : ≥ 80 % gateway-api endpoints, ≥ 90 % identity-svc 2 use cases, ≥ 80 % frontend forms

10. **AC10 — Documentation runbook + observability** :
    - **`docs/runbook/profile-management-debug.md`** (NEW ~50 lignes) : flow + troubleshooting (Keycloak sync drift, optimistic update rollback, locale change UX issues, signed URL expiry)
    - **`packages/contracts/README.md`** UPDATE : section Identity events ajouter `user-profile-updated.v1`
    - **Métriques Prom** : `tukio_profile_updates_total{result,field_changed}`, `tukio_kyc_signed_url_generated_total{type}`
    - **Audit log** : event `identity.user.profile-updated.v1` consume Story 2.7 admin audit log

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` extensions** (AC: #7)
  - [ ] 1.1 — Créer `dtos/identity/me.dto.ts` (MeResponseSchema discriminated union + UpdateMyProfileInputSchema)
  - [ ] 1.2 — Créer events `identity/user-profile-updated.v1.{schema.json,ts}` + `kyc-doc-accessed.v1.{schema.json,ts}`
  - [ ] 1.3 — Update `types/error-codes.ts` : 3 codes
  - [ ] 1.4 — Update barrel + build + test

- [ ] **Task 2 — identity-svc : domain methods + use cases + tests** (AC: #6)
  - [ ] 2.1 — Update `domain/model/user-profile.aggregate.ts` : 5 méthodes (changeName, changePhone, changeAddress, changeLocale, setMarketingOptIn) + InvalidNameError + InvalidPhoneError
  - [ ] 2.2 — Créer `usecases/get-my-profile.usecase.ts` + spec
  - [ ] 2.3 — Créer `usecases/update-my-profile.usecase.ts` + spec
  - [ ] 2.4 — Créer `usecases/get-kyc-doc-signed-url.usecase.ts` + spec
  - [ ] 2.5 — Tests unit ≥ 90 % coverage

- [ ] **Task 3 — identity-svc : controllers + DTOs** (AC: #3, #4, #5)
  - [ ] 3.1 — Créer `infrastructure/http/controllers/me.controller.ts` (3 endpoints internal `GET /by-id/{id}`, `PATCH /by-id/{id}`, `GET /by-id/{id}/kyc-doc/{type}`)
  - [ ] 3.2 — DTOs Zod pipes
  - [ ] 3.3 — Update usecases-proxy.module + http.module
  - [ ] 3.4 — Tests E2E

- [ ] **Task 4 — gateway-api : 3 endpoints `/v1/me`** (AC: #3, #4, #5)
  - [ ] 4.1 — Créer `usecases/me/me.forwarder.ts` (3 méthodes)
  - [ ] 4.2 — Update `domain/ports/identity-svc.port.ts` + `identity-svc.client.ts` : 3 méthodes
  - [ ] 4.3 — Créer `infrastructure/http/controllers/me.controller.ts` (3 endpoints @UseGuards JWT + RolesGuard pour kyc-doc)
  - [ ] 4.4 — Throttle config : `'me-kyc-doc'` 30/min/user
  - [ ] 4.5 — Tests E2E

- [ ] **Task 5 — Frontend hooks `@tukio/api-client`** (AC: #8)
  - [ ] 5.1 — Créer `packages/api-client/src/hooks/identity/{use-me,use-update-my-profile,use-get-kyc-doc-signed-url}.ts`
  - [ ] 5.2 — Update barrel
  - [ ] 5.3 — Tests `@testing-library/react` renderHook

- [ ] **Task 6 — Frontend Customer page profile** (AC: #1)
  - [ ] 6.1 — Créer `apps/customer/src/app/[locale]/account/profile/page.tsx` (Server Component fetch /v1/me)
  - [ ] 6.2 — Créer `apps/customer/src/features/account/profile/components/CustomerProfileForm.tsx` (Client Component RHF + Zod)
  - [ ] 6.3 — Update `apps/customer/messages/{fr,en}.json` namespace `account.profile.*` (~25 keys)
  - [ ] 6.4 — Tests E2E

- [ ] **Task 7 — Frontend Pro page profile** (AC: #2)
  - [ ] 7.1 — Créer `apps/seller/src/app/[locale]/seller/profile/page.tsx` (Server Component)
  - [ ] 7.2 — Créer `apps/seller/src/features/seller/profile/components/{ProProfileForm,KycDocsSection,StripeStatusBadge}.tsx`
  - [ ] 7.3 — Update `apps/seller/messages/{fr,en}.json` namespace `seller.profile.*`
  - [ ] 7.4 — Tests E2E

- [ ] **Task 8 — Tests Playwright e2e + axe-core + perf** (AC: #9)
  - [ ] 8.1 — Créer 2 spec files (customer + seller profile)
  - [ ] 8.2 — Helpers : login fixture + setup-test-pro fixture (Story 1.3 réutilisé)
  - [ ] 8.3 — Run en CI + axe-core + perf NFR48 ≤ 1s p90 GET, ≤ 2s p90 PATCH

- [ ] **Task 9 — Observability + runbook + commit** (AC: #10)
  - [ ] 9.1 — Métriques Prom + dashboards
  - [ ] 9.2 — Runbook
  - [ ] 9.3 — Lint + typecheck + tests + coverage
  - [ ] 9.4 — Commit `feat(identity): profile management end-to-end (GET/PATCH /v1/me + KYC signed URL on-demand + Customer + Pro pages + locale change force-refresh + audit event + Playwright e2e)` — Story 1.8 done

## Dev Notes

### Pourquoi Story 1.8 = template "self-service edit"

> **Sources** : `architecture.md` §Auth + envelope ; `prd.md` §FR14 (profile read+update), §FR15 (account delete partial — Story 1.9), §NFR1 (RGPD), §NFR9, NFR48 ; `epics.md` §Story 1.8 (lignes 1193-1206) ; UX-DR11 account settings ; Stories 1.2 (UserProfile aggregate factory), 1.3 (ProProfile + KYC signed URLs), 1.4 (login + force-refresh), 1.6 (force-refresh utility).

Story 1.8 est le **template canonique self-service edit** réutilisable :
- Story 1.9 (account delete) — utilise même `<UserProfileCard>` + force-refresh pattern (post-delete redirect)
- Story 4.x V1 (booking modification) — patient pattern (read state + partial update + audit event)
- Story 8.x V1 (B2B billing settings) — réutilise hooks API + atomic UI

### Décisions techniques majeures

1. **Server Component fetch GET /v1/me** (pas useQuery client-side initial fetch) — UX optimale (no flash, SSR-rendered)
2. **TanStack Query optimistic update + rollback** — UX fluide
3. **Keycloak sync non-fatal** (drift R8 acceptable) — DB est source of truth, Keycloak attributes éventuellement consistent (job réconciliation Story 1.10)
4. **Email change blocked MVP** — déféré V1 (Story 1.x token-based confirmation pattern)
5. **Pro core fields readonly** (RGPD NFR1 + cohérence SIRET legal) — modification via support uniquement
6. **KYC signed URLs on-demand** (pas pre-fetch dans GET /v1/me — TTL 5 min, fresh per click)
7. **Locale change → force-refresh JWT + window.location.assign** (pas client-side router push) — full reload propage middleware next-intl
8. **i18n + EN strict + memories** réutilisés
9. **3 endpoints internal identity-svc** (`GET by-id/:id`, `PATCH by-id/:id`, `GET by-id/:id/kyc-doc/:type`) — internal-service-token guard
10. **Audit event `user-profile-updated.v1`** publish toujours, même si Keycloak sync fail (DB est source of truth)

### Versions à utiliser

(Réutilisés Stories 1.2-1.7 — pas de nouvelle dep Story 1.8)

### Project Structure cible

```
packages/contracts/src/
├─ dtos/identity/me.dto.ts                            # NEW
├─ events/identity/{user-profile-updated,kyc-doc-accessed}.v1.{schema.json,ts}  # NEW (4)
└─ types/error-codes.ts                               # UPDATE — 3 codes

apps/identity-svc/src/
├─ domain/model/user-profile.aggregate.ts             # UPDATE Story 1.2 — 5 méthodes
├─ usecases/{get-my-profile,update-my-profile,get-kyc-doc-signed-url}.usecase.ts + specs  # NEW (6)
└─ infrastructure/http/controllers/me.controller.ts   # NEW (3 endpoints)

apps/identity-svc/test/me.e2e-spec.ts                 # NEW

apps/gateway-api/src/
├─ usecases/me/me.forwarder.ts                        # NEW
├─ infrastructure/external/identity-svc/identity-svc.client.ts  # UPDATE — 3 méthodes
└─ infrastructure/http/controllers/me.controller.ts   # NEW (3 endpoints)

apps/gateway-api/test/me.e2e-spec.ts                  # NEW

apps/customer/src/
├─ app/[locale]/account/profile/page.tsx              # NEW (Server Component)
└─ features/account/profile/components/CustomerProfileForm.tsx  # NEW

apps/customer/messages/{fr,en}.json                   # UPDATE — namespace
apps/customer/e2e/account/profile.spec.ts             # NEW

apps/seller/src/
├─ app/[locale]/seller/profile/page.tsx               # NEW
└─ features/seller/profile/components/{ProProfileForm,KycDocsSection,StripeStatusBadge}.tsx  # NEW (3)

apps/seller/messages/{fr,en}.json                     # UPDATE — namespace
apps/seller/e2e/seller/profile.spec.ts                # NEW

packages/api-client/src/hooks/identity/{use-me,use-update-my-profile,use-get-kyc-doc-signed-url}.ts  # NEW (3)

infra/k8s/grafana-dashboards/profile-management.json  # NEW
docs/runbook/profile-management-debug.md              # NEW

# Estimation total fichiers : ~40 nouveaux + ~10 updates = ~50 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 1.2-1.7 + memories (Pretre, envelope ADR-014, outbox transactional, EN strict, i18n strict, latest stable libs).

### Previous Story Intelligence

**Story 1.2** : 🔴 UserProfile aggregate (Story 1.8 ajoute 5 méthodes domain), KeycloakAdminService `updateUser` (Story 1.6 ajoute, Story 1.8 réutilise), envelope errors pattern.

**Story 1.3** : ProProfile aggregate (Story 1.8 read-only consumer), MediaStorage signed URLs (Story 1.8 réutilise).

**Story 1.4** : `<AuthProvider>` + `useAuth` hooks (Story 1.8 consomme), middleware admin/customer/seller (Story 1.8 ne touche pas — déjà finalisés).

**Story 1.6** : `force-refresh.ts` utility (Story 1.8 réutilise post-locale-change).

**Story 1.7** : pattern admin role enforcement (Story 1.8 utilise pour endpoint kyc-doc — `@Roles('pro')`).

### What this story does NOT do (out of scope)

- ❌ **Email change flow** → V1 Story 1.x (réutilisera pattern Story 1.5 token-based)
- ❌ **Account delete soft-delete RGPD** → Story 1.9 (next story)
- ❌ **Profile picture upload** → V1+ FR11 (Pro portfolio enrichi)
- ❌ **Notification preferences granular** → V1 Story 11.4
- ❌ **B2B billing settings multi-user** → V1 Epic 8 Story 8.4
- ❌ **2FA settings page** (admin TOTP setup uniquement Story 1.7) → V1+ Pro 2FA optionnel FR10

### Files to UPDATE vs CREATE

(cf. Project Structure cible)

### Testing Standards

- Coverage ≥ 90 % use cases + 80 % endpoints + 80 % frontend forms
- Tests unit Vitest + integration testcontainers + E2E Playwright FR/EN + axe-core
- Performance NFR48 : GET /v1/me ≤ 1s p90, PATCH ≤ 2s p90 (incluant Keycloak sync)

### Project Structure Notes

✅ Aligné avec architecture, PRD, epics, UX-DR11, Stories 1.2-1.7, memories.

⚠️ Décision : Keycloak sync non-fatal (drift R8 acceptable, reconciliation Story 1.10).

⚠️ Décision : Pro core fields readonly (companyName, SIRET, vatNumber, proAddress) — modification via support seulement V1 (Story 2.x ouvrira changement contactPhone si demandé).

⚠️ À noter : `<UserProfileCard>` shared atomic — pourrait être extracté dans `packages/ui/patterns/` si réutilisé > 2 fois (V1+).

### References

- [Source: epics.md#Epic-1-Story-1.8 — Lines 1193-1206]
- [Source: prd.md#FR14, FR15, NFR1, NFR9, NFR48]
- [Source: ux-design-specification.md#UX-DR11 — account settings]
- [Source: 1-2 (UserProfile aggregate), 1-3 (ProProfile + KYC signed URLs), 1-4 (login), 1-6 (force-refresh), 1-7 (RolesGuard pattern)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md]

## Dev Agent Record

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 2 (8ᵉ story Epic 1)
- **Estimation effort** : 3-4 jours (1 dev fullstack — story moyenne grâce aux patterns réutilisés)
- **Dépendances upstream** : Stories 1.2 (UserProfile + KeycloakAdmin), 1.3 (ProProfile + MediaStorage), 1.4 (login + AuthProvider), 1.6 (force-refresh utility)
- **Dépendances downstream** : Story 1.9 (account delete réutilise pattern), Story 2.5 (admin update Pro status — non-impact direct), Story 2.7 (audit consume `user-profile-updated.v1`), Stories Epic 4-7 (consume `useMe()` hook)
- **FRs covered** : **FR14** ✅ Profile read+update
- **NFRs touchés** : NFR1 (RGPD readonly Pro fields), NFR9 (HTTPS), NFR48 (UX), NFR71 (coverage)

> **Prochaine story → Story 1.9** (Account deletion soft-delete + RGPD)

---

**Dev agent next steps :**
1. Lire ce file en entier
2. Vérifier upstream Stories 1.2/1.3/1.4/1.6 implémentées
3. Implémenter Tasks 1-9
4. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test && pnpm playwright test --grep "profile"`
5. Commit Story 1.8 quand : 8/8 e2e tests passent + coverage thresholds + axe-core 0 violations + perf OK
6. Update sprint-status : `1-8-profile-management: review` puis `done`
