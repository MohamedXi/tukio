# Story 5.8: Reviews aggregate display Service + Pro + recency weight UI + JSON-LD SEO (FR79, FR82, NFR1, NFR5, NFR50, NFR54)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As a** Visitor anonyme ou Customer authentifié sur tukio.one,
**I want** **consulter les avis agrégés** d'un Service (fiche `/services/<slug>` Story 3.10) ou d'un Pro (profil `/pro/<slug>` Story 3.11) — **rating moyen pondéré FR82** (recency weighting 2× < 6 mois Story 5.5 `RecencyWeightingService` baseline) + **count total** + **distribution barchart** (5/4/3/2/1 étoiles avec barres relatives) + **liste des 10 dernières reviews paginée** + **CTA "Voir tous les avis"** → page dédiée `/services/<slug>/reviews` si > 10 reviews (paginée cursor-based) — avec **badge "Récent"** sur chaque review < 6 mois (FR82 transparency pondération) + **anonymized display** "Marie L." par défaut (Story 5.7 baseline anonymized field) + **JSON-LD aggregateRating + Review schema.org** injecté Server Component pour rich snippets Google Search (NFR5 SEO),
**So that** je peux **évaluer la réputation d'un Service ou d'un Pro en 5 secondes** (signal qualité visuel — rating moyen + distribution + récents) — la transparence FR82 (badge "Récent" + pondération expliquée tooltip) me permet de juger la pertinence (avis 6 mois > avis 3 ans) — la page dédiée `/services/<slug>/reviews` me laisse lire tous les avis si je veux investiguer (paginated cursor pour 100+ reviews popular listings) — Googlebot crawle JSON-LD aggregateRating → rich snippets dans SERP (étoiles + count visible dans résultats Google → CTR boost SEO) — performances respectées (matview Story 5.5 baseline `review_aggregate_mv` < 50ms p95 NFR1).

Story 5.8 livre :

- (a) **Frontend Service detail page Story 3.10 EXTEND** : ajouter section "Avis clients" intégrée dans `apps/public/src/app/[locale]/services/[slug]/page.tsx` Server Component Story 3.10 baseline :
  - Server Component fetch initial via `@tukio/api-client/server` : (1) `getReviewsAggregateForListing(listingId)` (matview lookup ~1ms) + (2) `getListReviews({ listingId, cursor: null, limit: 10 })` (initial 10 reviews)
  - Pass server-fetched data to `<ReviewsSectionClient>` Client Component (hydrate TanStack Query cache via `dehydrate + hydrate` SSR pattern Story 0.9 baseline)
  - **JSON-LD injection** dans `<head>` via Next.js 16 `generateMetadata` OR explicit `<Script type="application/ld+json">` dans page.tsx Server Component (NFR5 — `aggregateRating: { "@type": "AggregateRating", ratingValue, reviewCount, bestRating: 5, worstRating: 1 }` + 5 `Review` items schema.org) — verify Google Rich Results Test post-deploy

- (b) **Frontend Pro profile page Story 3.11 EXTEND** : ajouter section "Avis clients cross-listings" intégrée dans `apps/public/src/app/[locale]/pro/[slug]/page.tsx` :
  - Server Component fetch `getReviewsAggregateForPro(proActorId)` (matview Story 5.5 aggregé cross-listings du Pro) + `getListReviews({ proActorId, cursor: null, limit: 3 })` (3 derniers avis cross-listings)
  - Pro 5+ listings : section "Avis clients agrégés" affiche rating moyen pondéré ALL listings du Pro + count total + 3 derniers (cross-listings — sample diversity)
  - JSON-LD injection : Pro = `Person + AggregateRating` schema.org

- (c) **NEW page dédiée `/services/<slug>/reviews`** (full list paginated cursor) :
  - `apps/public/src/app/[locale]/services/[slug]/reviews/page.tsx` NEW Server Component
  - Fetch initial 50 reviews via `getListReviews({ listingId, limit: 50 })` + breadcrumb `Service > Avis clients`
  - Client Component `<ReviewsListPageClient>` :
    - `<ReviewsDisplay>` Story 0.5 baseline (full breakdown + distribution barchart visible + summary)
    - Infinite scroll via `useInfiniteQuery` `useListReviews` cursor-based + Intersection Observer (Story 5.2 pattern réutilisé)
    - "Filtrer par note" filter `<Select>` Story 0.4 (1-5 stars) → re-fetch avec `?ratingFilter=N` query param
    - "Trier par récent/note" `<Select>` 2 options (default `recent`)
  - Mirror Pro side : NEW page `/pro/<slug>/reviews` même structure

- (d) **`<ReviewsDisplay>` Story 0.5 pattern EXTEND** : ajouter prop `recencyBadge` (optional default false) sur `<ReviewsDisplay.Item>` sub-component — si true ET `reviewedAt > NOW - 6 months` → render `<Badge variant="success" size="sm">` "Récent" Story 0.4 atom (FR82 transparence pondération) + tooltip `<Tooltip>` "Avis < 6 mois — pondéré 2× dans la note globale (FR82)" :
  - `apps/public/src/features/reviews/components/ReviewBubble.tsx` NEW (wrapper de `<ReviewsDisplay.Item>` Story 0.5 baseline + recency logic)
  - Anonymized display via `Review.computeDisplayName(firstName, lastName, anonymized)` Story 5.7 baseline pure method invoked côté backend dans DTO mapping (frontend reçoit déjà `displayName` pré-computed — pas de logic frontend)
  - Avatar : si `anonymized=true` → default `<Avatar variant="initials">` "ML" rendered → si false → real avatar URL si présent OR fallback initials
  - Content : truncate 200 chars + "Lire la suite" toggle → modal `<ReviewDetailModal>` NEW component (full content)
  - Date relative : `formatRelativeTime(reviewedAt, locale)` Story 5.2 baseline helper
  - "Signaler" button → opens `<ReportReviewModal>` Story 5.7 baseline

- (e) **Gateway-api 4 endpoints NEW (no auth required — public Visitor access)** :
  - `GET /v1/listings/:id/reviews-aggregate` — read matview Story 5.5 baseline `IReviewAggregatorPort.getForListing(listingId)` → response `{ averageRating (weighted), totalCount, recentCount, ratingDistribution: { '1': N, '2': N, '3': N, '4': N, '5': N } }`
  - `GET /v1/pros/:id/reviews-aggregate` — read matview pour Pro cross-listings → même shape response
  - `GET /v1/listings/:id/reviews?cursor&limit&ratingFilter?&sortBy?` — paginated list (default limit=10, max=50) + sortBy `recent|rating-desc|rating-asc` + ratingFilter 1-5 optional
  - `GET /v1/pros/:id/reviews?cursor&limit&ratingFilter?` — same shape, cross-listings du Pro
  - All 4 endpoints **NO auth** (`@Public()` decorator NestJS Story 1.4 baseline — public Visitor access) — BUT throttler `60/min IP` anti-scrape
  - Envelope ADR-014 wrapped + pagination meta

- (f) **review-svc 4 internal endpoints NEW** :
  - `GET /internal/listings/:id/reviews-aggregate` → invoke `GetAggregateForListingUseCase` Story 5.5 baseline FULL
  - `GET /internal/pros/:id/reviews-aggregate` → invoke `GetAggregateForProUseCase` Story 5.5 baseline FULL
  - `GET /internal/listings/:id/reviews?cursor&limit&ratingFilter&sortBy` → invoke `ListReviewsByListingUseCase` NEW Story 5.8
  - `GET /internal/pros/:id/reviews?cursor&limit&ratingFilter` → invoke `ListReviewsByProUseCase` NEW Story 5.8
  - InternalServiceGuard HMAC

- (g) **review-svc 2 NEW usecases** :
  - `ListReviewsByListingUseCase` : query `IReviewRepository.findByListingId(listingId, pagination, filters)` — extend Story 5.5 baseline avec optional `ratingFilter` + `sortBy` params — filter `status = 'active'` (exclure `hidden`/`pending_moderation`/`deleted` — auto-hidden Story 5.7 transparent excluded) — return `{ reviews: ReviewWithDisplayNameDto[], nextCursor, hasMore }` — `displayName` computed via `Review.computeDisplayName` Story 5.7 baseline (FR75 anonymized "Marie L.") — populated from `booking_snapshots_replica.customer_first_name + customer_last_name` Story 5.7 denormalized
  - `ListReviewsByProUseCase` : similar but query across all listings du Pro (cross-listings) — `IReviewRepository.findByProActorId(proActorId, pagination, filters)`

- (h) **Story 5.5 `IReviewRepository` EXTEND** : add 4 methods :
  - `findByListingId(listingId, pagination: { cursor?, limit, ratingFilter?, sortBy? }): Promise<{ reviews, nextCursor }>` — Story 5.5 baseline `findByListingId` simple → Story 5.8 EXTEND avec filters + sortBy
  - `findByProActorId(proActorId, pagination: { cursor?, limit, ratingFilter? }): Promise<{ reviews, nextCursor }>`
  - `countByListingId(listingId, ratingFilter?): Promise<number>` (pour pagination total)
  - `countByProActorId(proActorId, ratingFilter?): Promise<number>`

- (i) **3 NEW frontend hooks `@tukio/api-client/hooks/reviews/`** (Story 5.7 baseline EXTEND) :
  - `useAggregateForListing(listingId)` — `useQuery` aggregate matview + 5min staleTime (NFR1 perfs — refresh dépend cron Story 5.5 4h tick) + initialData hydration SSR
  - `useAggregateForPro(proActorId)` — same shape
  - `useListReviews({ listingId | proActorId, ratingFilter?, sortBy? })` — `useInfiniteQuery` cursor-based pagination + initialData SSR hydration

- (j) **JSON-LD aggregateRating + Review schema.org Server Component injection** :
  - `apps/public/src/features/reviews/helpers/build-aggregate-rating-jsonld.ts` NEW server-side helper :
    ```ts
    export function buildAggregateRatingJsonLd(input: {
      itemReviewed: { '@type': 'Service' | 'Person'; name: string; url?: string };
      averageRating: number;
      reviewCount: number;
      reviews: ReviewDto[];                                          // top 5 récents
    }): string {
      return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'AggregateRating',
        itemReviewed: input.itemReviewed,
        ratingValue: input.averageRating.toFixed(1),
        bestRating: 5,
        worstRating: 1,
        ratingCount: input.reviewCount,
        review: input.reviews.slice(0, 5).map(r => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.displayName },         // "Marie L." anonymized Story 5.7
          datePublished: r.reviewedAt,
          reviewBody: r.content.slice(0, 200),                        // truncate same as visible UI
          reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        })),
      });
    }
    ```
  - Page `services/[slug]/page.tsx` Server Component injects `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildAggregateRatingJsonLd(...) }} />` dans `<head>` via `generateMetadata` ou inline `<head>` Next.js 16 pattern
  - Mirror Pro `pro/[slug]/page.tsx` avec `itemReviewed: { '@type': 'Person', name: proDisplayName }`
  - **Validation Google Rich Results Test post-deploy** runbook step

- (k) **i18n FR/EN ~30 strings** dans `apps/public/messages/{fr,en}/services.json` (NEW namespace `reviews_display` + `reviews_full_page` + `recency_badge`) :
  - `reviews_display.title` "Avis clients ({count})"
  - `reviews_display.summary_label` "Note moyenne pondérée"
  - `reviews_display.distribution_label` "Répartition des notes"
  - `reviews_display.no_reviews_yet.title` "Aucun avis pour le moment"
  - `reviews_display.no_reviews_yet.description` "Soyez le premier client à le découvrir !"
  - `reviews_display.cta_view_all` "Voir tous les avis"
  - `reviews_display.read_more` "Lire la suite"
  - `reviews_display.read_less` "Réduire"
  - `reviews_display.report_button` "Signaler"
  - `reviews_display.recency_badge` "Récent"
  - `reviews_display.recency_tooltip` "Avis < 6 mois — pondéré 2× dans la note globale (FR82)"
  - `reviews_display.rating_aria` "{rating} étoiles sur 5"
  - `reviews_display.distribution_bar_aria` "{count} avis avec {rating} étoiles ({percent}%)"
  - `reviews_full_page.title` "Tous les avis de {serviceTitle}"
  - `reviews_full_page.title_pro` "Tous les avis de {proDisplayName}"
  - `reviews_full_page.filter_rating_label` "Filtrer par note"
  - `reviews_full_page.filter_rating_all` "Toutes les notes"
  - `reviews_full_page.sort_by_label` "Trier par"
  - `reviews_full_page.sort_recent` "Plus récents"
  - `reviews_full_page.sort_rating_desc` "Note décroissante"
  - `reviews_full_page.sort_rating_asc` "Note croissante"
  - `reviews_full_page.results_count` "{count, plural, one {# avis trouvé} other {# avis trouvés}}"
  - `reviews_full_page.load_more` "Voir plus d'avis"
  - `reviews_full_page.empty_filter` "Aucun avis avec ce filtre — essayez d'autres critères"

- (l) **A11y RGAA AA enforced** :
  - `<Stars value={4.8}>` Story 0.4 `role="img"` + `aria-label="{rating} étoiles sur 5"` (NOT radiogroup ici — read-only display vs Story 5.7 interactive form)
  - Distribution barchart : `<div role="list">` + chaque barre `<div role="listitem">` avec `aria-label="{count} avis avec {rating} étoiles ({percent}%)"`
  - `<Badge>` "Récent" + `<Tooltip>` keyboard accessible (focus → tooltip visible + ESC dismiss)
  - "Lire la suite" toggle button + `aria-expanded` state + focus management
  - Filter `<Select>` + `<Combobox>` ARIA WAI-ARIA pattern Story 0.4 baseline
  - Pagination "Voir plus" button + `aria-live="polite"` quand new items loaded
  - Lighthouse Accessibility ≥ 90 + axe-core 0 violations sur 4 pages (`/services/:slug` + `/services/:slug/reviews` + `/pro/:slug` + `/pro/:slug/reviews`)

- (m) **NFR1 perfs + matview cache 6×/day** : Story 5.5 baseline matview `review_aggregate_mv` REFRESH CONCURRENTLY 6×/day suffisant pour `<ReviewsDisplay>` aggregate render — Story 5.8 ne touche pas la matview. Read latency < 50ms p95 via UNIQUE index lookup (Story 5.5 baseline benchmark)

- (n) **NFR5 SEO + JSON-LD** : 4 pages Story 5.8 (Service + Pro + 2 dédiées reviews) injectent JSON-LD aggregateRating + Review schema.org via Server Component — verify Google Rich Results Test post-deploy via runbook `docs/runbook/reviews-seo-validation.md` NEW

- (o) **Tests** :
  - **Playwright E2E 8 scenarios** : Service page avec reviews → ReviewsDisplay rendered + badge "Récent" sur < 6m + JSON-LD inspection (`<script type="application/ld+json">` content valide) ; Service sans reviews → EmptyState ; CTA "Voir tous" → /services/<slug>/reviews page + 10 → infinite scroll → 20 → 30 ; filter ratingFilter=5 → ne montre que 5 étoiles ; sortBy rating-desc ; report flow → ReportReviewModal Story 5.7 reused ; Pro profile aggregate cross-listings ; SEO validator script Lighthouse `metaTag aggregateRating`
  - **axe-core 0 violations** sur 4 pages
  - **Lighthouse Accessibility ≥ 90 + SEO ≥ 90** (rich snippets aggregateRating valid)
  - **Hooks unit 6 scenarios** MSW
  - **Gateway E2E 16 scenarios** (4 per endpoint × 4 endpoints)
  - **Usecases unit 8 scenarios** (ListReviewsByListing 4 + ListReviewsByPro 4)
  - **Integration testcontainer 6 scenarios** (filters + pagination cursor + cross-listings query + sortBy + matview lookup + IReviewRepository methods extension)

**So that** Visitor **évalue Service/Pro reputation en 5 secondes** via `<ReviewsDisplay>` summary + distribution + récents — transparence FR82 via badge "Récent" tooltip — page dédiée pour deep-dive si > 10 reviews — Googlebot crawle JSON-LD rich snippets → CTR SEO boost — performances < 50ms p95 NFR1 via matview Story 5.5 — A11y RGAA AA + Lighthouse 90 + axe-core 0 violations — Stories Epic 7 SEO (FR101, FR103) peuvent build sur JSON-LD foundation Story 5.8.

> **Outcome attendu** : à la fin de cette story, un Visitor anonyme sur `https://tukio.one/fr/services/marquee-pornichet` → section "Avis clients (42)" rendered avec `<ReviewsDisplay>` Story 0.5 baseline : note 4.8/5 (pondérée FR82 Story 5.5 RecencyWeightingService) + distribution barchart 5★=28, 4★=10, 3★=3, 2★=1, 1★=0 + 10 dernières reviews "Marie L. ★★★★★ il y a 2 mois — Super pro, marquise impeccable. [Lire la suite]" + 5 reviews avec badge "Récent" (< 6 mois — FR82 tooltip explique pondération) + CTA "Voir tous les avis (42)" → /services/marquee-pornichet/reviews + JSON-LD aggregateRating dans `<head>` ; Googlebot crawle → rich snippets dans SERP étoiles 4.8 + 42 avis ; un Visitor sur Pro profile `/pro/pornichet-events` → section "Avis clients cross-listings" rating 4.7/5 (averaged ALL listings) + 3 derniers avis ; un Visitor sur `/services/marquee-pornichet/reviews` → infinite scroll cursor 10→20→30 + filter par note + sortBy ; un listing sans avis → EmptyState "Aucun avis pour le moment. Soyez le premier client à le découvrir !" ; axe-core 0 violations + Lighthouse Accessibility 90 + SEO 90 ; `pnpm lint && typecheck && test --coverage` exit 0 ; `sprint-status.yaml` flip 5.8 = ready-for-dev → done.

## Acceptance Criteria

1. **AC1 — Frontend Service detail page Story 3.10 EXTEND + section "Avis clients" + JSON-LD** : Given Service page `apps/public/src/app/[locale]/services/[slug]/page.tsx` Story 3.10 baseline, When Story 5.8 EXTEND : (a) Server Component fetch aggregate + 10 initial reviews via `@tukio/api-client/server` ; (b) JSON-LD aggregateRating + Review schema.org injected dans `<head>` (5 top reviews subset) via Server Component ; (c) `<ReviewsSectionClient>` Client Component render `<ReviewsDisplay>` Story 0.5 baseline avec props mapping ; (d) Empty state si 0 reviews via `<EmptyState variant="reviews-empty">` Story 0.5 baseline ; (e) CTA "Voir tous les avis ({count})" visible si `totalCount > 10` → link `/services/[slug]/reviews` Story 5.8 NEW page. Tests Playwright 2 scenarios + JSON-LD validator.

2. **AC2 — Frontend Pro profile page Story 3.11 EXTEND + cross-listings aggregate + 3 derniers reviews** : Given Pro profile page Story 3.11 baseline, When Story 5.8 EXTEND : (a) Server Component fetch `getReviewsAggregateForPro(proActorId)` + `getListReviews({ proActorId, limit: 3 })` ; (b) Section "Avis clients agrégés" rendered si Pro a 5+ listings publiés OR 1+ avis cross-listings ; (c) JSON-LD `Person + AggregateRating` schema.org ; (d) CTA "Voir tous les avis du Pro" → `/pro/[slug]/reviews` Story 5.8 NEW page. Tests Playwright 1 scenario + JSON-LD validator.

3. **AC3 — NEW pages dédiées `/services/[slug]/reviews` + `/pro/[slug]/reviews` (full list paginated)** : Given Story 5.8 NEW Server Component pages, When user clique CTA "Voir tous les avis" : (a) Server Component fetch initial 50 reviews via `getListReviews({ listingId | proActorId, limit: 50 })` + breadcrumb ; (b) Client Component `<ReviewsListPageClient>` render full `<ReviewsDisplay>` Story 0.5 baseline + distribution barchart visible (default hidden sur Service page) ; (c) Infinite scroll via `useInfiniteQuery` `useListReviews` Story 5.8 hook + Intersection Observer Story 5.2 pattern réutilisé (load 50 more per scroll batch) ; (d) Filter `<Select>` "Filtrer par note" 1-5 + "Toutes les notes" → query `?ratingFilter=N` re-fetch ; (e) Sort `<Select>` "Trier par" 3 options `recent|rating-desc|rating-asc` default `recent` → query `?sortBy=...` re-fetch ; (f) Empty filter state → `<EmptyState>` "Aucun avis avec ce filtre" ; (g) Mirror Pro side same structure. Tests Playwright 3 scenarios.

4. **AC4 — `<ReviewsDisplay>` Story 0.5 pattern EXTEND + `<ReviewBubble>` NEW + badge "Récent" FR82 transparency** : Given Story 0.5 baseline `<ReviewsDisplay>` + sub-components (Summary/Breakdown/List/Item), When Story 5.8 EXTEND : (a) NEW prop `recencyBadge: boolean` optional default `false` sur `<ReviewsDisplay.Item>` → si `true` ET `reviewedAt > NOW() - 6 months` → render `<Badge variant="success" size="sm">` "Récent" Story 0.4 atom + `<Tooltip>` "Avis < 6 mois — pondéré 2× dans la note globale (FR82)" keyboard accessible ; (b) NEW `apps/public/src/features/reviews/components/ReviewBubble.tsx` wrapper component qui consume `<ReviewsDisplay.Item>` + ajoute recency logic + "Signaler" button → `<ReportReviewModal>` Story 5.7 baseline + "Lire la suite" toggle → `<ReviewDetailModal>` NEW component pour full content > 200 chars ; (c) Anonymized display via `displayName` field pre-computed côté backend (Story 5.7 `Review.computeDisplayName`) — frontend reçoit "Marie L." ou "Marie Lefèvre" directly. Tests components RTL 4 scenarios + a11y.

5. **AC5 — Gateway-api 4 NEW endpoints @Public + Throttler anti-scrape** : Given Story 5.7 baseline reviews gateway, When Story 5.8 NEW :
   - `GET /v1/listings/:id/reviews-aggregate` + `@Public()` decorator (no auth) + `@Throttle({ public: { limit: 60, ttl: 60_000 } })` anti-scrape
   - `GET /v1/pros/:id/reviews-aggregate` + `@Public()` + Throttler
   - `GET /v1/listings/:id/reviews?cursor&limit&ratingFilter?&sortBy?` Zod validation query params + `@Public()` + Throttler
   - `GET /v1/pros/:id/reviews?cursor&limit&ratingFilter?` Zod query + `@Public()` + Throttler
   - All response envelope ADR-014 wrapped + pagination meta (`{ nextCursor, hasMore, totalCount }`)
   - Errors : 404 listing/pro not found + 422 invalid query params + 429 + Retry-After
   - Tests E2E 16 scenarios (4 per endpoint × 4)

6. **AC6 — review-svc 4 NEW internal endpoints + 2 NEW usecases ListReviewsByListing/ListReviewsByPro** : Given Story 5.5 baseline review-svc, When Story 5.8 NEW :
   - 4 internal endpoints : `GET /internal/listings/:id/reviews-aggregate` (invoke Story 5.5 `GetAggregateForListingUseCase` baseline FULL) + `GET /internal/pros/:id/reviews-aggregate` + `GET /internal/listings/:id/reviews` (invoke `ListReviewsByListingUseCase` NEW) + `GET /internal/pros/:id/reviews` (invoke `ListReviewsByProUseCase` NEW)
   - 2 NEW usecases :
     - `ListReviewsByListingUseCase` : query `IReviewRepository.findByListingId(listingId, pagination, filters)` Story 5.5 baseline EXTEND + filter `status = 'active'` (exclude hidden/pending_moderation/deleted) + cursor-based pagination `reviewed_at DESC NULLS LAST` OR `rating DESC/ASC` selon sortBy + populate `displayName` via Story 5.7 `Review.computeDisplayName` + Story 5.7 `booking_snapshots_replica.customer_first_name/last_name` denormalized → return `{ reviews: ReviewWithDisplayNameDto[], nextCursor, hasMore }`
     - `ListReviewsByProUseCase` : query `IReviewRepository.findByProActorId(proActorId, pagination, filters)` across all listings du Pro
   - Tests unit 4 + 4 = 8 scenarios + integration testcontainer 3

7. **AC7 — Story 5.5 `IReviewRepository` EXTEND 4 methods + raw SQL filters** : Given Story 5.5 baseline `IReviewRepository`, When Story 5.8 EXTEND :
   - `findByListingId(listingId, pagination: { cursor?, limit, ratingFilter?, sortBy? }): Promise<{ reviews, nextCursor }>` — Story 5.5 baseline avait `findByListingId` simple list — Story 5.8 EXTEND avec filters + sortBy via raw SQL conditionnel
   - `findByProActorId(proActorId, pagination: { cursor?, limit, ratingFilter? }): Promise<{ reviews, nextCursor }>`
   - `countByListingId(listingId, ratingFilter?): Promise<number>` (pour `totalCount` pagination meta)
   - `countByProActorId(proActorId, ratingFilter?): Promise<number>`
   - Tests integration testcontainer 4 scenarios (filters, pagination cursor, count match, cross-listings)

8. **AC8 — 3 NEW frontend hooks `@tukio/api-client/hooks/reviews/`** : Given Story 5.7 baseline hooks, When Story 5.8 NEW :
   - `useAggregateForListing(listingId)` `useQuery` + 5min `staleTime` (matview refresh 6×/day Story 5.5) + initialData SSR hydration
   - `useAggregateForPro(proActorId)` same
   - `useListReviews({ listingId | proActorId, ratingFilter?, sortBy? })` `useInfiniteQuery` cursor + filters propagation
   - Tests unit 6 scenarios MSW

9. **AC9 — JSON-LD aggregateRating + Review schema.org Server Component injection** : Given Story 5.8 frontend pages, When Server Component render :
   - NEW `apps/public/src/features/reviews/helpers/build-aggregate-rating-jsonld.ts` server-side pure helper (cf. (j) code)
   - Service page `services/[slug]/page.tsx` : `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildAggregateRatingJsonLd({ itemReviewed: { '@type': 'Service', name: serviceName, url }, ... }) }} />` injecté dans `<head>` ou inline body (Next.js 16 pattern)
   - Pro profile `pro/[slug]/page.tsx` : `itemReviewed: { '@type': 'Person', name: proDisplayName }`
   - Reviews dedicated pages : full Review schema.org list (top 50 returned)
   - **Validation** : runbook `docs/runbook/reviews-seo-validation.md` NEW — Google Rich Results Test URL deploy + Lighthouse SEO ≥ 90
   - Tests E2E 2 scenarios JSON-LD content validator (parse JSON dans `<script>` + assert valid schema.org)

10. **AC10 — A11y RGAA AA + axe-core 0 violations + Lighthouse Accessibility ≥ 90** : Given Story 0.4 atoms + Story 0.5 pattern, When Story 5.8 render :
    - `<Stars>` read-only display `role="img"` + `aria-label` (NOT radiogroup — distinct Story 5.7 interactive)
    - Distribution barchart : `<div role="list">` + `<div role="listitem">` + `aria-label` per bar
    - `<Badge>` "Récent" + `<Tooltip>` focus accessible + ESC dismiss
    - "Lire la suite" `<Button aria-expanded>` toggle
    - Filter `<Select>` ARIA WAI-ARIA combobox pattern
    - "Voir plus" pagination + `aria-live="polite"` on items added
    - Lighthouse Accessibility ≥ 90 + SEO ≥ 90 (rich snippets aggregateRating)
    - axe-core 0 violations sur 4 pages
    - Tests Playwright 4 a11y specs + Lighthouse CI

11. **AC11 — i18n FR/EN ~30 strings + namespace `reviews_display` + `reviews_full_page` + `recency_badge`** : Given next-intl Story 1.2d pattern, When Story 5.8 :
    - UPDATE `apps/public/messages/{fr,en}/services.json` — add 3 namespaces ~30 strings (cf. (k) liste)
    - ICU plural pour `reviews_full_page.results_count`
    - Zero hardcoded text NFR56-57 enforced lint
    - Tests render snapshot 4 pages avec localized strings appear in HTML

12. **AC12 — `<ReviewDetailModal>` NEW component pour "Lire la suite" full content** : Given Story 5.7 baseline modal pattern, When Story 5.8 user clique "Lire la suite" sur review tronquée > 200 chars : (a) NEW `apps/public/src/features/reviews/components/ReviewDetailModal.tsx` ; (b) `<Modal>` Story 0.4 atom + focus trap + ESC close + scroll body internal ; (c) Affiche full content + Stars + date + displayName + "Signaler" button → `<ReportReviewModal>` Story 5.7 baseline nested OR replace modal ; (d) Mirror dans `apps/seller/` si Pro consulte reviews côté seller subdomain (V1+ pas applicable MVP — Story 5.8 Visitor public uniquement). Tests Playwright 1 scenario.

## Tasks / Subtasks

- [ ] **Task 1 — Story 5.5 `IReviewRepository` EXTEND 4 new methods + raw SQL filters** (AC: #7)
  - [ ] 1.1 — UPDATE `apps/review-svc/src/domain/ports/review-repository.ts` — add `findByListingId` EXTEND signature avec filters + sortBy + `findByProActorId` + `countByListingId` + `countByProActorId`
  - [ ] 1.2 — UPDATE `apps/review-svc/src/infrastructure/persistence/typeorm-review.repository.ts` Story 5.5 baseline — impl 4 methods avec raw SQL conditionnel + cursor-based pagination
  - [ ] 1.3 — Tests integration testcontainer 4 scenarios

- [ ] **Task 2 — 2 NEW usecases ListReviewsByListing + ListReviewsByPro** (AC: #6)
  - [ ] 2.1 — NEW `apps/review-svc/src/usecases/list-reviews-by-listing.usecase.ts` (query + filter status='active' + populate displayName Story 5.7 baseline)
  - [ ] 2.2 — NEW `apps/review-svc/src/usecases/list-reviews-by-pro.usecase.ts` (cross-listings query)
  - [ ] 2.3 — NEW DTO `ReviewWithDisplayNameDto` (review + displayName pre-computed)
  - [ ] 2.4 — UPDATE `apps/review-svc/src/usecases-proxy/usecases-proxy.module.ts` — add 2 PROXY tokens
  - [ ] 2.5 — Tests unit 8 scenarios

- [ ] **Task 3 — review-svc 4 NEW internal endpoints** (AC: #6)
  - [ ] 3.1 — UPDATE `apps/review-svc/src/infrastructure/controllers/internal-reviews.controller.ts` Story 5.7 baseline — add 4 GET endpoints
  - [ ] 3.2 — NEW DTOs Zod query params `{ListingsReviewsAggregateQueryDto, ProsReviewsAggregateQueryDto, ListReviewsQueryDto}`
  - [ ] 3.3 — Tests E2E 8 scenarios (2 per endpoint × 4)

- [ ] **Task 4 — gateway-api 4 NEW endpoints @Public + Throttler anti-scrape** (AC: #5)
  - [ ] 4.1 — UPDATE `apps/gateway-api/src/reviews/reviews.controller.ts` Story 5.7 baseline — add 4 GET endpoints @Public + Throttler
  - [ ] 4.2 — NEW 4 forwarders `{listing-aggregate, pro-aggregate, list-listing-reviews, list-pro-reviews}-forwarder.usecase.ts`
  - [ ] 4.3 — UPDATE `apps/gateway-api/src/reviews/clients/review-svc.client.ts` Story 5.7 — add 4 client methods
  - [ ] 4.4 — UPDATE `apps/gateway-api/src/throttler/throttler.config.ts` — add `publicReviews: 60/min` scope
  - [ ] 4.5 — Tests E2E 16 scenarios (4 per endpoint × 4)

- [ ] **Task 5 — 3 NEW frontend hooks `@tukio/api-client/hooks/reviews/`** (AC: #8)
  - [ ] 5.1 — NEW `packages/api-client/src/hooks/reviews/use-aggregate-for-listing.ts` (`useQuery` + staleTime + initialData SSR)
  - [ ] 5.2 — NEW `packages/api-client/src/hooks/reviews/use-aggregate-for-pro.ts` (same shape)
  - [ ] 5.3 — NEW `packages/api-client/src/hooks/reviews/use-list-reviews.ts` (`useInfiniteQuery` cursor + filters + sortBy)
  - [ ] 5.4 — NEW types `packages/api-client/src/types/reviews.ts` Story 5.7 baseline EXTEND — add `ReviewWithDisplayNameDto` + `AggregateDto` + `ListReviewsResponse`
  - [ ] 5.5 — UPDATE `packages/api-client/src/hooks/index.ts` — export subpath
  - [ ] 5.6 — Tests unit 6 scenarios MSW

- [ ] **Task 6 — `<ReviewsDisplay>` Story 0.5 pattern EXTEND + `<ReviewBubble>` + `<ReviewDetailModal>`** (AC: #4, #12)
  - [ ] 6.1 — UPDATE `packages/ui/src/patterns/ReviewsDisplay/ReviewsDisplay.tsx` Story 0.5 — add `recencyBadge` prop sur `<ReviewsDisplay.Item>` sub-component + Tooltip
  - [ ] 6.2 — NEW `apps/public/src/features/reviews/components/ReviewBubble.tsx` (wrapper consume Story 0.5 Item + recency logic + Signaler button)
  - [ ] 6.3 — NEW `apps/public/src/features/reviews/components/ReviewDetailModal.tsx` (Modal Story 0.4 + full content + nested ReportReviewModal Story 5.7)
  - [ ] 6.4 — NEW helper `apps/public/src/features/reviews/helpers/format-review-date.ts` (réutilise Story 5.2 baseline)
  - [ ] 6.5 — Tests components RTL 4 scenarios + Playwright modal interaction 1

- [ ] **Task 7 — Frontend Service detail Story 3.10 EXTEND + section Avis clients + JSON-LD** (AC: #1, #9)
  - [ ] 7.1 — UPDATE `apps/public/src/app/[locale]/services/[slug]/page.tsx` Story 3.10 baseline — Server Component fetch aggregate + 10 reviews + JSON-LD injection
  - [ ] 7.2 — NEW `apps/public/src/features/reviews/components/ReviewsSectionClient.tsx` (Client Component hydrate + ReviewsDisplay Story 0.5 wired)
  - [ ] 7.3 — NEW `apps/public/src/features/reviews/helpers/build-aggregate-rating-jsonld.ts` (server-side pure helper schema.org)
  - [ ] 7.4 — Tests Playwright E2E 2 scenarios + JSON-LD validator

- [ ] **Task 8 — Frontend Pro profile Story 3.11 EXTEND + cross-listings aggregate** (AC: #2, #9)
  - [ ] 8.1 — UPDATE `apps/public/src/app/[locale]/pro/[slug]/page.tsx` Story 3.11 baseline — Server Component fetch Pro aggregate + 3 derniers avis + JSON-LD Person+AggregateRating
  - [ ] 8.2 — Tests Playwright E2E 1 scenario

- [ ] **Task 9 — NEW pages dédiées `/services/[slug]/reviews` + `/pro/[slug]/reviews` (full list paginated)** (AC: #3)
  - [ ] 9.1 — NEW `apps/public/src/app/[locale]/services/[slug]/reviews/page.tsx` Server Component
  - [ ] 9.2 — NEW `apps/public/src/app/[locale]/pro/[slug]/reviews/page.tsx`
  - [ ] 9.3 — NEW `apps/public/src/features/reviews/components/ReviewsListPageClient.tsx` (infinite scroll + filter + sortBy)
  - [ ] 9.4 — Tests Playwright E2E 3 scenarios

- [ ] **Task 10 — i18n FR/EN ~30 strings** (AC: #11)
  - [ ] 10.1 — UPDATE `apps/public/messages/{fr,en}/services.json` — add `reviews_display` + `reviews_full_page` + `recency_badge` namespaces
  - [ ] 10.2 — ICU plural pour `results_count` FR + EN
  - [ ] 10.3 — Verify no hardcoded text lint

- [ ] **Task 11 — A11y RGAA AA + axe-core + Lighthouse** (AC: #10)
  - [ ] 11.1 — `<Stars>` read-only `role="img"` + aria-label
  - [ ] 11.2 — Distribution barchart `<div role="list">` + per-bar aria-label
  - [ ] 11.3 — `<Badge>` "Récent" + `<Tooltip>` keyboard accessible
  - [ ] 11.4 — Pagination "Voir plus" + `aria-live="polite"`
  - [ ] 11.5 — Tests Playwright axe-core 4 specs + Lighthouse SEO + Accessibility ≥ 90

- [ ] **Task 12 — Documentation + runbook SEO validation** (no AC — docs)
  - [ ] 12.1 — NEW `docs/runbook/reviews-seo-validation.md` (Google Rich Results Test URL deploy + Lighthouse SEO ≥ 90 + JSON-LD inspector)
  - [ ] 12.2 — UPDATE `docs/runbook/review-svc-bootstrap.md` Story 5.5 baseline — add Story 5.8 endpoints + matview NFR1 perfs check
  - [ ] 12.3 — UPDATE `docs/project-context.md` — extend Reviews section
  - [ ] 12.4 — UPDATE `_bmad-output/implementation-artifacts/5-5-review-svc-pretre-review-aggregate.md` Completion Notes — note IReviewRepository EXTEND 4 methods Story 5.8 + 2 NEW usecases List
  - [ ] 12.5 — UPDATE `_bmad-output/implementation-artifacts/0-5-implement-composite-patterns-tukio-ui.md` Completion Notes — note `<ReviewsDisplay>` recencyBadge prop EXTEND Story 5.8

- [ ] **Task 13 — Validation & Commit**
  - [ ] 13.1 — `pnpm lint && pnpm typecheck` 0 errors
  - [ ] 13.2 — `pnpm test --coverage` NFR71 maintained
  - [ ] 13.3 — Tests integration testcontainer green
  - [ ] 13.4 — Playwright E2E 8 scenarios + axe-core 0 + Lighthouse ≥ 90 + JSON-LD validator green
  - [ ] 13.5 — Commit `feat(review-svc,gateway-api,api-client,public,packages/ui): Story 5.8 reviews aggregate display Service + Pro + recency badge FR82 transparency + JSON-LD aggregateRating SEO NFR5 — 2 NEW usecases ListReviewsByListing + ListReviewsByPro + 4 review-svc internal endpoints + 4 gateway-api endpoints @Public + Throttler publicReviews 60/min + 3 hooks @tukio/api-client + Service detail EXTEND + Pro profile EXTEND + 2 NEW pages dédiées full list paginated + <ReviewsDisplay> recencyBadge prop + <ReviewBubble> + <ReviewDetailModal> + buildAggregateRatingJsonLd helper + ~30 i18n strings + a11y RGAA AA + axe-core 0 + Lighthouse 90 + IReviewRepository EXTEND 4 methods + runbook reviews-seo-validation`
  - [ ] 13.6 — PR title `Story 5.8 — Reviews aggregate display + recency weight + JSON-LD SEO` ; target `develop`

## Dev Notes

### Story 5.8 livre

**Backend (review-svc + gateway-api) :**

1. **Story 5.5 `IReviewRepository` EXTEND** 4 methods (findByListingId avec filters + sortBy + findByProActorId + 2 count methods) — raw SQL conditionnel + cursor pagination
2. **2 NEW usecases** : `ListReviewsByListingUseCase` (filter status='active' + populate displayName Story 5.7 baseline + cursor pagination) + `ListReviewsByProUseCase` (cross-listings)
3. **4 NEW review-svc internal endpoints** : `GET /internal/listings/:id/reviews-aggregate` + `GET /internal/pros/:id/reviews-aggregate` + `GET /internal/listings/:id/reviews` + `GET /internal/pros/:id/reviews`
4. **4 NEW gateway-api endpoints** : @Public no auth (Visitor anonymous access) + Throttler `publicReviews: 60/min` anti-scrape + Zod validation + envelope ADR-014

**Frontend (public) :**

1. **Service detail page Story 3.10 EXTEND** : section "Avis clients" intégrée + JSON-LD injection Server Component
2. **Pro profile page Story 3.11 EXTEND** : section cross-listings + JSON-LD Person+AggregateRating
3. **NEW 2 pages dédiées** `/services/[slug]/reviews` + `/pro/[slug]/reviews` (Server Component + full list paginated infinite scroll + filter + sortBy)
4. **`<ReviewsDisplay>` Story 0.5 pattern EXTEND** : `recencyBadge` optional prop sur Item sub-component + Tooltip FR82 transparency
5. **NEW components** : `<ReviewBubble>` wrapper (recency logic + Signaler button) + `<ReviewDetailModal>` full content > 200 chars + `<ReviewsSectionClient>` + `<ReviewsListPageClient>`
6. **3 NEW hooks `@tukio/api-client/hooks/reviews/`** : useAggregateForListing + useAggregateForPro + useListReviews
7. **JSON-LD `buildAggregateRatingJsonLd` server-side helper** schema.org aggregateRating + Review subset top 5
8. **~30 i18n strings** namespaces (reviews_display + reviews_full_page + recency_badge)
9. **A11y RGAA AA + axe-core 0 + Lighthouse Accessibility + SEO ≥ 90**

**Tests : ~60 scenarios totale**

### Story 5.8 NE livre PAS (déféré Stories 5.9/V1+)

- ❌ **Badge "Available in FR only" si EN absent** → **Story 5.9** (FR100)
- ❌ **Reviews multi-critères breakdown (precision/communication/etc.)** → **V1+ Epic 12 Story 12.2** (Story 5.8 affiche overall rating uniquement, Story 0.5 baseline Breakdown sub-component présent mais Story 5.8 disable car données pas dispo MVP)
- ❌ **Pro réponse publique sur review** → **V1+ Epic 12 Story 12.2**
- ❌ **Email digest week digest "Vos derniers avis"** → **V1+** (Story 5.4 baseline pas concerné)
- ❌ **Admin moderation UI (review-svc Story 6.3)** → **Epic 6**
- ❌ **Reviews export CSV/PDF Pro dashboard** → **V1+ Epic 9** (Pro export)

### Dependencies inputs (Stories livrées)

| Story | Livrable réutilisé Story 5.8 |
|-------|--------------------------------|
| 0.2 | `@tukio/contracts` envelope ADR-014 |
| 0.4 | `<Stars>` + `<Badge>` + `<Avatar>` + `<Modal>` + `<Tooltip>` + `<Select>` + `<EmptyState>` atoms |
| 0.5 | **`<ReviewsDisplay>` Story 0.5 pattern baseline** (Summary + Breakdown + List + Item sub-components) — Story 5.8 EXTEND `recencyBadge` prop |
| 0.6 | Pretre scaffolding + envelope interceptor |
| 0.9 | `@tukio/testing` testcontainer helpers + axe-core Playwright |
| 0.11 | CI workflow + Lighthouse |
| 1.2c | gateway forwarder pattern (axios + axios-retry HMAC + ThrottlerModule scopes) |
| 1.4 | `@Public()` decorator NestJS Story 1.4 baseline (no auth) |
| 3.10 | **Service detail page Story 3.10 baseline** — Story 5.8 EXTEND section "Avis clients" |
| 3.11 | **Pro profile page Story 3.11 baseline** — Story 5.8 EXTEND cross-listings section |
| 5.2 | `formatRelativeTime` helper + Intersection Observer infinite scroll pattern + initialData SSR hydration |
| 5.5 | **review-svc Pretre + Review aggregate + ReviewReport + IReviewRepository baseline (Story 5.8 EXTEND 4 methods) + GetAggregateForListing/Pro usecases FULL Story 5.5 baseline + RecencyWeightingService pure logic FR82 + matview review_aggregate_mv 6×/day CONCURRENT REFRESH + IReviewAggregatorPort + tukio_review DB** — Story 5.8 consume baseline pas modifie domain |
| 5.7 | **`anonymized` field + `Review.computeDisplayName` static pure + `booking_snapshots_replica.customer_first_name/last_name` denormalized + `<ReportReviewModal>` baseline** — Story 5.8 consume directement (frontend reçoit `displayName` pre-computed dans DTO) |

### Architecture compliance

- ✅ **ADR-001 Clean Architecture Pretre 4ème référence Story 5.5 maintained** : 2 NEW usecases orchestrent ports baseline Story 5.5 — pas de domain modif.
- ✅ **ADR-003 DB per service** : `tukio_review` exclusively — matview Story 5.5 baseline + replica firstName/lastName Story 5.7 baseline.
- ✅ **ADR-006 Saga choreographed** : pas d'event NEW émis Story 5.8 — pure read-side use cases.
- ✅ **ADR-014 envelope REST canonique** : 4 gateway endpoints wrap response + pagination meta.
- ✅ **NFR1 perfs reads** : matview Story 5.5 baseline lookup < 50ms p95 via UNIQUE index — Story 5.8 ne touche pas matview.
- ✅ **NFR5 SEO** : JSON-LD aggregateRating + Review schema.org injected Server Component — Google Rich Results Test validation runbook.
- ✅ **NFR50/54 a11y** : RGAA AA + axe-core 0 + Lighthouse ≥ 90.
- ✅ **NFR56-57 zero hardcoded text** : ~30 i18n strings.
- ✅ **NFR71 coverage** : maintained.
- ✅ **NFR82 audit** : Story 5.8 = read-side only, pas d'audit event.

### File structure

```
apps/review-svc/src/
  domain/ports/review-repository.ts                                  # UPDATE — add 4 methods (findByListingId EXTEND + findByProActorId + 2 count)
  usecases/
    list-reviews-by-listing.usecase.ts                               # NEW Story 5.8
    list-reviews-by-pro.usecase.ts                                   # NEW Story 5.8
  usecases-proxy/usecases-proxy.module.ts                            # UPDATE — add 2 PROXY tokens
  infrastructure/
    persistence/typeorm-review.repository.ts                          # UPDATE Story 5.5 — impl 4 methods raw SQL
    controllers/internal-reviews.controller.ts                        # UPDATE Story 5.7 — add 4 GET endpoints

apps/gateway-api/src/reviews/
  reviews.controller.ts                                               # UPDATE Story 5.7 — add 4 @Public GET endpoints + Throttler
  usecases/{listing-aggregate,pro-aggregate,list-listing-reviews,list-pro-reviews}-forwarder.usecase.ts  # NEW × 4
  clients/review-svc.client.ts                                        # UPDATE Story 5.7 — add 4 methods
  throttler/throttler.config.ts                                       # UPDATE — add publicReviews 60/min scope

packages/api-client/src/hooks/reviews/
  use-aggregate-for-listing.ts                                        # NEW
  use-aggregate-for-pro.ts                                            # NEW
  use-list-reviews.ts                                                 # NEW
  index.ts                                                             # UPDATE subpath exports

packages/ui/src/patterns/ReviewsDisplay/
  ReviewsDisplay.tsx                                                  # UPDATE Story 0.5 — add recencyBadge prop

apps/public/src/
  app/[locale]/services/[slug]/
    page.tsx                                                          # UPDATE Story 3.10 — add reviews section + JSON-LD
    reviews/page.tsx                                                  # NEW Story 5.8 (full list paginated)
  app/[locale]/pro/[slug]/
    page.tsx                                                          # UPDATE Story 3.11 — add reviews cross-listings + JSON-LD
    reviews/page.tsx                                                  # NEW
  features/reviews/
    components/
      ReviewBubble.tsx                                                # NEW (wrapper Story 0.5 Item + recency + Signaler)
      ReviewDetailModal.tsx                                           # NEW (full content > 200 chars)
      ReviewsSectionClient.tsx                                        # NEW (Client Component Service/Pro page hydrate)
      ReviewsListPageClient.tsx                                       # NEW (infinite scroll + filter + sortBy)
    helpers/
      build-aggregate-rating-jsonld.ts                                # NEW (server-side helper)
      format-review-date.ts                                           # NEW (réutilise pattern Story 5.2)

apps/public/messages/
  fr/services.json + en/services.json                                # UPDATE (~30 keys × 2)

docs/
  runbook/reviews-seo-validation.md                                  # NEW

_bmad-output/implementation-artifacts/
  5-5-review-svc-pretre-review-aggregate.md                          # UPDATE Completion Notes
  0-5-implement-composite-patterns-tukio-ui.md                       # UPDATE Completion Notes
```

### JSON-LD output example (Service page)

```json
{
  "@context": "https://schema.org",
  "@type": "AggregateRating",
  "itemReviewed": {
    "@type": "Service",
    "name": "Marquise tente Pornichet Events",
    "url": "https://tukio.one/fr/services/marquee-pornichet"
  },
  "ratingValue": "4.8",
  "bestRating": 5,
  "worstRating": 1,
  "ratingCount": 42,
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Marie L." },
      "datePublished": "2026-03-15T18:30:00Z",
      "reviewBody": "Super pro, marquise impeccable. Installation rapide et équipe sympa…",
      "reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5 }
    }
    // ... 4 more reviews top 5
  ]
}
```

### Lib / framework choices

| Lib | Usage Story 5.8 | Version | Why |
|-----|------------------|---------|-----|
| Next.js 16 App Router | Server Component + JSON-LD injection + Server fetch | latest (Story 0.13b baseline) | RSC initialData hydration |
| TanStack Query | useQuery + useInfiniteQuery cursor pagination | latest (Story 0.9 baseline) | SSR hydration + cursor |
| `@tukio/ui` ReviewsDisplay + Stars + Badge + Modal + Tooltip + Select + EmptyState | UI atoms + pattern | workspace (Story 0.4/0.5 baseline) | Réutilisés |
| `@tukio/api-client` | useAggregateForListing/Pro + useListReviews | workspace | NEW hooks |
| Zod | DTO validation gateway + frontend types | latest | No class-validator |
| Playwright + axe-core + Lighthouse CI | E2E + a11y + SEO | latest | NFR5/50/54 |
| `next-intl` | ~30 i18n strings + ICU plural | latest | FR/EN parité |

### Previous Story Intelligence (5.5 + 5.7 + 0.5 + 3.10/3.11)

- **Story 5.5 patterns réutilisés** : matview baseline + GetAggregateForListing/Pro usecases FULL + RecencyWeightingService FR82 + IReviewRepository (Story 5.8 EXTEND 4 methods) + IReviewAggregatorPort + `tukio_review` DB
- **Story 5.7 patterns réutilisés** : `Review.computeDisplayName` pure + `anonymized` field + `booking_snapshots_replica.customer_first_name/last_name` denormalized + `<ReportReviewModal>` component
- **Story 0.5 patterns réutilisés** : `<ReviewsDisplay>` baseline (Summary + Breakdown + List + Item) — Story 5.8 EXTEND `recencyBadge` prop sur Item — pas de refactor majeur, juste extension
- **Story 3.10 patterns réutilisés** : Service detail page Server Component structure — Story 5.8 ajoute section reviews + JSON-LD
- **Story 3.11 patterns réutilisés** : Pro profile page structure
- **Story 5.2 patterns réutilisés** : initialData SSR hydration + Intersection Observer infinite scroll + cursor-based pagination

### Project Context Reference

- **PRD §FR79** — Visitor reviews aggregate display — **Story 5.8 livre full**
- **PRD §FR82** — Recency weight 2× < 6m — **Story 5.8 livre UI transparency badge + tooltip**
- **PRD §NFR1** — Perfs reads < 150ms Meilisearch (related ~50ms matview Story 5.5 baseline)
- **PRD §NFR5** — SEO + JSON-LD rich snippets — **Story 5.8 livre full**
- **PRD §NFR50/54** — A11y RGAA AA + Lighthouse — Story 5.8 enforced
- **PRD §NFR56-57** — Zero hardcoded text
- **PRD §NFR71** — Coverage — maintained
- **Architecture §Pattern Pretre canonique** — Story 5.5 4ème référence maintained
- **Architecture §DB-per-service ADR-003** — matview Story 5.5
- **Architecture §Envelope REST ADR-014** — 4 gateway endpoints wrap
- **ADR-001/003/014** — strict respect
- **Stories livrées** : 0.2, 0.4, 0.5, 0.6, 0.9, 0.11, 1.2c, 1.4, 3.10, 3.11, 5.2, 5.5, 5.7
- **Memories Tukio** : `feedback_clean_architecture_explicit`, `feedback_api_envelope_response`, `feedback_tech_layer_english`, `feedback_i18n_frontend`, `feedback_comprehensive_briefs`

### Project Structure Notes

- 4 review-svc internal endpoints + 4 gateway endpoints + 2 NEW usecases + IReviewRepository EXTEND 4 methods + 3 hooks @tukio/api-client + 4 Next.js pages (2 EXTEND + 2 NEW) + 4 components NEW + 1 ReviewsDisplay pattern EXTEND + 1 helper JSON-LD + ~30 i18n strings + 1 runbook SEO + ~60 test scenarios totale
- No new service — pure extension Stories 5.5/5.7 + Frontend Stories 3.10/3.11 baselines
- Coverage NFR71 maintained
- NFR5 SEO baked-in via JSON-LD

### Testing

| Layer | Framework | Coverage cible | Story 5.8 scenarios |
|-------|-----------|----------------|----------------------|
| Domain | Jest unit | ≥ 80 % (Story 5.5 baseline maintained) | No domain changes |
| Usecases | Jest unit | ≥ 70 % | ListReviewsByListing (4) + ListReviewsByPro (4) = 8 |
| Infrastructure | Jest integration testcontainer | ≥ 50 % | IReviewRepository EXTEND 4 methods (4) + 4 internal endpoints (8) = 12 |
| Hooks frontend | @testing-library/react + MSW | All hooks tested | 3 hooks × 2 = 6 |
| Gateway E2E | Jest E2E supertest | 4 endpoints × 4 | 16 scenarios |
| Playwright E2E | Playwright + axe-core | 8 critical paths | 8 scenarios (Service page + Pro page + 2 dédiées + EmptyState + filter + JSON-LD validator + modal "Lire la suite") |
| A11y | axe-core | 0 violations 4 pages | 4 specs |
| Lighthouse | CI | Accessibility + SEO ≥ 90 | 4 specs |
| **Total** | | | **~60 test scenarios** |

### References

- [Source: epics.md#Story-5.8 (lines 1999-2012)]
- [Source: epics.md#Epic-5 (lines 1813-1822)]
- [Source: prd.md#FR79 (aggregate display)]
- [Source: prd.md#FR82 (recency weight)]
- [Source: prd.md#NFR1 (perfs reads)]
- [Source: prd.md#NFR5 (SEO JSON-LD)]
- [Source: prd.md#NFR50/54 (a11y + Lighthouse)]
- [Source: prd.md#NFR56-57 (zero hardcoded)]
- [Source: prd.md#NFR71 (coverage)]
- [Source: architecture.md#Pattern-Pretre-canonique]
- [Source: architecture.md#Envelope-REST (ADR-014)]
- [Source: implementation-artifacts/5-5-review-svc-pretre-review-aggregate.md (matview baseline + GetAggregate usecases + IReviewRepository + RecencyWeightingService)]
- [Source: implementation-artifacts/5-7-customer-leave-review-report-abuse.md (Review.computeDisplayName + anonymized + booking_snapshots_replica firstName/lastName)]
- [Source: implementation-artifacts/0-5-implement-composite-patterns-tukio-ui.md (ReviewsDisplay pattern baseline + sub-components)]
- [Source: implementation-artifacts/3-10-listing-detail-public-page.md (Service detail page Story 3.10 baseline)]
- [Source: implementation-artifacts/3-11-pro-public-profile-page.md (Pro profile Story 3.11 baseline)]
- [Source: implementation-artifacts/5-2-conversation-thread-ui.md (infinite scroll + initialData SSR hydration pattern)]
- [Source: .agents/context/atomic-design.md (ReviewsDisplay pattern)]
- [Source: .agents/context/rest-envelope.md (ADR-014)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-create-story workflow `_bmad/bmm/skills/bmad-create-story` adapté ACS Tukio (`{user_name}=Ismael`, `{communication_language}=Français`, `{document_output_language}=Français`)

### Debug Log References

(populated during dev-story)

### Completion Notes List

(populated during dev-story)

### File List

(populated during dev-story)
