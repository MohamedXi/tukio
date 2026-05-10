# Story 3.8: Search frontend (barre recherche cat + ville + date) — FR18

Status: ready-for-dev

## Story

**As a** Visitor (B2C particulier ou Pro découvrant la marketplace) atterrissant sur `/fr/` ou `/en/`,
**I want** une **barre de recherche prominente** 3 fields (Catégorie + Ville + Date événement) sur la home + page résultats `/{locale}/search?...` qui consume Meilisearch via gateway-api → catalog-svc → indexes per locale Story 3.7 (FR/EN avec fallback) — Story 3.7 a livré la **couche backend search** (indexes + sync + DLQ + reconcile cron). Story 3.8 livre maintenant la **première interface Visitor public** :
- (a) **Home page `/{locale}/page.tsx`** Server Component (`apps/public/src/app/[locale]/page.tsx`) — réutilise `home.jsx` du bundle Cloud Design (figé Sprint 0) avec `<SearchBar>` proéminent hero section :
  - `<Select required>` Catégorie — fetch `GET /v1/categories?tree=false&mvpPilotOnly=true&locale={locale}` Story 3.1 (Server Component pre-fetch) + cascading dropdown 2 catégories MVP + sous-catégories
  - `<Input>` Ville — autocomplete via `GET /v1/geo/cities?q={query}&locale={locale}` (NEW endpoint Story 3.8 — consume `PostalCodeCityResolverService` Story 3.7 avec INSEE postal codes seed + recherche fuzzy par city name + popular cities first MVP). Format response `[{ city: 'Nantes', postalCodes: ['44000', '44100', '44200', '44300'], department: 'Loire-Atlantique', region: 'Pays de la Loire' }, ...]` debounced 300ms
  - `<DatePicker>` Date événement — single date MVP (`yyyy-mm-dd` ISO + min=today, max=today+2years), UX pattern `react-day-picker` v9+ ou `<input type="date">` natif Tailwind v4 styled
  - CTA `<Button variant="primary" size="lg">Rechercher</Button>` disabled tant que category required vide ; ville+date optionnels
  - Sur submit → `router.push('/{locale}/search?categorySlug={slug}&city={citySlug}&postalCodes={list-csv}&date={iso}')` (URL strict EN params NFR58 + searchable URL)
- (b) **Page `/{locale}/search/page.tsx`** Server Component (NEW Story 3.8) consume `GET /v1/search/listings` (NEW gateway endpoint Story 3.8 — DTO Story 3.7 livré `SearchListingsQuerySchema` réutilisé) qui forward catalog-svc internal endpoint qui interroge Meilisearch `listings_{locale}` avec filters appropriés :
  - Layout `<SearchResultsLayout>` (NEW Story 3.8 pattern) :
    - Header sticky `<SearchBar>` réutilisée (compact variant) avec values from URL params pre-rempli + bouton "Modifier" expand vers full version
    - `<ResultsCount>` "X services trouvés à Nantes pour le 15 août 2026"
    - `<SortSelector>` (Story 3.9 future facets — MVP Story 3.8 livre 1 sort : `publishedAt:desc` default + 2 alternatives `priceUnitAmountCents:asc` "Prix croissant" + `deliveryRadiusKm:asc` "Plus proche")
    - **`<ListingsGrid>`** (NEW Story 3.8 — réutilisable Stories 3.10 future related listings + Story 3.11 pro public profile) avec each `<ListingCard>` (NEW Story 3.8 atomic component — réutilisable Stories 3.10/3.11/3.12) :
      - Hero photo `urls.card` Story 3.4 variants (lazy-load `loading="lazy"` sauf 1ère row above-the-fold) — `<picture>` srcset WebP/AVIF/JPG fallback NFR3 LCP < 2.5s
      - Title + truncate description 100 chars
      - Pricing display + currency + per unit
      - Pro name + city
      - Distance approximate (V1+ feature avec geosearch, MVP placeholder "Livraison à Nantes")
      - Reviews aggregate placeholder "Pas encore d'avis" (Story 5.8 V1 populates)
      - Badge "FR only" si `_fallback_locale === 'fr'` côté EN locale (Story 5.9 future UI — Story 3.8 livre le badge mécanique)
      - Click → redirect `/{locale}/services/{slug}` (Story 3.10 future detail page)
    - **Infinite scroll** TanStack Query `useInfiniteQuery({ queryKey, queryFn, getNextPageParam })` — pageSize=20 + `<IntersectionObserver>` trigger fetch next quand scroll bottom 80%
    - **Empty state UX-DR16** : `<EmptyState variant="search-no-results">` "Aucun service ne correspond. Essayez d'élargir votre zone ou changer de date" + 2 CTAs : "Effacer les filtres" (clear all params) + "Modifier la recherche" (expand SearchBar)
- (c) **City autocomplete endpoint `GET /v1/geo/cities`** (NEW Story 3.8) :
  - Query param `q` (string, min 2 chars) — debounced frontend 300ms
  - Response `{ data: CityResult[] }` cache HTTP 1h (`Cache-Control: public, max-age=3600`)
  - **Implementation MVP** : catalog-svc `PostalCodeCityResolverService` Story 3.7 INSEE seed → in-memory fuzzy search via lib `fuse.js` v7+ (latest stable — léger ~13KB, indexed once at boot). Top 10 results + popular cities priority (Nantes, Angers, Le Mans, La Roche-sur-Yon for PdL launch).
  - **Forward Story 3.x V1+** : Story 3.8 livre l'endpoint MVP simple. V1+ pourra upgrade vers geo-svc avec OpenStreetMap/Nominatim pour autocomplete international.
- (d) **Gateway endpoint `GET /v1/search/listings`** (NEW Story 3.8) :
  - Query params (Zod validate via `SearchListingsQuerySchema` Story 3.7 livré) : `categorySlug?`, `subcategorySlug?`, `postalCodes[]?` (array via comma CSV), `date?` (ISO yyyy-mm-dd — checks `minLeadTimeDays` filter), `pricingMode?`, `priceMinCents?`, `priceMaxCents?`, `sort=publishedAt:desc|priceUnitAmountCents:asc|deliveryRadiusKm:asc`, `locale: 'fr' | 'en'` (default Accept-Language), `limit=20`, `offset=0`
  - Forwarder appelle catalog-svc internal `GET /internal/search/listings` avec mêmes params + `X-Internal-Service-Token`
  - **catalog-svc internal endpoint** consume `IListingSearchIndexerService.search()` Story 3.7 :
    ```ts
    @Injectable()
    export class SearchListingsUseCase {
      async execute(input: SearchListingsQuery): Promise<{ items: MeilisearchListingDocument[]; totalEstimate: number; processingTimeMs: number; facets?: Record<string, Record<string, number>> }> {
        const indexName = input.locale === 'fr' ? 'listings_fr' : 'listings_en';
        const filterParts: string[] = ['status = "published"'];
        if (input.categorySlug) filterParts.push(`categorySlug = "${input.categorySlug}"`);
        if (input.subcategorySlug) filterParts.push(`subcategorySlug = "${input.subcategorySlug}"`);
        if (input.postalCodes?.length) filterParts.push(`postalCode IN [${input.postalCodes.map(p => `"${p}"`).join(',')}]`);
        if (input.pricingMode) filterParts.push(`pricingMode = "${input.pricingMode}"`);
        if (input.priceMinCents !== undefined) filterParts.push(`priceUnitAmountCents >= ${input.priceMinCents}`);
        if (input.priceMaxCents !== undefined) filterParts.push(`priceUnitAmountCents <= ${input.priceMaxCents}`);
        if (input.date) {
          // Filter listings whose minLeadTimeDays allows the requested date
          // i.e., (eventDate - today) >= minLeadTimeDays → minLeadTimeDays <= daysFromToday
          const daysFromToday = Math.floor((new Date(input.date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          filterParts.push(`minLeadTimeDays <= ${daysFromToday}`);
        }
        const result = await this.searchIndexer.search({
          indexName,
          query: input.query ?? '',
          filter: filterParts.join(' AND '),
          sort: input.sort ? [input.sort.replace(':', ':')] : ['publishedAt:desc'],
          limit: input.limit ?? 20,
          offset: input.offset ?? 0,
        });
        return result;
      }
    }
    ```
  - Throttle 120/min/IP (search publique anonyme — anti-abuse)
  - Cache HTTP `Cache-Control: public, max-age=60, stale-while-revalidate=300` (60s fresh + 5min SWR) — search results évoluent vite (nouveaux listings published) mais 60s cache acceptable UX + reduce Meilisearch load
- (e) **URL state sync + browser back/forward** : tous les params search reflected URL search params (next.js `useSearchParams` + `router.replace`) → bookmarkable + shareable + back/forward navigation works
- (f) **NFR58 URLs EN strict** : `/fr/search?categorySlug=tents-marquees&city=nantes&postalCodes=44000,44100&date=2026-08-15` (paths EN strict + query params EN). Visitor anglais : `/en/search?...` même structure
- (g) **i18n FR/EN strict** namespace `public.search.*` ~40 keys × 2 locales (search bar labels, placeholder dates, results count format, sort options, empty state, CTA labels)
- (h) **Accessibility RGAA AA** (NFR47-54) : `<SearchBar>` semantic `<form role="search">` + `<label>` per field + ARIA-live `<ResultsCount>` (`aria-live="polite"`) for screen readers when results update + focus management on submit + axe-core 0 violations + keyboard navigation Tab through fields + DatePicker keyboard accessible + ListingCard `<article>` semantic + alt text photos NFR50
- (i) **Performance NFR1 < 150ms p95 search + NFR3 LCP < 2.5s** :
  - Meilisearch query p95 30-80ms → gateway forward + Meilisearch ~100ms p95 total OK
  - Hero search bar `<picture>` no LCP impact (images Cloudflare CDN cached)
  - ListingCard images lazy-load except first row above-the-fold (LCP candidates)
  - HTTP cache 60s + SWR 5min reduce repeated Meilisearch calls
- (j) **Story 3.9 forward-dep** : filters/facettes + page results refinements V1 — Story 3.8 livre la mécanique base + structure `<SearchResultsLayout>`. Story 3.9 ajoutera `<FilterSidebar>` + facets display (category facet counts + price range slider + capacity filter V1+)

**so that** un Visitor anonymous Sophie cherche "tente Nantes 15 août" → home `/fr/` → `<SearchBar>` 3 fields → submit → `/fr/search?categorySlug=tents-marquees&city=nantes&postalCodes=44000,44100,44200,44300&date=2026-08-15` → page rendered Server Component → 12 listings published correspondants → infinite scroll → click 1ère card → redirect `/fr/services/{slug}` (Story 3.10 future) ; Sophie change date → `<SearchBar>` modifie URL → re-fetch → 8 listings (4 ont minLeadTimeDays > daysFromToday → filtered out) ; Tom anglais search "tents Nantes" → `/en/search?...` → 12 listings index `listings_en` (8 avec EN translations + 4 avec `_fallback_locale: 'fr'` badge "FR only" Story 5.9) ; Marie cherche zone très spécifique aucun résultat → empty state UX-DR16 + 2 CTAs ; un test `pnpm playwright test --grep "search frontend"` passe FR/EN axe-core 0 violations 12 scénarios (search submit happy FR + EN, URL params bookmarkable back/forward, infinite scroll triggers next page, empty state CTAs functional, city autocomplete debounce 300ms + popular cities first, sort change re-fetch, filters category cascading, badge FR-only EN locale, RGAA semantic + kbd nav, mobile responsive, NFR3 LCP < 2.5s Lighthouse audit, NFR1 search p95 < 150ms perf assert) ; coverage ≥ 90 % gateway endpoint + use case + 85 % frontend page + components.

## Acceptance Criteria

1. **AC1 — gateway-api `GET /v1/search/listings` + city autocomplete `/v1/geo/cities` endpoints** : Given Story 3.7 livré `IListingSearchIndexerService.search()` + DTO `SearchListingsQuerySchema`, When je consulte `apps/gateway-api/src/`, Then :
   - **NEW endpoint** `GET /v1/search/listings` :
     ```ts
     @Controller('/v1/search')
     export class SearchController {
       @Get('/listings')
       @HttpCode(200)
       @CacheControl('public, max-age=60, stale-while-revalidate=300')
       @Throttle({ short: { limit: 120, ttl: 60_000 } })
       async searchListings(@Query() query: SearchListingsQuery, @AcceptLanguage() locale: 'fr' | 'en'): Promise<SearchListingsResponse> {
         return this.searchForwarder.getInstance().searchListings({ ...query, locale: query.locale ?? locale });
       }
     }
     ```
   - **NEW endpoint** `GET /v1/geo/cities?q=&locale=&limit=10`
     ```ts
     @Controller('/v1/geo')
     export class GeoController {
       @Get('/cities')
       @HttpCode(200)
       @CacheControl('public, max-age=3600') // 1h cache (cities/postal codes change rarely)
       @Throttle({ short: { limit: 60, ttl: 60_000 } })
       async citiesAutocomplete(@Query() query: { q: string; locale?: 'fr' | 'en'; limit?: number }, @AcceptLanguage() locale: 'fr' | 'en'): Promise<{ data: CityResult[] }> {
         return this.geoForwarder.getInstance().citiesAutocomplete({ q: query.q, locale: query.locale ?? locale, limit: query.limit ?? 10 });
       }
     }
     ```
   - **Validation Zod** `SearchListingsQuerySchema` Story 3.7 réutilisé + `CityAutocompleteQuerySchema` NEW Story 3.8 (`q: z.string().min(2).max(60)`, `limit: z.number().int().min(1).max(20).default(10)`)
   - **Response shapes** : `SearchListingsResponse: { data: MeilisearchListingDocument[]; pagination: { hasMore: boolean; nextOffset: number; totalEstimate: number; limit: number; offset: number }; meta: { processingTimeMs: number; facets?: ... } }`
   - Tests E2E gateway 8 scenarios (search happy FR + EN, filters category + postalCodes + date, sort variants, throttle 120/min, empty result, city autocomplete fuzzy + popular)

2. **AC2 — catalog-svc `SearchListingsUseCase` + `CitiesAutocompleteUseCase` + Fuse.js integration** : Given Story 3.7 `IListingSearchIndexerService.search()` + `PostalCodeCityResolverService`, When je consulte `apps/catalog-svc/src/`, Then :
   - **NEW use case** `search-listings.usecase.ts` (cf. story body section d implementation)
   - **NEW use case** `cities-autocomplete.usecase.ts` :
     ```ts
     @Injectable()
     export class CitiesAutocompleteUseCase implements OnModuleInit {
       private fuse: Fuse<CityRecord>;
       async onModuleInit(): Promise<void> {
         const cities = await this.postalCodeCityResolver.loadAllCities(); // ~37k entries from INSEE seed
         this.fuse = new Fuse(cities, {
           keys: ['city', 'postalCodes'],
           threshold: 0.3,
           minMatchCharLength: 2,
           includeScore: true,
         });
       }
       async execute(input: { q: string; locale: 'fr' | 'en'; limit: number }): Promise<{ data: CityResult[] }> {
         const results = this.fuse.search(input.q, { limit: input.limit });
         return { data: results.map(r => ({ city: r.item.city, postalCodes: r.item.postalCodes, department: r.item.department, region: r.item.region })) };
       }
     }
     ```
   - **NEW DTO** `dtos/geo/city.dto.ts` : `CityResult { city: string; postalCodes: string[]; department: string; region: string }`
   - **Internal endpoints catalog-svc** : `GET /internal/search/listings` + `GET /internal/geo/cities` avec `X-Internal-Service-Token` guard
   - Tests unit ≥ 90 % each use case (Meilisearch search filter building, Fuse.js fuzzy search)

3. **AC3 — Home page `/{locale}/page.tsx` + `<SearchBar>` 3 fields** : Given AC1 + Story 3.1 categories endpoint, When je consulte `apps/public/src/app/[locale]/page.tsx` (UPDATE Story 0.x bundle Cloud Design `home.jsx` migrated), Then :
   - **Server Component fetches** parallel : `GET /v1/categories?tree=false&mvpPilotOnly=true` + i18n keys
   - **Render `<HomeHero>` Section** with bundle Cloud Design design system Sprint 0 figé + `<SearchBar>` overlay
   - **`<SearchBar>` Client Component** (NEW Story 3.8 — `apps/public/src/features/public/search/components/SearchBar.tsx`) :
     ```tsx
     'use client';
     export const SearchBar: FC<{ categories: CategoryDto[]; defaultValues?: SearchParams; variant?: 'hero' | 'compact' }> = ({ categories, defaultValues, variant = 'hero' }) => {
       const [categorySlug, setCategorySlug] = useState(defaultValues?.categorySlug ?? '');
       const [cityQuery, setCityQuery] = useState(defaultValues?.city ?? '');
       const [selectedCity, setSelectedCity] = useState<CityResult | null>(defaultValues?.cityResult ?? null);
       const [date, setDate] = useState(defaultValues?.date ?? '');
       const router = useRouter();
       const t = useTranslations('public.search.bar');

       const { data: cityResults } = useQuery({
         queryKey: ['cities', cityQuery],
         queryFn: () => apiClient.get('/v1/geo/cities?q=' + encodeURIComponent(cityQuery)),
         enabled: cityQuery.length >= 2,
         staleTime: 60_000, // 1 min cache
       });
       const debouncedCityQuery = useDebouncedCallback(setCityQuery, 300);

       const handleSubmit = (e: FormEvent) => {
         e.preventDefault();
         if (!categorySlug) return; // required
         const params = new URLSearchParams();
         params.set('categorySlug', categorySlug);
         if (selectedCity) {
           params.set('city', selectedCity.city.toLowerCase());
           params.set('postalCodes', selectedCity.postalCodes.join(','));
         }
         if (date) params.set('date', date);
         router.push('/' + locale + '/search?' + params.toString());
       };

       return (
         <form role="search" onSubmit={handleSubmit} className={cn('search-bar', variant)}>
           <label>
             {t('categoryLabel')}
             <Select value={categorySlug} onChange={setCategorySlug} required>
               <option value="">{t('categoryPlaceholder')}</option>
               {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
             </Select>
           </label>
           <label>
             {t('cityLabel')}
             <Combobox value={selectedCity} onChange={setSelectedCity} options={cityResults?.data ?? []} onInputChange={(v) => debouncedCityQuery(v)} placeholder={t('cityPlaceholder')} />
           </label>
           <label>
             {t('dateLabel')}
             <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} max={new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} />
           </label>
           <Button type="submit" variant="primary" size="lg" disabled={!categorySlug}>{t('submitCta')}</Button>
         </form>
       );
     };
     ```
   - **`<Combobox>` Story 0.5 atomic ou créer Story 3.8** — autocomplete via `@headlessui/react` Combobox v2+ ou `cmdk` v1+ (latest stable — Tailwind v4 compatible + RGAA)
   - i18n keys `public.search.bar.{categoryLabel, categoryPlaceholder, cityLabel, cityPlaceholder, dateLabel, submitCta}` × 2 locales
   - Tests `@testing-library/react` 8 scenarios (render fields, submit redirects URL, city autocomplete fetch debounced, date min/max, required category enforce, defaultValues pre-fill, variant compact)

4. **AC4 — Page `/{locale}/search/page.tsx` Server Component + `<SearchResultsLayout>`** : Given AC3, When je consulte `apps/public/src/app/[locale]/search/page.tsx` (NEW Story 3.8), Then :
   - **Server Component** :
     1. Parse `searchParams` (categorySlug, city, postalCodes, date, sort, etc.)
     2. Validate Zod `SearchListingsQuerySchema`
     3. Fetch parallel : `GET /v1/search/listings` + `GET /v1/categories?tree=false&mvpPilotOnly=true` (for SearchBar pre-fill)
     4. Render `<SearchResultsLayout>` Client Component
   - **`<SearchResultsLayout>`** Client Component :
     - Sticky header `<SearchBar variant="compact" defaultValues={...}>` + bouton "Modifier" expand
     - `<ResultsCount>` aria-live polite "{count} services trouvés à {city} pour le {date}"
     - `<SortSelector>` 3 options
     - `<ListingsGrid>` infinite scroll TanStack Query
     - `<EmptyState>` if 0 results
   - Tests : 6 scenarios (render results, empty state, sort change, infinite scroll, URL state sync, RGAA aria-live polite)

5. **AC5 — `<ListingCard>` atomic component** : Given AC4 + Story 3.4 photos variants + Story 3.7 MeilisearchListingDocument shape, When je consulte `packages/ui/src/components/ListingCard/ListingCard.tsx` (NEW — réutilisable Stories 3.10/3.11/3.12 future), Then :
   - **Component props** : `{ listing: MeilisearchListingDocument; locale: 'fr' | 'en'; variant?: 'card' | 'detail-related'; eager?: boolean }`
   - **Render** :
     - `<picture>` srcset WebP/AVIF/JPG fallback (`urls.card` Story 3.4) + `loading="lazy"` (sauf eager=true pour above-the-fold LCP)
     - Title + truncate description ~100 chars
     - `<PricingDisplay>` Story 0.5 réutilisé
     - Pro name + city
     - Reviews aggregate ("Pas encore d'avis" placeholder MVP — Story 5.8 V1 populates)
     - Badge `<Badge variant="muted">FR only</Badge>` si `_fallback_locale === 'fr'` ET `locale === 'en'` (Story 5.9 future UI definitive — Story 3.8 livre le badge mécanique)
     - Click → `router.push('/{locale}/services/{slug}')` (Story 3.10 future)
   - **Storybook** 4 stories + axe-core a11y test
   - Tests `@testing-library/react` 5 scenarios

6. **AC6 — `<EmptyState variant="search-no-results">` UX-DR16** : Given AC4, When 0 results, Then :
   - `<EmptyState>` Story 0.5 atomic réutilisé avec variant `search-no-results`
   - i18n message `"Aucun service ne correspond. Essayez d'élargir votre zone ou changer de date"` / `"No service matches. Try expanding your area or changing the date"`
   - 2 CTAs : "Effacer les filtres" → `router.push('/{locale}/search')` no params + "Modifier la recherche" → expand SearchBar variant hero

7. **AC7 — Infinite scroll TanStack Query + Intersection Observer** : Given AC4, When user scroll bottom, Then :
   - `useInfiniteQuery({ queryKey: ['search-listings', searchParams], queryFn: fetchPage, getNextPageParam: (last) => last.pagination.hasMore ? last.pagination.nextOffset : undefined, initialPageParam: 0 })`
   - `<IntersectionObserver>` ref on `<div data-fetch-trigger />` at bottom-1 of grid → triggers `fetchNextPage()` quand 80% visible
   - Loading state `<ListingCardSkeleton>` ×3 placeholder pendant fetch
   - Tests : initial render 20 items, scroll → fetch next 20, no more results stops trigger

8. **AC8 — i18n + métriques + tests Playwright e2e + perf NFR1/NFR3** : Given AC1-7, When :
   - **i18n** namespace `public.search.*` ~40 keys × 2 locales (cf. story body section g)
   - **Métriques NEW** :
     - `tukio_search_queries_total{result_count_bucket}` (counter — bucket 0|1-10|11-50|51+)
     - `tukio_search_duration_seconds` (histogram — gateway → Meilisearch + back)
     - `tukio_search_throttle_blocked_total` (counter)
     - `tukio_search_city_autocomplete_total{result_count}` (counter)
     - `tukio_search_p95_seconds` (histogram NFR1 monitoring)
   - **Prometheus alert** `SearchLatencyHigh` `histogram_quantile(0.95, tukio_search_duration_seconds_bucket) > 0.150` for 5m → warning Slack `#tukio-alerts-ops`
   - **Dashboard Grafana** `search-frontend.json` (NEW ~5 panels) : queries/min, p90/p95 latency, empty result rate, city autocomplete usage, throttle hit rate
   - **Tests Playwright e2e** 12 scenarios (cf. story body Outcome) :
     - T1-2 search submit happy FR + EN
     - T3 URL params bookmarkable + back/forward navigation works
     - T4 infinite scroll triggers next page
     - T5 empty state CTAs functional
     - T6 city autocomplete debounce 300ms + popular cities first
     - T7 sort change re-fetch
     - T8 filters category cascading sub-cat
     - T9 badge "FR only" EN locale fallback
     - T10 RGAA aria-live polite + kbd nav + axe-core 0 violations
     - T11 mobile responsive (320px width)
     - T12 NFR3 LCP < 2.5s Lighthouse audit + NFR1 search p95 < 150ms perf assert (k6 load test)
   - Coverage ≥ 90 % gateway endpoints + use cases + 85 % frontend page + components

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` DTOs search + cities** (AC: #1, #2)
  - [ ] 1.1 — DTO `dtos/geo/city.dto.ts` (CityResult + CityAutocompleteQuerySchema)
  - [ ] 1.2 — UPDATE `dtos/catalog/search-listings-query.dto.ts` Story 3.7 — extend `query?` field (text search MVP placeholder)
  - [ ] 1.3 — Tests Zod
- [ ] **Task 2 — gateway-api 2 endpoints + forwarders + cache HTTP** (AC: #1)
  - [ ] 2.1 — `search.controller.ts` GET /v1/search/listings + cache 60s SWR 5min + throttle 120/min
  - [ ] 2.2 — `geo.controller.ts` GET /v1/geo/cities + cache 1h + throttle 60/min
  - [ ] 2.3 — Forwarders + tests E2E 8 scenarios
- [ ] **Task 3 — catalog-svc use cases + Fuse.js integration** (AC: #2) — coverage ≥ 90 %
  - [ ] 3.1 — `search-listings.usecase.ts` (Meilisearch query builder filter parts)
  - [ ] 3.2 — `cities-autocomplete.usecase.ts` (Fuse.js init OnModuleInit + 37k cities indexed once at boot)
  - [ ] 3.3 — Internal endpoints catalog-svc
  - [ ] 3.4 — Wire usecases-proxy module
  - [ ] 3.5 — Tests unit + integration testcontainer Meilisearch
- [ ] **Task 4 — Home page + `<SearchBar>` Client Component** (AC: #3)
  - [ ] 4.1 — Page `/{locale}/page.tsx` Server Component (migrate home.jsx bundle)
  - [ ] 4.2 — `<SearchBar>` 3 fields + Combobox autocomplete (`@headlessui/react` Combobox v2+ or cmdk v1+)
  - [ ] 4.3 — i18n keys `public.search.bar.*`
  - [ ] 4.4 — Tests `@testing-library/react` 8 scenarios
- [ ] **Task 5 — Page `/{locale}/search` + `<SearchResultsLayout>`** (AC: #4) — coverage ≥ 85 %
  - [ ] 5.1 — Page Server Component
  - [ ] 5.2 — `<SearchResultsLayout>` Client Component
  - [ ] 5.3 — `<ResultsCount>` aria-live + `<SortSelector>`
  - [ ] 5.4 — Tests 6 scenarios
- [ ] **Task 6 — `<ListingCard>` atomic + `<ListingsGrid>` + Infinite Scroll** (AC: #5, #7)
  - [ ] 6.1 — `<ListingCard>` packages/ui (réutilisable Stories 3.10/3.11/3.12)
  - [ ] 6.2 — `<ListingsGrid>` infinite scroll TanStack Query useInfiniteQuery
  - [ ] 6.3 — `<ListingCardSkeleton>` loading placeholder
  - [ ] 6.4 — Storybook + axe-core
  - [ ] 6.5 — Tests
- [ ] **Task 7 — `<EmptyState search-no-results>` + 2 CTAs** (AC: #6)
- [ ] **Task 8 — Métriques + Prometheus alerts + Grafana dashboard** (AC: #8)
- [ ] **Task 9 — Tests Playwright e2e + NFR1/NFR3 perf assert** (AC: #8) — 12 tests
- [ ] **Task 10 — Documentation runbook + commit**
  - [ ] 10.1 — Runbook `docs/runbook/search-frontend-debug.md`
  - [ ] 10.2 — Update `docs/project-context.md` section "Search Frontend (Story 3.8)"
  - [ ] 10.3 — Commit `feat(public,catalog,gateway): Story 3.8 search frontend SearchBar 3 fields + page results + city autocomplete + Meilisearch query`

## Dev Notes

### Pourquoi Story 3.8 ouvre la couche UI Visitor public

Story 3.7 a livré la **couche backend search** (Meilisearch indexes). Story 3.8 livre la **première interface Visitor** : SearchBar home + page résultats. C'est la **porte d'entrée acquisition** de la marketplace — performance + UX critiques (NFR1 < 150ms + NFR3 LCP < 2.5s + RGAA AA). Pattern complet **search-as-you-type + URL state sync + infinite scroll + city autocomplete + locale-aware** réutilisé Stories 3.9 facets V1+, Stories 8.x V1 multi-vendor cart search, Stories Epic 11 V1+ in-app notifications search.

### Décisions techniques majeures actées

1. **Search bar 3 fields fixes (catégorie required + ville optional + date optional)** — UX simplicité MVP. Filters granulaires Story 3.9.
2. **City autocomplete via Fuse.js + INSEE seed** — MVP simple sans dépendance externe. Story 3.x V1+ pourra upgrade vers geo-svc.
3. **HTTP cache 60s search results + 1h cities** — balance UX (results frais) + performance (Meilisearch load reduce).
4. **Infinite scroll** (vs pagination classic) — UX fluide mobile + desktop.
5. **URL state sync complet** — bookmarkable + shareable + SEO (Story 3.12 future page catégorie).
6. **Badge "FR only" mécanique Story 3.8** — Story 5.9 future polit l'UI definitively.
7. **`<ListingCard>` atomic réutilisable** — Stories 3.10/3.11/3.12.
8. **Story 3.10 listing detail forward-dep** — Story 3.8 redirect `/{locale}/services/{slug}` mais Story 3.10 livre la page detail.
9. **`@headlessui/react` Combobox v2+ ou `cmdk` v1+** — RGAA-friendly + Tailwind v4 compatible.
10. **EN strict + i18n + RGAA AA + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `fuse.js` | City autocomplete fuzzy search | latest stable v7+ | Léger ~13KB, no deps, indexed once at boot |
| `@headlessui/react` Combobox OR `cmdk` | Autocomplete UI | Headless v2+ / cmdk v1+ | RGAA + Tailwind v4 compatible |
| `react-day-picker` | DatePicker (alternatif input type=date natif) | v9+ if needed V1+ | MVP : input type=date natif suffit |
| `@tanstack/react-query` `useInfiniteQuery` | Infinite scroll | (Story 0.9 already) | |
| `use-debounce` | City autocomplete debounce 300ms | (Story 3.3 already) | |

### Project Structure cible

```
packages/contracts/src/dtos/
├─ geo/city.dto.ts                                                # NEW Story 3.8
└─ catalog/search-listings-query.dto.ts                           # UPDATE Story 3.7 — add optional `query` text search field

packages/ui/src/components/
├─ ListingCard/ListingCard.tsx + spec + stories + index           # NEW Story 3.8 (réutilisable Stories 3.10/3.11/3.12)
└─ ListingCardSkeleton/ListingCardSkeleton.tsx                    # NEW (loading placeholder)

apps/gateway-api/src/
├─ usecases/search/{search.forwarder.ts, geo.forwarder.ts}        # NEW
└─ infrastructure/http/controllers/
   ├─ search.controller.ts                                        # NEW
   └─ geo.controller.ts                                           # NEW

apps/catalog-svc/src/
├─ usecases/
│  ├─ search-listings.usecase.ts + spec                           # NEW
│  └─ cities-autocomplete.usecase.ts + spec                       # NEW (Fuse.js OnModuleInit)
├─ usecases-proxy/usecases-proxy.module.ts                        # UPDATE — wire 2 new use cases
└─ infrastructure/http/controllers/
   ├─ internal-search.controller.ts                               # NEW
   └─ internal-geo.controller.ts                                  # NEW

apps/public/src/
├─ app/[locale]/
│  ├─ page.tsx                                                    # UPDATE Story 0.x — add SearchBar overlay home
│  └─ search/page.tsx                                             # NEW Server Component
├─ features/public/search/
│  ├─ components/
│  │  ├─ SearchBar.tsx + spec                                     # NEW Client Component (3 fields + Combobox)
│  │  ├─ SearchResultsLayout.tsx + spec                           # NEW
│  │  ├─ ResultsCount.tsx                                         # NEW (aria-live polite)
│  │  ├─ SortSelector.tsx                                         # NEW
│  │  ├─ ListingsGrid.tsx                                         # NEW (infinite scroll)
│  │  └─ Combobox.tsx                                             # NEW (autocomplete cities)
│  └─ hooks/
│     ├─ use-search-listings-infinite-query.ts                    # NEW (TanStack useInfiniteQuery)
│     ├─ use-cities-autocomplete-query.ts                         # NEW
│     └─ use-search-params-state.ts                               # NEW (URL state sync helper)
└─ messages/{fr,en}.json                                          # UPDATE — namespace public.search.* ~40 keys × 2

apps/public/e2e/search/search.spec.ts                             # NEW (12 tests)

infra/k8s/prometheus-rules/search-frontend.yaml                   # NEW
infra/k8s/grafana-dashboards/search-frontend.json                 # NEW

docs/runbook/search-frontend-debug.md                             # NEW (~30 lignes)

# Estimation : ~30 nouveaux + ~5 updates = ~35 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5 (atomics), 0.9 (TanStack Query + next-intl + use-debounce), 1.2 (gateway-api forwarder), 3.1 (categories endpoint), 3.4 (Cloudflare Images variants), 3.7 (Meilisearch indexer + ISearchIndexer.search() + PostalCodeCityResolverService + SearchListingsQuerySchema DTO).

1. **API responses envelope ADR-014** — search response avec pagination + meta.
2. **EN strict + i18n FR/EN + RGAA AA + latest stable versions** memories.
3. **NFR1 < 150ms p95 search** — Meilisearch typical 30-80ms + gateway ~30ms = ~110ms p95 OK.
4. **NFR3 LCP < 2.5s** — Hero search bar no LCP impact + ListingCard images lazy except first row.
5. **NFR58 URLs EN strict** — `/fr/search?categorySlug=tents-marquees&...` paths + query params EN.
6. **HTTP cache 60s search + 1h cities** — balance UX + perf.

### Previous Story Intelligence

**Story 0.5 (atomics)** : `<Select>`, `<Input>`, `<Button>`, `<EmptyState>`, `<Card>`, `<PricingDisplay>` réutilisés.

**Story 0.9 (TanStack Query + next-intl)** : Story 3.8 réutilise `useInfiniteQuery` + `useQuery` + i18n.

**Story 1.2 (gateway-api forwarder pattern)** : réutilisé.

**Story 3.1 (Categories API)** : Story 3.8 consume `GET /v1/categories?tree=false&mvpPilotOnly=true` for SearchBar Select.

**Story 3.4 (Cloudflare Images variants)** : ListingCard renders `urls.card` (and `urls.detail` for Story 3.10 future).

**Story 3.7 (Meilisearch indexer + search() method + PostalCodeCityResolverService + SearchListingsQuerySchema DTO)** : Story 3.8 wire le Meilisearch search via SearchListingsUseCase + city autocomplete via PostalCodeCityResolverService + Fuse.js wrapping.

### What this story does NOT do

- ❌ **Story 3.9 filters/facettes panel** — Story 3.8 livre 1 sort + structure. Story 3.9 ajoute FilterSidebar + facets.
- ❌ **Story 3.10 listing detail public page** — Story 3.8 redirect vers `/services/{slug}` mais Story 3.10 livre la page.
- ❌ **Distance/geosearch radius** — V1+ feature. MVP : postalCode IN [...] filter exact match.
- ❌ **Search history / recent searches** — V1+ feature.
- ❌ **Saved searches notifications** — V1+ feature Stories 11.x.
- ❌ **AI semantic search** — V2 Story 13.3.
- ❌ **Filter by reviews score** — V1 Story 5.8.
- ❌ **Multi-date range** — V1+ feature. MVP single date.
- ❌ **Categorie populaires homepage carousel** — V1+ enhancement.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 90 % gateway endpoints + use cases (search + cities autocomplete)
- Coverage ≥ 85 % frontend page + components
- E2E Playwright FR/EN axe-core 0 violations 12 tests AC8
- Tests integration testcontainer Meilisearch (search query)
- Perf : Lighthouse LCP < 2.5s, k6 load test search p95 < 150ms with 500 listings indexed
- A11y axe-core 0 violations sur (a) home avec SearchBar, (b) search results, (c) empty state, (d) Combobox autocomplete

### Project Structure Notes

✅ **Aligné architecture, PRD §FR18 (search bar 3 fields), §NFR1 (search p95 < 150ms), §NFR3 (LCP < 2.5s), §NFR58 (URLs EN), §UX-DR (home figé bundle), Stories 0.5/0.9/1.2/3.1/3.4/3.7, memories.**

⚠️ **Décision** : SearchBar 3 fields fixes — UX simplicité MVP, filters Story 3.9.
⚠️ **Décision** : City autocomplete Fuse.js + INSEE seed — MVP simple, geo-svc V1+.
⚠️ **Décision** : HTTP cache 60s SWR 5min — balance UX + Meilisearch load.
⚠️ **Décision** : Infinite scroll — UX fluide.
⚠️ **Décision** : URL state sync complet — bookmarkable + SEO.
⚠️ **Décision** : Badge "FR only" mécanique Story 3.8 + UI definitive Story 5.9.
⚠️ **Décision** : `<ListingCard>` atomic réutilisable Stories 3.10/3.11/3.12.

### References

- [Source: epics.md#Epic-3-Story-3.8 — Lines 1505-1518]
- [Source: prd.md#FR18 (search bar), #NFR1 (p95 < 150ms), #NFR3 (LCP), #NFR58 (URLs EN)]
- [Source: ux-design-specification.md — UX-DR16 empty state pattern]
- [Source: architecture.md — ADR-014 envelope, lines 2120-2164 Pretre]
- [Source: Stories 0.5/0.9/1.2/3.1/3.4/3.7]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(à remplir à la fin — points d'attention pour Story 3.9 (FilterSidebar + facets), Story 3.10 (listing detail page consume slug routing), Story 3.11 (pro public profile), Story 3.12 (page catégorie générale))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-10
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (8ᵉ story Epic 3 — première UI Visitor public)
- **Estimation effort** : 4-5 jours (1 dev fullstack — story complexité moyenne+ : 2 endpoints + 2 use cases + Fuse.js + 6 components + page + i18n + 12 e2e tests, ~35 fichiers)
- **Dépendances upstream** : Stories 0.5, 0.9, 1.2, 3.1, 3.4, 3.7
- **Dépendances downstream** :
  - Story 3.9 (FilterSidebar + facets) — extend SearchResultsLayout Story 3.8
  - Story 3.10 (listing detail public) — page `/services/{slug}` redirect target Story 3.8
  - Story 3.11 (pro public profile) — réutilise `<ListingCard>` Story 3.8
  - Story 3.12 (page catégorie générale) — réutilise `<ListingsGrid>` Story 3.8
  - Stories Epic 8 V1 (multi-vendor cart) — pattern search étendu
- **FRs covered** :
  - **FR18** ✅ search bar 3 fields (catégorie + ville + date) home
- **NFRs touchés** :
  - **NFR1** ✅ search p95 < 150ms
  - **NFR3** ✅ LCP < 2.5s home + search results
  - **NFR58** ✅ URLs EN strict
  - **NFR47/50/54** ✅ RGAA AA + altText photos + kbd nav
  - **NFR71** ✅ coverage thresholds

> **Prochaine story → Story 3.9** (Filters / facettes + search results page FR19 — extend SearchResultsLayout Story 3.8 avec FilterSidebar + facets count Meilisearch)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.9, 1.2, 3.1, 3.4, 3.7 implémentées
3. Implémenter Tasks 1-10 dans l'ordre
4. Lancer `pnpm playwright test --grep "search frontend"` après chaque jalon + Lighthouse audit + k6 load test
5. Commit Story 3.8 quand : 12/12 e2e + coverage NFR71 + axe-core 0 + Lighthouse LCP < 2.5s + k6 search p95 < 150ms + Fuse.js boot < 500ms + métriques validées
6. Update sprint-status : `3-8-...: review` puis `done`
