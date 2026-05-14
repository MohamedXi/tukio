# Story 3.12: Category general page + median price display (FR22 MVP, FR31)

Status: ready-for-dev

## Story

**As a** Visitor (B2C particulier ou Pro découvrant la marketplace) qui clique une catégorie depuis `<TopBar>` Story 0.5 OU `<Breadcrumb>` Story 3.10 `<ListingHeader>` OR atterrit via Google SERP long-tail "location chapiteau Loire-Atlantique" / "event tent rental Nantes" → atterrit sur `/{locale}/category/<slug>` (singular `category` — NFR58 EN strict slug, e.g., `/fr/category/tents-marquees` ou `/en/category/tents-marquees`),
**I want** Server Component RSC dynamic rendering Next.js 15 qui reproduit le pattern Story 3.10/3.11 :
- (a) **`<CategoryHeaderHero>`** (NEW Story 3.12 feature-scoped) :
  - **Breadcrumb** : `Accueil > Catégories > {category.name}` (Story 7.3 future sitemap structured data BreadcrumbList JSON-LD V1)
  - **H1 Fraunces** `text-4xl font-display charcoal-800` : `category.name` localisé via `category_translations` Story 3.1 (e.g., "Chapiteaux & barnums" FR / "Tents & marquees" EN)
  - **Sous-titre** : `"{listingsCount} services disponibles dans votre région"` — listingsCount issu de `GET /v1/search/listings?categorySlug=<slug>` Story 3.8 `pagination.totalEstimate` Meilisearch (vs `category.listings_count` field DB cron-populated V1+ — MVP utilise totalEstimate Meilisearch real-time)
  - **Median price badge** : `<PricingDisplay variant="median">` (NEW variant Story 3.12 UPDATE Story 0.5) — "Prix médian : ~XXX € {unit}" (FR31 transparence client) :
    - **Si `category.median_price_amount !== null`** (Story 3.5 cron daily populates si ≥ 5 listings publiés) → render badge "Prix médian : 35 € par jour" (formatMoney + unit hint)
    - **Si null** (< 5 listings publiés) → `<EmptyState variant="placeholder">` Story 0.5/3.10 réutilisé avec icône `<TrendingUp>` Lucide + label "Pas encore assez de données pour calculer le prix médian" + sous-texte "Revenez bientôt — au moins 5 fiches publiées requises" (UX éducative FR31 transparence — NFR1 RGPD anonymisation effective)
  - **Description** : `category.description` localisé (max 280 chars truncated avec "Lire la suite" toggle) — vient de `category_translations.description` Story 3.1
- (b) **`<CategorySubcategoriesNav>`** (NEW Story 3.12 feature-scoped) : Si `category.subcategories.length > 0` (root categories MVP = `tents-marquees` + `event-furniture` — Story 3.1 livre 8 subcategories au total) → grid horizontal scroll mobile / inline desktop des `<Card variant="chip">` (NEW variant `<Card>` Story 0.4 UPDATE — chip layout petit) :
  - Chaque chip = `<Link href="/{locale}/category/<subcategory.slug>">` cliquable → navigue vers subcategory page (same pattern Story 3.12 récursif — MVP all subcategories indexed, V1+ might lazy)
  - Hover preload Story 3.9 pattern réutilisé (`<link rel="prefetch">` sur subcategory routes)
  - Icône Lucide adaptée par subcategory (V1+ catégorie-specific icons — MVP générique `<Box>`)
  - Label = `subcategory.name` localisé
  - Badge `{subcategory.listingsCount}` (V1+ cron-populated — MVP hide si count==0)
- (c) **`<CategoryListingsSection>`** (NEW Story 3.12 feature-scoped) wraps Story 3.8/3.9 patterns réutilisés :
  - **Backend** : Server Component parallel fetch `GET /v1/categories/:slug` (Story 3.1 livré, UPDATE Story 3.12 ajoute `medianPriceAmountCents` field) + `GET /v1/search/listings?categorySlug=<slug>&locale=...&limit=20&sort=publishedAt:desc` (Story 3.8/3.9 livré — Story 3.12 réutilise endpoint avec query categorySlug filter)
  - **`<ListingsGrid>` Story 3.8 réutilisé** infinite scroll TanStack `useInfiniteQuery` — pattern identique SERP search results
  - **`<ListingCard>` Story 3.8/3.9 réutilisé** avec :
    - **NEW badge "Prix dévie"** (Story 3.12 UPDATE `<ListingCard>` Story 3.8/3.9) : si `listing.priceDeviation === true` (Story 3.5 livré field populated post-publish + Story 3.7 indexer field MeilisearchListingDocument) → render `<Badge variant="warning" size="sm">` "Prix +50% médiane" OR "Prix -50% médiane" (color warning si dévie > 50 % — FR32 transparence Visitor)
    - UPDATE Story 3.7 `MeilisearchListingDocument` ajoute `priceDeviation: boolean` field + Story 3.7 `IndexListingUseCase.buildDocument()` ajoute computed field
    - UPDATE Story 3.7 setup-indexes filterableAttributes ajoute `priceDeviation` (optional filter Story 3.12 — V1+ permet "Cacher prix qui dévient")
  - **`<EmptyState variant="placeholder">` Story 0.5** réutilisé si 0 listings : "Aucun service publié dans cette catégorie pour le moment" + sous-texte "Soyez le premier pro à publier (réservé aux pros validés)" — pas de CTA Visitor (CTA cible Pro V1+ Story 7.x acquisition)
  - **`<FilterSidebar>` Story 3.9 réutilisé** : pre-filled `categorySlug=<slug>` + visible only desktop OR via `<FilterDrawer>` mobile (Story 3.9 livré) — same UX pattern that SERP `/{locale}/search` use Story 3.9. Story 3.12 livre integration avec category context pre-filled
- (d) **`<CityFilterCta>` (NEW Story 3.12 placeholder MVP — anticipates V1 `/{locale}/category/<slug>/<city>` pages locales)** : Une section discrète "Voir les services par ville" — link vers `/{locale}/search?categorySlug=<slug>&city=...` Story 3.8 (city filter dans SearchBar) — MVP gracieux dégradement vers SERP filtered. V1+ FR22 livre vraies pages locales `/{locale}/category/<slug>/<city>` générées automatiquement si > 3 pros par ville (RA1 SEO long-tail).
- (e) **JSON-LD `ItemList` schema.org** (FR116) — NEW Story 3.12 helper `apps/public/src/lib/schema-org/ItemList.tsx` **étend pattern foundation Stories 3.10/3.11** (livré `Service.tsx` + `Organization.tsx`) :
  ```jsonld
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "{category.name} sur Tukio",
    "description": "{category.description}",
    "url": "https://tukio.one/{locale}/category/<slug>",
    "numberOfItems": <listingsCount>,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "itemListElement": <listings.slice(0, 20).map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Service',
        name: l.title,
        url: `https://tukio.one/${locale}/services/${l.slug}`,
        image: l.urls.card,
        offers: { '@type': 'Offer', price: (l.pricingAmountCents / 100).toFixed(2), priceCurrency: l.pricingCurrency },
        provider: { '@type': 'Organization', name: l.proName }
      }
    }))>
  }
  ```
  Injected via `<script type="application/ld+json">` (pattern Stories 3.10/3.11 réutilisé). Top 20 ListItems uniquement (Google indexable limite — V1+ pagination via `ItemList.partOfList` chained pages)
- (f) **NFR58 hreflang systematic** (réutilise Story 3.9 helper) + `generateMetadata` Next.js 15 :
  - **`<title>`** = `${category.meta_title ?? category.name + ' | Tukio'}` (Story 3.1 livré `category_translations.meta_title` field — Story 3.12 consume directly)
  - **`<meta description>`** = `${category.meta_description ?? category.description.slice(0, 160)}`
  - **alternates.canonical** = `https://tukio.one/{locale}/category/<slug>`
  - **alternates.languages** = `{ fr: ..., en: ..., 'x-default': ... }` via Story 3.9 helper
  - **OG + Twitter** images : derive depuis 1ʳᵉ listing photo `listings[0]?.urls.detail` (preview category visual) OR fallback static Tukio brand image V1+
- (g) **City subpath 404 + suggestion to canonical category** (epic AC line 1579) : `/{locale}/category/<slug>/<city>` (V1 FR22 page locale auto-générée) → MVP **404 with suggestion** :
  - **Backend** : Story 3.12 NE livre PAS d'endpoint dédié — Next.js `app/[locale]/category/[slug]/[city]/page.tsx` (NEW Story 3.12 placeholder file) returns `notFound()` (404 natif Next.js 15)
  - **NEW `not-found.tsx` custom Story 3.12** : explique "Page non disponible en MVP" + CTA "Voir les services de cette catégorie" → redirect `/{locale}/category/<slug>` canonical + suggestion via `<ListingCard>` grid top 4 listings (réutilise pattern Story 3.10 ListingUnavailableErrorPage similar suggestions)
  - **V1+ Story 7.x livre** la vraie page locale auto-générée (FR22 + RA1 SEO long-tail)
- (h) **EN strict + i18n FR/EN** namespace `public.category.*` ~25 keys × 2 locales (header subtitle plural format, median badge label, subcategories chip aria, listings grid empty state, city subpath placeholder copy, breadcrumb labels, sort selector labels — réutilise Story 3.8 namespace `public.search.*` sort labels pour éviter dupliquer)

**so that** Sophie navigue depuis `<TopBar>` "Catégories > Chapiteaux & barnums" → atterrit `/fr/category/tents-marquees` → Server Component RSC dynamic rendering → H1 "Chapiteaux & barnums" + sous-titre "12 services disponibles dans votre région" + badge "Prix médian : 35 € par jour" + description catégorie + chip "Marquees (8)" "Tents (4)" subcategories + `<FilterSidebar>` desktop préfilled categorySlug + grid 12 `<ListingCard>` avec 2 badges "Prix +60% médiane" warning visibles + infinite scroll → click 1 card → navigue `/fr/services/<slug>` Story 3.10 ; Sophie EN charge `/en/category/tents-marquees` → labels EN ("Tents & marquees", "12 services available in your region", "Median price: ~35 € per day") ; un Googlebot crawle → SEO score Lighthouse ≥ 95 + JSON-LD ItemList parsed Rich Results Test ; un Visitor accède `/fr/category/tents-marquees/nantes` → 404 custom + suggestion redirect canonical + top 4 listings ; un Visitor charge `/fr/category/empty-future-cat` (catégorie sans listings, < 5 → median null) → page render avec `<EmptyState variant="placeholder">` "Pas assez de données pour calculer le prix médian" + listings grid empty "Aucun service publié dans cette catégorie pour le moment" ; un test `pnpm playwright test --grep "category page"` passe FR/EN axe-core 0 violations 10 scénarios (header median badge populated + null, subcategories chips navigate, listings grid + filter sidebar pre-filled, deviation badge warning render, JSON-LD ItemList valid Google Rich Results, hreflang head injection, 404 city subpath + suggestion redirect, locale switch URL preserved, empty category state, infinite scroll) ; coverage ≥ 90 % CategoryLayout + 85 % gateway endpoint UPDATE + 80 % schema-org ItemList helper + 80 % hreflang reuse.

## Acceptance Criteria

1. **AC1 — Backend UPDATE `GET /v1/categories/:slug` Story 3.1 — add `medianPrice` field + listingsCount real-time** : Given Story 3.1 livré `GET /v1/categories/:slug` (CategoryDto with name, description, listingsCount, subcategories[], serviceTypes[], meta_title, meta_description) + Story 3.5 livré `category.median_price_amount` DB field cron-populated, When Story 3.12 étend, Then :
   - **UPDATE `packages/contracts/src/dtos/catalog/category.dto.ts`** Story 3.1 — add fields :
     ```ts
     export const CategoryDtoSchema = z.object({
       // ... existing Story 3.1 fields
       medianPriceAmountCents: z.number().int().nonnegative().nullable(), // NEW Story 3.12 — null si < 5 listings (Story 3.5 threshold)
       medianPriceCurrency: z.literal('EUR').default('EUR'),
       medianPriceUnit: z.enum(['unit', 'package']).nullable(), // NEW Story 3.12 — which pricing mode the median represents (Story 3.5 stores median per (categoryId, pricingMode) combination — MVP returns 'unit' default for simple display)
       listingsCount: z.number().int().nonnegative(), // Story 3.1 livre, MVP returns 0 — Story 3.12 returns real-time depuis Meilisearch facets OR Story 3.7 indexer cron-populated `category.listings_count` field DB V1+
     });
     ```
   - **UPDATE catalog-svc `get-category-by-slug.usecase.ts`** Story 3.1 livré — add JOIN on `category.median_price_amount` + `category.median_price_currency` + map to DTO. Listings count : MVP simple SELECT COUNT(*) FROM listing WHERE category_id=$1 AND status='published' AND deleted_at IS NULL (lightweight count <50ms vs Meilisearch facets — réservé Story 3.12 V1+ optimization)
   - **UPDATE gateway-api forwarder** Story 3.1 livré — minimal change (DTO extended already)
   - **Cache HTTP** Story 3.1 livré `Cache-Control: public, max-age=3600` (catégories rarely changing) — Story 3.12 keep mais réduit max-age=300 (5min) pour fresher median price + listingsCount post-cron run. Throttle Story 3.1 livré 120/min/IP — keep.
   - Tests integration testcontainer Postgres 6 scenarios : T1 happy path medianPrice populated, T2 medianPrice null (< 5 listings), T3 listingsCount real-time, T4 cache 5min hit ratio, T5 throttle 120/min, T6 EN locale fallback (translations missing → FR fallback name/description)

2. **AC2 — UPDATE Story 3.7 `MeilisearchListingDocument` + indexer — add `priceDeviation` field** : Given Story 3.5 livré `priceDeviation` boolean computed at publish time + Story 3.7 livré `MeilisearchListingDocument` shape + Story 3.9 livré `capacityBucket` computed field pattern réutilisé, When Story 3.12 étend, Then :
   - **UPDATE `packages/contracts/src/dtos/catalog/meilisearch-listing-document.ts`** Story 3.7 — add field :
     ```ts
     priceDeviation: z.boolean().default(false), // NEW Story 3.12 — true si abs(listing.price - category.median) / category.median > 0.5 (Story 3.5 computed at publish/update)
     priceDeviationDirection: z.enum(['above', 'below']).nullable(), // NEW — 'above' si price > median, 'below' si < median (FR32 directional badge)
     ```
   - **UPDATE Story 3.7 `IndexListingUseCase.buildDocument()`** — fetch `category.median_price_amount` au moment d'indexation + compute `priceDeviation = abs(listing.pricing.amount - median) / median > 0.5` (Story 3.5 `ListingPublicationService.computePriceDeviation` helper réutilisé — extract to shared helper pour réutilisation indexer)
   - **UPDATE Story 3.7 `setup-indexes.ts`** — add `priceDeviation` + `priceDeviationDirection` to filterableAttributes settings (optional V1+ filter "Cacher prix déviants")
   - **UPDATE Story 3.7 reconcile cron** — drift detection détectera `priceDeviation` missing dans MS docs et re-index automatically (pattern Story 3.9 réutilisé)
   - **Alternative simpler MVP** : Story 3.7 indexer fetches median once at boot + cache 1h (avoid N+1 fetch per listing index). Trade-off : stale up to 1h vs fresh — acceptable MVP given Story 3.5 cron runs daily.
   - Tests integration testcontainer 4 scenarios : T1 happy path price within 50% → deviation false, T2 price +60% → deviation true direction='above', T3 price -55% → deviation true direction='below', T4 median null (< 5 listings) → deviation false default

3. **AC3 — `apps/public/src/app/[locale]/category/[slug]/page.tsx` Server Component + parallel fetch** : Given AC1 + AC2, When je consulte le file (NEW Story 3.12), Then :
   - **Server Component** (`export const dynamic = 'force-dynamic'` MVP — pattern Story 3.10/3.11 réutilisé, V1+ ISR explore `revalidate = 600` car catégories+médianes changent peu) :
     ```tsx
     export default async function Page({ params, searchParams }: { params: Promise<{ locale, slug }>; searchParams: Promise<Record<string, string | string[]>> }) {
       const { locale, slug } = await params;
       const sp = await searchParams;
       const [categoryResponse, listingsResponse] = await Promise.allSettled([
         fetchCategory(slug, locale),
         fetchListingsForCategory(slug, locale, { sort: sp.sort ?? 'publishedAt:desc', limit: 20, offset: 0, filters: sp /* pass through Story 3.9 filter params */ }),
       ]);
       if (categoryResponse.status === 'rejected') {
         const err = categoryResponse.reason;
         if (err.tukioCode === 'CATALOG-CATEGORY-NOT-FOUND-001') notFound();
         throw err;
       }
       const category = categoryResponse.value.data;
       const listings = listingsResponse.status === 'fulfilled' ? listingsResponse.value : { data: [], pagination: { totalEstimate: 0 } };
       return (
         <>
           <ItemList jsonLd={buildItemListJsonLd(category, listings.data, locale)} />
           <CategoryLayout category={category} initialListings={listings} locale={locale} initialFilters={sp} />
         </>
       );
     }
     ```
   - **`generateMetadata`** Server function — pattern Stories 3.10/3.11 réutilisé :
     ```tsx
     export async function generateMetadata({ params }: { params: Promise<{ locale, slug }> }): Promise<Metadata> {
       const { locale, slug } = await params;
       const cat = await fetchCategory(slug, locale).catch(() => null);
       if (!cat) return { title: 'Catégorie non trouvée', robots: { index: false } };
       return {
         title: cat.data.meta_title ?? `${cat.data.name} | Tukio`,
         description: cat.data.meta_description ?? cat.data.description.slice(0, 160),
         alternates: { canonical: `https://tukio.one/${locale}/category/${slug}`, languages: buildHreflangMap(`/${locale}/category/${slug}`) },
         openGraph: { title: cat.data.name, description: cat.data.description.slice(0, 160), type: 'website' /* category image V1+ derive from listings[0].urls.detail */ },
       };
     }
     ```
   - Tests Vitest 5 scenarios (render with locale fr/en, not-found → notFound(), generateMetadata canonical + alternates, parallel fetch graceful 0 listings, ItemList JSON-LD rendered)

4. **AC4 — `<CategoryLayout>` orchestrator + 5 feature-scoped components** : Given AC3, When je consulte `apps/public/src/features/public/category/components/`, Then :
   - **NEW `CategoryLayout.tsx`** orchestrator (composes header + subcategories nav + listings section + city CTA + filter sidebar)
   - **NEW `CategoryHeaderHero.tsx`** (breadcrumb + H1 + subtitle + median badge `<PricingDisplay variant="median">` + description ReadMoreToggle)
   - **NEW `CategorySubcategoriesNav.tsx`** (grid chips horizontal scroll mobile / inline desktop — hover prefetch Story 3.9 pattern)
   - **NEW `CategoryListingsSection.tsx`** (wraps Story 3.8 `<ListingsGrid>` + Story 3.9 `<FilterSidebar>` + `<FilterDrawer>` pre-filled categorySlug)
   - **NEW `CityFilterCta.tsx`** (placeholder MVP — link to SERP filtered by city)
   - **NEW `app/[locale]/category/[slug]/[city]/page.tsx` placeholder** — calls `notFound()` immediately + custom `not-found.tsx` Story 3.12 redirect canonical + top 4 listings (réutilise pattern Story 3.10 ListingUnavailableErrorPage similar suggestions)
   - Tests `@testing-library/react` + axe-core 7 scenarios (header render with/without median, subcategories grid empty/populated, listings grid + filter sidebar integration, city placeholder CTA, 404 city subpath redirect)

5. **AC5 — UPDATE Story 0.5 `<PricingDisplay>` — add variant `"median"`** : Given Story 0.5 livré `<PricingDisplay>` (variants `compact` + `detailed`), When Story 3.12 needs median display variant, Then :
   - **UPDATE `packages/ui/src/patterns/PricingDisplay/PricingDisplay.tsx`** Story 0.5 livré — add 3ᵉ variant `"median"` :
     - Props : `{ variant: 'median', label?: string, amount: number, currency: string, unit?: string, formatMoney: (amount, currency) => string }`
     - Render : compact `<div>` avec icon `<TrendingUp>` Lucide + label "Prix médian" + amount formatté `font-tabular-nums` + unit suffix (e.g., "par jour" or "forfait" if unit hint)
     - Aria : `<span role="text" aria-label="Prix médian de la catégorie : XX euros par jour">`
   - **UPDATE Story 0.5 tests** `PricingDisplay.spec.tsx` — add 3 scenarios variant median (with unit, without unit, RGAA aria-label correct)
   - **i18n keys** `commons.pricing.medianLabel` + `commons.pricing.medianAriaFormat` × 2 locales (réutilisable Story 3.12 + V1+ pricing pages)

6. **AC6 — UPDATE Story 3.8/3.9 `<ListingCard>` — add deviation badge** : Given Story 3.8 livré atomic `<ListingCard>` + Story 3.9 livré enhancement (hover prefetch + badges DistanceBadge + CapacityBadge + ReviewsStars), When Story 3.12 ajoute deviation badge, Then :
   - **UPDATE `packages/ui/src/components/ListingCard/ListingCard.tsx`** Story 3.8/3.9 livré — add `<DeviationBadge>` rendering :
     - Props extension : reads `listing.priceDeviation` boolean + `listing.priceDeviationDirection` enum from MeilisearchListingDocument shape Story 3.7 UPDATE AC2
     - Conditional render : si `priceDeviation === true` → `<Badge variant="warning" size="sm">` Story 0.4 réutilisé :
       - `direction === 'above'` → "Prix > médiane"
       - `direction === 'below'` → "Prix < médiane"
     - Position : sous title + ville, au-dessus de PricingDisplay
     - Aria : badge has explicit aria-label for screen readers (FR32 transparence)
     - **Tooltip** : hover/focus shows `<Tooltip>` (V1+ `@radix-ui/react-tooltip` atomic — MVP simple `title=` HTML attribute) "Ce prix dévie de plus de 50% de la médiane de la catégorie"
   - **UPDATE Story 3.8/3.9 ListingCard.spec.tsx** — add 4 scenarios (deviation true above, deviation true below, deviation false hide, aria-label correct)
   - **i18n keys** `commons.listing.deviationBadge.{above,below,tooltip}` × 2 locales
   - **NOTE** : Story 3.7 MeilisearchListingDocument AC2 UPDATE ajoute `priceDeviation` + `priceDeviationDirection` fields — Story 3.12 depends on AC2

7. **AC7 — JSON-LD `ItemList` Schema.org helper — étend Story 3.10/3.11 foundation** : Given Stories 3.10/3.11 livrés `lib/schema-org/Service.tsx` + `Organization.tsx`, When Story 3.12 ajoute `ItemList.tsx`, Then :
   - **NEW** `apps/public/src/lib/schema-org/ItemList.tsx` :
     - Helper `buildItemListJsonLd(category, listings, locale)` returns `Record<string, unknown>` Schema.org ItemList spec (cf. story body section e)
     - `<ItemList jsonLd={...} />` component renders `<script type="application/ld+json">` (pattern réutilisé)
     - Top 20 ListItems max (Google indexable threshold — V1+ pagination via `partOfList` chain)
   - **Validation** : `schema-dts` v1+ type-check (Stories 3.10/3.11 dep réutilisé) + Google Rich Results Test API e2e
   - Tests Vitest 4 scenarios (valid Schema.org ItemList, listings.length=0 → empty itemListElement array, top 20 limit truncate, all listings have @type Service + provider Organization)

8. **AC8 — `@tukio/api-client` hooks `useCategoryDetail` + `useCategoryListings` (UPDATE Story 3.8 hook)** : Given AC1 + Story 3.8 livré `useSearchListings`, When Story 3.12 wires (NEW), Then :
   - **NEW hook** `packages/api-client/src/hooks/catalog/useCategoryDetail.ts` :
     ```ts
     export function useCategoryDetail(slug: string, locale: 'fr' | 'en') {
       return useSuspenseQuery({
         queryKey: ['category-detail', slug, locale],
         queryFn: () => apiClient.get<CategoryDto>(`/v1/categories/${slug}?locale=${locale}`).then(unwrapEnvelope),
         staleTime: 5 * 60 * 1000,
       });
     }
     ```
   - **REUSE Story 3.8 hook** `useSearchListings({ categorySlug: <slug>, ...filters })` — pas de new hook listing-by-category (search endpoint accepts categorySlug filter directly)
   - **Architecture line 2220** référence `useCategoryTree` hook (Story 3.1 livré or partial — Story 3.12 cleanup if needed)
   - Tests Vitest 3 scenarios

9. **AC9 — i18n FR/EN + hreflang reuse + 404 city subpath custom + métriques + tests** : Given AC1-8, When :
   - **i18n namespace `public.category.*`** ~25 keys × 2 locales :
     ```
     header.{subtitleFormat,medianBadgeLabel,medianBadgeAria,medianEmptyTitle,medianEmptyHint}
     subcategories.{ariaLabel,chipFormat,countBadge}
     listings.{title,emptyTitle,emptyHint,filterToggleLabel}
     citySubpath.{notFoundTitle,notFoundDescription,suggestionTitle,backToCategoryCta,viewByCityCta,viewByCityHint}
     breadcrumb.{home,categories,categoryName}
     ```
   - **i18n** `commons.pricing.medianLabel|medianAriaFormat` + `commons.listing.deviationBadge.{above,below,tooltip}` cross-cutting keys
   - **hreflang Story 3.9 helper réutilisé** — verify works for `/category/:slug` route (likely no change)
   - **404 city subpath** : `apps/public/src/app/[locale]/category/[slug]/[city]/page.tsx` NEW Story 3.12 placeholder file + custom `not-found.tsx` Story 3.12 (réutilise Story 3.10 pattern similar suggestions)
   - **Métriques NEW** (extend Stories 3.10/3.11) :
     - `tukio_category_views_total{locale,slug,has_median}` (counter)
     - `tukio_category_fetch_duration_seconds` (histogram — gateway parallel fetch)
     - `tukio_category_listings_with_deviation_total{direction}` (counter — analytics deviation rate FR32 monitoring)
     - `tukio_category_subcategory_chip_clicks_total{from_slug,to_slug}` (counter — UX flow)
     - `tukio_category_city_subpath_404_total{slug,city}` (counter — V1 prioritization signal — high-traffic cities deserve dedicated locale pages first)
   - **Prometheus alert** `CategoryLatencyHigh` `histogram_quantile(0.95, tukio_category_fetch_duration_seconds_bucket) > 0.300` for 5m → warning Slack
   - **Dashboard Grafana NEW** `infra/k8s/grafana-dashboards/category-page.json` (NEW Story 3.12 ~5 panels)
   - **Tests Playwright e2e** 10 scenarios :
     - T1-2 happy category FR + EN content render full
     - T3 median badge populated (≥ 5 listings) + null (< 5 listings) placeholder
     - T4 subcategories nav chips render + click navigate
     - T5 listings grid + filter sidebar pre-filled categorySlug + infinite scroll
     - T6 deviation badge warning render (above/below directions)
     - T7 JSON-LD ItemList valid (Google Rich Results Test API call OR schema-dts type-check)
     - T8 hreflang head injection + canonical
     - T9 city subpath 404 + suggestion + redirect canonical CTA
     - T10 empty category (0 listings) state + RGAA kbd nav full page + axe-core 0 violations + Lighthouse SEO ≥ 95 + Accessibility ≥ 90 (Story 0.11 CI gate)
   - **Test perf NFR3 LCP < 2,5s** : Lighthouse CI Story 0.11 assert `/fr/category/tents-marquees` (CI gate fail regression)
   - **k6 load test** GET /v1/categories/:slug + /v1/search/listings parallel p95 < 250ms
   - Coverage thresholds NFR71 (≥ 90 % critical, ≥ 85 % gateway, ≥ 80 % helpers/hooks)

## Tasks / Subtasks

- [ ] **Task 1 — UPDATE `@tukio/contracts` DTOs CategoryDto + MeilisearchListingDocument** (AC: #1, #2)
  - [ ] 1.1 — UPDATE `dtos/catalog/category.dto.ts` Story 3.1 — add medianPrice* fields
  - [ ] 1.2 — UPDATE `dtos/catalog/meilisearch-listing-document.ts` Story 3.7 — add priceDeviation + priceDeviationDirection
  - [ ] 1.3 — Tests Zod parse — happy median populated/null, deviation true/false/direction, full document shape

- [ ] **Task 2 — UPDATE catalog-svc `get-category-by-slug.usecase` + `IndexListingUseCase` + setup-indexes** (AC: #1, #2) — coverage ≥ 85 %
  - [ ] 2.1 — UPDATE `get-category-by-slug.usecase.ts` Story 3.1 — add JOIN median_price_amount + listingsCount query
  - [ ] 2.2 — UPDATE `IndexListingUseCase.buildDocument()` Story 3.7 — fetch median + compute priceDeviation + direction
  - [ ] 2.3 — Extract `computePriceDeviation` helper to `apps/catalog-svc/src/domain/service/price-deviation.service.ts` (NEW Story 3.12 — réutilisable Story 3.5 publish workflow + Story 3.7 indexer)
  - [ ] 2.4 — UPDATE `setup-indexes.ts` Story 3.7 — add priceDeviation + priceDeviationDirection filterableAttributes
  - [ ] 2.5 — Tests integration testcontainer Postgres + Meilisearch 6 scenarios AC1 + 4 scenarios AC2

- [ ] **Task 3 — UPDATE gateway-api forwarder + cache 5min** (AC: #1)
  - [ ] 3.1 — UPDATE `get-category-by-slug.forwarder.ts` Story 3.1 (minimal — DTO extended)
  - [ ] 3.2 — UPDATE cache `Cache-Control: public, max-age=300` (was 3600 Story 3.1 — fresher median)
  - [ ] 3.3 — Tests E2E gateway 6 scenarios AC1

- [ ] **Task 4 — `apps/public/src/app/[locale]/category/[slug]/page.tsx` Server Component + generateMetadata** (AC: #3)
  - [ ] 4.1 — Page.tsx Server Component + parallel fetch Promise.allSettled (category + listings)
  - [ ] 4.2 — generateMetadata Next.js 15 (réutilise meta_title + meta_description Story 3.1 livrés + Story 3.9 hreflang helper)
  - [ ] 4.3 — not-found.tsx fallback 404 (canonical category not found)
  - [ ] 4.4 — Tests Vitest 5 scenarios AC3

- [ ] **Task 5 — `<CategoryLayout>` orchestrator + 5 feature-scoped components + city subpath placeholder** (AC: #4) — coverage ≥ 90 %
  - [ ] 5.1 — `CategoryLayout.tsx` orchestrator
  - [ ] 5.2 — `CategoryHeaderHero.tsx` (breadcrumb + H1 + subtitle + median badge + description)
  - [ ] 5.3 — `CategorySubcategoriesNav.tsx` (chip grid + hover prefetch Story 3.9 pattern)
  - [ ] 5.4 — `CategoryListingsSection.tsx` (wraps Story 3.8 ListingsGrid + Story 3.9 FilterSidebar + FilterDrawer pre-filled)
  - [ ] 5.5 — `CityFilterCta.tsx` placeholder MVP
  - [ ] 5.6 — `apps/public/src/app/[locale]/category/[slug]/[city]/page.tsx` (NEW placeholder file calls notFound())
  - [ ] 5.7 — Custom `not-found.tsx` Story 3.12 (city subpath suggestion + redirect canonical + top 4 listings — réutilise pattern Story 3.10)
  - [ ] 5.8 — Tests `@testing-library/react` + axe-core 7 scenarios AC4

- [ ] **Task 6 — UPDATE Story 0.5 `<PricingDisplay>` — add variant "median"** (AC: #5)
  - [ ] 6.1 — UPDATE `packages/ui/src/patterns/PricingDisplay/PricingDisplay.tsx` Story 0.5 — add 3ᵉ variant + props
  - [ ] 6.2 — UPDATE Story 0.5 tests + add 3 scenarios variant median
  - [ ] 6.3 — i18n keys `commons.pricing.medianLabel` + `commons.pricing.medianAriaFormat` × 2 locales

- [ ] **Task 7 — UPDATE Story 3.8/3.9 `<ListingCard>` — add deviation badge** (AC: #6)
  - [ ] 7.1 — UPDATE `packages/ui/src/components/ListingCard/ListingCard.tsx` Story 3.8/3.9 — add DeviationBadge conditional render
  - [ ] 7.2 — Add HTML `title=` tooltip MVP (V1+ Radix Tooltip atomic)
  - [ ] 7.3 — UPDATE Story 3.8/3.9 tests + add 4 scenarios
  - [ ] 7.4 — i18n keys `commons.listing.deviationBadge.{above,below,tooltip}` × 2 locales

- [ ] **Task 8 — JSON-LD `ItemList` Schema.org helper — étend Stories 3.10/3.11 foundation** (AC: #7) — coverage ≥ 80 %
  - [ ] 8.1 — `apps/public/src/lib/schema-org/ItemList.tsx` (NEW Story 3.12)
  - [ ] 8.2 — Helper `buildItemListJsonLd(category, listings, locale)` + `<ItemList>` component
  - [ ] 8.3 — Validation `schema-dts` v1+ type-check + Google Rich Results Test API e2e
  - [ ] 8.4 — Tests Vitest 4 scenarios AC7

- [ ] **Task 9 — `@tukio/api-client` hook `useCategoryDetail`** (AC: #8) — coverage ≥ 80 %
  - [ ] 9.1 — `packages/api-client/src/hooks/catalog/useCategoryDetail.ts` (NEW)
  - [ ] 9.2 — REUSE Story 3.8 `useSearchListings` for listings-by-category (no new hook)
  - [ ] 9.3 — Tests Vitest 3 scenarios

- [ ] **Task 10 — i18n FR/EN + hreflang reuse + 404 city subpath custom** (AC: #9)
  - [ ] 10.1 — `apps/public/messages/{fr,en}.json` namespaces public.category.* + commons.pricing.* + commons.listing.deviationBadge.*
  - [ ] 10.2 — CI check `pnpm i18n:audit` Story 0.9 réutilisé
  - [ ] 10.3 — Verify Story 3.9 hreflang.ts helper works for `/category/:slug`

- [ ] **Task 11 — Métriques + Prometheus alerts + Grafana dashboard** (AC: #9)
  - [ ] 11.1 — 5 nouvelles métriques (cf. AC9) instrumentées
  - [ ] 11.2 — Prometheus alert `CategoryLatencyHigh` `infra/k8s/prometheus-rules/category-page.yaml` (NEW)
  - [ ] 11.3 — Dashboard Grafana `category-page.json` (NEW ~5 panels)

- [ ] **Task 12 — Tests Playwright e2e 10 scenarios + Lighthouse CI + k6 perf** (AC: #9)
  - [ ] 12.1 — `apps/public/e2e/category/category-page.spec.ts` (NEW 10 tests AC9)
  - [ ] 12.2 — Lighthouse CI Story 0.11 update — add `/fr/category/tents-marquees` budgets SEO ≥ 95 + LCP < 2,5s + Accessibility ≥ 90
  - [ ] 12.3 — k6 load test `infra/k6/category-page.k6.js` (NEW — 30 req/s × 5min, p95 < 250ms)
  - [ ] 12.4 — Coverage thresholds enforced NFR71

- [ ] **Task 13 — Documentation + commit**
  - [ ] 13.1 — Runbook `docs/runbook/category-page-debug.md` (NEW Story 3.12 ~25 lignes — debugging median cache + Meilisearch facets + deviation indexer drift)
  - [ ] 13.2 — UPDATE `docs/project-context.md` section "Category Page (Story 3.12)"
  - [ ] 13.3 — Commit `feat(public,catalog,gateway,api-client,ui): Story 3.12 category page + median price display PricingDisplay variant + listing deviation badge FR32 + JSON-LD ItemList Schema.org + city subpath 404 placeholder V1`

## Dev Notes

### Pourquoi Story 3.12 close Epic 3 MVP

Story 3.12 est la **dernière story Epic 3 MVP** — clôture le funnel **Visitor browse** : home → category → SERP filtered → listing detail → reserve (Epic 4). C'est aussi la **page-clé SEO long-tail** via Google "location chapiteau Loire-Atlantique" → category page → listing detail → conversion. Pattern réutilisé Stories 3.10/3.11 (Server Component RSC + JSON-LD Schema.org + hreflang + locale fallback) + extensions critiques :
- **`<PricingDisplay variant="median">`** Story 0.5 UPDATE — FR31 transparence client (prix médian visible, sans identifier Pros sources)
- **`<ListingCard>` deviation badge** Story 3.8/3.9 UPDATE — FR32 transparence Visitor + UX éducative (alerter sur prix qui dévient)
- **JSON-LD `ItemList`** — 3ᵉ Schema.org pattern foundation après Service (Story 3.10) + Organization (Story 3.11) — completes le triptyque public pages SEO. Story 7.8 future systématise BreadcrumbList + LocalBusiness + AggregateRating.
- **City subpath 404 placeholder** — anticipe FR22 V1+ pages locales auto-générées (RA1 SEO long-tail) — MVP gracieux dégradement.

### Décisions techniques majeures actées

1. **REUSE Story 3.8 `GET /v1/search/listings?categorySlug=<slug>`** (vs new endpoint dédié) — pas de duplication endpoint. Server Component fait parallel fetch : category metadata + search filtered. Avoids backend code duplication + UI consistency (mêmes filtres, mêmes pagination, mêmes facets que SERP).

2. **UPDATE Story 3.1 CategoryDto** — ajoute `medianPriceAmountCents` + `medianPriceCurrency` + `medianPriceUnit` fields. Story 3.5 livre déjà la donnée DB (`category.median_price_amount` populated par cron daily). Story 3.12 expose via DTO + UI.

3. **UPDATE Story 3.7 MeilisearchListingDocument** — ajoute `priceDeviation` + `priceDeviationDirection` fields computed at index time. Pattern Story 3.9 `capacityBucket` réutilisé. Trade-off : stale up to 1h (boot cache median) ou index-time fetch (perf overhead +30ms/indexation). MVP : cache median 1h au boot Story 3.7 indexer service. V1+ : NATS event listener `catalog.medians.computed.v1` Story 3.5 → invalidate cache + re-index affected listings.

4. **`<PricingDisplay variant="median">`** Story 0.5 UPDATE (vs new component) — single source of truth pour pricing display. Pattern Story 0.5 atomic extensible.

5. **`<ListingCard>` deviation badge** Story 3.8/3.9 UPDATE (vs feature-scoped) — badge cross-cutting réutilisable Stories Epic 3 search + category + Story 5.7 reviews context filtering V1+.

6. **404 city subpath MVP** — Next.js `notFound()` + custom `not-found.tsx` réutilise Story 3.10 ListingUnavailableErrorPage pattern (rename Story 3.11 ErrorPage entity-unavailable generic). Coût Story 3.12 : 1 placeholder file + custom not-found copy. Gain V1+ : FR22 pages locales auto-générées plug seamlessly without breaking change.

7. **Server Component RSC `dynamic = 'force-dynamic'` MVP** — pattern Stories 3.10/3.11 réutilisé. **V1+ peut explorer ISR `revalidate = 600`** (10 min) car category metadata + median changent peu (cron daily). Décision réversible.

8. **JSON-LD ItemList top 20** — Google indexable threshold pratique. V1+ peut chain via `partOfList` pour pagination > 20.

9. **EN strict + i18n + RGAA AA + latest stable versions + Clean Architecture + Envelope ADR-014** memories — toutes respectées.

10. **No backwards compatibility hacks** — UPDATE patterns directs, fresh code path.

11. **Cache HTTP réduit max-age=300 (vs 3600 Story 3.1)** — balance UX (fresh median post-cron) + perf (CDN Vercel edge cache toujours efficace).

12. **price-deviation.service.ts shared helper** — extracted from Story 3.5 publication service for reuse by Story 3.7 indexer. Pattern Clean Architecture domain service réutilisé.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `next` | Next.js 15 metadata API + Server Components + notFound() | (Sprint 0 already) | force-dynamic MVP, ISR V1+ |
| `next-intl` | i18n | (Sprint 0 already) | namespace public.category.* + commons.pricing.* + commons.listing.deviationBadge.* |
| `@tanstack/react-query` | hooks `useCategoryDetail` + `useSearchListings` reuse Story 3.8 | (Story 0.9 already) | useSuspenseQuery SSR |
| `schema-dts` | JSON-LD type-check | (Stories 3.10/3.11 already) | Réutilisé ItemList type-check |
| `web-vitals` | LCP/INP/CLS reporting | (Stories 3.10/3.11 already) | Tukio Prometheus ingest |
| `@radix-ui/react-tooltip` | DeviationBadge tooltip V1+ | latest stable v1+ | MVP : simple HTML `title=` attribute |

### Project Structure cible

```
# ====== NEW Story 3.12 ======

apps/public/src/
├─ app/[locale]/category/[slug]/
│  ├─ page.tsx                                                              # NEW Server Component + generateMetadata
│  ├─ not-found.tsx                                                         # NEW (404 generic category not-found)
│  └─ [city]/
│     ├─ page.tsx                                                           # NEW (calls notFound() — placeholder MVP)
│     └─ not-found.tsx                                                      # NEW custom — city subpath suggestion redirect canonical + top 4 listings
├─ features/public/category/
│  └─ components/
│     ├─ CategoryLayout.tsx + spec                                          # NEW orchestrator
│     ├─ CategoryHeaderHero.tsx + spec                                      # NEW (breadcrumb + H1 + subtitle + median badge + description)
│     ├─ CategorySubcategoriesNav.tsx                                       # NEW (chip grid + hover prefetch)
│     ├─ CategoryListingsSection.tsx                                        # NEW (wraps Story 3.8 + 3.9 components)
│     └─ CityFilterCta.tsx                                                  # NEW (placeholder MVP)
├─ lib/schema-org/
│  └─ ItemList.tsx + spec                                                   # NEW Story 3.12 — étend Stories 3.10/3.11 foundation
└─ messages/{fr,en}.json                                                    # UPDATE — namespaces public.category.* + commons.pricing.* + commons.listing.deviationBadge.*

packages/api-client/src/hooks/catalog/
└─ useCategoryDetail.ts + spec                                              # NEW Story 3.12

apps/catalog-svc/src/
├─ domain/service/price-deviation.service.ts                                # NEW Story 3.12 — extracted shared helper (réutilisé Story 3.5 + Story 3.7)
├─ usecases/get-category-by-slug.usecase.ts                                 # UPDATE Story 3.1 — add JOIN median + listingsCount
└─ usecases/index-listing.usecase.ts                                        # UPDATE Story 3.7 — fetch median + compute priceDeviation + direction

infra/meilisearch/setup-indexes.ts                                          # UPDATE Story 3.7 — add priceDeviation + direction filterableAttributes

packages/contracts/src/dtos/catalog/
├─ category.dto.ts                                                          # UPDATE Story 3.1 — add medianPrice* fields
└─ meilisearch-listing-document.ts                                          # UPDATE Story 3.7 — add priceDeviation + priceDeviationDirection

apps/gateway-api/src/usecases/catalog/get-category-by-slug.forwarder.ts     # UPDATE Story 3.1 — minimal (DTO extended)

packages/ui/src/
├─ patterns/PricingDisplay/PricingDisplay.tsx                               # UPDATE Story 0.5 — add variant "median"
└─ components/ListingCard/ListingCard.tsx                                   # UPDATE Story 3.8/3.9 — add DeviationBadge

apps/public/e2e/category/category-page.spec.ts                              # NEW 10 tests AC9

infra/k8s/prometheus-rules/category-page.yaml                               # NEW
infra/k8s/grafana-dashboards/category-page.json                             # NEW (~5 panels)
infra/k6/category-page.k6.js                                                # NEW

docs/runbook/category-page-debug.md                                         # NEW (~25 lignes)
docs/project-context.md                                                     # UPDATE — section "Category Page (Story 3.12)"

# Estimation : ~22 nouveaux + ~9 updates = ~31 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.4 (atomics Badge), 0.5 (patterns PricingDisplay UPDATE variant median + EmptyState reuse), 0.9 (TanStack Query + i18n CI), 0.11 (Lighthouse CI gates), 3.1 (catalog-svc baseline + Category data model + category_translations + GET /v1/categories/:slug — UPDATE), 3.2 (catalog-svc Pretre), 3.5 (median price compute + cron + `priceDeviation` computed publish time — extract helper Story 3.12), 3.7 (Meilisearch indexer per locale — UPDATE MeilisearchListingDocument + setup-indexes), 3.8 (search frontend + ListingCard + ListingsGrid réutilisés), 3.9 (FilterSidebar + FilterDrawer pre-filled + hreflang helper + ListingCard enhancement — UPDATE ListingCard deviation badge), 3.10 (Server Component RSC + JSON-LD Service foundation + 410 Gone Next.js 15 pattern), 3.11 (Server Component + JSON-LD Organization foundation + ErrorPage rename entity-unavailable generic).

1. **API responses envelope ADR-014** — Story 3.12 réutilise endpoints Story 3.1 + 3.8 wrapped envelope. Pas de nouveau error code MVP (404 natif Next.js category not-found, pas de Tukio code dédié).

2. **EN strict path URLs (`/category/<slug>`) + slugs EN (override K-05 + memory)** — `/fr/category/tents-marquees` not `/fr/categorie/chapiteaux`. Memory feedback_tech_layer_english respect strict.

3. **i18n FR/EN frontend + RGAA AA + latest stable versions + Clean Architecture + Cross-svc boundary** memories — toutes respectées.

4. **NFR1 RGPD transparence médiane anonymisée** (Story 3.5 livré threshold ≥ 5 listings) — Story 3.12 UI display respect : si median null → empty state placeholder explicit (pas d'identification Pros sources individuels).

5. **NFR3 LCP < 2,5s** — page mostly static markup + hero image V1+.

6. **NFR5 Core Web Vitals SEO** — Lighthouse SEO ≥ 95 via JSON-LD ItemList + canonical + OG + hreflang systematic.

7. **NFR47 prefers-reduced-motion** respecté (no animations specific Story 3.12 — subcategories nav scroll natif).

8. **NFR58 hreflang systematic** — Story 3.9 helper réutilisé.

9. **NFR71 coverage thresholds** — ≥ 90 % critical, ≥ 85 % gateway, ≥ 80 % helpers/hooks.

10. **FR31 transparence médiane** — display public sans identifier sources. **FR32 transparence price deviation** — badge warning visible Visitor.

### Previous Story Intelligence

**Story 0.4 (atomic Badge)** : réutilisé pour DeviationBadge + medianBadge.

**Story 0.5 (patterns PricingDisplay + EmptyState + ErrorPage)** : Story 3.12 UPDATE PricingDisplay (variant median). Réutilise EmptyState (variants placeholder Story 3.10 + reviews-empty). Réutilise ErrorPage entity-unavailable Story 3.11 pattern indirect (city subpath custom not-found uses similar UX).

**Story 0.9 (TanStack Query + i18n CI)** : infrastructure réutilisée.

**Story 0.11 (Lighthouse CI + axe-core)** : Story 3.12 ajoute `/fr/category/tents-marquees` aux budgets SEO + LCP + Accessibility gates.

**Story 3.1 (catalog data model + GET /v1/categories/:slug + category_translations + meta_title + meta_description)** : Story 3.12 UPDATE CategoryDto + use case (add medianPrice fields + listingsCount real-time). **READ Story 3.1 livré file complet avant modification** — patterns ADR + invariants + tests à preserve.

**Story 3.5 (publish workflow + median price compute + cron daily + priceDeviation field publish-time)** : Story 3.12 consume `category.median_price_amount` DB field + extract `computePriceDeviation` helper to shared service for Story 3.7 indexer reuse.

**Story 3.7 (Meilisearch indexer + IndexListingUseCase + MeilisearchListingDocument shape + setup-indexes + reconcile cron)** : Story 3.12 UPDATE doc shape + indexer (add priceDeviation field at index time). Pattern Story 3.9 `capacityBucket` computed field réutilisé.

**Story 3.8 (search frontend + ListingCard atomic + ListingsGrid + endpoint `GET /v1/search/listings`)** : Story 3.12 RÉUTILISE l'endpoint avec `categorySlug` filter param (no new endpoint). REUSE ListingsGrid + ListingCard.

**Story 3.9 (FilterSidebar + FilterDrawer + hreflang helper + ListingCard enhancement + facets)** : Story 3.12 UPDATE ListingCard (deviation badge). REUSE FilterSidebar + FilterDrawer pre-filled categorySlug (Story 3.12 passe categorySlug fixed param). REUSE hreflang helper.

**Story 3.10 (Server Component RSC + JSON-LD Service foundation `lib/schema-org/Service.tsx` + 410 Gone pattern + similar listings + ErrorPage variant — Story 3.11 rename entity-unavailable generic)** : Story 3.12 réutilise Server Component pattern + étend JSON-LD foundation `lib/schema-org/` avec ItemList.tsx + réutilise pattern custom not-found avec suggestions Story 3.10 (city subpath 404 mirror).

**Story 3.11 (Server Component + JSON-LD Organization foundation + ProUnavailableErrorPage + ErrorPage rename)** : Story 3.12 réutilise pattern Server Component RSC + étend `lib/schema-org/` avec ItemList.tsx (3ᵉ Schema.org pattern foundation triptyque public pages MVP).

### What this story does NOT do

- ❌ **Pages locales catégorie × ville auto-générées** (FR22 V1+ — RA1 SEO long-tail) — Story 3.12 livre 404 placeholder + suggestion. V1+ Story 7.x implémente vraies pages avec ranking + filters.
- ❌ **Saved category favorites** — V1+ Story 11.x notifications.
- ❌ **Category-specific filters** (e.g., chapiteaux specific filters comme "capacité ≥ 50 pers") — Story 3.9 livre filters génériques cross-categories. V1+ peut introduire category-specific filter sets.
- ❌ **Subcategory page distincte** — Story 3.12 réutilise même page template (recursive) pour root + subcategories. V1+ peut customiser per-category-depth si UX justifie.
- ❌ **Category banner hero image** — MVP H1 text + description. V1+ peut ajouter hero image curated per-category Story 7.3 SEO foundation.
- ❌ **Average price** + autres stats (vs median seulement) — V1+ Story 9.x analytics. Median est le statistique robuste anti-outliers MVP.
- ❌ **Multi-listing-status filter** (draft, pending_moderation) — Visitor public ne voit que published. Admin Epic 6 a son propre moderation queue page.
- ❌ **Category create/edit UI admin** — V1+ Story 6.8 taxonomy editor admin. MVP : `pnpm seed:categories` Story 3.1 + data model ready.
- ❌ **Subcategory listingsCount accurate real-time** — V1+ cron-populated. MVP : hide badge si count==0 (DB field absent).

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 3.12` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :
1. `apps/catalog-svc/src/usecases/get-category-by-slug.usecase.ts` Story 3.1 — add JOIN median_price + listingsCount
2. `apps/catalog-svc/src/usecases/index-listing.usecase.ts` Story 3.7 — fetch median + compute deviation
3. `infra/meilisearch/setup-indexes.ts` Story 3.7 — add filterableAttributes
4. `packages/contracts/src/dtos/catalog/category.dto.ts` Story 3.1 — add fields
5. `packages/contracts/src/dtos/catalog/meilisearch-listing-document.ts` Story 3.7 — add fields
6. `apps/gateway-api/src/usecases/catalog/get-category-by-slug.forwarder.ts` Story 3.1 — minimal (DTO extended) + cache max-age=300
7. `packages/ui/src/patterns/PricingDisplay/PricingDisplay.tsx` Story 0.5 — add variant "median"
8. `packages/ui/src/components/ListingCard/ListingCard.tsx` Story 3.8/3.9 — add DeviationBadge
9. `apps/public/messages/{fr,en}.json` — namespaces additions
10. `apps/public/e2e/lighthouse.config.{ts,js}` Story 0.11 — add `/fr/category/tents-marquees` budgets

**Lire l'état complet de chaque UPDATE file avant édition** — PricingDisplay.tsx notamment (preserve 2 variants existing compact + detailed + tests), ListingCard.tsx (preserve Story 3.8/3.9 enhancements DistanceBadge + CapacityBadge + ReviewsStars + hover prefetch).

### Testing Standards

- Coverage ≥ 90 % `CategoryLayout` + `CategoryHeaderHero`
- Coverage ≥ 85 % gateway forwarder UPDATE + catalog-svc use case UPDATE + indexer UPDATE
- Coverage ≥ 80 % `schema-org/ItemList.tsx` + hreflang reuse + api-client hooks + price-deviation.service.ts
- E2E Playwright FR/EN axe-core 0 violations 10 tests AC9
- k6 load test : p95 < 250ms gateway parallel fetch (category + listings)
- Lighthouse CI Story 0.11 : SEO ≥ 95, Accessibility ≥ 90, LCP < 2,5s gate
- Schema.org validation : `schema-dts` v1+ type-check OR Google Rich Results Test API e2e

### Project Structure Notes

✅ **Aligné** architecture.md (`features/catalog/` line 2101 — Story 3.12 utilise `features/public/category/` aligned avec convention Stories 3.8/3.9/3.10/3.11), `app/[locale]/category/[slug]/page.tsx` (line 2090) + `app/[locale]/category/[slug]/[city]/page.tsx` (line 2091 V1) ✅ aligné. ADR-014 envelope + ADR-013 multi-zones + feature-based + Clean Architecture + cross-svc boundary. PRD §FR22 (page catégorie MVP), §FR31 (median price transparence), §FR32 (deviation transparence), §FR98 (URLs locale), §FR115 (sitemap V1), §FR116 (JSON-LD ItemList), §NFR1 (RGPD anonymisation), §NFR3/5/47/58/71. UX spec patterns réutilisés. Memories.

⚠️ **Déviations** : aucune significative. Convention `features/public/<feature>/` continue Stories 3.8-3.11 (vs architecture `features/<feature>/`).

⚠️ **Décisions clés Story 3.12** :
- REUSE Story 3.8 search endpoint avec categorySlug filter (no duplication)
- UPDATE Story 3.1 CategoryDto add median fields (rather than separate endpoint)
- Extract `price-deviation.service.ts` shared helper (réutilisé Stories 3.5 + 3.7)
- UPDATE Story 0.5 PricingDisplay + Story 3.8/3.9 ListingCard generic (réutilisables cross-stories)
- 404 city subpath custom not-found avec top 4 suggestions (anticipates V1 FR22)
- JSON-LD ItemList top 20 limit (Google indexable threshold)
- Cache 5min (vs 3600s Story 3.1) — balance fresh median vs perf
- Indexer median cache 1h at boot (vs N+1 fetch per indexation)

### References

- [Source: epics.md#Epic-3-Story-3.12 — Lines 1567-1581]
- [Source: prd.md#FR22 (page catégorie MVP), #FR31 (median transparence), #FR32 (deviation transparence), #FR98 (URLs locale), #FR115-116 (sitemap+JSON-LD), #NFR1 (RGPD anonymisation), #NFR3 (LCP), #NFR5 (SEO), #NFR47 (motion), #NFR58 (hreflang), #NFR71 (coverage)]
- [Source: ux-design-specification.md — UX-DR `category` page (gap MVP — pas figé bundle, design pattern dérivé `search.jsx` + `service.jsx`) + composants atomic/pattern + UX patterns + RGAA AA]
- [Source: architecture.md — ADR-014 envelope, ADR-013 multi-zones, project structure `app/[locale]/category/[slug]/page.tsx` line 2090 + `[city]/page.tsx` line 2091 V1, `features/catalog/` line 2101, JSON-LD pattern foundation line 2115]
- [Source: Stories 0.4 (atomics), 0.5 (PricingDisplay UPDATE + EmptyState reuse), 0.9 (TanStack/i18n), 0.11 (Lighthouse CI), 3.1 (catalog data model + categories endpoint — UPDATE), 3.2 (catalog-svc Pretre), 3.5 (median compute + cron + deviation field — extract helper), 3.7 (Meilisearch indexer — UPDATE document shape + indexer + setup-indexes), 3.8 (search frontend + ListingCard + ListingsGrid réutilisés), 3.9 (FilterSidebar + FilterDrawer + hreflang + ListingCard — UPDATE DeviationBadge), 3.10 (Server Component + JSON-LD Service foundation + 410 Gone pattern), 3.11 (Server Component + JSON-LD Organization foundation + ErrorPage entity-unavailable generic)]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(points d'attention pour Story 7.3 (sitemap.xml dynamique — category URLs ajouter au sitemap), Story 7.8 (SEO foundation — Story 3.12 livre 3ᵉ Schema.org pattern triptyque MVP, Story 7.8 systématise BreadcrumbList + LocalBusiness + AggregateRating cross-pages), Story 6.8 V1+ (admin taxonomy editor — backend ready Story 3.1, UI admin V1+), Story 11.x V1+ (saved category favorites + notifications nouvelles fiches), Stories 7.x V1 FR22 (pages locales catégorie × ville auto-générées — Story 3.12 livre 404 placeholder, Story V1 plug seamless avec page réelle), Stories Epic 9 V1+ (subscription tiers — peuvent gating premium categories ou listing positioning V2+), Stories Epic 4 (booking — Story 3.12 listings cards click → service detail Story 3.10 → checkout funnel Epic 4))

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-14
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP) — **DERNIÈRE STORY EPIC 3**
- **Sprint cible** : Sprint 4 (12ᵉ et dernière story Epic 3 MVP — funnel browse-by-category close)
- **Estimation effort** : 3-4 jours (1 dev fullstack — 5 composants frontend NEW + JSON-LD ItemList helper + 1 shared service backend extracted + UPDATE 9 files (Story 3.1 CategoryDto/use case + Story 3.7 MeilisearchListingDocument/indexer/setup-indexes + Story 0.5 PricingDisplay + Story 3.8/3.9 ListingCard + gateway forwarder + lighthouse config) + 10 e2e + Lighthouse CI gate + k6 perf + 1 runbook, ~31 fichiers)
- **Dépendances upstream** :
  - Stories 0.4, 0.5, 0.9, 0.11 (atomics + patterns — UPDATE PricingDisplay + i18n CI + Lighthouse)
  - Stories 3.1 (catalog data model + categories endpoint — UPDATE), 3.2 (catalog-svc Pretre baseline), 3.5 (median compute cron + deviation field publish-time — extract helper), 3.7 (Meilisearch indexer + MeilisearchListingDocument shape — UPDATE), 3.8 (search frontend + ListingCard + ListingsGrid réutilisés), 3.9 (FilterSidebar + FilterDrawer + hreflang helper + ListingCard enhancement — UPDATE DeviationBadge), 3.10 (Server Component + JSON-LD foundation), 3.11 (Server Component + JSON-LD Organization extends foundation + ErrorPage entity-unavailable generic)
- **Dépendances downstream** :
  - Story 7.3 (sitemap.xml dynamique — category URLs)
  - Story 7.8 (SEO foundation — pattern Schema.org triptyque complet, systématise BreadcrumbList + LocalBusiness + AggregateRating)
  - Story 6.8 V1+ (admin taxonomy editor — backend ready, UI admin V1+)
  - Stories 7.x V1 FR22 (pages locales catégorie × ville — 404 placeholder Story 3.12 → pages réelles)
  - Stories Epic 4 (booking funnel — listings cards click → service detail → checkout)
  - Stories 11.x V1+ (saved favorites + notifications nouvelles fiches)
- **FRs covered** :
  - **FR22 partial** ✅ Visitor peut consulter une page catégorie générale (page locale × ville V1+ déferré)
  - **FR31** ✅ Affichage prix médian catégorie (transparence client + RGPD anonymisation threshold ≥ 5 listings Story 3.5)
  - **FR32** ✅ Badge "Prix dévie" warning sur ListingCard (transparence Visitor + UX éducative)
  - **FR98** ✅ URL locale-prefixée + hreflang systématique
  - **FR116** ✅ JSON-LD ItemList Schema.org auto
- **NFRs touchés** :
  - **NFR1** ✅ RGPD transparence médiane anonymisée (threshold ≥ 5)
  - **NFR3** ✅ LCP < 2,5s
  - **NFR5** ✅ Core Web Vitals SEO (Lighthouse SEO ≥ 95 gate)
  - **NFR47** ✅ prefers-reduced-motion respect
  - **NFR58** ✅ hreflang systematic
  - **NFR71** ✅ coverage thresholds

> **Prochaine story → Story 4.1** (booking-svc Pretre + saga state machine — Epic 4 ouverture booking funnel). **Epic 3 MVP done après Story 3.12 implementation + 3 retros + Stories 0.11/0.12/0.13 + Stories 1.x/2.x dev cycles.**

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.4/0.5/0.9/0.11/3.1/3.2/3.5/3.7/3.8/3.9/3.10/3.11 implémentées (sprint-status.yaml)
3. Lire l'état complet de chaque UPDATE file avant édition (cf. section "Files to UPDATE vs CREATE")
4. Implémenter Tasks 1-13 dans l'ordre (DTOs → catalog-svc use cases UPDATE + extract helper → gateway forwarder → Server Component page.tsx → composants feature-scoped → UPDATE PricingDisplay variant median → UPDATE ListingCard deviation badge → JSON-LD ItemList → api-client hook → i18n + hreflang reuse + 404 city subpath → métriques → tests + Lighthouse + k6 → runbook + commit)
5. Lancer `pnpm playwright test --grep "category page"` après chaque jalon + Lighthouse CI assert SEO ≥ 95 + LCP < 2,5s + k6 perf p95 < 250ms
6. Commit Story 3.12 quand : 10/10 e2e + coverage NFR71 thresholds + axe-core 0 violations + Lighthouse SEO ≥ 95 + Accessibility ≥ 90 + LCP < 2,5s + JSON-LD ItemList Schema.org valid (Google Rich Results Test pass) + k6 p95 < 250ms + hreflang head verified + 404 city subpath custom suggestion verified + median badge + deviation badge visual QA in real browser FR/EN
7. Update sprint-status : `3-12-category-general-page-median-price-display: review` puis `done`. **Once Story 3.12 done + 3 retros, flag `epic-3: done` manually** (Epic transitions in-progress → done manual per sprint-status workflow notes).
