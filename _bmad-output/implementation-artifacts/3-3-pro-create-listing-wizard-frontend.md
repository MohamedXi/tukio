# Story 3.3: Pro create listing wizard frontend (5 steps : infos + photos + tarifs + zone + aperçu)

Status: ready-for-dev

## Story

**As a** Pro `verified` (sortant Story 2.6 onboarding step 4 OU déjà active sur dashboard et créant une fiche additionnelle),
**I want** un **wizard multi-step de création de fiche service** sur `/seller/listings/new` (et `/seller/listings/:id/edit` qui consume le même wizard pre-rempli en mode edit Story 3.6) qui guide visuellement l'avancement (5 steps : Infos → Photos → Tarifs → Zone & délais → Aperçu) avec `<StepIndicator>` Story 0.5 toujours visible top-page + state machine côté frontend (`unsaved → saving → saved → error`) + auto-save backend chaque 2 s debounce (TanStack Query mutation) + resume draft 7 jours si tab fermé + integration `<OnboardingFirstListingBanner>` Story 2.6 si query param `?onboarding=true` (Pro fraîchement KYC `approved` dirigé via Story 2.2 wizard step 4) + Story 3.4 photo upload pipeline forward-dep stubbed avec placeholder UX (Story 3.4 wirera la vraie pipeline R2 → CF Images) :

**Step 1 — Infos générales** (`/seller/listings/new` initial render OU `/seller/listings/:id/edit` step=1) :
- `<Select required>` Catégorie (consume `GET /v1/categories?tree=false&mvpPilotOnly=true&locale={fr|en}` Story 3.1) + `<Select required>` Sous-catégorie (filter `category.parentId === selectedRootId`)
- `<Input>` Title FR (max 80 chars, `required` per FR99 — bloquant) + character counter live
- `<Input>` Title EN (max 80 chars, optional + helper "Si vide, les visiteurs EN verront la version FR avec un badge 'FR only'" cohérent Story 5.9)
- `<Textarea>` Description FR (max 2000 chars, required FR99 — bloquant) + character counter live
- `<Textarea>` Description EN (max 2000 chars, optional + même helper)
- CTA Suivant disabled tant que required fields invalid (Zod schema mirror Story 3.2 `TitleMultilang` + `DescriptionMultilang` VOs)

**Step 2 — Photos** (`step=2`) :
- `<FileUpload>` Story 0.5 atomic réutilisé — accept `image/jpeg | image/png | image/webp | image/heic`, max 10 MB par photo, ratio 4:3 ou 16:9 recommandé via tooltip
- 3 photos minimum (FR23) — bouton Suivant disabled si `photos.length < 3` avec message inline "3 photos minimum"
- 15 photos maximum — upload zone disabled avec message "15 photos maximum atteint"
- `<PhotoGrid>` (NEW Story 3.3 component `apps/seller/src/features/seller/listings/components/PhotoGrid.tsx`) avec drag & drop reorder via `@dnd-kit/core` (latest stable v6+) → call `PATCH /v1/listings/:id/photos/reorder` debounced
- Each photo `<PhotoCard>` avec preview thumbnail + champ `altText` inline (max 125 chars NFR50 a11y, optional avec tooltip "Décrivez l'image pour les utilisateurs malvoyants") + bouton X retirer
- **Story 3.4 forward-dep** : Story 3.3 wire `<FileUpload>` avec **MOCK pipeline temporaire** (frontend simule upload + retourne `{ photoId: nanoid(), urls: { thumbnail: data-url, card: data-url, detail: data-url } }`) jusqu'à Story 3.4 wire la vraie pipeline R2 → CF Images. Story 3.3 livre le **contrat UX** + `useUploadPhoto` hook stub ; Story 3.4 implement la vraie pipeline media-svc

**Step 3 — Tarifs** (`step=3`) :
- `<RadioGroup>` Mode tarification : `unit` (par unité) / `package` (forfait) — FR25 MVP
- Si `mode='unit'` : `<Input>` Prix unitaire (€ — input mask `0.00` cents conversion) + `<Input>` Unité (placeholder pré-rempli depuis `serviceType.defaultUnit` Story 3.1 — e.g., "par jour" / "par soirée") + `<Input>` Quantité min (optional) + `<Input>` Quantité max (optional, doit être ≥ min si défini)
- Si `mode='package'` : `<Input>` Prix forfaitaire + `<Textarea>` Description forfait (1-500 chars, required)
- **Soft-warning FR32 deviation > 50 %** : pendant la saisie debounced 1s → call `GET /v1/categories/:slug/median-price?pricingMode={unit|package}` (NEW endpoint Story 3.3 — Story 3.5 finalisera la query SQL percentile_cont, Story 3.3 livre l'endpoint avec stub returning null MVP) → si median exists ET `abs(price - median) / median > 0.5` → render `<Alert variant="warning">` "Votre prix dévie de X % de la médiane catégorie. Continuer ou ajuster ?" (pas blocage strict, juste warning UX)

**Step 4 — Zone & délais** (`step=4`) :
- `<Input>` Code postal d'origine (mask `\d{5}` FR format strict, required validation Zod mirror `ServiceArea` VO Story 3.2)
- `<Slider>` Rayon livraison (5-200 km, default 50, increment 5km) — FR26
- `<Input>` Délai minimum réservation (1-30 jours, required, helper "Délai minimum entre réservation et événement")
- **Map placeholder MVP** : `<div className="h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">Aperçu carte zone (V1)</div>` — V1+ wirera Mapbox/Leaflet avec circle radius autour du codePostal

**Step 5 — Aperçu** (`step=5`) :
- `<TabPreview>` Toggle FR/EN render — Story 3.3 NEW component qui rend la fiche en mode preview lecture seule (s'inspire de `service.jsx` du bundle Cloud Design Sprint 0 — UX-DR12)
- Affiche : Hero photo + carousel photos + Title locale + Description locale + Pricing display + ServiceArea zone + slug preview URL `/fr/services/{slug}` (slug auto-généré via `Slug.fromTitle(title.fr)` côté backend Story 3.2 + frontend re-call API pour avoir slug définitif)
- 2 CTAs primary :
  - **"Publier"** → `POST /v1/listings/:id/publish` (gateway endpoint NEW Story 3.3 — Story 3.5 finalise auto-publish + median check ; Story 3.3 livre l'endpoint avec skeleton from Story 3.2 `publish-listing.usecase`) → success redirect `/seller/listings` (Story 3.6 listings page) avec toast "Fiche publiée ! 🎉" si auto-publish OU "Fiche envoyée en modération (~24h)" si pending_moderation
  - **"Sauvegarder en brouillon"** → save draft (TanStack Query mutation already triggered by auto-save) + redirect `/seller/listings` avec toast "Brouillon sauvegardé"
- CTAs secondaires : "← Retour" (step précédent), "Aperçu rapide" (open preview modal lightbox)

**State management côté frontend** : `useReducer` pattern (vs Zustand pour wizard local state) — `wizardState: { step: 1-5, listingId: string | null, formData: { categoryId, serviceTypeId, title: { fr, en }, description: { fr, en }, photos: Photo[], pricing, serviceArea }, autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error', lastSavedAt: Date | null }` ; chaque field change dispatch `UPDATE_FIELD` action → trigger debounced auto-save 2s ; chaque step transition validate Zod schema avant `GOTO_NEXT_STEP` action ;

**Auto-save flow** : sur premier load wizard `/seller/listings/new` → call `POST /v1/listings` (NEW endpoint Story 3.3 — consume Story 3.2 `create-listing.usecase`) avec body minimal `{ categoryId: null, ... }` → returns `{ listingId, slug: temp_slug }` + URL update via `router.replace(/seller/listings/:listingId/edit?step=1)` (clean URL state) ; ensuite chaque field change → debounced 2s `useDebouncedCallback` → `PATCH /v1/listings/:listingId` (NEW endpoint Story 3.3 — consume Story 3.2 `update-listing.usecase` partial update) → response 200 → `autoSaveStatus = 'saved'` + `lastSavedAt = NOW()` UI affiche `✓ Sauvegardé il y a Xs` indicator topbar wizard ;

**Resume draft TTL 7 jours** : sur load `/seller/listings/new`, frontend Server Component fetch `GET /v1/listings/me/drafts` (NEW endpoint Story 3.3 — list pro's drafts older than 7d filtered out + sorted desc lastEditedAt) → si `drafts.length > 0` → render `<ResumeDraftBanner>` Story 3.3 NEW component avec liste max 3 drafts + CTA "Reprendre" (redirect `/seller/listings/:id/edit`) + CTA "Démarrer une nouvelle fiche" (continue with `POST /v1/listings`) ; backend cron Story 3.3 `purge-old-drafts.task.ts` (`@nestjs/schedule` `@Cron('0 4 * * *')` 4am UTC daily — pattern Story 1.9 réutilisé) hard-delete drafts `status='draft' AND updated_at < NOW() - INTERVAL '7 days'` (avec photos R2 cleanup forward Story 3.4) ;

**Story 2.6 banner integration** : si query param `?onboarding=true` (Pro fraîchement KYC approved Story 2.5 vient de Story 2.2 wizard step 4) → `useSearchParams().get('onboarding') === 'true'` → render `<OnboardingFirstListingBanner>` (Story 2.6 pattern @tukio/ui) tout en haut de page wizard avec title "Dernière étape ! Publiez votre 1ère fiche pour activer votre compte" + i18n keys `seller.listings.new.onboardingBanner.*` Story 2.6 livré ;

**i18n FR/EN strict** : namespace `seller.listings.new.*` ~80 keys × 2 locales (steps labels, fields labels, validation messages, CTAs, helpers, error states, toasts) ;

**Accessibility RGAA AA** (NFR47, NFR50-54) : `<StepIndicator>` semantic `<nav aria-label="Étapes">` + `aria-current="step"` sur step active + skip-to-content link + focus management automatic on step change (focus first field of new step) + Esc to close modale aperçu + axe-core 0 violations ;

**Performance NFR48** UX < 15 min p90 onboarding cumulatif — Story 3.3 wizard target < 12 min Pro avec photos prêtes (3 min step Infos + 3 min Photos + 2 min Tarifs + 2 min Zone + 2 min Aperçu/Publier) ; auto-save < 200 ms p90 backend + frontend optimistic UI updates,

**so that** Marc loueur de tentes (P1 persona Tukio J3 happy path) qui vient d'être validé par Léa Story 2.5 + atterri sur step 4 du wizard onboarding Story 2.2 → click "Créer ma 1ère fiche" → atterrit `/seller/listings/new?onboarding=true` → render `<OnboardingFirstListingBanner>` motivant + auto-create draft listing → Marc complète le wizard 5 steps (~12-15 min) → click "Publier" → redirect `/seller/listings` toast succès → Story 3.5 publish-workflow trigger côté backend (auto-publish OU moderation selon Marc verifiedAt) ; un Pro existant `tukio_status='active'` créant une fiche additionnelle navigue `/seller/listings/new` (sans `?onboarding=true`) → wizard standard (no banner Story 2.6) ; un Pro qui ferme le tab en plein step 3 + revient 2 jours plus tard → render `<ResumeDraftBanner>` "Reprendre votre brouillon ?" → click → `/seller/listings/:id/edit?step=3` → state restored from DB ; un test `pnpm playwright test --grep "create listing wizard"` passe FR/EN axe-core 0 violations 14 scénarios (5 steps complete happy FR + EN + draft auto-save validation + resume draft after tab close + soft-warning price deviation + onboarding banner show/hide based on query param + Story 3.4 photo upload mock pipeline + RGAA focus management + step navigation forward/back state preservation + edit existing listing pre-fill + publish from step 5 redirect + save draft redirect + photo reorder drag&drop + alt text accessibility) ; coverage ≥ 90 % wizard hooks + 85 % page components + 80 % gateway endpoints.

## Acceptance Criteria

1. **AC1 — gateway-api endpoints CRUD listings + photos reorder + drafts list** : Given Stories 1.2/3.1/3.2 baseline, When je consulte `apps/gateway-api/src/infrastructure/http/controllers/listings.controller.ts` (NEW Story 3.3), Then :
   - **NEW endpoints** :
     ```ts
     @Controller('/v1/listings')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro')
     export class ListingsController {
       @Post('/')
       @HttpCode(201)
       async createDraft(@Body() body: CreateListingInput, @CurrentActor() actor: Actor): Promise<{ listingId: string; slug: string }> {
         return this.listingsForwarder.getInstance().createDraft({ proProfileId: actor.proProfileId, ...body });
       }

       @Patch('/:listingId')
       @HttpCode(200)
       async update(@Param('listingId', ParseUUIDPipe) id: string, @Body() body: UpdateListingInput, @CurrentActor() actor: Actor): Promise<{ listingId: string; updatedAt: string }> {
         return this.listingsForwarder.getInstance().update({ listingId: id, proProfileId: actor.proProfileId, ...body });
       }

       @Patch('/:listingId/photos/reorder')
       @HttpCode(200)
       async reorderPhotos(@Param('listingId', ParseUUIDPipe) id: string, @Body() body: { photoIds: string[] }, @CurrentActor() actor: Actor): Promise<{ ok: true }> {
         return this.listingsForwarder.getInstance().reorderPhotos({ listingId: id, proProfileId: actor.proProfileId, photoIds: body.photoIds });
       }

       @Post('/:listingId/publish')
       @HttpCode(200)
       async publish(@Param('listingId', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<PublishListingResponse> {
         // Story 3.5 finalise auto-publish + median + price deviation logic
         return this.listingsForwarder.getInstance().publish({ listingId: id, proProfileId: actor.proProfileId });
       }

       @Get('/me/drafts')
       @HttpCode(200)
       async listMyDrafts(@CurrentActor() actor: Actor): Promise<DraftListing[]> {
         return this.listingsForwarder.getInstance().listMyDrafts({ proProfileId: actor.proProfileId });
       }
     }
     ```
   - **NEW endpoint Story 3.3** `GET /v1/categories/:slug/median-price?pricingMode={unit|package}` — wired by Story 3.3 frontend pour soft-warning FR32 (Story 3.5 finalise SQL ; Story 3.3 livre stub returning `null` if not yet computed)
   - **Validation Zod** :
     - `CreateListingInputSchema` : `{ categoryId?: uuid, serviceTypeId?: uuid }` (everything optional — draft creation minimal)
     - `UpdateListingInputSchema` : partial update — every field optional, validated against Story 3.2 VO invariants only if provided. **Auto-save tolère champs partiels invalid** (e.g., title.fr=2 chars n'erreur pas mais ne déclenche pas l'invariant FR99 backend tant que pas de publish — invariant strict uniquement à `publish-listing.usecase`)
   - **Forwarder** appelle catalog-svc internal endpoints `POST /internal/listings`, `PATCH /internal/listings/:id`, etc.
   - **Throttle** : 60/min/user create-update, 10/hour/user publish, 30/min reorder
   - **Errors** : 403 si listing.proProfileId !== actor.proProfileId (RBAC strict — Pro ne peut éditer que ses propres listings) → `LISTING-FORBIDDEN-001` ; 404 si listing not found → `LISTING-NOT-FOUND-001` ; 409 si publish + listing.status pas in {draft, unpublished} → `LISTING-STATUS-CONFLICT-001`
   - **Tests E2E gateway** : 8 scénarios — create draft 201, update 200 partial, reorder photos 200, publish 200, list drafts paginated, RBAC 403 cross-pro, 404 not-found, 409 publish already-published

2. **AC2 — catalog-svc internal endpoints + median-price endpoint** : Given Story 3.2 use cases livrés, When je consulte `apps/catalog-svc/src/infrastructure/http/controllers/internal-listings.controller.ts` (NEW Story 3.3), Then :
   - **NEW internal endpoints** mirror gateway endpoints AC1 (POST/PATCH/POST publish/GET drafts) avec `X-Internal-Service-Token` guard
   - **NEW endpoint** `GET /v1/categories/:slug/median-price?pricingMode={unit|package}` — Story 3.3 implementation Stub :
     ```ts
     @Get('/:slug/median-price')
     async getMedianPrice(@Param('slug') slug: string, @Query() query: { pricingMode: 'unit' | 'package' }): Promise<{ medianAmountCents: number | null; currency: 'EUR' }> {
       // Story 3.3 stub — returns null until Story 3.5 implements compute-median-price.usecase fully
       return { medianAmountCents: null, currency: 'EUR' };
       // Story 3.5 will finalize: const result = await this.computeMedianPrice.execute({ categorySlug: slug, pricingMode: query.pricingMode });
     }
     ```
   - **NEW use case** `list-my-drafts.usecase.ts` (catalog-svc Story 3.3) — `findByProProfileId({ proProfileId, status: 'draft' })` cursor pagination réutilise Story 3.2 repo `findByProProfileId`
   - Tests integration testcontainer : 4 scenarios CRUD listings + drafts list pagination

3. **AC3 — Wizard pages structure `/seller/listings/new` + `/seller/listings/:id/edit`** : Given Stories 0.5 (atomics+patterns) + 1.7 (admin layout — re-use seller layout pattern) + 2.2 (middleware seller — Story 3.3 needs `tukio_status='active'` OR `kyc_status='approved'` to allow access), When je consulte `apps/seller/src/app/[locale]/seller/listings/`, Then :
   - **NEW page** `apps/seller/src/app/[locale]/seller/listings/new/page.tsx` (Server Component) :
     1. Fetch `GET /v1/me` → check `kyc_status === 'approved'` (else redirect `/seller/onboarding/kyc` Story 2.2)
     2. Fetch `GET /v1/listings/me/drafts` → if `drafts.length > 0` → render `<ResumeDraftBanner drafts={drafts} />` (max 3 most recent)
     3. Else → call `POST /v1/listings` (auto-create draft) → server-side `redirect('/seller/listings/' + listingId + '/edit?step=1' + (searchParams.onboarding ? '&onboarding=true' : ''))`
   - **NEW page** `apps/seller/src/app/[locale]/seller/listings/[id]/edit/page.tsx` (Server Component) :
     1. Fetch `GET /v1/listings/:id` → check `listing.proProfileId === actor.proProfileId` (else redirect `/seller/listings` 403)
     2. Fetch `GET /v1/categories?tree=true&locale={locale}` (Story 3.1) for `<Select>` cascading
     3. Render `<ListingWizard initialState={listing} categories={categories} step={searchParams.step ?? 1} onboardingMode={searchParams.onboarding === 'true'} />` (Client Component)
   - **NEW middleware UPDATE** `apps/seller/src/middleware.ts` Story 2.2 — autoriser `/seller/listings/new` + `/seller/listings/:id/edit` même si `tukio_status === 'pending_admin_review'` AND `kyc_status === 'approved'` (cas Pro post-KYC validé Story 2.5 pas encore onboarding completed Story 2.2 — peut commencer wizard 1ère fiche)

4. **AC4 — `<ListingWizard>` Client Component + state machine + auto-save** : Given AC3, When je consulte `apps/seller/src/features/seller/listings/components/ListingWizard.tsx`, Then :
   - **State management** `useReducer` :
     ```ts
     interface WizardState {
       step: 1 | 2 | 3 | 4 | 5;
       listingId: string;
       formData: Partial<ListingFormData>;
       autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
       lastSavedAt: Date | null;
       errors: Record<string, string>;
     }
     type WizardAction =
       | { type: 'UPDATE_FIELD'; field: string; value: any }
       | { type: 'GOTO_STEP'; step: 1|2|3|4|5 }
       | { type: 'SET_AUTOSAVE_STATUS'; status: 'idle' | 'saving' | 'saved' | 'error' }
       | { type: 'SET_VALIDATION_ERRORS'; errors: Record<string, string> };
     ```
   - **Debounced auto-save** via `use-debounce` v10+ (latest stable) — `useDebouncedCallback(autoSave, 2000)` triggered on every `UPDATE_FIELD` action
   - **TanStack Query mutation** `useUpdateListingMutation` — `mutationFn: (formData) => apiClient.patch('/v1/listings/' + listingId, formData)` + `onMutate` (set autoSaveStatus='saving') + `onSuccess` (set autoSaveStatus='saved' + lastSavedAt=NOW) + `onError` (autoSaveStatus='error' + retry exponential backoff)
   - **Step navigation guarded** : `GOTO_STEP` action → validate current step Zod schema → if invalid set errors + DON'T transition ; if valid + going forward → ensure auto-save flushed before transition (await pending mutation)
   - **URL sync** : `step` reflected in URL `?step=N` via `router.replace` (browser back/forward navigation works) — Server Component initial step from `searchParams.step`
   - **Topbar** : `<WizardTopbar>` (NEW Story 3.3) avec `<StepIndicator steps={['Infos', 'Photos', 'Tarifs', 'Zone & délais', 'Aperçu']} current={step} />` + auto-save indicator `✓ Sauvegardé il y a Xs` / `⟳ Sauvegarde...` / `⚠ Erreur sauvegarde — Réessayer ?`
   - Tests `@testing-library/react` : 12 scenarios (initial state, field update triggers debounced mutation, step transition validates current step, error sets validation errors, auto-save success/error states, URL sync forward/back, etc.)

5. **AC5 — `<StepInfos>` Step 1 component (Catégorie/Sous-cat + Title/Description FR/EN)** : Given AC4, When je consulte `apps/seller/src/features/seller/listings/components/steps/StepInfos.tsx`, Then :
   - **Cascading Selects** : Catégorie change → reset Sous-cat + filter `subcategories.filter(s => s.parentId === selectedRootId)`
   - **Validation Zod inline** réelle : Title FR required + max 80 + character counter live + error inline `"Titre FR obligatoire"` (FR99). Title EN optional but max 80.
   - **i18n** `seller.listings.new.steps.infos.*` namespace (~15 keys × 2 locales)
   - **A11y** : `<label htmlFor>` + `<Input aria-invalid={!!error} aria-describedby={errorId}>` + focus management on error
   - Tests : happy path, FR99 enforce, EN optional, character counter, cascading reset

6. **AC6 — `<StepPhotos>` Step 2 component (FileUpload + PhotoGrid drag & drop reorder + alt text)** : Given Story 0.5 `<FileUpload>` atomic + Story 3.4 forward-dep, When je consulte `apps/seller/src/features/seller/listings/components/steps/StepPhotos.tsx`, Then :
   - **`<FileUpload>` Story 0.5** réutilisé avec accept = `image/jpeg | image/png | image/webp | image/heic` + max 10 MB + `multiple={true}`
   - **Validation count** : 3 minimum (FR23) — bouton Suivant disabled + message inline "Encore X photo(s) requise(s)" si `photos.length < 3`
   - **`<PhotoGrid>`** NEW component avec `@dnd-kit/core` v6+ :
     - `<DndContext>` wrap + `<SortableContext>` pour drag & drop reorder
     - Each `<PhotoCard>` : preview thumbnail (size 200x200) + handle drag (`<GripIcon>`) + bouton X retirer + champ inline `<Input altText>` max 125 chars (NFR50 a11y avec tooltip "Décrivez l'image pour les utilisateurs malvoyants")
   - **Reorder mutation** : on dragEnd → debounced 500ms → call `PATCH /v1/listings/:id/photos/reorder` body `{ photoIds: [...] }` — optimistic UI update via TanStack Query `setQueryData`
   - **Alt text auto-save** : on blur de chaque champ altText → trigger update photo (consume existing PATCH listing endpoint avec photo update partial)
   - **Story 3.4 forward-dep stub** : Story 3.3 livre `useUploadPhoto` hook avec **MOCK** :
     ```ts
     export const useUploadPhoto = () => useMutation({
       mutationFn: async (file: File) => {
         // MOCK Story 3.3 — Story 3.4 implements real R2 → CF Images pipeline
         await new Promise(resolve => setTimeout(resolve, 800)); // simulate latency
         const dataUrl = await fileToDataUrl(file);
         return { photoId: nanoid(), urls: { thumbnail: dataUrl, card: dataUrl, detail: dataUrl }, r2Key: `mock-${nanoid()}`, cloudflareImageId: `mock-${nanoid()}` };
       },
     });
     ```
   - Tests : 3 photos minimum block Suivant, 15 maximum block upload, drag & drop reorder, alt text save, mock pipeline returns dataUrl

7. **AC7 — `<StepPricing>` Step 3 component (RadioGroup unit/package + price deviation soft-warning)** : Given AC4, When je consulte `apps/seller/src/features/seller/listings/components/steps/StepPricing.tsx`, Then :
   - **`<RadioGroup>` Mode** : `unit` (par unité) / `package` (forfait)
   - **Conditional fields** :
     - `mode='unit'` : Prix unitaire (€ — input mask `0.00` cents conversion `Math.round(parseFloat(input) * 100)`) + Unité (placeholder pré-rempli depuis `serviceType.defaultUnit` Story 3.1) + Quantité min/max optionnels
     - `mode='package'` : Prix forfaitaire + Description forfait textarea required 1-500 chars
   - **Soft-warning FR32** :
     - `usePriceDeviation` hook NEW Story 3.3 : `useQuery({ queryKey: ['median-price', categorySlug, pricingMode], queryFn: () => apiClient.get('/v1/categories/' + slug + '/median-price?pricingMode=' + mode), enabled: !!categorySlug && !!mode, staleTime: 60_000 })`
     - On price field blur OR debounced 1s → compute `Math.abs(price - median) / median > 0.5` → if true → render `<Alert variant="warning">` "Votre prix dévie de {percent}% de la médiane catégorie ({medianFormatted}). Continuer ou ajuster ?" (pas blocage)
     - **MVP** : median est null jusqu'à Story 3.5 implémente compute-median-price → soft-warning never fires MVP. Story 3.3 livre la mécanique frontend prête.
   - Tests : mode switch reset fields, character counter description forfait, deviation warning fires when median exists + > 50%

8. **AC8 — `<StepZone>` Step 4 (postal + radius slider + leadTime + map placeholder)** : Given AC4, When je consulte, Then :
   - `<Input>` Code postal mask `\d{5}` strict + Zod validation `/^\d{5}$/` mirror Story 3.2 ServiceArea VO
   - `<Slider>` Radius 5-200 km, default 50, step 5km — affiche valeur live `<Badge>{radius} km</Badge>`
   - `<Input>` Lead time 1-30 jours (number input)
   - **Map placeholder** : `<div className="h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">{t('mapPlaceholder')}</div>` avec i18n `seller.listings.new.steps.zone.mapPlaceholder` "Aperçu carte zone (V1)" / "Map preview (V1)"
   - Tests : postal mask enforce, radius slider live update, lead time bounds, map placeholder render

9. **AC9 — `<StepPreview>` Step 5 + 2 CTAs Publier/Sauvegarder** : Given Stories 3.10 future listing detail UX-DR `service.jsx` reference, When je consulte, Then :
   - **`<TabPreview>`** toggle FR/EN (default = current locale) — appel `Listing.title.getFor(locale)` + `description.getFor(locale)` (NFR60 fallback FR if EN missing)
   - **Render preview** s'inspire de `service.jsx` bundle Cloud Design (UX-DR12) :
     - Hero photo (`photos[0].urls.detail`) + carousel `<PhotoCarousel>` (Story 0.5 atomic ou créer Story 3.3 si manquant)
     - Title locale + Description locale formatted
     - `<PricingDisplay>` Story 0.5 pattern réutilisé
     - `<ServiceAreaDisplay>` (NEW Story 3.3 — affiche origin postal + radius circle + leadTime)
     - URL preview `/{locale}/services/{slug}` slug auto-generated backend
   - **2 CTAs primary** :
     - "Publier" → mutation `usePublishListingMutation` → `POST /v1/listings/:id/publish` → success redirect `/seller/listings` + toast "Fiche publiée ! 🎉" si auto-publish OU "Fiche envoyée en modération (~24h) Story 3.5"
     - "Sauvegarder en brouillon" → mutation already done via auto-save → just `router.push('/seller/listings')` + toast "Brouillon sauvegardé"
   - **Confirmation modale Publier** : `<Modal>` "Confirmer la publication ?" avec recap prix + zone + photos count + 2 CTAs Annuler/Publier (focus trap RGAA)
   - Tests : tab FR/EN toggle, render fields, publish flow → redirect + toast, save draft flow

10. **AC10 — `<ResumeDraftBanner>` + cron purge-old-drafts + tests E2E + perf + i18n** : Given AC3 + AC4, Then :
    - **NEW component** `<ResumeDraftBanner drafts={DraftListing[]}>` — list max 3 drafts par lastEditedAt DESC + each row `<Card>` with photo[0]?.thumbnail + title.fr + step lastReached + "Reprendre" CTA → redirect `/seller/listings/:id/edit?step=N` + "Démarrer une nouvelle fiche" CTA → POST /v1/listings new draft
    - **NEW cron** `apps/catalog-svc/src/infrastructure/tasks/purge-old-drafts.task.ts` — `@Cron('0 4 * * *')` UTC daily — query `SELECT id FROM listing WHERE status='draft' AND deleted_at IS NULL AND updated_at < NOW() - INTERVAL '7 days'` → soft-delete via `Listing.softDelete()` Story 3.2 + cascade photos R2 cleanup forward-dep Story 3.4 (Story 3.3 publishe `catalog.listing.deleted.v1` event ; Story 3.4 future consumer R2 cleanup)
    - **Tests Playwright e2e** 14 scenarios :
      - T1-2 (happy path FR + EN) : 5 steps complete → publish → redirect + toast
      - T3 (draft auto-save) : edit field → wait 2s → check `lastSavedAt` indicator updated + DB row updated
      - T4 (resume draft) : start wizard → close tab → revisit → ResumeDraftBanner shows draft → click Reprendre → state restored
      - T5 (soft-warning price deviation) : mock median API returns 100€ → enter price 200€ → deviation 100% → warning visible
      - T6 (onboarding banner shown) : navigate `?onboarding=true` → banner Story 2.6 visible top-page
      - T7 (onboarding banner hidden) : navigate without query → banner absent
      - T8 (photo upload mock pipeline) : drop 5 photos → 3 minimum reached → Suivant enabled
      - T9 (photo reorder) : drag photo 1 → position 3 → API call PATCH /reorder
      - T10 (RGAA focus management) : Tab through fields → focus visible + aria-current step
      - T11 (step navigation guarded) : try to skip step 2 with photos < 3 → blocked
      - T12 (edit existing listing) : navigate `/seller/listings/:id/edit` → fields pre-filled
      - T13 (publish redirect + toast) : publish → URL changes + success toast
      - T14 (RBAC cross-pro) : pro A tries to edit pro B listing → 403 redirect
    - **Test perf** : auto-save mutation < 200ms p90 backend, wizard initial render < 1s p90 with categories pre-fetched, step transition < 100ms (no API call besides flush auto-save)
    - **i18n** : namespace `seller.listings.new.*` (~80 keys × 2 locales = 160 entries) + `seller.listings.edit.*` minor (~10 keys edit-specific)
    - **A11y axe-core 0 violations** sur (a) wizard step 1, (b) step 2 photo upload, (c) step 3 pricing, (d) step 4 zone, (e) step 5 preview, (f) modale publier confirm
    - Coverage ≥ 90 % wizard hooks + state machine reducer + 85 % step components + 80 % gateway endpoints + cron

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` DTOs listings** (AC: #1)
  - [ ] 1.1 — `dtos/catalog/listing.dto.ts` (CreateListingInput + UpdateListingInput + DraftListing + PublishListingResponse + ListingFormData Zod)
- [ ] **Task 2 — gateway-api endpoints listings + forwarders** (AC: #1) — coverage ≥ 80 %
  - [ ] 2.1 — `listings.controller.ts` (5 endpoints CRUD + publish + drafts + reorder)
  - [ ] 2.2 — `listings.forwarder.ts` (5 forwards + RBAC actor.proProfileId enforce)
  - [ ] 2.3 — `categories.controller.ts` UPDATE Story 3.1 — add `GET /v1/categories/:slug/median-price` stub endpoint
  - [ ] 2.4 — Tests E2E gateway 8 scénarios
- [ ] **Task 3 — catalog-svc internal endpoints + median-price stub + ListMyDrafts use case** (AC: #2)
  - [ ] 3.1 — `internal-listings.controller.ts` (5 internal endpoints)
  - [ ] 3.2 — `internal-categories.controller.ts` UPDATE — add median-price stub endpoint
  - [ ] 3.3 — Use case `list-my-drafts.usecase.ts`
  - [ ] 3.4 — Tests integration testcontainer 4 CRUD scenarios
- [ ] **Task 4 — Cron `purge-old-drafts.task.ts`** (AC: #10) — coverage ≥ 90 %
  - [ ] 4.1 — Task `@Cron('0 4 * * *')` UTC daily — pattern Story 1.9 réutilisé
  - [ ] 4.2 — Soft-delete + outbox publish `catalog.listing.deleted.v1`
  - [ ] 4.3 — Tests integration testcontainer 3 cases (happy purge 7d+, dedupe, no candidates)
- [ ] **Task 5 — Server Components pages `/seller/listings/new` + `/[id]/edit`** (AC: #3)
  - [ ] 5.1 — Page `/seller/listings/new/page.tsx` (auto-create draft + redirect OR ResumeDraftBanner)
  - [ ] 5.2 — Page `/seller/listings/[id]/edit/page.tsx` (fetch listing + categories + render ListingWizard)
  - [ ] 5.3 — UPDATE middleware Story 2.2 — autoriser /seller/listings/* si kyc_status=approved (même pending_admin_review)
- [ ] **Task 6 — `<ListingWizard>` Client Component + state machine + auto-save** (AC: #4) — coverage ≥ 90 %
  - [ ] 6.1 — `ListingWizard.tsx` (useReducer + Zod validation + step navigation)
  - [ ] 6.2 — `useDebouncedAutoSave` hook (use-debounce v10+)
  - [ ] 6.3 — `useUpdateListingMutation` + `usePublishListingMutation` (TanStack Query)
  - [ ] 6.4 — `<WizardTopbar>` (StepIndicator + auto-save indicator)
  - [ ] 6.5 — URL sync ?step=N via router.replace
  - [ ] 6.6 — Tests `@testing-library/react` 12 scenarios
- [ ] **Task 7 — `<StepInfos>` Step 1** (AC: #5)
  - [ ] 7.1 — Component + cascading Selects + Zod inline
  - [ ] 7.2 — i18n keys steps.infos.*
- [ ] **Task 8 — `<StepPhotos>` Step 2 + FileUpload mock pipeline forward Story 3.4** (AC: #6)
  - [ ] 8.1 — Component + `<PhotoGrid>` + `@dnd-kit/core` v6+
  - [ ] 8.2 — `useUploadPhoto` hook MOCK pipeline (Story 3.4 will replace)
  - [ ] 8.3 — Reorder mutation debounced 500ms
  - [ ] 8.4 — Alt text inline + a11y NFR50
- [ ] **Task 9 — `<StepPricing>` Step 3 + price deviation soft-warning** (AC: #7)
  - [ ] 9.1 — RadioGroup mode + conditional fields
  - [ ] 9.2 — `usePriceDeviation` hook (consume `/v1/categories/:slug/median-price`)
  - [ ] 9.3 — `<Alert variant="warning">` deviation > 50%
- [ ] **Task 10 — `<StepZone>` Step 4 + map placeholder** (AC: #8)
  - [ ] 10.1 — Postal code mask + Zod
  - [ ] 10.2 — Slider radius + lead time number
  - [ ] 10.3 — Map placeholder div
- [ ] **Task 11 — `<StepPreview>` Step 5 + 2 CTAs + confirmation modale** (AC: #9)
  - [ ] 11.1 — TabPreview FR/EN toggle
  - [ ] 11.2 — `<ServiceAreaDisplay>` NEW component
  - [ ] 11.3 — Publish modal confirmation focus trap
  - [ ] 11.4 — Save draft redirect
- [ ] **Task 12 — `<ResumeDraftBanner>` + Story 2.6 banner integration** (AC: #10)
  - [ ] 12.1 — `<ResumeDraftBanner>` component
  - [ ] 12.2 — Wire `<OnboardingFirstListingBanner>` Story 2.6 si `?onboarding=true`
- [ ] **Task 13 — i18n FR + EN namespace seller.listings.new.* (~80 keys × 2)** (AC: tous)
- [ ] **Task 14 — Tests Playwright e2e + axe-core + perf + cron** (AC: #10) — 14 tests + coverage thresholds
- [ ] **Task 15 — Documentation + commit**
  - [ ] 15.1 — Update `docs/project-context.md` section "Listing Wizard (Story 3.3)"
  - [ ] 15.2 — Runbook `docs/runbook/listing-wizard-debug.md` (~30 lignes — auto-save debug, draft TTL, photo mock pipeline replaced Story 3.4)
  - [ ] 15.3 — Commit `feat(seller,catalog): Story 3.3 Pro create listing wizard 5 steps + draft auto-save 2s + resume draft 7j + Story 2.6 banner integration + cron purge-old-drafts`

## Dev Notes

### Pourquoi Story 3.3 = pierre angulaire UX Pro Epic 3

Story 3.1 a livré la **taxonomie**. Story 3.2 a livré le **domain Listing**. Story 3.3 livre l'**expérience Pro** qui transforme un dossier validé Story 2.5 en fiche service publique. Pattern complet **multi-step wizard with debounced auto-save + resume draft + state machine reducer + step validation guard + URL sync** réutilisé Stories 4.x V1 (booking flow customer 3 steps), Stories 8.x V1 (B2B billing wizard), Stories 12.x V1 (review wizard multi-criteria FR76).

### Décisions techniques majeures actées

1. **Auto-save debounced 2s** (vs sync on field blur OU sync on next click) — UX Pro typique edit + scroll + edit again sans perdre data + minimal backend churn (debounce groupe les changes).
2. **Draft auto-create on `/seller/listings/new` first load** (vs explicit "Save draft" button) — UX seamless. Pro doesn't need to think about saving.
3. **`useReducer` (vs Zustand)** for wizard local state — local-only state (no cross-component sharing), reducer pattern explicit pour state machine + tests prévisible.
4. **Story 3.4 photo upload pipeline forward-dep MOCK** — Story 3.3 livre le contrat UX `useUploadPhoto` hook stub returning dataUrl mock. Story 3.4 implement la vraie pipeline R2 → CF Images. Permet wirage UX flow complet sans bloquer Story 3.3 sur Story 3.4 backend pipeline.
5. **`?step=N` URL sync** — browser back/forward navigation works + shareable wizard URL (debug, support).
6. **Step navigation guarded** — flush pending auto-save + validate current step Zod schema before transition. Évite état inconsistent.
7. **Resume draft TTL 7 jours** — balance UX (Pro peut quitter et revenir) + nettoyage DB (cron purge évite zombies).
8. **`?onboarding=true` query param** Story 2.6 banner integration — explicit + URL-shareable + middleware preserves on edit redirect.
9. **Soft-warning FR32 frontend mécanique livrée Story 3.3 + median backend Story 3.5** — frontend prêt à fonctionner dès Story 3.5 implémente compute-median.
10. **Confirmation modale "Publier"** focus trap RGAA + recap fields — UX réfléchi (vs publish 1-clic — risque erreur).
11. **`useDebouncedCallback` `use-debounce` v10+** — léger (<2KB), bien testé, pas de lib lourde alternative.
12. **`@dnd-kit/core` v6+** photo reorder — modern, accessible, RGAA-friendly (vs `react-beautiful-dnd` deprecated).
13. **Cron purge-old-drafts** Story 3.3 livre — pattern Story 1.9 réutilisé.
14. **EN strict + i18n + RGAA AA + Pretre + envelope ADR-014 + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `use-debounce` | Auto-save 2s + reorder 500ms | latest stable v10+ | Light, well-tested, native React hooks |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Photo reorder drag&drop | latest stable v6+ | RGAA-friendly, modern (vs deprecated react-beautiful-dnd) |
| `nanoid` | Photo mock IDs | (Story 3.2 already installed) | |
| `next-intl` | i18n FR/EN | latest stable (Story 0.9 already installed) | |
| `@tanstack/react-query` | Mutations + queries | (Story 0.9 already installed) | |
| `zod` | Validation Zod schemas mirror Story 3.2 VOs | (Story 0.2 already installed) | |

### Project Structure cible

```
packages/contracts/src/dtos/catalog/
└─ listing.dto.ts                                                # NEW Story 3.3 (CreateListingInput + UpdateListingInput + DraftListing + PublishListingResponse + ListingFormData)

apps/gateway-api/src/
├─ usecases/catalog/listings.forwarder.ts                        # NEW
└─ infrastructure/http/controllers/
   ├─ listings.controller.ts                                     # NEW (5 endpoints)
   └─ categories.controller.ts                                   # UPDATE Story 3.1 — add median-price stub endpoint

apps/catalog-svc/src/
├─ usecases/list-my-drafts.usecase.ts + spec                     # NEW Story 3.3
├─ usecases-proxy/usecases-proxy.module.ts                       # UPDATE — wire new use case
├─ infrastructure/
│  ├─ http/controllers/
│  │  ├─ internal-listings.controller.ts                         # NEW (5 internal endpoints)
│  │  └─ internal-categories.controller.ts                       # UPDATE — median-price stub endpoint
│  └─ tasks/purge-old-drafts.task.ts                             # NEW (cron daily 4am UTC)

apps/seller/src/
├─ app/[locale]/seller/listings/
│  ├─ new/page.tsx                                               # NEW Server Component
│  └─ [id]/edit/page.tsx                                         # NEW Server Component
├─ middleware.ts                                                  # UPDATE Story 2.2 — allow /seller/listings/* if kyc_status='approved'
├─ features/seller/listings/
│  ├─ components/
│  │  ├─ ListingWizard.tsx + spec                                # NEW Client Component (useReducer + auto-save)
│  │  ├─ WizardTopbar.tsx                                        # NEW (StepIndicator + auto-save indicator)
│  │  ├─ ResumeDraftBanner.tsx                                   # NEW
│  │  ├─ steps/
│  │  │  ├─ StepInfos.tsx + spec                                 # NEW
│  │  │  ├─ StepPhotos.tsx + spec                                # NEW (with PhotoGrid + dnd-kit)
│  │  │  ├─ StepPricing.tsx + spec                               # NEW
│  │  │  ├─ StepZone.tsx + spec                                  # NEW
│  │  │  └─ StepPreview.tsx + spec                               # NEW (TabPreview + 2 CTAs + ServiceAreaDisplay)
│  │  ├─ PhotoGrid.tsx                                           # NEW (dnd-kit sortable)
│  │  ├─ PhotoCard.tsx                                           # NEW (with altText inline)
│  │  ├─ ServiceAreaDisplay.tsx                                  # NEW
│  │  └─ TabPreview.tsx                                          # NEW
│  └─ hooks/
│     ├─ use-listing-wizard-reducer.ts                           # NEW
│     ├─ use-debounced-autosave.ts                               # NEW
│     ├─ use-update-listing-mutation.ts                          # NEW
│     ├─ use-publish-listing-mutation.ts                         # NEW
│     ├─ use-upload-photo.ts                                     # NEW (MOCK Story 3.3 — Story 3.4 implements real pipeline)
│     ├─ use-reorder-photos-mutation.ts                          # NEW
│     └─ use-price-deviation.ts                                  # NEW
└─ messages/{fr,en}.json                                         # UPDATE — namespace seller.listings.new.* (~80 keys × 2)

apps/seller/e2e/listings/wizard.spec.ts                          # NEW (14 tests)

docs/runbook/listing-wizard-debug.md                             # NEW

# Estimation : ~50 nouveaux + ~5 updates = ~55 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5 (atomics + patterns FileUpload + StepIndicator + Card + Modal + Alert + Slider), 0.6 (Pretre — Story 3.3 endpoints follow envelope ADR-014), 0.7 (outbox), 0.9 (next-intl + TanStack Query setup), 1.2 (gateway-api scaffolding + forwarder pattern), 1.7 (admin layout pattern reference for seller layout), 2.2 (middleware seller — Story 3.3 UPDATE to allow /seller/listings/* even pending_admin_review if kyc_status=approved), 2.6 (`<OnboardingFirstListingBanner>` pattern @tukio/ui — Story 3.3 wire when ?onboarding=true), 3.1 (Categories API GET /v1/categories?tree=true), 3.2 (Listing aggregate + 8 use cases catalog-svc + IListingRepository + state machine canTransitionStatusTo).

1. **Pretre architecture stricte** côté backend — endpoints catalog-svc internal Story 3.3 dans `infrastructure/http/controllers/`, use case `list-my-drafts` dans `usecases/`, cron dans `infrastructure/tasks/`.
2. **Transactional outbox ADR-007** — cron purge + publish event single transaction.
3. **API responses envelope ADR-014** — `POST /v1/listings` returns `{ method, code, data: { listingId, slug }, meta }`.
4. **EN strict couche tech** — slug strict EN auto-generated Story 3.2 `Slug.fromTitle()`. URL paths `/seller/listings/new` strict EN.
5. **i18n FR/EN strict** memory — namespace `seller.listings.new.*` ~80 keys × 2 locales. Zéro texte hardcodé.
6. **RGAA AA** (NFR47/50/54) — focus management on step change, axe-core 0 violations, alt text NFR50, prefers-reduced-motion respect.
7. **NFR48 SLA UX < 15 min p90** — wizard target < 12 min Pro avec photos prêtes.
8. **NFR3 perf LCP < 2.5s** — Server Component fetch initial parallel + lazy-load wizard Client Component.
9. **Latest stable versions** memory.

### Previous Story Intelligence

**Story 0.5 (atomics + patterns)** : `<FileUpload>`, `<StepIndicator>`, `<Card>`, `<Modal>`, `<Alert>`, `<Slider>`, `<RadioGroup>`, `<Input>`, `<Textarea>`, `<Select>`, `<Button>`, `<Badge>` réutilisés.

**Story 0.9 (api-client + i18n + testing)** : TanStack Query setup + next-intl + Vitest + Playwright. Story 3.3 réutilise stack.

**Story 2.2 (middleware seller)** : Story 3.3 **UPDATE** middleware pour autoriser `/seller/listings/*` même si `tukio_status='pending_admin_review'` AND `kyc_status='approved'` (Pro post-KYC validé Story 2.5 doit pouvoir commencer wizard 1ère fiche avant onboarding completed Story 2.6).

**Story 2.6 (`<OnboardingFirstListingBanner>` pattern + i18n keys `seller.listings.new.onboardingBanner.*`)** : Story 3.3 **WIRE** le component dans wizard topbar si `?onboarding=true` query param. i18n keys déjà livrés Story 2.6.

**Story 3.1 (catalog-svc taxonomy)** : `GET /v1/categories?tree=true&locale={fr|en}` consumed dans Server Component fetch + `<Select>` cascading.

**Story 3.2 (catalog-svc Listing aggregate + 8 use cases)** : Story 3.3 wire gateway endpoints qui consume `create-listing`, `update-listing`, `publish-listing` (skeleton — Story 3.5 finalise auto-publish), `list-pro-listings` (filtered status='draft' for ListMyDraftsUseCase).

### What this story does NOT do

- ❌ **Story 3.4 photo upload pipeline réelle (R2 → CF Images)** — Story 3.3 livre le contrat UX + MOCK hook. Story 3.4 wirera la vraie pipeline media-svc.
- ❌ **Story 3.5 publish workflow auto-publish + median price** finalisation — Story 3.3 wire l'endpoint `POST /v1/listings/:id/publish` mais Story 3.5 finalise la logic auto-publish + median + price deviation backend.
- ❌ **Story 3.6 edit/unpublish/delete UI** liste seller listings — Story 3.6 livre `/seller/listings` page (Story 3.3 redirect after publish/save).
- ❌ **Story 3.7 Meilisearch indexer** — listing publish event publié Story 3.5/3.6 consumed Story 3.7.
- ❌ **Story 3.10 listing detail public page** — Story 3.3 step 5 preview est interne wizard, pas public.
- ❌ **Map réelle (Mapbox/Leaflet)** — V1+ MVP placeholder div.
- ❌ **DeepL auto-translate FR → EN missing** — V1+ FR101.
- ❌ **AI suggestions title/description** — V1+ FR126.
- ❌ **Templates pré-remplis par catégorie** — V1+ admin tool.
- ❌ **Inventory tracking quantité disponible** — V1+ FR29.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 90 % wizard hooks + state machine reducer
- Coverage ≥ 85 % step components (5)
- Coverage ≥ 80 % gateway endpoints + forwarders
- Coverage ≥ 90 % cron purge-old-drafts
- E2E Playwright FR/EN axe-core 0 violations 14 tests AC10
- Tests `@testing-library/react` ListingWizard 12 scenarios state machine
- Perf : auto-save mutation < 200ms p90, wizard initial render < 1s p90, step transition < 100ms
- A11y axe-core 0 violations sur 6 contextes (5 steps + modale publier)

### Project Structure Notes

✅ **Aligné architecture, PRD §FR23 (1ère fiche dans onboarding), §FR25 (pricing unit/package), §FR26 (service area), §FR32 (price deviation soft-warning), §FR99 (FR obligatoire), §NFR48 (UX < 15 min), §NFR50 (a11y altText), §UX-DR12 (gap MVP wizard service inspired by service.jsx), Stories 0.5/0.9/2.2/2.6/3.1/3.2, memories.**

⚠️ **Décision** : Auto-save debounced 2s + auto-create draft on first load — UX seamless.
⚠️ **Décision** : `useReducer` (vs Zustand) for wizard state — local-only + tests prévisible.
⚠️ **Décision** : Story 3.4 photo pipeline forward-dep MOCK — UX flow wirable sans blocage.
⚠️ **Décision** : `?step=N` URL sync — browser navigation + shareable.
⚠️ **Décision** : Step navigation guarded — flush auto-save + validate avant transition.
⚠️ **Décision** : Resume draft TTL 7j + cron purge — balance UX/DB cleanup.
⚠️ **Décision** : `?onboarding=true` query param Story 2.6 banner integration — explicit URL-shareable.
⚠️ **Décision** : Confirmation modale Publier focus trap — RGAA + UX réfléchi.
⚠️ **Décision** : `@dnd-kit/core` v6+ (vs deprecated react-beautiful-dnd) — moderne RGAA-friendly.
⚠️ **Décision** : Map placeholder MVP — V1+ Mapbox/Leaflet.
⚠️ **Décision** : Story 3.3 wire endpoint publish mais Story 3.5 finalise auto-publish logic — split scope clair.

### References

- [Source: epics.md#Epic-3-Story-3.3 — Lines 1423-1440]
- [Source: epics.md#Story-3.4 — forward-dep photo pipeline]
- [Source: epics.md#Story-3.5 — forward-dep publish workflow + median]
- [Source: prd.md#FR23 (1ère fiche), #FR25 (pricing), #FR26 (service area), #FR32 (price deviation soft-warning), #FR99 (FR obligatoire), #NFR48 (UX < 15 min), #NFR50 (a11y altText), #NFR47 (motion + RGAA AA)]
- [Source: ux-design-specification.md — UX-DR12 wizard service gap MVP, service.jsx bundle reference]
- [Source: architecture.md — ADR-007 outbox, ADR-014 envelope, EN strict line 158]
- [Source: Stories 0.5 (atomics), 0.9 (TanStack Query + next-intl), 1.2 (gateway-api forwarder), 2.2 (middleware seller — UPDATE), 2.6 (OnboardingFirstListingBanner + i18n keys), 3.1 (Categories API), 3.2 (Listing aggregate + 8 use cases + IListingRepository)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 3.4 (photo upload pipeline réelle R2 → CF Images via media-svc — replace `useUploadPhoto` MOCK Story 3.3 par vraie implementation), Story 3.5 (publish workflow auto-publish + median + price deviation — finalise endpoint POST /v1/listings/:id/publish + compute-median-price use case Story 3.2 skeleton), Story 3.6 (seller listings page — redirect target post publish/save Story 3.3), Story 3.7 (Meilisearch indexer — consume listing.published event), Story 3.10 (listing detail public — preview Story 3.3 step 5 inspiré + s'aligne avec service.jsx bundle))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (3ᵉ story Epic 3 après 3.1 + 3.2)
- **Estimation effort** : 6-8 jours (1 dev fullstack — story complète : 5 step components + wizard state machine + auto-save + 5 gateway endpoints + cron + i18n 80 keys × 2 + 14 e2e tests, ~55 fichiers, plus complex Epic 3 jusqu'ici)
- **Dépendances upstream** : Stories 0.5 (atomics + patterns), 0.6 (Pretre), 0.7 (outbox), 0.9 (TanStack Query + next-intl + testing), 1.2 (gateway-api forwarder), 1.7 (admin layout reference for seller layout), 2.2 (middleware seller — UPDATE), 2.6 (OnboardingFirstListingBanner + i18n keys), 3.1 (Categories API), 3.2 (Listing aggregate + 8 use cases catalog-svc — Story 3.3 wire `create-listing` + `update-listing` + `publish-listing` skeleton + `list-pro-listings` filtered drafts)
- **Dépendances downstream** :
  - Story 3.4 (photo upload pipeline réelle) — replace `useUploadPhoto` MOCK Story 3.3 par vraie implementation R2 → CF Images via media-svc
  - Story 3.5 (publish workflow auto-publish + median) — finalise endpoint POST /v1/listings/:id/publish + compute-median-price (Story 3.2 skeletons)
  - Story 3.6 (seller listings page) — redirect target post publish/save Story 3.3 + edit existing listing utilise wizard same component
  - Story 3.7 (Meilisearch indexer) — consume `catalog.listing.published.v1` event publié Story 3.5/3.6
  - Story 3.10 (listing detail public) — preview Story 3.3 step 5 inspiré + s'aligne avec service.jsx bundle
- **FRs covered** :
  - **FR23** ✅ 1ère fiche service dans onboarding (wizard frontend + integration Story 2.6 banner)
  - **FR25 partial** ✅ pricing unit/package UX (FR25 enforce backend Story 3.2 + UX Story 3.3)
  - **FR26 partial** ✅ service area UX (postal + radius + leadTime — map placeholder V1+)
  - **FR32 partial** ✅ price deviation soft-warning UX prêt (full backend Story 3.5)
  - **FR99** ✅ FR obligatoire enforced UX inline + Zod (mirror Story 3.2 VOs)
- **NFRs touchés** :
  - **NFR47** ✅ motion + prefers-reduced-motion respect (modale focus trap, no janky animations)
  - **NFR48** ✅ UX < 15 min p90 onboarding cumulatif
  - **NFR50** ✅ a11y altText photo + axe-core 0 violations
  - **NFR54** ✅ RGAA AA focus management + step navigation
  - **NFR71** ✅ coverage thresholds

> **Prochaine story → Story 3.4** (Photo upload + Cloudflare Images integration — replace `useUploadPhoto` MOCK Story 3.3 par vraie pipeline R2 → CF Images via media-svc scaffolding)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.6, 0.7, 0.9, 1.2, 1.7, 2.2, 2.6, 3.1, 3.2 implémentées
3. Implémenter Tasks 1-15 dans l'ordre (DTOs Task 1 → gateway endpoints Task 2 → catalog-svc internal Task 3 → cron Task 4 → Server pages Task 5 → ListingWizard Task 6 → 5 step components Tasks 7-11 → ResumeDraftBanner + Story 2.6 wire Task 12 → i18n Task 13 → tests Task 14 → docs Task 15)
4. Lancer `pnpm playwright test --grep "create listing wizard"` après chaque jalon + `pnpm vitest --filter=seller` pour wizard hooks
5. Commit Story 3.3 quand : 14/14 e2e + 12/12 ListingWizard tests + coverage thresholds NFR71 + axe-core 0 + perf cibles + auto-save 200ms p90 + Story 2.6 banner integration testée + Story 3.4 MOCK pipeline documentée pour replace + i18n FR/EN namespaces complets + cron purge-old-drafts testé
6. Update sprint-status : `3-3-...: review` puis `done`
