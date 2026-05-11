# Story 3.9: Filters / facettes + search results page (FR19)

Status: ready-for-dev

## Story

**As a** Visitor (B2C particulier ou Pro découvrant marketplace) sur page results `/{locale}/search?...` Story 3.8,
**I want** **affiner mes résultats** via `<FilterSidebar>` desktop + `<Drawer>` bottom-sheet mobile avec filters multi-types : Prix min/max slider auto-bounded sur médiane catégorie ±100 %, Distance livraison range slider 5-200 km, Capacité checkbox group ('< 50', '50-100', '100-200', '> 200' personnes), Options checkbox group (selon facettes catégorie — V1+ extensible) — Story 3.8 a livré la **structure search + sort + infinite scroll**. Story 3.9 enrichit avec :
- (a) **`<FilterSidebar>` desktop + `<FilterDrawer>` mobile** (NEW Story 3.9 components — réutilisables Stories 11.x V1 search refinement) :
  - **`<PriceRangeSlider>`** auto-bounded : min = max(0, median - 100% median), max = min(median + 100% median, 999€) — bornes computed depuis `category.median_price_amount` Story 3.5 cron. Si median null (< 5 listings catégorie), bornes `[0, 200000]` cents (0-2000€) generic
  - **`<DistanceRangeSlider>`** : 5-200 km, default `[5, 50]`, increment 5
  - **`<CapacityCheckboxGroup>`** : 4 buckets ('< 50', '50-100', '100-200', '> 200') — multi-select. Story 3.7 indexer Story 3.4 capacity field nullable MVP — Story 3.9 filter ignore listings sans capacity field renseigné
  - **`<OptionsCheckboxGroup>`** : V1+ extension (e.g., "Installation incluse", "Livraison incluse", "Couverts inclus") — MVP placeholder structure prête (Story 3.9 livre l'UI + endpoint expose facets V1+ enrich)
  - **Facets counts Meilisearch** : à chaque filter render, `<FilterCheckboxGroup>` affiche `<Badge>{count}</Badge>` à côté de chaque option (count de listings matching ce filter dans le subset courant — feature `facetDistribution` Meilisearch). Si count === 0 → checkbox disabled grisé
  - **`<ClearAllFiltersButton>`** en haut sidebar — reset URL params filters (preserve sort + categorySlug + city + date)
- (b) **URL state sync shallow routing** : chaque filter change → `router.replace({ query: newParams }, undefined, { shallow: true })` (next.js 15 — pas de re-fetch full page, seulement query params + Server Actions revalidate ou client-side mutation TanStack Query). Pattern Story 3.3 wizard `useSearchParams` réutilisé. Browser back/forward navigation works
- (c) **Debounce 300ms côté client** sur sliders Prix + Distance (NFR1 < 150ms p95 search → debounce avoid spam Meilisearch). Checkbox groups : no debounce (instant toggle, 1 click = 1 query)
- (d) **Animation transition résultats** (NFR47 prefers-reduced-motion respecté) : skeleton fade-in/fade-out sur ListingCardSkeleton x3 pendant fetch, smooth height transition
- (e) **`<ListingCard>` enhancement Story 3.8 → Story 3.9** : ajouts pour respecter UX-DR `search.jsx` bundle Cloud Design figé Sprint 0 :
  - Hover preload `urls.detail` variant Story 3.4 (smart preload via `<link rel="prefetch">` ou simple swap on hover) — NFR3 LCP optimization Story 3.10 future detail page transition fluide
  - `<DistanceBadge>` "À 12 km" calculé depuis ville origine listing vs city query Visitor (V1+ vrai geosearch — MVP placeholder fixed depuis postalCode mapping)
  - `<CapacityBadge>` "Capacité 100-200 pers" (si capacity field renseigné Story 3.4 photos doc field — MVP capacity null, badge hidden)
  - `<ReviewsStars>` aggregate (Story 5.8 V1 populates — MVP placeholder hidden si reviewsAggregate.count === 0)
  - Bouton CTA primary `Voir la fiche` clear (vs implicit click toute la card MVP — UX explicit)
- (f) **NFR58 hreflang systematic** : Story 3.9 ajoute `<link rel="alternate" hreflang="{locale}" href="...">` injection dans `<head>` Server Component pour chaque locale (FR + EN) — pattern réutilisable Story 7.2 future hreflang systematic. Story 3.9 livre l'implémentation MVP search page.
- (g) **`<FilterDrawer>` mobile bottom-sheet** : `@radix-ui/react-dialog` v2+ (latest stable — RGAA + Tailwind v4) avec `<DrawerTrigger>` button "Filtrer" sticky mobile bottom + `<DrawerContent>` slide-up bottom-sheet 90vh + header sticky titre + close + body scroll filters + footer sticky 2 CTAs Annuler + Voir X résultats (count live updated)
- (h) **`GET /v1/search/listings` endpoint UPDATE Story 3.8** : add facets in response :
```ts
interface SearchListingsResponse {
  data: MeilisearchListingDocument[];
  pagination: { hasMore, nextOffset, totalEstimate, limit, offset };
  meta: {
    processingTimeMs: number;
    facets: {
      categorySlug: Record<string, number>; // { 'tents-marquees': 8, 'event-furniture': 4 }
      pricingMode: Record<string, number>;
      capacityBucket: Record<string, number>; // computed server-side from capacity field
      // ... V1+ options
    };
  };
}
```
- (i) **catalog-svc UPDATE `SearchListingsUseCase` Story 3.8** : passe `facets` array param Meilisearch search call → response includes `facetDistribution` mapped to `meta.facets`
- (j) **Performance NFR1 < 150ms p95** : Meilisearch facets natifs Story 3.7 (réglés `faceting: { maxValuesPerFacet: 200 }`) — perf overhead minimal (~10-20ms) vs sans facets. p95 cible < 150ms maintenue
- (k) **i18n FR/EN strict** namespace `public.search.filters.*` ~30 keys × 2 locales (filter labels, capacity buckets labels, clear all CTA, results count format),

**so that** Sophie sur `/fr/search?categorySlug=tents-marquees&city=nantes&date=2026-08-15` (Story 3.8) → 12 listings → ouvre `<FilterSidebar>` desktop ou `<FilterDrawer>` mobile → toggle "Prix max 800€" + "Capacité 100-200" → URL update `?priceMax=80000&capacityBucket=100-200` → Meilisearch query refetch → 4 listings filtered + facets counts updated `Capacité < 50: 2, 50-100: 4, 100-200: 4, > 200: 2` → click "Effacer les filtres" → reset → 12 listings ; un Visitor anglais regarde même page → `<link rel="alternate" hreflang="fr">` injecté head pour SEO + cross-locale UX ; un test `pnpm playwright test --grep "search filters"` passe FR/EN axe-core 0 violations 10 scénarios (sidebar render desktop + drawer mobile, price slider debounce 300ms + URL sync, distance slider, capacity checkbox + facets counts updates, clear all filters, hover preload detail variant, RGAA kbd nav focus trap drawer, hreflang head injection, NFR1 p95 < 150ms with facets, NFR47 prefers-reduced-motion respect transitions) ; coverage ≥ 90 % FilterSidebar + FilterDrawer + 85 % gateway endpoint update + use case + 80 % i18n.

## Acceptance Criteria

1. **AC1 — `<FilterSidebar>` desktop + `<FilterDrawer>` mobile components** : Given Story 3.8 livré `<SearchResultsLayout>`, When je consulte `apps/public/src/features/public/search/components/`, Then :
   - **NEW component `FilterSidebar.tsx`** Client Component — desktop layout sticky left side (`md:block` Tailwind responsive) :
     - `<ClearAllFiltersButton>` haut sidebar
     - `<FilterSection title="Prix">` `<PriceRangeSlider>` auto-bounded depuis `category.median_price_amount`
     - `<FilterSection title="Distance">` `<DistanceRangeSlider>` 5-200km
     - `<FilterSection title="Capacité">` `<CheckboxGroup>` 4 buckets + facet counts
     - `<FilterSection title="Options">` placeholder V1+ (Story 3.9 livre structure)
     - URL state sync via `useSearchParams` + `router.replace shallow`
     - Debounce 300ms sliders via `use-debounce` Story 3.3 réutilisé
   - **NEW component `FilterDrawer.tsx`** Client Component — mobile bottom-sheet (`md:hidden` + sticky button "Filtrer (X actifs)") :
     - `@radix-ui/react-dialog` v2+ Drawer pattern
     - `<DrawerTrigger>` button bottom sticky avec count active filters badge
     - `<DrawerContent>` slide-up 90vh bottom-sheet + body scroll + sticky footer 2 CTAs Annuler/Voir X résultats
     - Identical filter content as desktop sidebar
   - **NEW shared component `FilterSection.tsx`** + `<PriceRangeSlider>` + `<DistanceRangeSlider>` + `<CapacityCheckboxGroup>` (factor `<CheckboxGroup>` Story 0.5 réutilisé)
   - Tests `@testing-library/react` 8 scenarios (render desktop + mobile, slider debounce, URL sync, clear all, focus trap drawer)

2. **AC2 — `GET /v1/search/listings` UPDATE Story 3.8 + facets response** : Given Story 3.8 livré endpoint, When Story 3.9 étend, Then :
   - **UPDATE catalog-svc `SearchListingsUseCase`** : passe `facets: ['categorySlug', 'subcategorySlug', 'pricingMode', 'capacityBucket']` array à Meilisearch `search({ ... facets })` call. Map response `result.facetDistribution` → `meta.facets`
   - **NEW computed field `capacityBucket`** dans Meilisearch document Story 3.7 (computed at index time depuis `capacity` field — bucket logic : null → null, < 50 → 'below_50', 50-100 → '50_100', 100-200 → '100_200', > 200 → 'above_200'). UPDATE Story 3.7 `IndexListingUseCase.buildDocument()` ajoute computed `capacityBucket` field + filterableAttributes settings UPDATE Story 3.7 add 'capacityBucket'
   - **Reconcile cron Story 3.7** réindexe avec nouveau field automatically (drift detection détectera `capacityBucket` missing dans MS docs et re-index). Alternative MVP : ops re-run setup-indexes + manual reindex via cron trigger
   - **UPDATE response type** `SearchListingsResponse.meta.facets: { categorySlug, subcategorySlug?, pricingMode, capacityBucket }`
   - Tests E2E gateway 4 scenarios (facets returned + counts correct, capacityBucket computed, missing field returns null bucket, perf overhead < 30ms vs sans facets)

3. **AC3 — URL state sync shallow routing + debounce 300ms sliders** : Given AC1, When user changes filter, Then :
   - **`useSearchParams` + `router.replace`** Next.js 15 shallow routing pattern — no full page re-fetch, just query params update + TanStack Query auto-refetch via queryKey dependency
   - **Debounce sliders** 300ms (`use-debounce` Story 3.3 réutilisé) : `useDebouncedCallback(updateUrlAndQueryKey, 300)` sur Price + Distance sliders
   - **No debounce checkboxes** : instant toggle = 1 click 1 query (UX cohérent attentes user)
   - **TanStack Query queryKey** depends on `searchParams.toString()` → auto-refetch on URL change
   - Tests integration : 5 scenarios (URL update on filter change, debounce slider 300ms, instant checkbox toggle, browser back restore filters, clear all reset)

4. **AC4 — `<ListingCard>` enhancement hover preload + badges** : Given Story 3.8 livré `<ListingCard>` atomic, When Story 3.9 enrichit, Then :
   - **UPDATE `<ListingCard>`** packages/ui — add :
     - `onMouseEnter` handler → `<link rel="prefetch" href={listing.urls.detail}>` injected dynamic OR simple `<img src={urls.detail}>` swap (preload + warm CDN cache pour Story 3.10 future detail navigation faster)
     - `<DistanceBadge>` placeholder MVP (V1+ vrai geosearch)
     - `<CapacityBadge>` rendered si `capacityBucket !== null`
     - `<ReviewsStars>` rendered si `reviewsAggregate.count > 0` (MVP V1 Story 5.8 populates — Story 3.9 ajoute le composant qui affiche ou hide)
     - Bouton CTA primary `Voir la fiche` explicit (Tailwind `<Button variant="primary" size="sm">` Story 0.5 réutilisé)
   - Tests `@testing-library/react` : hover prefetch, badges conditional render

5. **AC5 — hreflang systematic head injection** : Given NFR58, When Server Component renders search page, Then :
   - **NEW helper** `apps/public/src/lib/hreflang.ts` (NEW Story 3.9 — réutilisable Story 7.2 future hreflang systematic) :
     ```ts
     export function buildHreflangLinks(currentPath: string, currentLocale: 'fr' | 'en', searchParamsString?: string): { hreflang: 'fr' | 'en' | 'x-default'; href: string }[] {
       const altLocale = currentLocale === 'fr' ? 'en' : 'fr';
       const altPath = currentPath.replace(/^\/(fr|en)/, '/' + altLocale);
       return [
         { hreflang: currentLocale, href: 'https://tukio.one' + currentPath + (searchParamsString ? '?' + searchParamsString : '') },
         { hreflang: altLocale, href: 'https://tukio.one' + altPath + (searchParamsString ? '?' + searchParamsString : '') },
         { hreflang: 'x-default', href: 'https://tukio.one/fr' + currentPath.replace(/^\/(fr|en)/, '') + (searchParamsString ? '?' + searchParamsString : '') }, // FR par défaut Tukio MVP
       ];
     }
     ```
   - **UPDATE `apps/public/src/app/[locale]/search/page.tsx`** Story 3.8 — Server Component `generateMetadata` returns `alternates: { languages: { fr: ..., en: ..., 'x-default': ... } }` Next.js 15 metadata API
   - Tests : verify head rendered `<link rel="alternate" hreflang="fr"...>` + `hreflang="en"` + `hreflang="x-default"`

6. **AC6 — Animation transition + NFR47 prefers-reduced-motion** : Given UX brand, When filter change → re-fetch results, Then :
   - **`<ListingCardSkeleton>` x3 fade-in** pendant fetch (Tailwind `animate-pulse` ou framer-motion v11+ si needed)
   - **Smooth height transition** sur `<ListingsGrid>` quand result count change (`transition-all duration-200`)
   - **`prefers-reduced-motion: reduce`** respecté : disable animations + use `motion-safe:` Tailwind variants
   - Tests : Lighthouse audit motion + axe-core animation respect prefers-reduced-motion

7. **AC7 — i18n + métriques + tests Playwright e2e** : Given AC1-6, When :
   - **i18n** namespace `public.search.filters.*` ~30 keys × 2 locales (Sidebar/Drawer titles, FilterSection titles, capacity buckets labels, clear all CTA, results count format mobile, hover badges)
   - **Métriques NEW** :
     - `tukio_search_filters_applied_total{filter_type}` (counter — price/distance/capacity/options usage analytics)
     - `tukio_search_filters_clear_all_total` (counter)
     - `tukio_search_facets_compute_duration_seconds` (histogram — Meilisearch facets overhead)
   - **Dashboard Grafana** UPDATE Story 3.8 — add 2 panels filter usage breakdown + facets compute latency
   - **Tests Playwright e2e** 10 scenarios :
     - T1-2 sidebar desktop FR + EN render with facets counts
     - T3 drawer mobile open/close + filter apply
     - T4 price slider debounce 300ms + URL sync
     - T5 distance slider behavior
     - T6 capacity checkbox toggle + facets counts update
     - T7 clear all filters reset URL + results
     - T8 ListingCard hover prefetch detail variant
     - T9 hreflang head injection FR + EN + x-default
     - T10 RGAA kbd nav focus trap drawer + axe-core 0 violations
   - **Test perf NFR1** : k6 load test search with all filters applied → p95 < 150ms (Meilisearch facets ~10-20ms overhead acceptable)
   - Coverage ≥ 90 % FilterSidebar + FilterDrawer + 85 % gateway update + use case + 80 % helpers (hreflang, capacityBucket compute)

## Tasks / Subtasks

- [ ] **Task 1 — UPDATE catalog-svc Story 3.7 indexer + Story 3.8 use case + facets** (AC: #2)
  - [ ] 1.1 — UPDATE `IndexListingUseCase.buildDocument()` Story 3.7 — add computed `capacityBucket` field
  - [ ] 1.2 — UPDATE Meilisearch index settings Story 3.7 — add `capacityBucket` to filterableAttributes
  - [ ] 1.3 — UPDATE setup-indexes.ts Story 3.7 — add capacityBucket
  - [ ] 1.4 — UPDATE `SearchListingsUseCase` Story 3.8 — add facets array + map response
  - [ ] 1.5 — Tests integration testcontainer 4 scenarios facets
- [ ] **Task 2 — UPDATE gateway-api response shape + Zod** (AC: #2)
  - [ ] 2.1 — UPDATE `SearchListingsResponseSchema` add `meta.facets`
  - [ ] 2.2 — Tests E2E gateway facets returned
- [ ] **Task 3 — `<FilterSidebar>` + `<FilterDrawer>` + 4 filter components** (AC: #1) — coverage ≥ 90 %
  - [ ] 3.1 — `FilterSidebar.tsx` desktop
  - [ ] 3.2 — `FilterDrawer.tsx` mobile (`@radix-ui/react-dialog` v2+)
  - [ ] 3.3 — `<PriceRangeSlider>` auto-bounded median ±100%
  - [ ] 3.4 — `<DistanceRangeSlider>` 5-200km
  - [ ] 3.5 — `<CapacityCheckboxGroup>` 4 buckets
  - [ ] 3.6 — `<FilterSection>` shared wrapper
  - [ ] 3.7 — `<ClearAllFiltersButton>`
  - [ ] 3.8 — Tests `@testing-library/react` 8 scenarios
- [ ] **Task 4 — URL state sync shallow + debounce sliders** (AC: #3)
  - [ ] 4.1 — `useSearchFiltersState` hook (URL state + debounce wrappers)
  - [ ] 4.2 — Integration `<SearchResultsLayout>` Story 3.8 UPDATE
  - [ ] 4.3 — Tests integration 5 scenarios
- [ ] **Task 5 — `<ListingCard>` enhancement** (AC: #4)
  - [ ] 5.1 — Hover prefetch detail variant
  - [ ] 5.2 — `<DistanceBadge>` + `<CapacityBadge>` + `<ReviewsStars>` conditional
  - [ ] 5.3 — Bouton CTA primary explicit
  - [ ] 5.4 — Tests
- [ ] **Task 6 — hreflang systematic helper + Server Component metadata** (AC: #5)
  - [ ] 6.1 — `apps/public/src/lib/hreflang.ts` helper
  - [ ] 6.2 — UPDATE search page `generateMetadata` Next.js 15 alternates
  - [ ] 6.3 — Tests verify head rendered links
- [ ] **Task 7 — Animations + prefers-reduced-motion** (AC: #6)
  - [ ] 7.1 — Skeleton fade-in/out + height transition
  - [ ] 7.2 — `motion-safe:` Tailwind variants respect
- [ ] **Task 8 — i18n + métriques + tests E2E + perf** (AC: #7)
  - [ ] 8.1 — i18n namespace `public.search.filters.*` ~30 keys × 2 locales
  - [ ] 8.2 — Métriques 3 nouvelles
  - [ ] 8.3 — Dashboard Grafana UPDATE Story 3.8 add 2 panels
  - [ ] 8.4 — Tests E2E 10 scenarios + k6 perf NFR1 p95
  - [ ] 8.5 — Coverage thresholds NFR71
- [ ] **Task 9 — Documentation + commit**
  - [ ] 9.1 — Update `docs/project-context.md` section "Search Filters (Story 3.9)"
  - [ ] 9.2 — Commit `feat(public,catalog,gateway): Story 3.9 search filters facets sidebar + drawer mobile + hreflang + ListingCard hover prefetch`

## Dev Notes

### Pourquoi Story 3.9 affine Story 3.8 search

Story 3.8 a livré la **structure de base** (search bar + results + sort + infinite scroll). Story 3.9 enrichit avec **filters multi-types + facets counts** essentiels pour Visitor qui cherche un service spécifique (e.g., capacité 150 personnes + budget 600€ max + livraison < 30km). Sans Story 3.9, search MVP est trop générique. Pattern complet **filter sidebar + drawer mobile + facets counts + URL state shallow + debounce sliders** réutilisé Stories Epic 5 V1+ messaging filters, Stories 8.x V1 multi-vendor cart filters.

### Décisions techniques majeures actées

1. **`<FilterSidebar>` desktop + `<FilterDrawer>` mobile** (`@radix-ui/react-dialog` v2+) — RGAA + Tailwind v4 + reuse pattern Story 3.6 ActionsMenu Radix.
2. **Price slider auto-bounded median ±100%** — UX intelligente : range adapté à la catégorie (vs hardcoded 0-2000€ qui serait trop large MVP). Si median null → fallback generic.
3. **Capacity buckets fixes 4** (vs free input) — UX simplicité MVP, V1+ pourra ajouter custom range.
4. **Computed `capacityBucket` field index time** (vs runtime filter) — performant Meilisearch facets natifs.
5. **URL state shallow routing** Next.js 15 — bookmarkable + back/forward + no full page re-fetch.
6. **Debounce 300ms sliders** + no debounce checkboxes — UX différentielle.
7. **Hover prefetch detail variant** — NFR3 perf optimization Story 3.10 future.
8. **hreflang helper réutilisable** Story 7.2 future systematic.
9. **Animation respect prefers-reduced-motion** NFR47.
10. **EN strict + i18n + RGAA AA + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `@radix-ui/react-dialog` | Drawer mobile | v2+ | Story 3.6 réutilisé |
| `@radix-ui/react-slider` | Price + Distance sliders | latest stable | Tailwind v4 + RGAA |
| `use-debounce` | Slider 300ms debounce | (Story 3.3 already) | |

### Project Structure cible

```
apps/public/src/features/public/search/components/
├─ FilterSidebar.tsx + spec                                       # NEW Story 3.9 desktop
├─ FilterDrawer.tsx + spec                                        # NEW mobile bottom-sheet
├─ FilterSection.tsx                                              # NEW shared wrapper
├─ PriceRangeSlider.tsx                                           # NEW
├─ DistanceRangeSlider.tsx                                        # NEW
├─ CapacityCheckboxGroup.tsx                                      # NEW
├─ ClearAllFiltersButton.tsx                                      # NEW
└─ SearchResultsLayout.tsx                                        # UPDATE Story 3.8 — add sidebar + drawer integration

apps/public/src/features/public/search/hooks/
└─ use-search-filters-state.ts                                    # NEW (URL state + debounce wrappers)

apps/public/src/lib/
└─ hreflang.ts                                                    # NEW (réutilisable Story 7.2)

apps/public/src/app/[locale]/search/page.tsx                      # UPDATE Story 3.8 — add generateMetadata alternates

packages/ui/src/components/ListingCard/ListingCard.tsx            # UPDATE Story 3.8 — hover prefetch + badges + CTA

apps/catalog-svc/src/usecases/
├─ index-listing.usecase.ts                                       # UPDATE Story 3.7 — add computed capacityBucket
└─ search-listings.usecase.ts                                     # UPDATE Story 3.8 — add facets

infra/meilisearch/setup-indexes.ts                                # UPDATE Story 3.7 — add capacityBucket filterable

apps/public/messages/{fr,en}.json                                 # UPDATE — namespace public.search.filters.* ~30 keys × 2

apps/public/e2e/search/filters.spec.ts                            # NEW Story 3.9 (10 tests)

# Estimation : ~12 nouveaux + ~7 updates = ~19 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5 (atomics), 0.9 (TanStack Query + use-debounce), 3.4 (Cloudflare Images variants), 3.6 (Radix dropdown pattern), 3.7 (Meilisearch indexer + setup-indexes + computed fields), 3.8 (search endpoint + ListingCard + SearchResultsLayout).

1. **API responses envelope ADR-014** — search response avec facets in meta.
2. **EN strict + i18n FR/EN + RGAA AA + latest stable versions** memories.
3. **NFR1 < 150ms p95** — facets overhead < 30ms acceptable.
4. **NFR47 prefers-reduced-motion** — animations respect.
5. **NFR58 hreflang systematic** — helper réutilisable Story 7.2.

### Previous Story Intelligence

**Story 0.5 (`<CheckboxGroup>`, `<Slider>`, `<Drawer>` patterns)** : réutilisés.

**Story 3.4 (Cloudflare Images variants)** : `urls.detail` hover prefetch.

**Story 3.6 (`@radix-ui/react-dropdown-menu`)** : pattern Radix réutilisé pour Dialog/Drawer.

**Story 3.7 (IndexListingUseCase + setup-indexes + reconcile cron)** : Story 3.9 UPDATE pour ajouter `capacityBucket` computed field. Cron reconcile détectera drift et re-index.

**Story 3.8 (SearchResultsLayout + ListingCard + SearchListingsUseCase + endpoint)** : Story 3.9 enrichit composants existants.

### What this story does NOT do

- ❌ **Geosearch radius vrai distance** — V1+ feature MapTiler/OpenStreetMap.
- ❌ **Options checkboxes V1+** (Installation incluse, Couverts inclus, etc.) — Story 3.9 livre structure UI placeholder.
- ❌ **Saved filters favorites** — V1+ Story 11.x.
- ❌ **Filter analytics dashboard pro** — V1+ Story 7.x.
- ❌ **Filter combinaison alerts** — V1+ Story 11.x notifications.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 90 % FilterSidebar + FilterDrawer
- Coverage ≥ 85 % gateway update + use case
- Coverage ≥ 80 % helpers (hreflang, capacityBucket compute)
- E2E Playwright FR/EN axe-core 0 violations 10 tests AC7
- k6 perf : NFR1 p95 < 150ms with facets

### Project Structure Notes

✅ **Aligné architecture, PRD §FR19 (filters facettes), §NFR1 (search p95 < 150ms), §NFR47 (motion + RGAA), §NFR58 (hreflang systematic), §UX-DR `search.jsx` figé bundle, Stories 0.5/0.9/3.4/3.6/3.7/3.8, memories.**

⚠️ **Décision** : capacityBucket computed index time (vs runtime) — performant Meilisearch facets.
⚠️ **Décision** : Price slider auto-bounded median ±100% — UX intelligente.
⚠️ **Décision** : URL state shallow routing Next.js 15 — bookmarkable + perf.
⚠️ **Décision** : Debounce 300ms sliders + no debounce checkboxes — UX différentielle.
⚠️ **Décision** : hreflang helper réutilisable — Story 7.2 future systematic.

### References

- [Source: epics.md#Epic-3-Story-3.9 — Lines 1520-1534]
- [Source: prd.md#FR19 (filters), #NFR1 (p95), #NFR47 (motion + RGAA), #NFR58 (hreflang)]
- [Source: ux-design-specification.md — UX-DR search.jsx figé bundle]
- [Source: architecture.md — ADR-014 envelope]
- [Source: Stories 0.5/0.9/3.4/3.6/3.7/3.8]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(points d'attention pour Story 3.10 (listing detail consume hover prefetch detail variant Story 3.9), Story 7.2 (hreflang systematic réutilise helper Story 3.9), Stories Epic 5 V1+ (filters extension options checkboxes))

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-10
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (9ᵉ story Epic 3)
- **Estimation effort** : 3-4 jours (1 dev fullstack — story refinement Story 3.8 : 7 components + UPDATE 3 use cases/endpoints + hreflang helper + i18n + 10 e2e tests, ~19 fichiers)
- **Dépendances upstream** : Stories 0.5, 0.9, 3.4, 3.6, 3.7, 3.8
- **Dépendances downstream** :
  - Story 3.10 (listing detail) — consume hover prefetch detail variant Story 3.9
  - Story 7.2 (hreflang systematic) — réutilise helper Story 3.9
  - Stories Epic 5 V1+ (filters extension options) — pattern réutilisé
- **FRs covered** :
  - **FR19** ✅ filters facettes search results (price/distance/capacity)
- **NFRs touchés** :
  - **NFR1** ✅ search p95 < 150ms with facets
  - **NFR47** ✅ prefers-reduced-motion respect
  - **NFR58** ✅ hreflang systematic
  - **NFR3 partial** ✅ hover prefetch detail variant Story 3.10
  - **NFR71** ✅ coverage thresholds

> **Prochaine story → Story 3.10** (Listing detail public page FR20 — `/services/{slug}` complete page consume Story 3.9 hover prefetch + Story 3.4 photos detail variant)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.9, 3.4, 3.6, 3.7, 3.8 implémentées
3. Implémenter Tasks 1-9 dans l'ordre
4. Lancer `pnpm playwright test --grep "search filters"` après chaque jalon + k6 perf
5. Commit Story 3.9 quand : 10/10 e2e + coverage NFR71 + axe-core 0 + k6 p95 < 150ms + hreflang head verified
6. Update sprint-status : `3-9-...: review` puis `done`
