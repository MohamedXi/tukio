# Story 5.9: Display badge "FR only" si EN absent (FR100, FR99, NFR58, NFR60, NFR50, NFR54)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As a** Visitor en locale `en` (anglophone résidant en France ou visiteur international),
**I want** **un badge visuel transparent "Available in French only"** affiché sur la fiche d'un Service / d'un Pro / d'une catégorie qui n'a pas (encore) été traduit(e) en EN par le Pro — **variant prominent** sur la fiche détail (`<Badge variant="info">` placé au-dessus du titre + tooltip explicatif) + **variant mini** sur les cards listing dans search results / category pages / Pro public profile (`<Flag icon="FR">` discret top-right corner UX subtil pour SERP density) — **fallback transparent** sur le contenu FR existant (Story 3.x baseline `listing_translations + category_translations + pro_profile_translations` schema multilingue Story 3.7) + **invalidation cache TanStack Query automatique** quand Pro ajoute EN translation Story 3.6 baseline → badge disparaît au prochain reload Visitor — **Visitor FR jamais ne voit ce badge** (FR langue principale, fallback non-applicable),
**So that** je comprends **immédiatement pourquoi le contenu s'affiche en FR** plutôt qu'en EN (transparence UX-DR16 — pas de confusion ou frustration "le site est buggué") — Tukio garde son **engagement bilingue FR/EN dès MVP** (ADR-012 + NFR59) sans bloquer les Pros qui ne traduisent pas leurs fiches (effort optionnel — fallback FR + badge transparent UX) — Visitor peut cliquer le badge tooltip pour lire l'explication complète + lien stub "Request translation (coming soon)" (V1+ feature défini, MVP : tooltip statique informative) — Pro voit **clear UI hint** dans son listing editor Story 3.6 ("EN translation missing → badge will appear pour anglophones") qui encourage à traduire sans rendre obligatoire (FR99 mandatory FR + optional EN respect strict).

Story 5.9 livre :

- (a) **Frontend `<FrenchOnlyBadge>` NEW component** dans `apps/public/src/features/i18n/components/FrenchOnlyBadge.tsx` :
  - 2 variants : `variant="prominent"` (Service/Pro/Category detail pages — placed above title) + `variant="mini"` (Search results / category cards — top-right corner)
  - **`variant="prominent"`** : `<Badge variant="info" size="md">` Story 0.4 atom + label localized `t('french_only_badge.label')` "Available in French only" + `<Tooltip>` Story 0.4 atom + tooltip content localized `t('french_only_badge.tooltip')` "This service has not been translated by the seller. Content is displayed in French." + stub link "Request translation (coming soon)" (V1+ feature deferred — MVP : disabled link `<a aria-disabled="true">` avec tooltip "Feature coming soon")
  - **`variant="mini"`** : `<Badge variant="info" size="sm">` + `<Flag>` icon FR (lucide-react `<Flag />` Story 0.4 baseline) + label `t('french_only_badge.label_short')` "FR" (max 3 chars compact) + `<Tooltip>` shorter `t('french_only_badge.tooltip_search_card')` "Available in French only — content not translated"
  - **Conditional render** : component returns `null` si `locale !== 'en'` OR `hasEnTranslation === true` (Visitor FR jamais ne voit, EN avec translation jamais ne voit)
  - **A11y RGAA AA** : `<Badge>` `role="status"` + `aria-label` localized + `<Tooltip>` keyboard accessible (focus → tooltip visible + ESC dismiss) + `prefers-reduced-motion` Story 0.5 baseline respect

- (b) **Story 3.10 Service detail page EXTEND** : ajouter `<FrenchOnlyBadge variant="prominent">` au-dessus du `<h1>` titre dans `apps/public/src/app/[locale]/services/[slug]/page.tsx` :
  - Server Component fetch `getListingDetail(slug, locale)` Story 3.10 baseline retourne `{ ..., hasEnTranslation: boolean }` field (Story 5.9 backend EXTEND DTO)
  - Render conditional `{locale === 'en' && !hasEnTranslation && <FrenchOnlyBadge variant="prominent" />}` au-dessus du `<h1>` titre + avant breadcrumb
  - Pas de modification du contenu rendu (fallback FR content déjà affiché Story 3.10 baseline via `listing_translations.title || listing_translations_fr.title` pattern)

- (c) **Story 3.11 Pro public profile page EXTEND** : ajouter `<FrenchOnlyBadge variant="prominent">` au-dessus du `<h1>` Pro name dans `apps/public/src/app/[locale]/pro/[slug]/page.tsx` :
  - Server Component fetch `getProProfile(slug, locale)` Story 3.11 baseline retourne `{ ..., hasEnTranslation: boolean }` (computed depuis `pro_profile_translations.locale = 'en'` existence)
  - Conditional render même pattern Story 5.9 (b)

- (d) **Story 3.12 Category general page EXTEND** : ajouter `<FrenchOnlyBadge variant="prominent">` au-dessus du `<h1>` Category title dans `apps/public/src/app/[locale]/category/[slug]/page.tsx` :
  - Server Component fetch `getCategoryDetail(slug, locale)` Story 3.12 baseline → ajout `hasEnTranslation` field
  - Conditional render

- (e) **Story 3.9 Search results page EXTEND + Story 3.12 category listings EXTEND** : ajouter `<FrenchOnlyBadge variant="mini">` sur chaque `<ListingCard>` Story 3.8 baseline si `listing._fallback_locale === 'fr'` (Meilisearch field — Story 3.7 indexer baseline EXTEND Story 5.9) :
  - `<ListingCard>` Story 3.8 baseline component EXTEND avec prop `fallbackLocale?: 'fr' | null` (default null)
  - Conditional render `{locale === 'en' && fallbackLocale === 'fr' && <FrenchOnlyBadge variant="mini" />}` top-right corner via absolute positioning
  - Mirror sur `<ProListingCard>` si présent

- (f) **Backend `catalog-svc` Story 3.2/3.5 baseline EXTEND** :
  - DTO mapping `ListingDetailResponseDto` + `ProProfileResponseDto` + `CategoryDetailResponseDto` add `hasEnTranslation: boolean` field computed côté backend
  - Pure logic : `hasEnTranslation = listing.translations.some(t => t.locale === 'en' && t.title.length > 0 && t.description.length > 0)` — both `title_en + description_en` required (FR99 strict — partial EN translation counts as "missing")
  - Aucune modif domain Story 3.2 baseline — pure mapper extension côté gateway-api forwarder OR catalog-svc DTO output

- (g) **Story 3.7 Meilisearch indexer EXTEND** : when document indexed dans `listings_en` index baseline Story 3.7, ajouter field `_fallback_locale: 'fr'` si le doc utilise FR content faute de EN translation :
  - `apps/catalog-svc/src/infrastructure/messaging/listing-translation-published-consumer.handler.ts` Story 3.7 baseline EXTEND
  - Logic : si event `catalog.listing.translation.published.v1` payload locale = 'fr' AND no `en` translation exists pour le listing → upsert `listings_en` index avec FR content + `_fallback_locale: 'fr'` flag
  - Si event locale = 'en' → upsert avec EN content + `_fallback_locale: null` (clear flag) → invalidate cache Visitor reload sees update
  - Meilisearch field `_fallback_locale` searchable=false + filterable=true (filter `_fallback_locale = 'fr'` côté frontend display logic)

- (h) **Gateway-api `GET /v1/listings/:id` + mirrors EXTEND** : Story 3.10/3.11/3.12 baseline endpoints réutilisés — response envelope `data` add `hasEnTranslation: boolean` field. Mirror sur Pro + Category endpoints

- (i) **Story 3.6 Listing edit form Pro EXTEND** : ajouter UI hint dans le wizard étape EN translation optional :
  - Si Pro skip EN translation → afficher `<Alert variant="info">` "EN translation missing — French-only badge will appear pour visiteurs anglophones. You can add EN translation anytime." + CTA "Add EN translation now" (focus EN tab) + CTA secondary "Skip for now"
  - **PAS de FR99 enforcement override** — Story 3.6 baseline FR99 strict (FR mandatory + EN optional) — Story 5.9 add hint UX only, pas blocking
  - i18n string `pro_listing_editor.en_translation_hint` + `pro_listing_editor.en_translation_cta_add` + `pro_listing_editor.en_translation_cta_skip`

- (j) **TanStack Query cache invalidation** : Story 3.6 baseline `useUpdateListing` mutation hook → onSuccess invalidate `useListingDetail` + `useSearchListings` + `useCategoryListings` queries → reload Visitor sees badge disappear immediately (no manual hard refresh needed) — pattern Story 5.2/5.7 baseline réutilisé

- (k) **NFR58 hreflang systematic** : Story 3.10/3.11/3.12 baseline déjà inject `<link rel="alternate" hreflang="fr" href=".../fr/..." />` + `hreflang="en"` + `hreflang="x-default"` (NFR58 — Story 3.x baseline maintained). Story 5.9 ne modifie pas hreflang — pure UI badge logic

- (l) **i18n FR/EN ~10 strings** dans `apps/public/messages/{fr,en}/common.json` (NEW namespace `french_only_badge`) :
  - `french_only_badge.label` EN = "Available in French only" / FR = "" (badge n'apparait pas en FR)
  - `french_only_badge.label_short` EN = "FR" / FR = "" 
  - `french_only_badge.tooltip` EN = "This service has not been translated by the seller. Content is displayed in French." / FR = ""
  - `french_only_badge.tooltip_search_card` EN = "Available in French only — content not translated" / FR = ""
  - `french_only_badge.cta_request_translation` EN = "Request translation (coming soon)" / FR = ""
  - `french_only_badge.cta_request_translation_disabled_tooltip` EN = "Feature coming soon" / FR = ""
  - `french_only_badge.aria_label` EN = "Available in French only — explanatory tooltip" / FR = ""
  - Et dans `apps/seller/messages/{fr,en}/seller.json` (Pro côté seller editor hint) :
    - `pro_listing_editor.en_translation_hint` FR + EN ~3 strings
    - `pro_listing_editor.en_translation_cta_add` + `_cta_skip` ~2 strings

- (m) **A11y RGAA AA + Lighthouse ≥ 90** : `<Badge>` `role="status"` (informational) + `<Tooltip>` `role="tooltip"` + `aria-describedby` link Badge → Tooltip + keyboard navigation (Tab focus → Tooltip visible + ESC dismiss) + `prefers-reduced-motion` respect badge animations + axe-core 0 violations sur 4 pages Story 5.9 EXTEND (Service detail + Pro profile + Category + Search results)

- (n) **Tests** :
  - **Playwright E2E 6 scenarios** : (1) Visitor `en` sur Service détail sans EN → badge prominent visible + tooltip on hover/focus ; (2) Visitor `en` sur category page → 3 cards avec mini-badge FR + 2 cards sans (have EN) ; (3) Visitor `fr` sur même Service → aucun badge ; (4) Pro édite Story 3.6 baseline + add EN translation + save → Visitor `en` reload → badge disparaît (cache invalidation TanStack Query) ; (5) Search `/en/search?...` → results avec mix EN translations + FR fallback → mini-badges visibles only sur FR fallbacks ; (6) keyboard navigation Tab → Tooltip ARIA accessible
  - **axe-core 0 violations** sur 4 pages
  - **Lighthouse Accessibility ≥ 90 + SEO ≥ 90** (hreflang Story 3.10/3.11/3.12 baseline maintained)
  - **Components unit RTL 5 scenarios** : `<FrenchOnlyBadge variant="prominent">` render + tooltip + `variant="mini"` render + conditional null si locale=fr + conditional null si hasEnTranslation=true + ARIA attributes
  - **Integration testcontainer 3 scenarios** : Meilisearch indexer Story 3.7 EXTEND _fallback_locale field set quand EN missing + clear quand EN added + filter searchable
  - **DTO mapping unit 4 scenarios** : `hasEnTranslation` computed correct (both title+description required + partial → false + null translations array → false + both present → true)

**So that** Tukio respecte son **engagement bilingue FR/EN MVP** (ADR-012 + NFR59) sans forcer les Pros à traduire (FR99 mandatory FR + optional EN strict) — Visitor `en` comprend immédiatement pourquoi le contenu s'affiche en FR via badge transparent prominent fiche détail + mini cards SERP — Pros qui ajoutent EN translation voient badge disparaître pour Visitors anglophones (cache invalidation auto Story 5.9) + Pros voient hint UX Story 3.6 baseline EXTEND qui encourage à traduire — l'engagement bilingue + transparence FR100 closent Epic 5 i18n side (Stories 5.4 emails templates FR/EN + Story 5.9 UI badge + Story 7.1 next-intl baseline) — Epic 7 i18n + Acquisition (Sprint 8+) peut build sur cette foundation FR/EN strict.

> **Outcome attendu** : à la fin de cette story, un Visitor anonyme sur `https://tukio.one/en/services/marquee-pornichet` (listing sans `title_en` ou `description_en` Story 3.x baseline) → la page render fallback FR content + badge prominent `<Badge variant="info">"Available in French only"</Badge>` au-dessus du `<h1>` + tooltip on hover/focus "This service has not been translated by the seller…" + stub link "Request translation (coming soon)" disabled (V1+) ; un Visitor `en` sur `/en/category/marquees` → 8 cards listing, 5 avec mini-badge "FR" top-right (FR fallback) + 3 sans (EN translation present) ; un Visitor `fr` sur `/fr/services/marquee-pornichet` → aucun badge (FR principale) ; un Pro édite sa fiche listing-edit Story 3.6 baseline → voit UI hint "EN translation missing" + ajoute EN translation + save → outbox `catalog.listing.translation.published.v1` Story 3.7 → Meilisearch indexer EXTEND clear `_fallback_locale` field + cache TanStack Query invalidate → Visitor `en` reload → badge disparu ; Lighthouse Accessibility ≥ 90 + axe-core 0 violations sur 4 pages Story 5.9 EXTEND ; `pnpm lint && typecheck && test --coverage` exit 0 maintained NFR71 ; `sprint-status.yaml` flip Story 5.9 = ready-for-dev → done.

## Acceptance Criteria

1. **AC1 — Frontend `<FrenchOnlyBadge>` NEW component + 2 variants + Story 0.4 atoms + ARIA** : Given `apps/public/src/features/i18n/components/FrenchOnlyBadge.tsx` NEW, When I import it : (a) Props `{ variant: 'prominent' | 'mini', locale: 'fr' | 'en', hasEnTranslation: boolean }` ; (b) Conditional render `null` si `locale !== 'en' OR hasEnTranslation === true` ; (c) `variant="prominent"` : `<Badge variant="info" size="md">` Story 0.4 atom + label localized + `<Tooltip>` Story 0.4 + content localized + stub link "Request translation (coming soon)" disabled `<a aria-disabled="true">` ; (d) `variant="mini"` : `<Badge variant="info" size="sm">` + `<Flag>` icon FR (lucide-react) + label "FR" + shorter Tooltip ; (e) ARIA RGAA AA : `<Badge role="status">` + `aria-describedby` link Tooltip + keyboard focus accessible. Tests RTL 5 scenarios.

2. **AC2 — Story 3.10 Service detail EXTEND + Story 3.11 Pro profile EXTEND + Story 3.12 Category EXTEND** : Given Stories 3.10/3.11/3.12 baselines Server Component pages, When Story 5.9 EXTEND : (a) Service detail `services/[slug]/page.tsx` — fetch `getListingDetail(slug, locale)` baseline returns `hasEnTranslation: boolean` (Story 5.9 backend EXTEND DTO) — render `{locale === 'en' && !hasEnTranslation && <FrenchOnlyBadge variant="prominent" locale={locale} hasEnTranslation={false} />}` au-dessus de `<h1>` ; (b) Mirror Pro profile `pro/[slug]/page.tsx` + Category `category/[slug]/page.tsx` ; (c) Pas de modif content render (fallback FR Story 3.x baseline preserved). Tests Playwright E2E 3 scenarios + axe-core a11y.

3. **AC3 — Story 3.8 `<ListingCard>` EXTEND + Story 3.9 Search results + Story 3.12 category listings affichent `<FrenchOnlyBadge variant="mini">`** : Given Story 3.8 baseline `<ListingCard>`, When Story 5.9 EXTEND : (a) Prop `fallbackLocale?: 'fr' | null` (default null) ; (b) Conditional render `{locale === 'en' && fallbackLocale === 'fr' && <FrenchOnlyBadge variant="mini" locale={locale} hasEnTranslation={false} />}` top-right corner via absolute positioning Tailwind v4 `absolute top-2 right-2` ; (c) Mirror `<ProListingCard>` si existe (V1+ — vérifier Story 3.x baseline) ; (d) Search results page Story 3.9 + Category listings Story 3.12 pass `fallbackLocale` depuis Meilisearch result field `_fallback_locale`. Tests Playwright E2E 2 scenarios.

4. **AC4 — Backend `catalog-svc` DTO EXTEND + `hasEnTranslation` field computed** : Given Story 3.2/3.5 baselines `ListingDetailResponseDto + ProProfileResponseDto + CategoryDetailResponseDto`, When Story 5.9 EXTEND : (a) Add `hasEnTranslation: boolean` field computed côté backend mapper (gateway-api forwarder OR catalog-svc DTO output decision : **gateway-api forwarder** pour éviter cross-svc lookup overhead — read `translations` field already returned + compute) ; (b) Pure logic `hasEnTranslation = translations?.some(t => t.locale === 'en' && t.title?.length > 0 && t.description?.length > 0) ?? false` (both title+description required — FR99 strict, partial EN counts as missing) ; (c) Aucune modif domain Story 3.2 baseline ; (d) Mirror sur 3 DTO types. Tests unit DTO mapping 4 scenarios + integration 1 scenario gateway endpoint return field.

5. **AC5 — Story 3.7 Meilisearch indexer EXTEND `_fallback_locale` field** : Given Story 3.7 baseline `listing-translation-published-consumer.handler.ts` indexer, When Story 5.9 EXTEND : (a) Si event `catalog.listing.translation.published.v1` payload `locale === 'fr'` AND no EN translation exists pour le listing → upsert `listings_en` index avec FR content (fallback) + field `_fallback_locale: 'fr'` ; (b) Si event payload `locale === 'en'` → upsert `listings_en` avec EN content + clear `_fallback_locale: null` ; (c) Meilisearch field setting `_fallback_locale` `searchable: false` + `filterable: true` (filter `_fallback_locale = 'fr'` côté frontend) ; (d) Pure additive change — backward-compatible (existing docs sans field → considered `null` by Meilisearch). Tests integration testcontainer Meilisearch 3 scenarios.

6. **AC6 — Cache TanStack Query invalidation quand Pro ajoute EN translation Story 3.6 baseline** : Given Story 3.6 baseline `useUpdateListing` mutation, When Story 5.9 invalidation : (a) onSuccess invalidate `['listing-detail', listingId]` + `['search-listings']` + `['category-listings', categoryId]` query keys ; (b) Pattern Story 5.2/5.7 baseline réutilisé ; (c) Visitor `en` reload page sans manual hard refresh → fetch fresh `hasEnTranslation: true` → badge disappears. Tests integration 1 scenario + Playwright E2E 1 scenario (mock Pro update).

7. **AC7 — Story 3.6 Pro listing editor UI hint + CTA add EN translation** : Given Story 3.6 baseline listing wizard, When Pro skip EN translation step : (a) Afficher `<Alert variant="info">` Story 0.4 atom "EN translation missing — French-only badge will appear pour visiteurs anglophones. You can add EN translation anytime." ; (b) 2 CTA `<Button variant="primary">` "Add EN translation now" (focus EN tab) + `<Button variant="ghost">` "Skip for now" ; (c) Pas de FR99 enforcement override (FR mandatory + EN optional strict baseline maintained — Story 5.9 hint UX only) ; (d) i18n strings `pro_listing_editor.en_translation_hint` + ctas. Tests Playwright E2E 1 scenario Pro side.

8. **AC8 — i18n FR/EN ~10 strings + namespace `french_only_badge` + `pro_listing_editor` hint** : Given next-intl Story 1.2d pattern, When Story 5.9 :
   - UPDATE `apps/public/messages/en/common.json` — add `french_only_badge` namespace (7 strings) — FR namespace empty (badge n'apparait pas en FR — but provide empty strings for next-intl key safety)
   - UPDATE `apps/seller/messages/{fr,en}/seller.json` — add `pro_listing_editor.en_translation_*` namespace (5 strings × 2 locales)
   - Verify no hardcoded text NFR56-57 lint
   - Tests render snapshot 2 specs (variant prominent + mini) avec localized strings

9. **AC9 — A11y RGAA AA + axe-core 0 violations + Lighthouse ≥ 90 + ARIA tooltip keyboard** : Given Story 0.4 atoms baseline + Story 0.5 baseline, When Story 5.9 render : (a) `<Badge>` `role="status"` informational + `aria-label` localized + `aria-describedby` link to Tooltip ID ; (b) `<Tooltip>` `role="tooltip"` + focus visible on Tab + ESC dismiss + `prefers-reduced-motion` Story 0.5 baseline ; (c) Mini-badge on cards : `aria-label` "Available in French only" — distinct du card link aria-label ; (d) Lighthouse Accessibility ≥ 90 + axe-core 0 violations sur 4 pages Story 5.9 EXTEND. Tests Playwright + axe-core 4 a11y specs + Lighthouse CI.

10. **AC10 — Stub "Request translation (coming soon)" V1+ deferred + disabled link** : Given UX-DR16 transparence, When user clique stub link "Request translation" dans `<FrenchOnlyBadge variant="prominent">` tooltip : (a) Link rendered `<a aria-disabled="true" tabIndex={-1}>` + visually muted (color gray-400) + cursor not-allowed ; (b) Tooltip secondary on link hover/focus `t('french_only_badge.cta_request_translation_disabled_tooltip')` "Feature coming soon" ; (c) NEW Story slot V1+ Epic 12.x ou Epic 7.x (Story 5.9 reserve event schema `catalog.translation-requested.v1` STUB dans `packages/contracts/src/events/catalog/translation-requested.v1.{schema.json,ts}` STUB only — pas émis MVP) ; (d) Tests RTL 1 scenario disabled state.

## Tasks / Subtasks

- [ ] **Task 1 — `<FrenchOnlyBadge>` NEW component + 2 variants + tests RTL** (AC: #1)
  - [ ] 1.1 — NEW `apps/public/src/features/i18n/components/FrenchOnlyBadge.tsx` (2 variants + conditional render + ARIA)
  - [ ] 1.2 — NEW `apps/public/src/features/i18n/components/FrenchOnlyBadge.spec.tsx` (RTL 5 scenarios)
  - [ ] 1.3 — Mirror dans `apps/seller/src/features/i18n/components/FrenchOnlyBadge.tsx` si nécessaire (V1+ — Story 5.9 MVP public only — Seller voit son listing FR forcé)

- [ ] **Task 2 — Backend catalog-svc + gateway-api DTOs EXTEND `hasEnTranslation` field** (AC: #4)
  - [ ] 2.1 — UPDATE `apps/gateway-api/src/listings/usecases/{get-listing-detail,get-pro-profile,get-category-detail}-forwarder.usecase.ts` Story 3.2/3.11/3.12 baseline — add `hasEnTranslation` computed pure logic
  - [ ] 2.2 — UPDATE 3 DTOs response types (`ListingDetailResponseDto + ProProfileResponseDto + CategoryDetailResponseDto`)
  - [ ] 2.3 — Tests unit DTO mapping 4 scenarios

- [ ] **Task 3 — Meilisearch indexer Story 3.7 EXTEND `_fallback_locale` field** (AC: #5)
  - [ ] 3.1 — UPDATE `apps/catalog-svc/src/infrastructure/messaging/listing-translation-published-consumer.handler.ts` Story 3.7 baseline — add `_fallback_locale` field logic
  - [ ] 3.2 — UPDATE Meilisearch index settings via cron/bootstrap script — `_fallback_locale` filterable=true searchable=false
  - [ ] 3.3 — Tests integration testcontainer Meilisearch 3 scenarios (set quand EN missing + clear quand EN added + filter searchable)

- [ ] **Task 4 — Story 3.10 Service detail + Story 3.11 Pro + Story 3.12 Category EXTEND `<FrenchOnlyBadge variant="prominent">`** (AC: #2)
  - [ ] 4.1 — UPDATE `apps/public/src/app/[locale]/services/[slug]/page.tsx` Story 3.10 — render conditional badge
  - [ ] 4.2 — UPDATE `apps/public/src/app/[locale]/pro/[slug]/page.tsx` Story 3.11
  - [ ] 4.3 — UPDATE `apps/public/src/app/[locale]/category/[slug]/page.tsx` Story 3.12
  - [ ] 4.4 — Tests Playwright E2E 3 scenarios + axe-core a11y

- [ ] **Task 5 — Story 3.8 `<ListingCard>` EXTEND + Story 3.9 Search + Story 3.12 cards** (AC: #3)
  - [ ] 5.1 — UPDATE `apps/public/src/features/listings/components/ListingCard.tsx` Story 3.8 baseline — add `fallbackLocale` prop + conditional `<FrenchOnlyBadge variant="mini">`
  - [ ] 5.2 — UPDATE `apps/public/src/app/[locale]/search/page.tsx` Story 3.9 — pass `fallbackLocale` from Meilisearch result `_fallback_locale` field
  - [ ] 5.3 — UPDATE `apps/public/src/app/[locale]/category/[slug]/page.tsx` Story 3.12 listings section — pass `fallbackLocale`
  - [ ] 5.4 — Tests Playwright E2E 2 scenarios

- [ ] **Task 6 — Story 3.6 Pro listing editor UI hint + CTA** (AC: #7)
  - [ ] 6.1 — UPDATE `apps/seller/src/features/listings/components/ListingEditorWizard.tsx` Story 3.6 baseline — add `<Alert>` hint + 2 CTAs si EN translation skip
  - [ ] 6.2 — Tests Playwright E2E 1 scenario Pro side

- [ ] **Task 7 — Cache TanStack Query invalidation Story 3.6 baseline EXTEND** (AC: #6)
  - [ ] 7.1 — UPDATE `packages/api-client/src/hooks/listings/use-update-listing.ts` Story 3.6 baseline — onSuccess invalidate 3 query keys (listing-detail + search-listings + category-listings)
  - [ ] 7.2 — Tests integration 1 scenario invalidation flow

- [ ] **Task 8 — i18n FR/EN ~10 strings** (AC: #8)
  - [ ] 8.1 — UPDATE `apps/public/messages/{fr,en}/common.json` — add `french_only_badge` namespace 7 strings (EN populated + FR empty pour next-intl key safety)
  - [ ] 8.2 — UPDATE `apps/seller/messages/{fr,en}/seller.json` — add `pro_listing_editor.en_translation_*` 5 strings × 2 locales
  - [ ] 8.3 — Verify no hardcoded text lint

- [ ] **Task 9 — Event schema STUB `catalog.translation-requested.v1` reserved V1+** (AC: #10)
  - [ ] 9.1 — NEW `packages/contracts/src/events/catalog/translation-requested.v1.{schema.json,ts}` STUB schema (V1+ feature reserved — not emitted MVP)
  - [ ] 9.2 — UPDATE `packages/contracts/src/events/catalog/index.ts` — export subpath

- [ ] **Task 10 — A11y RGAA AA + axe-core + Lighthouse** (AC: #9)
  - [ ] 10.1 — `<Badge>` role=status + aria-label + aria-describedby Tooltip
  - [ ] 10.2 — `<Tooltip>` role=tooltip + keyboard accessible + ESC dismiss
  - [ ] 10.3 — `prefers-reduced-motion` respect Story 0.5 baseline
  - [ ] 10.4 — Stub link disabled `<a aria-disabled="true" tabIndex={-1}>` + cursor not-allowed
  - [ ] 10.5 — Tests Playwright axe-core 4 specs + Lighthouse Accessibility + SEO ≥ 90

- [ ] **Task 11 — Documentation + project-context** (no AC — docs)
  - [ ] 11.1 — UPDATE `docs/runbook/i18n-fr-en-bilingual.md` (NEW si pas existant OR EXTEND Story 7.x baseline) — add Story 5.9 badge logic + Meilisearch fallback indexer
  - [ ] 11.2 — UPDATE `docs/project-context.md` — extend i18n section avec Story 5.9 badge
  - [ ] 11.3 — UPDATE `_bmad-output/implementation-artifacts/3-7-meilisearch-index-per-locale-outbox-sync.md` Completion Notes — note `_fallback_locale` field Story 5.9 EXTEND
  - [ ] 11.4 — UPDATE `_bmad-output/implementation-artifacts/3-8-search-frontend-barre-recherche.md` + `3-10-listing-detail-public-page.md` + `3-11-pro-public-profile-page.md` + `3-12-category-general-page-median-price-display.md` Completion Notes — note Story 5.9 EXTEND visual badge

- [ ] **Task 12 — Validation & Commit**
  - [ ] 12.1 — `pnpm lint && pnpm typecheck` 0 errors
  - [ ] 12.2 — `pnpm test --coverage` NFR71 maintained
  - [ ] 12.3 — Tests integration testcontainer Meilisearch green
  - [ ] 12.4 — Playwright E2E 6 scenarios + axe-core 0 + Lighthouse ≥ 90 green
  - [ ] 12.5 — Commit `feat(public,seller,catalog-svc,gateway-api,api-client,contracts): Story 5.9 display badge FR only si EN absent FR100 — <FrenchOnlyBadge> NEW component 2 variants prominent/mini + Story 3.10/3.11/3.12 detail pages EXTEND + Story 3.8 ListingCard EXTEND fallbackLocale prop + Story 3.9 search EXTEND + Story 3.7 Meilisearch indexer EXTEND _fallback_locale field + catalog-svc gateway DTO EXTEND hasEnTranslation computed + Story 3.6 Pro editor UI hint + CTA add EN translation + TanStack Query cache invalidation listing-detail/search-listings/category-listings + ~10 i18n strings + STUB event catalog.translation-requested.v1 V1+ reserved + a11y RGAA AA + axe-core 0 + Lighthouse 90`
  - [ ] 12.6 — PR title `Story 5.9 — Display badge "FR only" si EN absent FR100` ; target `develop`

## Dev Notes

### Story 5.9 livre

**Frontend (public + seller) :**

1. **`<FrenchOnlyBadge>` NEW component** 2 variants : `prominent` (fiche détail) + `mini` (cards search/category)
2. **Story 3.10 Service detail + Story 3.11 Pro profile + Story 3.12 Category EXTEND** : render `<FrenchOnlyBadge variant="prominent">` conditional
3. **Story 3.8 `<ListingCard>` EXTEND** : add `fallbackLocale` prop + render `<FrenchOnlyBadge variant="mini">` top-right
4. **Story 3.9 Search results + Story 3.12 category listings EXTEND** : pass `fallbackLocale` from Meilisearch result `_fallback_locale`
5. **Story 3.6 Pro listing editor EXTEND** : UI hint + CTA add EN translation
6. **TanStack Query cache invalidation Story 3.6** : 3 query keys (listing-detail + search-listings + category-listings)
7. **~10 i18n strings** namespaces (french_only_badge EN populated FR empty + pro_listing_editor.en_translation_*)

**Backend (catalog-svc + gateway-api) :**

1. **Gateway forwarders 3 EXTEND** : add `hasEnTranslation` field computed pure logic dans DTO mappers (Service + Pro + Category)
2. **Meilisearch indexer Story 3.7 EXTEND** : add `_fallback_locale` field logic (set quand EN missing + clear quand EN added)
3. **Event schema STUB** `catalog.translation-requested.v1` V1+ reserved (Story 5.9 prepare future feature)

**A11y RGAA AA + Lighthouse + axe-core 0** sur 4 pages Story 5.9 EXTEND

**Tests : ~25 scenarios totale**

### Story 5.9 NE livre PAS (déféré V1+)

- ❌ **"Request translation" feature (Customer demande translation)** → **V1+** (Story 5.9 reserve event schema STUB + UI disabled link "coming soon")
- ❌ **Auto-translation via DeepL API** → **V1+ Epic 7** (Story 7.x pourrait livrer)
- ❌ **Glossary / consistency check Pro tools** → **V2+**
- ❌ **Badge on Pro public profile cards** (Pro list search) → **V1+ Epic 11**

### Dependencies inputs (Stories livrées)

| Story | Livrable réutilisé Story 5.9 |
|-------|--------------------------------|
| 0.2 | `@tukio/contracts` envelope + event schemas pattern |
| 0.4 | `<Badge>` + `<Tooltip>` + `<Alert>` + `<Button>` + `<Flag>` atoms |
| 0.5 | `prefers-reduced-motion` baseline |
| 0.9 | testcontainer helpers + axe-core Playwright |
| 0.11 | CI workflow + Lighthouse |
| 1.2c | gateway forwarder pattern |
| 1.2d | RHF + a11y RGAA AA patterns |
| 3.2 | catalog-svc baseline + listing translations schema |
| 3.5 | listing publish workflow + median price baseline |
| 3.6 | Pro listing editor wizard + useUpdateListing hook |
| 3.7 | **Meilisearch indexer Story 3.7 baseline** — Story 5.9 EXTEND `_fallback_locale` field |
| 3.8 | **`<ListingCard>` Story 3.8 baseline** — Story 5.9 EXTEND `fallbackLocale` prop + mini badge |
| 3.9 | Search results page baseline |
| 3.10 | **Service detail page Story 3.10 baseline** — Story 5.9 EXTEND badge prominent |
| 3.11 | **Pro public profile Story 3.11 baseline** — Story 5.9 EXTEND |
| 3.12 | **Category general page Story 3.12 baseline** — Story 5.9 EXTEND |
| 5.2 | TanStack Query cache invalidation pattern |

### Architecture compliance

- ✅ **ADR-012 i18n FR+EN dès Sprint 0** : Story 5.9 respect strict — `listing_translations + pro_profile_translations + category_translations` schema multilingue maintained ; fallback transparent visible (NFR59).
- ✅ **NFR58 hreflang systematic** : Story 3.10/3.11/3.12 baseline maintained — Story 5.9 ne modifie pas.
- ✅ **NFR60 Meilisearch 1 index per locale** : Story 3.7 baseline maintained — Story 5.9 EXTEND additive `_fallback_locale` field.
- ✅ **FR99 mandatory FR + optional EN** : Story 3.6 baseline strict respect — Story 5.9 add UX hint only, pas enforcement override.
- ✅ **FR100 badge UI "Disponible uniquement en français"** : Story 5.9 livre full.
- ✅ **NFR50/54 a11y RGAA AA** : axe-core 0 + Lighthouse ≥ 90.
- ✅ **NFR56-57 zero hardcoded text** : ~10 i18n strings.
- ✅ **NFR71 coverage** : maintained.
- ✅ **ADR-014 envelope REST** : 3 DTOs EXTEND `hasEnTranslation` field.

### File structure

```
apps/public/src/
  features/i18n/components/
    FrenchOnlyBadge.tsx                                              # NEW
    FrenchOnlyBadge.spec.tsx                                         # NEW
  features/listings/components/ListingCard.tsx                       # UPDATE Story 3.8 — add fallbackLocale prop
  app/[locale]/services/[slug]/page.tsx                              # UPDATE Story 3.10 — render badge prominent
  app/[locale]/pro/[slug]/page.tsx                                   # UPDATE Story 3.11
  app/[locale]/category/[slug]/page.tsx                              # UPDATE Story 3.12 — badge + cards EXTEND
  app/[locale]/search/page.tsx                                       # UPDATE Story 3.9 — pass fallbackLocale to cards

apps/seller/src/features/listings/components/
  ListingEditorWizard.tsx                                            # UPDATE Story 3.6 — UI hint + CTA

apps/{public,seller}/messages/
  fr/common.json + en/common.json                                    # UPDATE (~7 keys × 2 — EN populated FR empty)
  fr/seller.json + en/seller.json                                    # UPDATE (~5 keys × 2 pro_listing_editor)

packages/api-client/src/hooks/listings/use-update-listing.ts          # UPDATE Story 3.6 — invalidate 3 query keys

apps/gateway-api/src/listings/usecases/
  get-listing-detail-forwarder.usecase.ts                            # UPDATE Story 3.2 — add hasEnTranslation computed
  get-pro-profile-forwarder.usecase.ts                               # UPDATE Story 3.11
  get-category-detail-forwarder.usecase.ts                           # UPDATE Story 3.12
  dtos/{listing-detail,pro-profile,category-detail}-response.dto.ts  # UPDATE — add hasEnTranslation field

apps/catalog-svc/src/infrastructure/messaging/
  listing-translation-published-consumer.handler.ts                  # UPDATE Story 3.7 — add _fallback_locale field logic

packages/contracts/src/events/catalog/
  translation-requested.v1.{schema.json,ts}                          # NEW STUB V1+ reserved
  index.ts                                                            # UPDATE subpath

docs/runbook/i18n-fr-en-bilingual.md                                  # NEW OR EXTEND

_bmad-output/implementation-artifacts/
  3-7-meilisearch-index-per-locale-outbox-sync.md                    # UPDATE Completion Notes
  3-8-search-frontend-barre-recherche.md                             # UPDATE
  3-10-listing-detail-public-page.md                                 # UPDATE
  3-11-pro-public-profile-page.md                                    # UPDATE
  3-12-category-general-page-median-price-display.md                 # UPDATE
```

### Lib / framework choices

| Lib | Usage Story 5.9 | Version | Why |
|-----|------------------|---------|-----|
| `@tukio/ui` Badge + Tooltip + Alert + Button + Flag | UI atoms | workspace (Story 0.4 baseline) | Réutilisés |
| `lucide-react` `<Flag>` icon FR | mini-badge icon | latest (Story 0.4 baseline) | Standard icon |
| TanStack Query | invalidate 3 keys | latest (Story 0.9/5.2 baseline) | Cache invalidation pattern |
| Meilisearch SDK | indexer EXTEND _fallback_locale | latest (Story 3.7 baseline) | Réutilisé |
| `next-intl` | ~10 i18n strings | latest | FR/EN parité |
| Playwright + axe-core | E2E + a11y | latest (Story 0.11 baseline) | NFR50/54 |

### Previous Story Intelligence (3.7/3.8/3.10/3.11/3.12 + 5.2)

- **Story 3.7 Meilisearch indexer baseline** : index `listings_fr` + `listings_en` per locale + `catalog.listing.translation.published.v1` consumer — Story 5.9 EXTEND additive `_fallback_locale` field (backward-compatible — existing docs sans field = null implicit).
- **Story 3.8/3.10/3.11/3.12 frontend pages baselines** : Server Component + locale-prefix routing + `<ListingCard>` Story 3.8 pattern — Story 5.9 EXTEND non-breaking.
- **Story 3.6 Pro listing editor + useUpdateListing** : mutation pattern réutilisé pour cache invalidation Story 5.9.
- **Story 5.2 TanStack Query cache invalidation pattern** : Story 5.9 reproduit identical pour `useUpdateListing onSuccess invalidate`.
- **Story 1.2d a11y RGAA AA patterns** : ARIA tooltip + keyboard focus management réutilisés.

### Project Context Reference

- **PRD §FR98** — Locale-prefixed URLs + hreflang — Story 3.10/3.11/3.12 baseline maintained
- **PRD §FR99** — Pro saisit titre FR mandatory + EN optional — **Story 5.9 respecte strict**, ne modifie pas baseline
- **PRD §FR100** — Badge UI "Disponible uniquement en français" — **Story 5.9 livre full**
- **PRD §NFR50/54** — A11y RGAA AA + Lighthouse — enforced
- **PRD §NFR56-57** — Zero hardcoded text
- **PRD §NFR58** — Hreflang systematic — Story 3.x baseline maintained
- **PRD §NFR59** — Templates FR+EN parité — Story 5.4 baseline maintained
- **PRD §NFR60** — Meilisearch 1 index per locale — Story 5.9 EXTEND `_fallback_locale` field
- **PRD §NFR71** — Coverage — maintained
- **ADR-012 i18n FR+EN Sprint 0** — strict respect
- **ADR-014 envelope REST** — DTOs EXTEND
- **Stories livrées** : 0.2, 0.4, 0.5, 0.9, 0.11, 1.2c, 1.2d, 3.2, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 5.2
- **Memories Tukio** : `feedback_clean_architecture_explicit`, `feedback_api_envelope_response`, `feedback_tech_layer_english`, `feedback_i18n_frontend` (i18n FR+EN dès Sprint 0)

### Project Structure Notes

- 1 NEW component `<FrenchOnlyBadge>` 2 variants + Stories 3.6/3.7/3.8/3.9/3.10/3.11/3.12 baselines EXTEND non-breaking (additive)
- 3 gateway forwarders EXTEND `hasEnTranslation` field + 1 catalog-svc consumer EXTEND Meilisearch `_fallback_locale`
- 1 TanStack Query hook EXTEND cache invalidation
- 1 listing editor Pro EXTEND UI hint
- ~10 i18n strings × 2 locales × 2 apps = ~40 strings totale
- 1 STUB event schema V1+ reserved
- ~25 test scenarios totale
- Pas de nouveau service ou table DB — pure additive frontend + DTO mapper + indexer extension

### Testing

| Layer | Framework | Coverage cible | Story 5.9 scenarios |
|-------|-----------|----------------|----------------------|
| Domain | — | — (no domain changes) | — |
| Usecases | Jest unit | maintained | DTO mapping (4) computed `hasEnTranslation` |
| Infrastructure | Jest integration testcontainer | maintained | Meilisearch indexer _fallback_locale (3) |
| Components frontend | RTL | All variants tested | `<FrenchOnlyBadge>` (5 scenarios) + `<ListingCard>` EXTEND (1) + ListingEditorWizard hint (1) = 7 |
| Playwright E2E | Playwright + axe-core | 6 critical paths | 6 scenarios |
| A11y | axe-core | 0 violations 4 pages | 4 specs |
| Lighthouse | CI | Accessibility + SEO ≥ 90 | 4 specs |
| **Total** | | | **~25 test scenarios** |

### References

- [Source: epics.md#Story-5.9 (lines 2014-2027)]
- [Source: epics.md#Epic-5 (lines 1813-1822)]
- [Source: prd.md#FR98-100 (i18n hreflang + FR99 mandatory + FR100 badge)]
- [Source: prd.md#NFR50/54 (a11y + Lighthouse)]
- [Source: prd.md#NFR56-57 (zero hardcoded)]
- [Source: prd.md#NFR58 (hreflang systematic)]
- [Source: prd.md#NFR59 (templates FR+EN parité)]
- [Source: prd.md#NFR60 (Meilisearch 1 index per locale)]
- [Source: architecture.md#i18n-ADR-012]
- [Source: architecture.md#Envelope-REST (ADR-014)]
- [Source: implementation-artifacts/3-7-meilisearch-index-per-locale-outbox-sync.md (Meilisearch indexer baseline)]
- [Source: implementation-artifacts/3-8-search-frontend-barre-recherche.md (<ListingCard> baseline)]
- [Source: implementation-artifacts/3-10-listing-detail-public-page.md (Service detail Server Component)]
- [Source: implementation-artifacts/3-11-pro-public-profile-page.md (Pro profile)]
- [Source: implementation-artifacts/3-12-category-general-page-median-price-display.md (Category page)]
- [Source: implementation-artifacts/3-6-edit-unpublish-delete-listing-flow.md (Pro listing editor + useUpdateListing hook)]
- [Source: implementation-artifacts/5-2-conversation-thread-ui.md (TanStack Query cache invalidation pattern)]
- [Source: .agents/context/i18n.md]
- [Source: .agents/context/atomic-design.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-create-story workflow `_bmad/bmm/skills/bmad-create-story` adapté ACS Tukio (`{user_name}=Ismael`, `{communication_language}=Français`, `{document_output_language}=Français`)

### Debug Log References

(populated during dev-story)

### Completion Notes List

(populated during dev-story)

### File List

(populated during dev-story)
