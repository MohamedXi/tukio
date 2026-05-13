# Story 3.10: Listing detail public page (fiche service complète) — FR20

Status: ready-for-dev

## Story

**As a** Visitor (B2C particulier ou Pro découvrant la marketplace) qui clique une `<ListingCard>` Story 3.8 sur `/{locale}/search?...` ou Story 3.12 `/{locale}/category/<slug>` ou Story 3.11 `/{locale}/pro/<slug>`,
**I want** atterrir sur la fiche détail complète d'un service (`/{locale}/services/<slug>`) — Server Component RSC dynamic rendering Next.js 15 — qui reproduit le bundle Cloud Design figé `screens/service.jsx` :
- (a) **`<PhotoGallery>`** hero (NEW Story 3.10 pattern feature-scoped — peut migrer vers `packages/ui/patterns/` V1+ si réutilisé Stories Epic 5 reviews multi-photos ou Stories Epic 11 V1+ favoris) :
  - **Mobile** (< `md` = 0-1024px) : slider horizontal `embla-carousel-react` v8+ (latest stable — Tailwind v4 + RGAA kbd nav + touch swipe natif + `prefers-reduced-motion` respect) avec hero photo `urls.detail` Story 3.4 `<picture>` srcset AVIF/WebP/JPG `fetchpriority="high"` + dots indicators + counters "1/8" + lazy-load photos non-visibles
  - **Desktop** (`md+` = 1025px+) : layout mosaic à la Airbnb — 1 hero gauche 60% width + 2x2 grid droite 40% width des 4 photos suivantes + CTA "Voir les X photos" → modale `<Dialog>` `@radix-ui/react-dialog` Story 3.6/3.9 pattern réutilisé (zoom + carousel keyboard nav)
  - Hero photo **preload via `<link rel="preload" as="image">` injected dans `<head>` Server Component** → LCP candidate NFR3 < 2,5s mesuré Lighthouse CI Story 0.11
- (b) **`<ListingHeader>`** (NEW Story 3.10 feature-scoped) : Breadcrumb `Accueil > Catégorie > Service` (NFR58 hreflang propagated) + H1 Fraunces `text-4xl` (font-display) + `<Badge variant="muted">Available in French only</Badge>` rendu conditionnel si `meta.fallbackUsed === true && locale === 'en'` (FR99/FR100/FR100 — pattern Story 5.9 future UI definitive, Story 3.10 livre le badge mécanique) + ville + catégorie + reviews mini-summary (rating + count) si `reviews.aggregates.count > 0` else hidden MVP (Story 5.5 V1+ populate)
- (c) **`<PricingSection>`** (NEW feature-scoped) wraps `<PricingDisplay>` Story 0.5 atomique réutilisé avec items selon `listing.pricing.mode` :
  - **Mode `unit`** : 1 ligne label `pricing.unit` (e.g., "par jour", "par personne") + amount formatté `formatMoney(pricing.amount, pricing.currency)` font-tabular-nums + sous-texte gris "À partir de" si `pricing.minQuantity > 1`
  - **Mode `package`** : 1 ligne label "Forfait" + amount + sous-texte `pricing.packageDescription` (max 200 chars truncated avec "Lire la suite" toggle)
- (d) **`<DeliveryAndLeadTimeSection>`** (NEW feature-scoped) :
  - **Zone livraison** : icône `<MapPin>` Lucide + texte "Zone de livraison : {radius} km autour de {origin postal code → city resolved Story 3.8 PostalCodeCityResolverService réutilisé}" + map placeholder V1 `<Placeholder>` Story 0.4 atomique réutilisé avec label "Carte zone livraison (V1)"
  - **Délai minimum** : icône `<Clock>` Lucide + texte "Délai minimum : {minLeadTimeDays} jour(s) avant l'événement"
- (e) **`<DescriptionSection>`** (NEW feature-scoped) : H2 "Description" + `<article>` prose Tailwind Typography `prose-charcoal max-w-none` content `listing.description.getFor(locale)` (rendered as plain text MVP — Story 3.3 wizard textarea text-only, V1+ markdown editor) avec `<ReadMoreToggle>` si content.length > 500 chars
- (f) **`<CancellationPolicySection>`** (NEW feature-scoped) : H2 "Politique d'annulation" + récap copy MVP générique (V1+ per-listing customizable Epic 9 subscription tiers) :
  ```
  - Annulation gratuite jusqu'à 7 jours avant l'événement (remboursement intégral)
  - Annulation 3-7 jours avant : remboursement 50%
  - Annulation < 3 jours : aucun remboursement (sauf cas force majeure Epic 10 V1)
  ```
  Avec link "En savoir plus" → `/{locale}/help/cancellation-policy` (Story 7.9 legal pages future)
- (g) **`<AvailabilitySection>`** placeholder V1 (FR28 calendrier dispo) : H2 "Disponibilité" + `<EmptyState variant="placeholder">` Story 0.5 atomic réutilisé avec icône `<Calendar>` Lucide + label "Disponibilité en temps réel disponible prochainement (V1)" + sous-texte "Pour vérifier, contactez le pro après réservation" — MVP no real calendar (Epic 4 booking livre availability check côté backend race conditions, Story 3.10 MVP livre le placeholder UI)
- (h) **`<ReviewsSection>`** (NEW feature-scoped) wraps `<ReviewsDisplay>` Story 0.5 atomique pattern :
  - **MVP placeholder** : `reviews.aggregates.count === 0` (data Story 5.5 V1 populates) → `<EmptyState variant="reviews-empty">` Story 0.5 réutilisé "Aucun avis encore — soyez le premier !"
  - **V1+ active** : `<ReviewsDisplay rating={...} count={...} breakdown={...} reviews={sample}>` avec CTA "Voir tous les avis" si `count > 10` → modale ou page dédiée `/{locale}/services/<slug>/reviews` V1+ (Story 3.10 MVP livre le wrapper qui rend l'EmptyState placeholder ou ReviewsDisplay selon data — toggle automatique au futur populate Story 5.5 sans code change frontend)
- (i) **`<CtaReserveSticky>`** (NEW feature-scoped) : CTA primaire "Réserver" `<Button variant="primary" size="lg">` Story 0.5 :
  - **Desktop** (`md+`) : sticky right sidebar `position: sticky; top: 80px` (sous TopBar) dans une `<Card>` avec récap mini-pricing + dates picker placeholder (V1+ — MVP date input simple link to `/cart`) + CTA "Réserver maintenant"
  - **Mobile** (< `md`) : `position: fixed; bottom: 0` floating bar full-width avec mini-pricing + CTA — patterns `prefers-reduced-motion` respect, `aria-label` explicit "Réserver ce service"
  - **MVP behavior** : click → `router.push('/{locale}/cart?listingId={id}&slug={slug}')` placeholder Epic 4 future cart implementation (Story 4.3 livre cart UI réel, Story 3.10 MVP livre le CTA → route placeholder qui affichera la page cart Story 4.3 future)
- (j) **JSON-LD `Service` schema.org** (FR116) — NEW Story 3.10 helper `apps/public/src/lib/schema-org/Service.tsx` (NEW pattern réutilisable Stories 7.8 SEO foundation V1, Stories 3.11/3.12 future pro-profile/category-page Schema.org variants) :
  ```jsonld
  {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "<listing.title.getFor(locale)>",
    "description": "<listing.description.getFor(locale)>",
    "image": ["<photo.urls.detail>", ...],
    "provider": { "@type": "Organization", "name": "<pro.name>", "url": "https://tukio.one/{locale}/pro/<pro.slug>" },
    "offers": { "@type": "Offer", "price": "<pricing.amount / 100>", "priceCurrency": "<pricing.currency>", "availability": "https://schema.org/InStock" },
    "aggregateRating": <reviews.aggregates.count > 0 ? { "@type": "AggregateRating", "ratingValue": "<avg>", "reviewCount": "<count>" } : undefined>,
    "areaServed": { "@type": "Place", "name": "<city name resolved>", "geo": { "@type": "GeoCircle", "geoRadius": "<deliveryRadiusKm>km" } }
  }
  ```
  Injected via `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />` dans Server Component (Next.js 15 metadata API ne supporte pas natif application/ld+json, donc `<script>` direct dans tree JSX)
- (k) **NFR58 hreflang systematic** (réutilise Story 3.9 helper `apps/public/src/lib/hreflang.ts`) → `generateMetadata` Server Component returns `alternates: { canonical: ..., languages: { fr: ..., en: ..., 'x-default': ... } }` Next.js 15 metadata API
- (l) **`<ListingUnavailableErrorPage>`** (NEW feature-scoped) — Next.js 15 `error.tsx` + `not-found.tsx` patterns :
  - **Backend signals unavailable** : `GET /v1/services/<slug>` returns 410 Gone enveloppe avec `error.tukioCode = 'CATALOG-LISTING-UNPUBLISHED-001'` (si status='unpublished') ou `'CATALOG-LISTING-DELETED-002'` (si soft-deleted) ou 404 Not Found si slug inexistant
  - **Server Component handling** : `try/catch` autour du fetch → si 410/404 → render `<ListingUnavailableErrorPage variant="unpublished" | "deleted" | "not-found">` qui wraps `<ErrorPage variant="listing-unavailable">` Story 0.5 atomic avec :
    - H1 "Ce service n'est plus disponible" / "This service is no longer available"
    - Description "La fiche que vous cherchez a été dépubliée ou supprimée. Voici des services similaires."
    - 2 CTAs : "Retour catégorie" → `/{locale}/category/<categorySlug>` (si categorySlug récupéré depuis pre-410 catalog hint OU 404 → CTA générique "Retour à la recherche" → `/{locale}/search`) + "Page d'accueil" → `/{locale}/`
    - **Similar listings suggestions** : grid 4 `<ListingCard>` Story 3.8 réutilisé, fetched parallel via `GET /v1/services/<slug>/similar?limit=4` (NEW endpoint Story 3.10 — Meilisearch query par `categorySlug` + `postalCodes` proximité) — graceful degradation si endpoint 500 ou 0 result → hide section
  - **HTTP status code** : Server Component throw structured response avec `status: 410` (Next.js 15 `notFound()` returns 404 — pour 410 customize via response object) OR utilise `next/headers` pour status code manipulation. Pattern documenté `docs/runbook/listing-unavailable-status-410.md` (NEW Story 3.10 — ~20 lignes — Next.js 15 410 Gone pattern)
- (m) **i18n FR/EN strict** namespace `public.serviceDetail.*` ~35 keys × 2 locales (section titles, fallback badge, cancellation policy copy, similar listings, error variants, CTA reserve label, gallery counters, accessibility labels)

**so that** Sophie sur `/fr/search?category=tents-marquees&city=nantes` (Story 3.8) clique 1 carte → navigue `/fr/services/chapiteau-100m2-blanc-chic-nantes-x7k3` → page detail Server Component (RSC dynamic rendering, no static pre-gen MVP — Sprint 4 ; ISR potential V1+) → hero photo preload → LCP < 2,5s NFR3 → reproduce `service.jsx` figé : gallery 8 photos mosaic desktop / slider mobile + H1 "Chapiteau 100m² Blanc Chic" + `<PricingDisplay>` "650 € par jour" + zone "Loire-Atlantique 30km" + délai "3 jours min" + description Marc + politique annulation + reviews placeholder (V1+ populate) + CTA "Réserver" sticky desktop + JSON-LD Service + hreflang FR/EN → Sophie EN charge `/en/services/<slug>` (sans translation EN Marc) → badge "Available in French only" + content FR fallback FR99 ; un Visitor charge slug dépublié `/fr/services/chapiteau-old-2024` → 410 Gone `<ListingUnavailableErrorPage>` + 4 similar listings ; un Googlebot crawle → SEO score Lighthouse ≥ 95 (Story 0.11 CI) ; un test `pnpm playwright test --grep "listing detail"` passe FR/EN axe-core 0 violations 12 scénarios (gallery mobile slider + desktop mosaic, fallback badge, JSON-LD valid Schema.org Google Rich Results Test, hreflang head injection, NFR3 LCP < 2.5s Lighthouse, RGAA kbd nav focus trap modale gallery, sticky CTA mobile/desktop, 410 Gone unpublished + similar listings, 404 not-found + generic CTA, reviews empty placeholder MVP, prefers-reduced-motion respect gallery slide transitions, locale switch URL preserved) ; coverage ≥ 90 % ServiceDetailLayout + PhotoGallery + ListingUnavailableErrorPage + 85 % gateway endpoint + use case (catalog-svc `GetListingDetailUseCase` Story 3.2 livré — Story 3.10 livre wirage gateway + similar listings use case + frontend) + 80 % schema-org helper + hreflang reuse.

## Acceptance Criteria

1. **AC1 — Backend `GET /v1/services/{slug}` gateway endpoint + similar listings endpoint** : Given Story 3.2 livré `GetListingDetailUseCase` (`apps/catalog-svc/src/usecases/get-listing-detail.usecase.ts` — full impl with locale fallback FR if EN missing), When Story 3.10 wire gateway-api, Then :
   - **NEW DTO** `packages/contracts/src/dtos/catalog/listing-detail.dto.ts` :
     ```ts
     export const ListingDetailResponseSchema = z.object({
       listing: z.object({
         id: z.string().uuid(),
         slug: z.string(),
         title: z.string(), // localized via locale param
         description: z.string(),
         photos: z.array(z.object({
           id: z.string(),
           urls: z.object({ thumbnail: z.string().url(), card: z.string().url(), detail: z.string().url() }),
           altText: z.string().nullable(),
           sortOrder: z.number().int().nonnegative(),
         })),
         pricing: z.discriminatedUnion('mode', [
           z.object({ mode: z.literal('unit'), amountCents: z.number().int().nonnegative(), currency: z.string(), unit: z.string(), minQuantity: z.number().int().nullable(), maxQuantity: z.number().int().nullable() }),
           z.object({ mode: z.literal('package'), amountCents: z.number().int().nonnegative(), currency: z.string(), packageDescription: z.string() }),
         ]),
         serviceArea: z.object({ originPostalCode: z.string(), deliveryRadiusKm: z.number().int(), minLeadTimeDays: z.number().int() }),
         categorySlug: z.string(), // EN strict (Story 3.1)
         subcategorySlug: z.string().nullable(),
         publishedAt: z.string().datetime(),
       }),
       pro: z.object({
         id: z.string().uuid(),
         slug: z.string(),
         name: z.string(),
         avatar: z.object({ urls: z.object({ thumbnail: z.string().url() }) }).nullable(),
         verifiedSince: z.string().datetime().nullable(),
       }),
       reviews: z.object({
         aggregates: z.object({
           average: z.number().min(0).max(5),
           count: z.number().int().nonnegative(),
           distribution: z.record(z.string(), z.number()).optional(), // V1+ Story 5.8
         }),
         sample: z.array(z.object({ /* Story 5.x shape */ })).max(3), // MVP empty []
       }),
     });
     export type ListingDetailResponse = z.infer<typeof ListingDetailResponseSchema>;
     ```
   - **NEW DTO** `packages/contracts/src/dtos/catalog/similar-listings.dto.ts` — Story 3.10 (réutilise `MeilisearchListingDocument` Story 3.7 type — array max 4)
   - **NEW gateway-api controller** `apps/gateway-api/src/infrastructure/http/controllers/services.controller.ts` (NEW Story 3.10) :
     - `GET /v1/services/:slug` (path param slug regex `/^[a-z0-9]+(-[a-z0-9]+)*$/` Zod validation Story 3.2 `Slug` VO format)
     - Query `?locale=fr|en` (default from `Accept-Language` header)
     - Forwards to catalog-svc `GET /internal/listings/by-slug/:slug?locale=...` (NEW internal endpoint Story 3.10 catalog-svc — wraps `GetListingDetailUseCase.execute({ slug, locale })`)
     - Forwards parallel to identity-svc `GET /internal/pros/by-id/:proProfileId` Story 1.10 réutilisé (pour `pro` block snake) — réutiliser `ProProfileClient` port Story 3.2 livré, OR direct gateway-api forward depending on perf
     - Cache HTTP `Cache-Control: public, max-age=60, stale-while-revalidate=300` (Story 3.8 pattern réutilisé — listing detail moderately dynamic)
     - Throttle `60/min/IP` (Story 3.8 pattern)
     - **Returns 410 Gone enveloppe ADR-014 if listing.status ∈ ['unpublished']** with `error.tukioCode = 'CATALOG-LISTING-UNPUBLISHED-001'`
     - **Returns 410 Gone if listing soft-deleted** with `error.tukioCode = 'CATALOG-LISTING-DELETED-002'`
     - **Returns 404 Not Found** if slug doesn't exist with `error.tukioCode = 'CATALOG-LISTING-NOT-FOUND-003'`
     - `GET /v1/services/:slug/similar?limit=4` (NEW similar listings endpoint Story 3.10) — forwards to catalog-svc `GET /internal/listings/by-slug/:slug/similar?limit=4&locale=...` (NEW Story 3.10 internal endpoint catalog-svc — wraps `FindSimilarListingsUseCase` NEW Story 3.10)
   - **NEW catalog-svc use case** `apps/catalog-svc/src/usecases/find-similar-listings.usecase.ts` (NEW Story 3.10) :
     - Loads source listing (via `ListingRepository.findBySlug`) — must NOT be required to be published (for 410 Gone case → suggestions even if source unpublished)
     - Calls `ISearchIndexer.search({ indexName: 'listings_{locale}', query: '', filter: 'categorySlug = ' + source.categorySlug + ' AND id != ' + source.id + (postalCodes ? ' AND postalCode IN [' + ... + ']' : ''), limit: 4, sort: ['publishedAt:desc'] })`
     - Returns `Meilisearch ListingDocument[]` (max 4, empty if no source or no matches)
     - Pure use case — no infrastructure imports (port `ISearchIndexer` Story 3.7 livré réutilisé)
   - Tests integration testcontainer Meilisearch + Postgres 8 scenarios :
     - T1 happy path GET /v1/services/:slug locale=fr → 200 envelope
     - T2 happy path locale=en → 200 with fallback FR content + `meta.fallbackUsed=true`
     - T3 unpublished listing → 410 Gone CATALOG-LISTING-UNPUBLISHED-001
     - T4 soft-deleted → 410 Gone CATALOG-LISTING-DELETED-002
     - T5 non-existent slug → 404 CATALOG-LISTING-NOT-FOUND-003
     - T6 similar listings endpoint returns 4 by categorySlug
     - T7 similar listings 0 results (orphan category) → empty array
     - T8 cache + throttle perf p95 < 100ms

2. **AC2 — `apps/public/src/app/[locale]/services/[slug]/page.tsx` Server Component + dynamic rendering + parallel data fetch** : Given AC1, When je consulte le file (NEW Story 3.10), Then :
   - **Server Component** (`export const dynamic = 'force-dynamic'` MVP — pas de static pre-gen Sprint 4, V1+ peut explorer ISR `revalidate = 300` pour SEO + perf) :
     ```tsx
     export default async function Page({ params }: { params: Promise<{ locale: 'fr' | 'en'; slug: string }> }) {
       const { locale, slug } = await params;
       // Parallel fetch via Promise.all
       const [detailResponse, similarResponse] = await Promise.allSettled([
         fetchListingDetail(slug, locale),
         fetchSimilarListings(slug, locale, 4), // for hover prefetch in similar section + for 410 page
       ]);
       if (detailResponse.status === 'rejected') {
         // Distinguish 410 vs 404 vs 5xx based on error.tukioCode
         const err = detailResponse.reason;
         if (err.tukioCode === 'CATALOG-LISTING-UNPUBLISHED-001' || err.tukioCode === 'CATALOG-LISTING-DELETED-002') {
           const similar = similarResponse.status === 'fulfilled' ? similarResponse.value : [];
           return <ListingUnavailableErrorPage variant={err.tukioCode === 'CATALOG-LISTING-UNPUBLISHED-001' ? 'unpublished' : 'deleted'} similar={similar} categorySlug={err.context?.categorySlug} />;
         }
         if (err.tukioCode === 'CATALOG-LISTING-NOT-FOUND-003') notFound(); // Next.js 15 404
         throw err; // 5xx → bubble to error.tsx
       }
       const detail = detailResponse.value.data;
       return (
         <>
           <Service jsonLd={buildServiceJsonLd(detail, locale)} />
           <ServiceDetailLayout detail={detail} locale={locale} similar={similarResponse.status === 'fulfilled' ? similarResponse.value : []} />
         </>
       );
     }
     ```
   - **`generateMetadata`** Server function returns Next.js 15 Metadata :
     ```tsx
     export async function generateMetadata({ params }: { params: Promise<{ locale, slug }> }): Promise<Metadata> {
       const { locale, slug } = await params;
       const detail = await fetchListingDetail(slug, locale).catch(() => null);
       if (!detail) return { title: 'Service indisponible', robots: { index: false } };
       return {
         title: `${detail.listing.title} | Tukio`,
         description: detail.listing.description.slice(0, 160),
         alternates: { canonical: `https://tukio.one/${locale}/services/${slug}`, languages: buildHreflangMap(`/${locale}/services/${slug}`) },
         openGraph: { title: detail.listing.title, description: detail.listing.description.slice(0, 160), images: [detail.listing.photos[0]?.urls.detail], type: 'website' },
         twitter: { card: 'summary_large_image', images: [detail.listing.photos[0]?.urls.detail] },
       };
     }
     ```
   - **Hero photo preload** : `<head>`-level `<link rel="preload" as="image" href={detail.listing.photos[0].urls.detail} fetchpriority="high">` via Next.js 15 Metadata `other` field OR `<head>` direct in Server Component — pattern documenté
   - Tests : 5 scenarios Server Component (render with locale=fr + en, fallback badge, JSON-LD valid, hreflang generated, metadata canonical) — `@testing-library/react` + `vitest`

3. **AC3 — `<PhotoGallery>` feature-scoped component (hero slider mobile + mosaic desktop + modale fullscreen)** : Given AC2, When je consulte `apps/public/src/features/public/service-detail/components/PhotoGallery.tsx` (NEW Story 3.10), Then :
   - **Mobile (< `md`)** — slider horizontal `embla-carousel-react` v8+ (latest stable — `pnpm add embla-carousel-react@latest embla-carousel-autoplay@latest`) :
     ```tsx
     const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false, slidesToScroll: 1 }, [Autoplay({ playOnInit: false, delay: 5000 })]);
     ```
     - Touch swipe natif
     - Keyboard navigation : ← → (arrow keys) navigate prev/next
     - `<DotsIndicator>` bottom + counter "1/8"
     - First slide `<picture>` srcset AVIF/WebP/JPG `fetchpriority="high" loading="eager"` + alt text from photo.altText
     - Subsequent slides `loading="lazy"`
     - Aria : `role="region" aria-label="Galerie photos du service" aria-roledescription="carousel"`
   - **Desktop (`md+`)** — mosaic à la Airbnb :
     - Grid 4 photos `<photo[0]>` 60% width left + 2x2 grid 40% width right `<photo[1..4]>`
     - CTA "Voir les {photos.length} photos" → opens `<Dialog>` `@radix-ui/react-dialog` (Story 3.6/3.9 pattern réutilisé) fullscreen modale gallery with all photos + carousel kbd nav + ESC closes + focus trap (RGAA)
     - Hover photo[0] → no transform MVP (V1+ subtle zoom)
   - **NFR47 `prefers-reduced-motion`** respected — disable autoplay + transition durations 0
   - Tests `@testing-library/react` + axe-core : 6 scenarios (mobile slider render + swipe sim, desktop mosaic render + modal open/close, kbd nav arrow keys, focus trap modal, reduced-motion respect, alt text accessible)

4. **AC4 — `<ListingUnavailableErrorPage>` 3 variants + similar listings suggestions** : Given AC1 + AC2, When je consulte `apps/public/src/features/public/service-detail/components/ListingUnavailableErrorPage.tsx` (NEW Story 3.10), Then :
   - **Variants** `unpublished | deleted | not-found` :
     - `unpublished` — "Cette fiche a été dépubliée par le pro. Voici des services similaires." + CTA Retour catégorie (si categorySlug context) + Page d'accueil
     - `deleted` — "Cette fiche a été supprimée. Voici des services similaires." + CTAs idem
     - `not-found` — "Aucun service trouvé à cette adresse. Voici des services populaires." + CTAs retour search + Page d'accueil (no categorySlug context, no similar from this slug — fallback Meilisearch top 4 by publishedAt desc OR generic message + skip similar section)
   - **Wraps** `<ErrorPage variant="listing-unavailable">` Story 0.5 atomic (NEW Story 3.10 variant added — `<ErrorPage>` Story 0.5 livré 3 variants 404/500/maintenance, Story 3.10 ajoute 'listing-unavailable' 4ᵉ variant — UPDATE `<ErrorPage>` Story 0.5 packages/ui/src/patterns/ErrorPage)
   - **Similar listings section** (if `similar.length > 0`) : H2 "Services similaires" + grid 4 `<ListingCard>` Story 3.8 réutilisé responsive (1 col mobile, 2 cols sm, 4 cols md+)
   - **HTTP status code 410 Gone** : need to set response status code to 410 from Server Component — Next.js 15 pattern via `next/headers` or wrapper:
     ```tsx
     // option A : via custom not-found.tsx (Next.js handles 404 natively, 410 needs override)
     // option B : middleware response rewrite based on slug status (perf concern)
     // option C : Server Component throws structured ErrorWithStatus → caught in error.tsx with explicit status
     // → Story 3.10 implements option A : custom not-found.tsx + middleware.ts response header set
     ```
     **Pattern documenté `docs/runbook/nextjs-410-gone-handling.md` (NEW Story 3.10 ~25 lignes)** — comparison Next.js 15 options + retained approach (middleware.ts response header `x-tukio-status: 410` + `response.status = 410` via NextResponse pattern)
   - **i18n** keys `public.serviceDetail.errors.{unpublished,deleted,notFound}.{title,description,ctaCategory,ctaHome,similarTitle}`
   - Tests : 4 scenarios (each variant render + similar render + similar 0 results graceful hide + axe-core kbd nav CTAs)

5. **AC5 — JSON-LD `Service` Schema.org helper + injection** : Given FR116 + NFR5, When je consulte `apps/public/src/lib/schema-org/Service.tsx` (NEW Story 3.10 — pattern foundation Story 7.8 SEO future), Then :
   - **Helper `buildServiceJsonLd(detail, locale)`** returns `Record<string, unknown>` JSON-LD object Schema.org Service spec :
     ```ts
     export function buildServiceJsonLd(detail: ListingDetailResponse, locale: 'fr' | 'en'): Record<string, unknown> {
       const baseUrl = 'https://tukio.one';
       return {
         '@context': 'https://schema.org',
         '@type': 'Service',
         name: detail.listing.title,
         description: detail.listing.description.slice(0, 5000),
         image: detail.listing.photos.map(p => p.urls.detail),
         provider: { '@type': 'Organization', name: detail.pro.name, url: `${baseUrl}/${locale}/pro/${detail.pro.slug}` },
         offers: { '@type': 'Offer', price: (detail.listing.pricing.amountCents / 100).toFixed(2), priceCurrency: detail.listing.pricing.currency, availability: 'https://schema.org/InStock', url: `${baseUrl}/${locale}/services/${detail.listing.slug}` },
         ...(detail.reviews.aggregates.count > 0 && {
           aggregateRating: { '@type': 'AggregateRating', ratingValue: detail.reviews.aggregates.average.toFixed(1), reviewCount: detail.reviews.aggregates.count, bestRating: '5', worstRating: '1' },
         }),
         areaServed: { '@type': 'Place', geo: { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', address: detail.listing.serviceArea.originPostalCode }, geoRadius: `${detail.listing.serviceArea.deliveryRadiusKm}km` } },
       };
     }
     ```
   - **`<Service>` component** renders `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />` — passed prop `jsonLd: Record<string, unknown>` from page.tsx Server Component
   - **Validation** : included in test suite with `schema-dts` v1+ (latest stable) type-check OR Google Rich Results Test API call in e2e Story 3.10 (Playwright fetches page → extracts JSON-LD via `page.locator('script[type="application/ld+json"]').textContent()` → POST to Rich Results API → assert no errors)
   - Tests : 4 scenarios (Service Schema.org valid type, aggregateRating only when count > 0, image array all variants, areaServed geo correct)
   - **Foundation for Story 3.11 (Organization JSON-LD pro-profile), Story 3.12 (ItemList JSON-LD category), Story 7.8 (SEO foundation systematic + BreadcrumbList)** — Story 3.10 livre le pattern `schema-org/` directory + Service.tsx, future stories add LocalBusiness.tsx + BreadcrumbList.tsx + AggregateRating.tsx + Organization.tsx (filenames already referenced architecture.md line 2115)

6. **AC6 — Locale fallback badge FR99/FR100 + i18n strict + RGAA AA** : Given FR99 + FR100 + UX-DR19, When `meta.fallbackUsed === true && locale === 'en'`, Then :
   - **`<Badge variant="info">{t('serviceDetail.fallbackBadge')}</Badge>`** rendered au-dessus du H1 dans `<ListingHeader>` :
     - FR i18n key (technically never rendered, but kept for consistency) : `"Affiché en français uniquement"`
     - EN i18n key : `"Available in French only"`
   - **`aria-label`** explicit on badge for screen readers
   - **`<Badge>` Story 0.4 atomic réutilisé** (variants brand/success/warning/info/neutral livré Story 0.4)
   - **i18n namespace `public.serviceDetail.*`** ~35 keys × 2 locales :
     ```
     hero.{galleryButtonLabel,counterFormat,photoAlt,zoomModalTitle}
     header.{fallbackBadge,reviewsSummaryFormat}
     pricing.{unitLabel,packageLabel,minQuantityHint}
     delivery.{title,zoneRadius,leadTimeFormat,mapPlaceholder}
     description.{title,readMore,readLess}
     cancellation.{title,policyLine1,policyLine2,policyLine3,learnMore}
     availability.{title,placeholderMessage,placeholderHint}
     reviews.{title,emptyMessage,seeAllCta}
     cta.{reserveLabel,reserveAria,reserveSticky}
     errors.{unpublished,deleted,notFound}.{title,description,ctaCategory,ctaHome,similarTitle}
     similar.{title,emptyHide}
     ```
   - **Tests** : i18n CI lint (Story 0.9 pattern) — `apps/public/messages/{fr,en}.json` both contain all keys (CI check `pnpm i18n:audit` Story 0.9 réutilisé)
   - **NFR47 prefers-reduced-motion** : embla-carousel autoplay disabled, transitions 0ms
   - **RGAA AA** : axe-core 0 violations on full page (Story 0.11 CI Lighthouse score Accessibility ≥ 90)

7. **AC7 — `@tukio/api-client` hooks + UI integration sticky CTA placeholder** : Given AC2 + architecture line 2220 `packages/api-client/src/hooks/catalog/useListingDetail`, When Story 3.10 wires the hook (NEW Story 3.10 — architecture referenced but implementation Story 3.10 livre), Then :
   - **NEW hook** `packages/api-client/src/hooks/catalog/useListingDetail.ts` :
     ```ts
     export function useListingDetail(slug: string, locale: 'fr' | 'en') {
       return useSuspenseQuery({
         queryKey: ['listing-detail', slug, locale],
         queryFn: () => apiClient.get<ListingDetailResponse>(`/v1/services/${slug}?locale=${locale}`).then(unwrapEnvelope),
         staleTime: 60 * 1000, // 60s
       });
     }
     export function useSimilarListings(slug: string, locale: 'fr' | 'en', limit = 4) {
       return useQuery({
         queryKey: ['similar-listings', slug, locale, limit],
         queryFn: () => apiClient.get<MeilisearchListingDocument[]>(`/v1/services/${slug}/similar?locale=${locale}&limit=${limit}`).then(unwrapEnvelope),
         staleTime: 5 * 60 * 1000, // 5min — less dynamic
       });
     }
     ```
   - Note : Story 3.10 page.tsx Server Component uses direct `fetch` calls (no TanStack Query in Server Components) — hooks are for Client Component consumers (e.g., gallery modal, sticky CTA dynamic update V1+, error.tsx hydration). MVP : hooks created but only used for `<ListingUnavailableErrorPage>` similar suggestion hover prefetch + error.tsx revalidation.
   - **`<CtaReserveSticky>` MVP behavior** : click → `router.push('/{locale}/cart?listingId=${listing.id}&slug=${listing.slug}')` (Epic 4 future cart Story 4.3 livre la page cart réel — Story 3.10 MVP livre le CTA → route placeholder qui affichera `<EmptyState variant="cart-empty">` Story 0.5 si pas encore impl)
   - Tests : 3 scenarios (hook fetch + cache, similar hover prefetch, CTA navigation router.push)

8. **AC8 — Métriques + tests Playwright e2e + perf NFR3 + Lighthouse SEO ≥ 95** : Given AC1-7, When :
   - **Métriques NEW** :
     - `tukio_listing_detail_views_total{locale,category_slug,has_fallback}` (counter — analytics views per category + locale + EN fallback usage)
     - `tukio_listing_detail_fetch_duration_seconds` (histogram — gateway → catalog-svc + identity-svc parallel fetch p95)
     - `tukio_listing_unavailable_total{variant}` (counter — 410/404 occurrences for monitoring stale links from search index drift)
     - `tukio_similar_listings_fetch_duration_seconds` (histogram)
     - `tukio_listing_detail_lcp_seconds` (histogram — Lighthouse CI Story 0.11 ingest)
   - **Prometheus alert** `ListingDetailLatencyHigh` `histogram_quantile(0.95, tukio_listing_detail_fetch_duration_seconds_bucket) > 0.500` for 5m → warning Slack `#tukio-alerts-ops`
   - **Dashboard Grafana NEW** `infra/k8s/grafana-dashboards/listing-detail.json` (NEW Story 3.10 ~5 panels) : views/min by locale, fallback usage rate, fetch p95 latency, unavailable variants breakdown, LCP p75 (Core Web Vitals target)
   - **Tests Playwright e2e** 12 scenarios :
     - T1-2 happy detail FR + EN content render full
     - T3 EN fallback FR + badge "Available in French only" + content FR with locale=en
     - T4 hero photo preload `<link rel="preload">` + LCP candidate
     - T5 mobile slider swipe touch + arrows + counter "X/Y"
     - T6 desktop mosaic + click "Voir les X photos" → modal fullscreen + ESC closes + kbd nav
     - T7 JSON-LD Schema.org Service valid (Google Rich Results Test API call OR schema-dts type-check)
     - T8 hreflang head injection FR + EN + x-default + canonical
     - T9 410 Gone unpublished + similar listings 4 cards render
     - T10 404 not-found + generic CTAs (no similar from this slug)
     - T11 sticky CTA mobile (fixed bottom) + desktop (sticky sidebar) + click → router.push /{locale}/cart
     - T12 RGAA kbd nav full page + axe-core 0 violations + Lighthouse Accessibility ≥ 90 + SEO ≥ 95 (Story 0.11 CI gate)
   - **Test perf NFR3 LCP < 2,5s** : Lighthouse CI Story 0.11 assert on `/fr/services/<seed-slug>` page (CI gate fail if regression)
   - Coverage ≥ 90 % ServiceDetailLayout + PhotoGallery + ListingUnavailableErrorPage
   - Coverage ≥ 85 % gateway controllers + similar listings use case
   - Coverage ≥ 80 % schema-org helper + hreflang reuse + api-client hooks
   - **k6 load test** GET /v1/services/:slug p95 < 200ms gateway + catalog-svc roundtrip (NFR31 sustain 6000 visiteurs/mois MVP)

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` DTOs listing-detail + similar-listings + Zod** (AC: #1)
  - [ ] 1.1 — `dtos/catalog/listing-detail.dto.ts` (ListingDetailResponseSchema)
  - [ ] 1.2 — `dtos/catalog/similar-listings.dto.ts` (réutilise `MeilisearchListingDocument` Story 3.7)
  - [ ] 1.3 — Tests Zod parse happy + edge cases (pricing unit/package discriminated union, fallback meta optional, photos sorted)

- [ ] **Task 2 — catalog-svc internal endpoints + `FindSimilarListingsUseCase`** (AC: #1) — coverage ≥ 90 %
  - [ ] 2.1 — `apps/catalog-svc/src/usecases/find-similar-listings.usecase.ts` + spec (use port `ISearchIndexer` Story 3.7 + `IListingRepository.findBySlug` Story 3.2)
  - [ ] 2.2 — Wire `find-similar-listings.usecase` in `usecases-proxy.module.ts`
  - [ ] 2.3 — `apps/catalog-svc/src/infrastructure/http/controllers/internal-listing-detail.controller.ts` (NEW Story 3.10) — extends/co-located existing controllers — exposes `GET /internal/listings/by-slug/:slug?locale=...` (wraps `GetListingDetailUseCase`) + `GET /internal/listings/by-slug/:slug/similar?limit=4&locale=...` (wraps `FindSimilarListingsUseCase`)
  - [ ] 2.4 — Tests integration testcontainer Postgres + Meilisearch (8 scenarios AC1)

- [ ] **Task 3 — gateway-api `services.controller.ts` + forwarder + error mapping 410/404** (AC: #1) — coverage ≥ 85 %
  - [ ] 3.1 — `apps/gateway-api/src/usecases/catalog/get-listing-detail.forwarder.ts` (NEW Story 3.10) — forwards to catalog-svc internal endpoint
  - [ ] 3.2 — `apps/gateway-api/src/usecases/catalog/get-similar-listings.forwarder.ts` (NEW)
  - [ ] 3.3 — `apps/gateway-api/src/infrastructure/http/controllers/services.controller.ts` (NEW) — 2 endpoints + Zod validation + cache HTTP + throttle 60/min
  - [ ] 3.4 — Error mapping CATALOG-LISTING-NOT-FOUND-003 / CATALOG-LISTING-UNPUBLISHED-001 / CATALOG-LISTING-DELETED-002 → enveloppe ADR-014 410/404 (custom exception in `apps/catalog-svc/src/domain/exception/` if not already + global ExceptionFilter mapping)
  - [ ] 3.5 — Tests E2E gateway 8 scenarios AC1

- [ ] **Task 4 — `apps/public/src/app/[locale]/services/[slug]/page.tsx` Server Component + `generateMetadata` + hero preload** (AC: #2)
  - [ ] 4.1 — Page.tsx Server Component (force-dynamic) + parallel fetch via `Promise.allSettled`
  - [ ] 4.2 — `generateMetadata` Next.js 15 alternates languages + canonical + OG + Twitter card
  - [ ] 4.3 — Hero photo `<link rel="preload" as="image" fetchpriority="high">` Server Component head injection
  - [ ] 4.4 — `not-found.tsx` (404 generic) + `error.tsx` (5xx + listing unavailable variant routing)
  - [ ] 4.5 — Tests Vitest 5 scenarios AC2

- [ ] **Task 5 — `<ServiceDetailLayout>` orchestrator + 8 feature-scoped components** (AC: #3, #6) — coverage ≥ 90 %
  - [ ] 5.1 — `apps/public/src/features/public/service-detail/components/ServiceDetailLayout.tsx` (orchestrator)
  - [ ] 5.2 — `PhotoGallery.tsx` (mobile slider embla-carousel-react v8+ + desktop mosaic + modal Dialog) — AC3
  - [ ] 5.3 — `ListingHeader.tsx` (breadcrumb + H1 + fallback badge AC6 + reviews mini-summary)
  - [ ] 5.4 — `PricingSection.tsx` (wraps `<PricingDisplay>` Story 0.5)
  - [ ] 5.5 — `DeliveryAndLeadTimeSection.tsx` (icons Lucide + map placeholder Story 0.4)
  - [ ] 5.6 — `DescriptionSection.tsx` (`<article>` prose Tailwind Typography + ReadMoreToggle)
  - [ ] 5.7 — `CancellationPolicySection.tsx` (generic MVP copy + link learn-more)
  - [ ] 5.8 — `AvailabilitySection.tsx` (`<EmptyState variant="placeholder">` Story 0.5 placeholder V1)
  - [ ] 5.9 — `ReviewsSection.tsx` (wraps `<ReviewsDisplay>` Story 0.5 — toggle empty/active based on `aggregates.count`)
  - [ ] 5.10 — `CtaReserveSticky.tsx` (desktop sidebar + mobile fixed bottom + click → router.push /cart placeholder Epic 4)
  - [ ] 5.11 — Tests `@testing-library/react` + axe-core 6+ scenarios AC3 + AC6

- [ ] **Task 6 — `<ListingUnavailableErrorPage>` 3 variants + similar listings grid** (AC: #4)
  - [ ] 6.1 — `ListingUnavailableErrorPage.tsx` (NEW Story 3.10 feature-scoped)
  - [ ] 6.2 — **UPDATE** `packages/ui/src/patterns/ErrorPage/ErrorPage.tsx` Story 0.5 — add 4ᵉ variant `'listing-unavailable'` (props subtitle + similar slot composition)
  - [ ] 6.3 — Similar listings grid 4 `<ListingCard>` Story 3.8 réutilisé responsive
  - [ ] 6.4 — Tests `@testing-library/react` 4 scenarios AC4

- [ ] **Task 7 — JSON-LD `Service` Schema.org helper + injection** (AC: #5) — coverage ≥ 80 %
  - [ ] 7.1 — `apps/public/src/lib/schema-org/Service.tsx` (NEW Story 3.10 — pattern foundation Stories 3.11/3.12/7.8 future)
  - [ ] 7.2 — Helper `buildServiceJsonLd(detail, locale)` + `<Service jsonLd={...} />` component
  - [ ] 7.3 — Validation type-check via `schema-dts` v1+ (latest stable) OR Google Rich Results Test API e2e
  - [ ] 7.4 — Tests Vitest 4 scenarios AC5

- [ ] **Task 8 — `@tukio/api-client` hooks `useListingDetail` + `useSimilarListings`** (AC: #7) — coverage ≥ 80 %
  - [ ] 8.1 — `packages/api-client/src/hooks/catalog/useListingDetail.ts` (NEW Story 3.10 — architecture line 2220 référencé)
  - [ ] 8.2 — `packages/api-client/src/hooks/catalog/useSimilarListings.ts` (NEW)
  - [ ] 8.3 — Tests Vitest 3 scenarios AC7

- [ ] **Task 9 — i18n FR/EN namespace `public.serviceDetail.*` ~35 keys × 2** (AC: #6)
  - [ ] 9.1 — `apps/public/messages/fr.json` + `apps/public/messages/en.json` update namespace
  - [ ] 9.2 — CI check `pnpm i18n:audit` Story 0.9 réutilisé (both files contain all keys, no orphans)

- [ ] **Task 10 — hreflang réutilisation Story 3.9 helper + canonical** (AC: #2)
  - [ ] 10.1 — UPDATE `apps/public/src/lib/hreflang.ts` Story 3.9 livré — verify it handles `/services/:slug` route pattern (réutilisable as-is — accepts arbitrary path)
  - [ ] 10.2 — Tests verify head rendered `<link rel="alternate" hreflang="fr|en|x-default" href="...">` + `<link rel="canonical" href="...">`

- [ ] **Task 11 — Métriques + Prometheus alerts + Grafana dashboard** (AC: #8)
  - [ ] 11.1 — 5 nouvelles métriques (cf. AC8) instrumentées dans gateway-api + Server Component (Web Vitals LCP via `web-vitals` package v4+ latest stable client-side reporting)
  - [ ] 11.2 — Prometheus alert `ListingDetailLatencyHigh` ajouté `infra/k8s/prometheus-rules/listing-detail.yaml` (NEW Story 3.10)
  - [ ] 11.3 — Dashboard Grafana `listing-detail.json` (NEW ~5 panels)

- [ ] **Task 12 — Tests Playwright e2e 12 scenarios + Lighthouse CI assertions + k6 perf** (AC: #8)
  - [ ] 12.1 — `apps/public/e2e/services/listing-detail.spec.ts` (NEW 12 tests AC8)
  - [ ] 12.2 — Lighthouse CI Story 0.11 update — add `/fr/services/<seed-slug>` to budgets list + assert SEO ≥ 95 + LCP < 2,5s
  - [ ] 12.3 — k6 load test scenario `infra/k6/listing-detail.k6.js` (NEW — sustains 30 req/s for 5 min, p95 < 200ms NFR1 sustain MVP target)
  - [ ] 12.4 — Coverage thresholds enforced NFR71 (≥ 90 % composants critical, ≥ 85 % gateway, ≥ 80 % helpers/hooks)

- [ ] **Task 13 — Runbook + documentation + commit**
  - [ ] 13.1 — `docs/runbook/nextjs-410-gone-handling.md` (NEW Story 3.10 ~25 lignes) — Next.js 15 410 Gone pattern + middleware approach + comparison alternatives
  - [ ] 13.2 — `docs/runbook/listing-detail-debug.md` (NEW Story 3.10 ~30 lignes) — debugging guide cache 60s + Meilisearch similar + LCP optim
  - [ ] 13.3 — UPDATE `docs/project-context.md` section "Listing Detail (Story 3.10)" — résumé décisions + patterns réutilisables Stories 3.11/3.12/7.8 future
  - [ ] 13.4 — Commit `feat(public,catalog,gateway,api-client,ui): Story 3.10 listing detail public page + JSON-LD Service Schema.org + similar listings 410 Gone + photo gallery embla-carousel + hreflang + sticky reserve CTA placeholder Epic 4`

## Dev Notes

### Pourquoi Story 3.10 ferme la couche Visitor public Epic 3 MVP

Story 3.10 est la **3ᵉ et dernière page Visitor publique critique MVP** après Story 3.8 (home + search) et Story 3.9 (filters). Elle réalise enfin la **conversion** : un Visitor découvre → search → filter → **fiche détail complète** → CTA Réserver (Epic 4 future). Sans Story 3.10, le funnel s'arrête à la SERP — donc pas de conversion. C'est **la page la plus critique SEO** (NFR5 Lighthouse SEO ≥ 95 — JSON-LD Service + canonical + OG + hreflang) car c'est où Googlebot atterrira via long-tail queries "location chapiteau Loire-Atlantique" → fiche → CTR. Pattern complet **Server Component RSC dynamic rendering + JSON-LD Schema.org + hreflang systematic + 410 Gone graceful + locale fallback + sticky CTA + photo gallery embla-carousel** devient template Story 3.11 (pro public profile Organization JSON-LD), Story 3.12 (category page ItemList JSON-LD), Story 7.8 (SEO foundation BreadcrumbList systematic).

### Décisions techniques majeures actées

1. **URL convention `/{locale}/services/<slug>` (plural)** — alignement avec epics.md ligne 1544 + Story 3.8 ligne 228 (`router.push('/{locale}/services/{slug}')`). **DEVIATION vs architecture.md ligne 2092 + ux-design-specification.md ligne 241 qui mentionnent `/service/{slug}` (singular)** — Story 3.10 acte **plural** comme convention canonique (Story 3.8 a déjà câblé `router.push('/services/{slug}')`, architecture sera mise à jour V1+ via PR doc sync ou ADR si débat).

2. **Slug single (FR-based) vs per-locale slugs** — Story 3.2 livre `Listing.slug` field unique sur l'aggregate (factory `Slug.fromTitle(title.fr, suffix)`). Architecture parlait initialement de slugs par locale dans `<entity>_translations` mais Story 3.2 a tranché single FR-slug pour MVP simplicité (V1+ possible upgrade per-locale slug). Story 3.10 consume le single slug — peut servir indifféremment `/fr/services/<slug>` et `/en/services/<slug>`.

3. **Server Component RSC `dynamic = 'force-dynamic'` MVP** — pas de static pre-gen Sprint 4 car (a) listings changeants/dépubliables, (b) reviews aggregates dynamiques V1+, (c) similar listings Meilisearch query. V1+ peut explorer ISR `revalidate = 300` (5 min) si SEO crawl perf devient un blocker. Décision réversible.

4. **Parallel fetch `Promise.allSettled`** detail + similar — évite N+1 sequential. Similar fetch en parallel pour pre-load la fallback page 410/404 AC4 OU pour "vous pourriez aussi aimer" section V1+ on regular detail page.

5. **JSON-LD Service Schema.org pattern foundation** — Story 3.10 livre `apps/public/src/lib/schema-org/Service.tsx` + helper `buildServiceJsonLd`. Stories 3.11/3.12/7.8 ajoutent Organization.tsx + ItemList.tsx + BreadcrumbList.tsx + LocalBusiness.tsx + AggregateRating.tsx (filenames mentionnés architecture.md ligne 2115). Pattern Lighthouse SEO ≥ 95 (NFR5) critique RA1 risque acquisition #1.

6. **PhotoGallery feature-scoped vs `@tukio/ui` pattern** — démarrage feature-scoped `apps/public/src/features/public/service-detail/components/PhotoGallery.tsx`. Si V1+ stories Epic 5 (review multi-photos), Epic 11 (favoris carrousel), Epic 12 (booking modification file attachments) réutilisent → promote vers `packages/ui/patterns/PhotoGallery/`. **YAGNI MVP**.

7. **`embla-carousel-react` v8+** (latest stable — `pnpm add embla-carousel-react@latest embla-carousel-autoplay@latest`) choisi vs `swiper` v11+ : (a) plus léger ~15kb gzip vs swiper ~120kb gzip, (b) Tailwind v4 compatible no CSS conflicts, (c) RGAA-friendly kbd nav natif, (d) `prefers-reduced-motion` respecté natif, (e) memory/feedback_latest_versions.md latest stable.

8. **410 Gone pattern Next.js 15** — Next.js 15 ne supporte pas natif HTTP 410 (vs 404 natif `notFound()`). Story 3.10 livre pattern middleware.ts response header `x-tukio-status: 410` + NextResponse pattern + runbook documenté `docs/runbook/nextjs-410-gone-handling.md`. Décision : middleware.ts response wrapper > Server Component throw (perf middleware niveau Edge mieux pour SEO/crawlers).

9. **Reviews placeholder MVP** — `<ReviewsSection>` toggle entre `<EmptyState variant="reviews-empty">` (count=0 MVP) ou `<ReviewsDisplay>` Story 0.5 (count>0 V1+) — toggle automatique au futur populate Story 5.5 sans code change frontend.

10. **CTA Réserver sticky desktop sidebar + mobile fixed bottom** — UX-DR `service.jsx` bundle Cloud Design figé. Click → `router.push('/{locale}/cart?listingId=...&slug=...')` placeholder Epic 4. **Story 4.3 livre la page cart réel** — Story 3.10 MVP ne casse pas le funnel car CTA prend l'utilisateur à `/cart` qui affichera `<EmptyState variant="cart-empty">` Story 0.5 (gracieux fallback Epic 4 future).

11. **AvailabilityCalendar placeholder MVP** — FR28 calendrier dispo réelle est V1 (Stories Epic 9/10/11). MVP : `<EmptyState variant="placeholder">` Story 0.5 réutilisé avec label "Disponibilité en temps réel disponible prochainement (V1)" + sous-texte "Pour vérifier, contactez le pro après réservation". `<EmptyState>` Story 0.5 livre 7 variants — Story 3.10 utilise variant `placeholder` (NEW addition Story 0.5 — UPDATE pattern).

12. **Cache HTTP `Cache-Control: public, max-age=60, stale-while-revalidate=300`** (Story 3.8 pattern réutilisé) — balance UX (fresh content) + perf (CDN Vercel edge cache + Cloudflare). Throttle 60/min/IP (vs Story 3.8 search 120/min — detail page consultée moins fréquemment que search).

13. **EN strict + i18n + RGAA AA + latest stable versions + Clean Architecture + Envelope ADR-014** memories — toutes respectées.

14. **No backwards compatibility** — Story 3.10 introduit `ListingDetailResponseSchema` Zod fresh, no migration legacy. Reviews shape MVP empty array + aggregates count=0 est volontaire (pas de mock fixtures injection — vraie data null Story 5.5 future populate).

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `embla-carousel-react` | Photo gallery mobile slider | latest stable v8+ | Tailwind v4 + RGAA + `prefers-reduced-motion` natif |
| `embla-carousel-autoplay` | Optional autoplay plugin embla | latest stable v8+ | Disabled si `prefers-reduced-motion: reduce` |
| `@radix-ui/react-dialog` | Photo gallery modal fullscreen | (Story 3.6/3.9 already) | Réutilisé |
| `schema-dts` | JSON-LD type-check Schema.org | latest stable v1+ | Dev dep only, pas runtime |
| `web-vitals` | LCP/INP/CLS reporting client | latest stable v4+ | Tukio Prometheus ingest |
| `@tanstack/react-query` | API hooks | (Story 0.9 already) | useSuspenseQuery for SSR |
| `next-intl` | i18n | (Sprint 0 already) | namespace public.serviceDetail.* |
| `next` | Next.js 15 metadata API + Server Components | (Sprint 0 already) | force-dynamic MVP, ISR V1+ |
| `slugify` | (already Story 3.2) | v1.6+ | catalog-svc only, no frontend |

### Project Structure cible

```
# ====== NEW Story 3.10 ======

packages/contracts/src/dtos/catalog/
├─ listing-detail.dto.ts                                                # NEW (ListingDetailResponseSchema)
└─ similar-listings.dto.ts                                              # NEW (réutilise MeilisearchListingDocument Story 3.7)

packages/api-client/src/hooks/catalog/
├─ useListingDetail.ts + spec                                           # NEW Story 3.10 (architecture line 2220 référencé)
└─ useSimilarListings.ts + spec                                         # NEW

apps/catalog-svc/src/
├─ usecases/find-similar-listings.usecase.ts + spec                     # NEW (réutilise ports ISearchIndexer + IListingRepository Story 3.7/3.2)
├─ usecases-proxy/usecases-proxy.module.ts                              # UPDATE — wire find-similar-listings
├─ infrastructure/http/controllers/internal-listing-detail.controller.ts # NEW — 2 internal endpoints (by-slug + by-slug/similar)
└─ domain/exception/listing-unpublished.exception.ts                    # NEW (CATALOG-LISTING-UNPUBLISHED-001) — 410 mapping
└─ domain/exception/listing-deleted.exception.ts                        # NEW (CATALOG-LISTING-DELETED-002) — 410 mapping

apps/gateway-api/src/
├─ usecases/catalog/get-listing-detail.forwarder.ts                     # NEW
├─ usecases/catalog/get-similar-listings.forwarder.ts                   # NEW
└─ infrastructure/http/controllers/services.controller.ts               # NEW — GET /v1/services/:slug + /v1/services/:slug/similar + Zod + cache HTTP + throttle 60/min + error mapping 410/404

apps/public/src/
├─ app/[locale]/services/[slug]/
│  ├─ page.tsx                                                          # NEW Server Component + generateMetadata + hero preload
│  ├─ not-found.tsx                                                     # NEW (404 generic fallback)
│  └─ error.tsx                                                         # NEW (5xx error.tsx + ListingUnavailableErrorPage variant routing)
├─ features/public/service-detail/
│  ├─ components/
│  │  ├─ ServiceDetailLayout.tsx + spec                                 # NEW orchestrator
│  │  ├─ PhotoGallery.tsx + spec                                        # NEW (embla-carousel-react v8+ + Radix Dialog modal)
│  │  ├─ ListingHeader.tsx + spec                                       # NEW (breadcrumb + H1 + fallback badge + reviews mini)
│  │  ├─ PricingSection.tsx                                             # NEW (wraps PricingDisplay Story 0.5)
│  │  ├─ DeliveryAndLeadTimeSection.tsx                                 # NEW (icons Lucide + Placeholder Story 0.4)
│  │  ├─ DescriptionSection.tsx                                         # NEW (article prose + ReadMoreToggle)
│  │  ├─ CancellationPolicySection.tsx                                  # NEW (generic MVP copy)
│  │  ├─ AvailabilitySection.tsx                                        # NEW (EmptyState placeholder V1)
│  │  ├─ ReviewsSection.tsx                                             # NEW (wraps ReviewsDisplay Story 0.5 toggle empty/active)
│  │  ├─ CtaReserveSticky.tsx + spec                                    # NEW (desktop sidebar + mobile fixed bottom)
│  │  └─ ListingUnavailableErrorPage.tsx + spec                         # NEW (3 variants + similar grid)
│  └─ services/                                                         # (TanStack hooks lib réutilisés depuis @tukio/api-client — pas de service local)
├─ lib/schema-org/
│  └─ Service.tsx + spec                                                # NEW Story 3.10 — pattern foundation Stories 3.11/3.12/7.8
├─ lib/hreflang.ts                                                      # REUSE Story 3.9 (verify works for /services/:slug)
└─ messages/{fr,en}.json                                                # UPDATE — namespace public.serviceDetail.* ~35 keys × 2

packages/ui/src/patterns/ErrorPage/
└─ ErrorPage.tsx                                                        # UPDATE Story 0.5 — add 4ᵉ variant 'listing-unavailable'

packages/ui/src/patterns/EmptyState/
└─ EmptyState.tsx                                                       # UPDATE Story 0.5 — add 8ᵉ variant 'placeholder' (label + icon + sub-text)

apps/public/e2e/services/listing-detail.spec.ts                         # NEW 12 tests AC8

infra/k8s/prometheus-rules/listing-detail.yaml                          # NEW (ListingDetailLatencyHigh alert)
infra/k8s/grafana-dashboards/listing-detail.json                        # NEW (~5 panels)
infra/k6/listing-detail.k6.js                                           # NEW (load test 30 req/s 5min p95 < 200ms)

docs/runbook/nextjs-410-gone-handling.md                                # NEW (~25 lignes)
docs/runbook/listing-detail-debug.md                                    # NEW (~30 lignes)

# Estimation : ~28 nouveaux + ~6 updates = ~34 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.4 (atomics Badge/Stars/Avatar/Placeholder), 0.5 (patterns PricingDisplay/ReviewsDisplay/EmptyState/ErrorPage), 0.9 (TanStack Query + next-intl + i18n CI lint), 0.11 (Lighthouse CI gate SEO ≥ 95 + Accessibility ≥ 90 + LCP < 2,5s), 1.10 (identity-svc internal endpoint /internal/pros/by-id/:id réutilisé pour pro snapshot), 3.1 (Categories taxonomy slug EN strict), 3.2 (catalog-svc Pretre — GetListingDetailUseCase + ListingRepository.findBySlug + locale fallback + ProProfileClient port), 3.4 (Cloudflare Images variants thumbnail/card/detail réutilisés Story 3.10 photo gallery), 3.7 (Meilisearch indexer per locale + ISearchIndexer.search port réutilisé Story 3.10 similar listings), 3.8 (search frontend + ListingCard réutilisé similar grid + PostalCodeCityResolverService réutilisé), 3.9 (hreflang helper apps/public/src/lib/hreflang.ts réutilisé Story 3.10).

1. **API responses envelope ADR-014** — toutes responses gateway-api wrapped `{ method, code, data | error, meta }`. Story 3.10 ne contourne pas. Error envelope avec `tukioCode` mapping codes 410/404.

2. **EN strict path URLs + i18n FR/EN frontend + RGAA AA + latest stable versions + Clean Architecture (domain/ports/usecases sans dépendance infra)** memories — toutes respectées.

3. **NFR3 LCP < 2,5s** — hero photo preload + `loading="eager" fetchpriority="high"` + RSC dynamic mais hydration minimale (mostly static markup).

4. **NFR5 Core Web Vitals SEO** — Lighthouse SEO ≥ 95 via JSON-LD Service + canonical + OG + hreflang systematic (Story 0.11 CI gate).

5. **NFR47 prefers-reduced-motion** — embla-carousel autoplay disabled, transitions 0ms.

6. **NFR58 hreflang systematic** — réutilise helper Story 3.9 `apps/public/src/lib/hreflang.ts`.

7. **NFR50 alt text obligatoire** — `<picture>` alt depuis `photo.altText` Story 3.4 (V1+ fallback auto-generated descriptions).

8. **NFR53 touch targets 44×44 px mobile** — CTA Reserve sticky `<Button size="lg">` (48px) Story 0.5.

9. **NFR60 fallback FR pour contenu UGC EN missing** — backend `GetListingDetailUseCase` Story 3.2 fait fallback. Story 3.10 frontend rend le badge `<Badge variant="info">` UX-DR19.

10. **NFR71 coverage thresholds** — ≥ 90 % critical components, ≥ 85 % gateway, ≥ 80 % helpers/hooks/use cases.

### Previous Story Intelligence

**Story 0.4 (atomics Badge, Stars, Avatar, Placeholder)** : réutilisés directement. `<Badge variant="info">` pour fallback badge AC6. `<Placeholder>` pour map placeholder + availability placeholder.

**Story 0.5 (patterns PricingDisplay, ReviewsDisplay, EmptyState 7 variants, ErrorPage 3 variants)** : Story 3.10 réutilise PricingDisplay + ReviewsDisplay. UPDATE `<ErrorPage>` ajoute 4ᵉ variant 'listing-unavailable'. UPDATE `<EmptyState>` ajoute 8ᵉ variant 'placeholder'.

**Story 0.9 (TanStack Query + next-intl + i18n CI lint + use-debounce)** : Story 3.10 réutilise infrastructure i18n + TanStack Query Suspense pattern.

**Story 0.11 (CI Lighthouse + axe-core + perf budgets)** : Story 3.10 ajoute `/fr/services/<seed-slug>` à budgets Lighthouse + SEO ≥ 95 + LCP < 2,5s + Accessibility ≥ 90 gate.

**Story 1.10 (identity-svc Pretre + /internal/pros/by-id/:id endpoint)** : réutilisé Story 3.10 pour pro snapshot (Story 3.2 ProProfileClient port livré → infrastructure impl call identity-svc).

**Story 3.1 (Catalog data model + categories seed)** : `category.slug` EN strict réutilisé Story 3.10 pour breadcrumb + similar listings filter.

**Story 3.2 (catalog-svc Pretre — Listing aggregate + GetListingDetailUseCase + ProProfileClient port + IListingRepository)** : Story 3.10 consume `GetListingDetailUseCase` (full impl livré) + ajoute 1 nouveau use case `FindSimilarListingsUseCase`.

**Story 3.4 (Cloudflare Images variants thumbnail/card/detail)** : Story 3.10 utilise `urls.detail` hero + `urls.card` similar listings.

**Story 3.5 (publish workflow + median price calc)** : Story 3.10 ne touche pas mais consume publishedAt + categorySlug pour Schema.org Service + similar query.

**Story 3.6 (edit/unpublish/delete listing)** : Story 3.10 doit gracieusement gérer 410 Gone si listing.status='unpublished' OR soft-deleted (Story 3.6 livre les transitions backend, Story 3.10 livre le rendering 410 Gone côté frontend).

**Story 3.7 (Meilisearch indexer per locale)** : Story 3.10 réutilise `ISearchIndexer.search` pour similar listings query par categorySlug + postalCodes.

**Story 3.8 (search frontend + ListingCard atomic réutilisable + PostalCodeCityResolverService)** : Story 3.10 réutilise `<ListingCard>` pour similar listings grid 4 cards + PostalCodeCityResolverService pour resolved city display.

**Story 3.9 (filters + hreflang helper + ListingCard hover prefetch detail variant)** : Story 3.10 consume Story 3.9 `<ListingCard>` enhancement hover prefetch detail variant (Story 3.9 préchauffé pour Story 3.10 LCP optim) + réutilise helper `apps/public/src/lib/hreflang.ts`.

### What this story does NOT do

- ❌ **Réservation booking saga** — Epic 4 (Story 4.1-4.13). Story 3.10 livre seulement le CTA placeholder → `/cart` redirect.
- ❌ **Real availability calendar** (FR28 V1) — Story 3.10 livre `<EmptyState variant="placeholder">` Story 0.5 réutilisé.
- ❌ **Reviews populate** (FR82 Story 5.5 V1) — Story 3.10 livre `<ReviewsSection>` toggle empty/active selon `count > 0`.
- ❌ **Video embed YouTube/Vimeo** (FR27 V1).
- ❌ **InventoryPool partagé** (FR29 V1 Epic 9+).
- ❌ **Customizable cancellation policy per-listing** (V1+ Epic 9 subscription tiers — MVP générique 3 lines).
- ❌ **Map réelle** (V1+ MapTiler/OpenStreetMap — MVP `<Placeholder>` Story 0.4).
- ❌ **Auto-translation DeepL EN missing** (FR101 V1).
- ❌ **Sitemap.xml + robots.txt + structured data audit** (Story 7.3 Epic 7).
- ❌ **Pro public profile page** (Story 3.11 — next story).

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 3.10` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :
1. `apps/catalog-svc/src/usecases-proxy/usecases-proxy.module.ts` (Story 3.2 livré — wire `FindSimilarListingsUseCase`)
2. `packages/ui/src/patterns/ErrorPage/ErrorPage.tsx` (Story 0.5 livré — add 4ᵉ variant 'listing-unavailable')
3. `packages/ui/src/patterns/EmptyState/EmptyState.tsx` (Story 0.5 livré — add 8ᵉ variant 'placeholder')
4. `apps/public/messages/fr.json` + `apps/public/messages/en.json` (namespace public.serviceDetail.* ~35 keys × 2)
5. `apps/public/src/lib/hreflang.ts` (Story 3.9 livré — verify works for /services/:slug route — likely no change needed, helper accepts arbitrary path)
6. `apps/public/e2e/lighthouse.config.{ts,js}` Story 0.11 (add `/fr/services/<seed-slug>` to budgets + SEO ≥ 95 + LCP < 2,5s assertion)

**Lire l'état complet de chaque UPDATE file avant édition** — `ErrorPage.tsx` et `EmptyState.tsx` notamment, pour ajouter le variant sans casser les 3 (404/500/maintenance) et 7 (search-no-results/cart-empty/customer-no-bookings/seller-no-bookings/seller-no-services/messages-empty/reviews-empty) existants.

### Testing Standards

- Coverage ≥ 90 % `ServiceDetailLayout` + `PhotoGallery` + `ListingUnavailableErrorPage`
- Coverage ≥ 85 % gateway controllers + `FindSimilarListingsUseCase`
- Coverage ≥ 80 % `schema-org/Service.tsx` helper + `hreflang.ts` reuse + api-client hooks
- E2E Playwright FR/EN axe-core 0 violations 12 tests AC8
- k6 load test : NFR1 p95 < 200ms gateway roundtrip
- Lighthouse CI Story 0.11 : SEO ≥ 95, Accessibility ≥ 90, LCP < 2,5s gate fail
- Schema.org validation : `schema-dts` v1+ type-check OR Google Rich Results Test API e2e

### Project Structure Notes

✅ **Aligné** architecture.md (project structure 14 codebases + 8 packages + feature-based frontend strict + Pretre backend strict), PRD §FR20 (fiche service complète), §FR98 (URLs locale-prefixées), §FR99-100 (saisie FR obligatoire + EN optionnel + badge fallback), §FR116 (Schema.org JSON-LD), §NFR3 (LCP < 2,5s), §NFR5 (Core Web Vitals SEO), §NFR47 (prefers-reduced-motion), §NFR50 (alt text), §NFR53 (touch targets), §NFR58 (hreflang), §NFR60 (Meilisearch per locale fallback), §NFR71 (coverage), ux-design-specification.md (`service.jsx` figé bundle Cloud Design + composants atomic/pattern + UX patterns), Stories 0.4/0.5/0.9/0.11/1.10/3.1/3.2/3.4/3.5/3.6/3.7/3.8/3.9, memories Tukio (user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions).

⚠️ **Déviations** vs `architecture.md` :
- **URL `/services/<slug>` (plural)** vs architecture line 2092 + ux-design-specification line 241 `/service/<slug>` (singular) — Story 3.10 aligne sur **plural** (epics.md ligne 1544 + Story 3.8 ligne 228). Documents architecture + UX spec à mettre à jour V1+ (PR doc sync ou ADR si débat persistant).
- **Feature folder `features/public/service-detail/`** vs architecture line 2102 `features/service-detail/` (sans `public/` prefix) — Story 3.10 aligne avec convention Stories 3.8/3.9 (`features/public/<feature>/`).

⚠️ **Décisions clés Story 3.10** :
- `dynamic = 'force-dynamic'` Server Component (no static pre-gen MVP — V1+ ISR explore)
- 410 Gone Next.js 15 pattern via middleware.ts (vs Server Component throw) — runbook documenté
- `embla-carousel-react` v8+ choisi vs swiper (perf + RGAA + Tailwind v4)
- JSON-LD Service helper foundation pattern réutilisable Stories 3.11/3.12/7.8
- Reviews + Availability + Cancellation policy = placeholder MVP + toggle activation auto V1+ (sans code change frontend)
- Hreflang réutilise Story 3.9 helper (no duplication)

### References

- [Source: epics.md#Epic-3-Story-3.10 — Lines 1536-1551]
- [Source: prd.md#FR20 (fiche complète), #FR98 (URLs locale), #FR99-100 (fallback FR badge), #FR116 (JSON-LD), #NFR3 (LCP), #NFR5 (SEO Core Web Vitals), #NFR47 (motion), #NFR50 (alt), #NFR53 (touch), #NFR58 (hreflang), #NFR60 (Meilisearch fallback), #NFR71 (coverage)]
- [Source: ux-design-specification.md — UX-DR `service.jsx` figé bundle Cloud Design + composants atomic/pattern + UX patterns + RGAA AA + multilanguage UX UX-DR19]
- [Source: architecture.md — ADR-014 envelope, ADR-013 multi-zones feature-based, project structure §"Frontend Architecture" lines 752-974, §"Project Structure & Boundaries" lines 1990-2241, JSON-LD pattern foundation line 2115 + lines 818-821, FR116 Schema.org]
- [Source: Stories 0.4 (atomics), 0.5 (patterns), 0.9 (TanStack/i18n), 0.11 (Lighthouse CI), 1.10 (identity-svc /internal/pros/by-id), 3.1 (categories), 3.2 (catalog-svc Pretre + GetListingDetailUseCase + ProProfileClient port), 3.4 (CF Images variants), 3.5 (publish + median), 3.6 (edit/unpublish/delete + 410 trigger), 3.7 (Meilisearch + ISearchIndexer port), 3.8 (search frontend + ListingCard + PostalCodeCityResolverService), 3.9 (hreflang helper + ListingCard hover prefetch detail)]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(points d'attention pour Story 3.11 (pro public profile — réutiliser pattern Server Component + generateMetadata + Schema.org Organization helper foundation Story 3.10 + hreflang + similar listings via list-pro-listings.usecase), Story 3.12 (category page — réutiliser pattern + Schema.org ItemList helper + median price display FR31 + ListingCard grid), Story 4.3 (cart UI — Story 3.10 CTA Reserve sticky route placeholder `/{locale}/cart?listingId=...` deviendra route effective avec cart state), Story 5.5 (review aggregate — Story 3.10 ReviewsSection toggle auto active quand `count > 0` populated), Story 5.9 (FR-only badge UI definitive — Story 3.10 livre le badge mécanique Story 5.9 polit l'UX), Story 7.3 (sitemap.xml — Story 3.10 listing detail URLs ajouter au sitemap dynamique), Story 7.8 (SEO foundation Open Graph + structured data audit — Story 3.10 livre pattern foundation `lib/schema-org/Service.tsx`, Story 7.8 systématise BreadcrumbList + LocalBusiness + AggregateRating + Organization)

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-13
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (10ᵉ story Epic 3 — funnel acquisition CTR critique)
- **Estimation effort** : 4-5 jours (1 dev fullstack — 11 composants frontend NEW + JSON-LD helper + 2 gateway endpoints + 1 use case backend + UPDATE 2 patterns @tukio/ui + 12 e2e + Lighthouse CI gate + k6 perf + 2 runbooks, ~34 fichiers)
- **Dépendances upstream** :
  - Stories 0.4, 0.5, 0.9, 0.11 (atomics + patterns + i18n + CI)
  - Stories 1.10 (identity-svc /internal/pros/by-id)
  - Stories 3.1 (categories), 3.2 (catalog-svc + GetListingDetailUseCase), 3.4 (CF Images variants), 3.5 (publish), 3.6 (edit/unpublish/delete 410 trigger), 3.7 (Meilisearch indexer + ISearchIndexer), 3.8 (search + ListingCard), 3.9 (hreflang helper + ListingCard hover prefetch)
- **Dépendances downstream** :
  - Story 3.11 (pro public profile) — réutilise pattern Server Component + Schema.org foundation + hreflang helper
  - Story 3.12 (category page) — réutilise pattern + Schema.org ItemList + median price
  - Story 4.3 (cart UI) — CTA Reserve sticky route placeholder devient effective
  - Story 5.5 (review aggregate) — ReviewsSection toggle auto active
  - Story 5.9 (FR-only badge UI definitive) — pattern mécanique Story 3.10 → UX polit
  - Story 7.3 (sitemap.xml) — listing detail URLs ajoutées
  - Story 7.8 (SEO foundation) — pattern Schema.org systématisé BreadcrumbList + LocalBusiness + AggregateRating + Organization
- **FRs covered** :
  - **FR20** ✅ Visitor peut consulter la fiche complète d'un Service (titre, description, photos, tarifs, options, zone livraison, délai, avis, politique d'annulation)
  - **FR98** ✅ URL locale-prefixée + hreflang systématique (réutilise Story 3.9 helper)
  - **FR99-100** ✅ Fallback FR pour contenu UGC EN missing + badge "Available in French only"
  - **FR116** ✅ JSON-LD Service Schema.org auto
- **NFRs touchés** :
  - **NFR3** ✅ LCP < 2,5s (hero preload + fetchpriority + RSC dynamic)
  - **NFR5** ✅ Core Web Vitals SEO (Lighthouse SEO ≥ 95 gate)
  - **NFR47** ✅ prefers-reduced-motion respect (embla autoplay disabled)
  - **NFR50** ✅ alt text photos
  - **NFR53** ✅ touch targets 44×44 px mobile (Button size="lg" 48px)
  - **NFR58** ✅ hreflang systematic
  - **NFR60** ✅ Meilisearch per locale fallback FR (backend Story 3.2/3.7, frontend badge UI Story 3.10)
  - **NFR71** ✅ coverage thresholds (≥ 90 % critical, ≥ 85 % gateway, ≥ 80 % helpers)

> **Prochaine story → Story 3.11** (Pro public profile page FR21 — `/{locale}/pro/<slug>` réutilise pattern Server Component + Schema.org Organization foundation Story 3.10 + hreflang helper + list-pro-listings.usecase Story 3.2)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.4/0.5/0.9/0.11/1.10/3.1/3.2/3.4/3.5/3.6/3.7/3.8/3.9 implémentées (sprint-status.yaml)
3. Lire l'état complet de chaque UPDATE file avant édition (cf. section "Files to UPDATE vs CREATE")
4. Implémenter Tasks 1-13 dans l'ordre (DTOs → catalog-svc → gateway-api → Server Component page.tsx → composants feature-scoped → error page + similar → Schema.org helper → api-client hooks → i18n → hreflang reuse → métriques → tests + Lighthouse + k6 → runbook + commit)
5. Lancer `pnpm playwright test --grep "listing detail"` après chaque jalon + Lighthouse CI assert SEO ≥ 95 + LCP < 2,5s + k6 perf p95 < 200ms
6. Commit Story 3.10 quand : 12/12 e2e + coverage NFR71 thresholds + axe-core 0 violations + Lighthouse SEO ≥ 95 + Accessibility ≥ 90 + LCP < 2,5s + JSON-LD Schema.org valid (Google Rich Results Test pass) + k6 p95 < 200ms + hreflang head verified + 410 Gone unpublished + 404 not-found gracieux verified
7. Update sprint-status : `3-10-listing-detail-public-page: review` puis `done`
