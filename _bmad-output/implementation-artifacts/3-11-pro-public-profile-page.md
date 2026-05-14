# Story 3.11: Pro public profile page (FR21)

Status: ready-for-dev

## Story

**As a** Visitor (B2C particulier ou Pro découvrant la marketplace) qui clique le **nom du Pro** affiché sur une fiche service Story 3.10 `<ListingHeader>` (NEW Story 3.10 — pro.name est cliquable + link vers `/{locale}/pro/<slug>`) OR clique un Pro listing Card Story 3.8 + footer carte "Voir le profil pro" V1+ OR atterrit via Google SERP long-tail "Event Co Nantes avis location chapiteau" → atterrit sur `/{locale}/pro/<slug>` ,
**I want** Server Component RSC dynamic rendering Next.js 15 qui reproduit le bundle Cloud Design figé `screens/pro-profile.jsx` :
- (a) **`<ProHeaderHero>`** (NEW Story 3.11 feature-scoped) : Breadcrumb `Accueil > Pros > {city}` (Story 7.3 future sitemap) + grand layout 2-column desktop (1-column mobile) :
  - **Avatar** : `<Avatar size="2xl" initials={...} src={pro.avatar?.urls.detail}>` Story 0.4 atomic réutilisé. **MVP** : initials uniquement (computed from `companyName` — premières 2 lettres uppercase, e.g., "EC" pour "Event Co") avec background terracotta token + foreground cream. **V1+** : upload avatar Pro via Story 1.8 profile management extended → render image variant `urls.detail` Story 3.4 CF Images
  - **H1 Fraunces** `text-4xl font-display charcoal-800` : `pro.companyName` (display preserved exactly comme saisi Story 1.3 — pas anonymisé même si Pro deleted RGPD Story 1.9 car companyName = légal SIRET retention 10 ans)
  - **Badge "Vérifié depuis MM/YYYY"** : `<Badge variant="success" icon={<ShieldCheck>}>` Story 0.4 réutilisé — affiché si `pro.verifiedSince != null` (= `pro_profiles.kyc_decision_at` quand `kyc_status='approved'` Story 2.5 livré). Format date locale-aware via `next-intl` `format.dateTime({ year: 'numeric', month: 'long' })` → "Vérifié depuis mai 2026" (FR) / "Verified since May 2026" (EN)
  - **Reviews mini-summary** : `<Stars value={reviewsAggregate.average} count={reviewsAggregate.count}>` Story 0.4 atomic — rendu conditionnel si `count > 0` else hidden MVP (Story 5.5 V1+ populate)
  - **Location** : icône `<MapPin>` Lucide + texte "{city} — {address.country}" depuis `pro.address.city` + `pro.address.country` (FR par défaut MVP — Story 1.3 livré ProProfile fields)
  - **Member since** : sous-texte gris "Membre Tukio depuis {createdAt formatted}" — informatif uniquement, valeur pour SEO + confiance
- (b) **`<ProBioSection>`** (NEW feature-scoped) : H2 "À propos" + `<article>` prose Tailwind Typography `prose-charcoal max-w-prose` content `pro.bio` (NEW field pro_profiles — Story 3.11 ajoute migration, MVP optional + nullable — FR11 portfolio V1+) :
  - **MVP** : si `pro.bio == null` → `<EmptyState variant="placeholder">` Story 0.5 réutilisé avec icône `<User>` Lucide + label "Ce pro n'a pas encore rédigé sa bio" + sous-texte "Contactez-le directement pour en savoir plus" (V1+ Pro UI Story 1.8 extended pour saisir bio + portfolio FR11)
  - **V1+ portfolio (FR11)** : section additionnelle "Portfolio" avec galerie photos travaux + équipe + certifications (déféré — Story 3.11 livre uniquement `<ProBioSection>` bio text MVP, Story V1+ FR11 ajoute `<ProPortfolioSection>` séparée)
- (c) **`<ProServicesSection>`** (NEW feature-scoped) : H2 "Services proposés ({listings.length})" + grid responsive de `<ListingCard>` Story 3.8 réutilisé (1 col mobile, 2 cols sm, 3 cols md+) :
  - **Backend** : `list-pro-listings.usecase` Story 3.2 livré **filtered `status='published'`** (cursor pagination Story 2.3 pattern réutilisé — MVP all-in-one page no pagination si < 50 listings ; V1+ paginate si > 50 — UX-DR `pro-profile.jsx` figé montre grid simple)
  - **Empty state** : `<EmptyState variant="seller-no-services">` Story 0.5 réutilisé MVP — "Ce pro n'a pas encore de service publié" + sous-texte (pas de CTA → Visitor ne peut pas créer service pour le pro). **WAIT** — `seller-no-services` variant Story 0.5 a un CTA "Créer mon premier service" pour seller, donc Story 3.11 utilise plutôt `<EmptyState variant="placeholder">` Story 0.5 (livré Story 3.10 UPDATE) avec icône `<Box>` Lucide + label "Aucun service disponible pour le moment"
  - **Hover prefetch** : Story 3.9 livré `<ListingCard>` enhancement hover prefetch `urls.detail` (préchauffe LCP Story 3.10 future navigation fluide) — réutilisé naturellement
  - **Click `<ListingCard>`** → `router.push('/{locale}/services/<slug>')` Story 3.10 (même rendu que via search — AC mentionné epic line 1562)
- (d) **`<ProReviewsSection>`** (NEW feature-scoped) wraps `<ReviewsDisplay>` Story 0.5 atomique pattern (idem Story 3.10 toggle pattern) :
  - **MVP placeholder** : `reviews.aggregate.count === 0` (data Story 5.5 V1 populates) → `<EmptyState variant="reviews-empty">` Story 0.5 réutilisé "Aucun avis encore" + sous-texte "Soyez le premier client à laisser un avis"
  - **V1+ active** : `<ReviewsDisplay rating={...} count={...} breakdown={...} reviews={sample}>` avec 3 derniers reviews (epic AC line 1561) + CTA "Voir tous les avis" si `count > 10` → modale ou page dédiée `/{locale}/pro/<slug>/reviews` V1+ (Story 3.11 MVP livre le wrapper qui rend EmptyState ou ReviewsDisplay selon data — toggle automatique au futur populate Story 5.8 sans code change frontend)
  - **Display "Utilisateur supprimé"** propagé : si un Customer review-er a été soft-deleted RGPD Story 1.9 → `<ReviewsDisplay.Item>` Story 0.5 rend `firstName + lastName` qui retournera déjà `"Utilisateur supprimé"` (anonymisation Story 1.9 propagée naturellement)
- (e) **`<CtaContactSection>`** (NEW feature-scoped) MVP placeholder — CTA secondaire "Contacter le pro" `<Button variant="secondary" size="lg">` Story 0.5 :
  - **MVP behavior** : click → `router.push('/{locale}/search?proSlug=<slug>')` (placeholder — re-direct vers SERP filtered by pro, MVP no direct contact form. **Anti-désintermédiation R10/FR45** : pas de contact direct hors-plateforme.)
  - **V1+ Epic 5** : Story 5.3 messaging livre flow "Demander un devis" depuis pro profile → opens chat thread pré-booking — Story 3.11 MVP livre le CTA → route placeholder qui redirige search filtered (gracieux dégradement)
- (f) **JSON-LD `Organization` schema.org** (FR116) — NEW Story 3.11 helper `apps/public/src/lib/schema-org/Organization.tsx` **étend pattern foundation Story 3.10** (livré `Service.tsx`) :
  ```jsonld
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "<pro.companyName>",
    "description": "<pro.bio ?? generic fallback FR/EN i18n>",
    "image": "<pro.avatar?.urls.detail ?? null>",
    "url": "https://tukio.one/{locale}/pro/<slug>",
    "address": { "@type": "PostalAddress", "streetAddress": "<address.street>", "postalCode": "<address.postalCode>", "addressLocality": "<address.city>", "addressCountry": "<address.country>" },
    "foundingDate": "<pro.createdAt>",
    "vatID": "<pro.vatNumber ?? skip>",
    "taxID": "<pro.siret>",  // FR SIRET 14 digits — Google indexable pour rich snippets B2B
    "aggregateRating": <reviews.aggregate.count > 0 ? { "@type": "AggregateRating", "ratingValue": "<avg>", "reviewCount": "<count>", "bestRating": "5", "worstRating": "1" } : undefined>,
    "hasOfferCatalog": { "@type": "OfferCatalog", "name": "Services proposés par <companyName>", "itemListElement": <listings.map(l => ({ '@type': 'Offer', name: l.title, price: l.pricing.amount / 100, priceCurrency: l.pricing.currency, url: 'https://tukio.one/{locale}/services/<l.slug>' }))> }
  }
  ```
  Injected via `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />` dans Server Component — pattern Story 3.10 réutilisé
- (g) **NFR58 hreflang systematic** (réutilise Story 3.9 helper `apps/public/src/lib/hreflang.ts`) → `generateMetadata` Server Component returns `alternates: { canonical: ..., languages: { fr: ..., en: ..., 'x-default': ... } }` Next.js 15 metadata API (idem Story 3.10 pattern)
- (h) **`<ProUnavailableErrorPage>`** (NEW feature-scoped) — Next.js 15 `error.tsx` + `not-found.tsx` patterns (idem Story 3.10 pattern réutilisé) :
  - **Backend signals unavailable** : `GET /v1/pros/<slug>` returns 410 Gone enveloppe avec :
    - `error.tukioCode = 'IDENTITY-PRO-DELETED-001'` si `pro_profiles.deleted_at != null` (soft-delete RGPD Story 1.9)
    - `error.tukioCode = 'IDENTITY-PRO-SUSPENDED-002'` si `tukio_status='suspended'` (Story 6.5 admin ban — V1+ — mais code path ready MVP)
    - `error.tukioCode = 'IDENTITY-PRO-REJECTED-003'` si `tukio_status='rejected'` (Story 2.5 admin rejet)
    - `error.tukioCode = 'IDENTITY-PRO-PENDING-004'` si `tukio_status='pending_admin_review'` (Pro pas encore validé — profil pas public)
    - 404 Not Found si slug doesn't exist with `error.tukioCode = 'IDENTITY-PRO-NOT-FOUND-005'`
  - **Server Component handling** : `try/catch` → `<ProUnavailableErrorPage variant="deleted | suspended | rejected | pending | not-found">` wraps `<ErrorPage variant="entity-unavailable">` Story 0.5 — **UPDATE Story 3.10 atomic** (Story 3.10 livré variant `'listing-unavailable'`, Story 3.11 le **renomme `'entity-unavailable'` plus générique** OR ajoute 5ᵉ variant `'pro-unavailable'`). **Décision Story 3.11** : rename `'listing-unavailable'` → `'entity-unavailable'` (générique réutilisable Stories 3.11 + 3.12 + V1+) — Story 3.10 implement utilise déjà code path generic donc rename safe + UPDATE Story 3.10 file references (sed renamer dans story file MD, pas commit code Story 3.10 — code commit fera Story 3.10 review fix avec nouveau nom)
  - **Variants copy** :
    - `deleted` — "Ce profil a été supprimé." + CTA Retour catégorie + Page d'accueil
    - `suspended` — "Ce profil est temporairement indisponible." + CTAs idem
    - `rejected` — "Ce profil n'est pas disponible." + CTAs idem (générique pour ne pas révéler admin decision)
    - `pending` — "Ce profil est en cours de validation. Revenez bientôt !" + CTAs idem
    - `not-found` — "Aucun pro trouvé à cette adresse." + CTA Page d'accueil + Voir tous les pros (search filtered)
  - **HTTP status code 410 Gone** : pattern Story 3.10 réutilisé (middleware.ts `x-tukio-status: 410` + NextResponse — runbook `docs/runbook/nextjs-410-gone-handling.md` Story 3.10 livré)
  - **Similar pros suggestions** (gracieux dégradement) : `GET /v1/pros/<slug>/similar?limit=4` (NEW endpoint Story 3.11 — Meilisearch query par `address.city` proximity OR fallback top-rated pros same `address.region` — graceful 0 results hide section). Stretch goal MVP — skip si scope tight.
- (i) **i18n FR/EN strict** namespace `public.proProfile.*` ~30 keys × 2 locales (section titles, bio empty placeholder, services empty placeholder, reviews empty placeholder, CTA contact, error variants, verified badge format, member since format, breadcrumb labels)

**so that** Sophie consulte la fiche `/fr/services/chapiteau-100m2-blanc-chic` Story 3.10 → clique le nom "Event Co Nantes" → navigue `/fr/pro/event-co-nantes-x7k3` → page Pro profile (Server Component RSC dynamic rendering, no static pre-gen MVP — Sprint 4) → reproduce `pro-profile.jsx` figé : avatar initials "EC" + H1 "Event Co Nantes" + badge "Vérifié depuis mai 2026" + bio Marc + grid 3 services publiés + reviews placeholder MVP + CTA "Contacter le pro" placeholder Epic 5 + JSON-LD Organization + hreflang FR/EN ; Sophie EN charge `/en/pro/<slug>` → contenu rendu avec section bio fallback générique EN si bio.en absent ; un Visitor charge slug Pro deleted RGPD `/fr/pro/old-pro-2024` → 410 Gone `<ProUnavailableErrorPage variant="deleted">` ; un Googlebot crawle → SEO score Lighthouse ≥ 95 (Story 0.11 CI) ; un test `pnpm playwright test --grep "pro profile"` passe FR/EN axe-core 0 violations 10 scénarios (header avatar initials + badge verified, bio placeholder MVP, services grid + click navigate Story 3.10, reviews empty placeholder MVP, JSON-LD Organization valid Google Rich Results Test, hreflang head injection, 410 Gone deleted + suspended + rejected + pending variants, 404 not-found, RGAA kbd nav + axe-core 0, locale switch URL preserved) ; coverage ≥ 90 % ProProfileLayout + ProUnavailableErrorPage + 85 % gateway endpoints + 80 % helpers (schema-org Organization, hreflang reuse).

## Acceptance Criteria

1. **AC1 — DB migration `pro_profiles` UPDATE — slug + bio fields** : Given Story 1.3 livre `pro_profiles` table (companyName, siret, vatNumber, address JSON, contactPhone, kyc_status, kyc_decision_at, tukio_status) — sans slug ni bio, When Story 3.11 ajoute migration `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddProProfileSlugAndBio.ts`, Then :
   - **Add column `slug VARCHAR(100) NOT NULL UNIQUE`** — populated via backfill script generated from `companyName` slugify + 6-char nanoid suffix (Story 3.2 `Slug.fromTitle` pattern réutilisé — `slugify` v1.6+ + `nanoid` latest stable v5+ already in monorepo) :
     ```ts
     // up()
     await queryRunner.query('ALTER TABLE pro_profiles ADD COLUMN slug VARCHAR(100) NULL');
     // Backfill : iterate existing pro_profiles, generate slug = slugify(companyName).slice(0, 90) + '-' + nanoid(6) lowercase
     const rows = await queryRunner.query('SELECT id, company_name FROM pro_profiles WHERE deleted_at IS NULL');
     for (const row of rows) {
       const baseSlug = slugify(row.company_name, { lower: true, strict: true, locale: 'fr', trim: true }).slice(0, 90);
       const slug = baseSlug + '-' + nanoid(6).toLowerCase();
       await queryRunner.query('UPDATE pro_profiles SET slug = $1 WHERE id = $2', [slug, row.id]);
     }
     await queryRunner.query('ALTER TABLE pro_profiles ALTER COLUMN slug SET NOT NULL');
     await queryRunner.query('CREATE UNIQUE INDEX idx_pro_profiles_slug ON pro_profiles (slug) WHERE deleted_at IS NULL');
     ```
   - **Add column `bio TEXT NULL`** with CHECK constraint `CHECK (bio IS NULL OR (length(bio) >= 1 AND length(bio) <= 2000))` (FR11 V1 portfolio — MVP bio optional)
   - **Update `ProProfile` aggregate Story 1.3 livré** + factory `register({...})` — slug auto-generated at register time (Story 1.3 UPDATE — Story 3.11 patch).
   - **Update Story 1.3 `pro-profile.aggregate.ts` factory** : add `slug` generation in `register({...})` method. **UPDATE file documented dans Files to UPDATE section** : read full state before modifying.
   - **Down migration** : DROP slug + bio columns + index (réversible)
   - Tests integration testcontainer Postgres 6 cases : migration up + down + slug uniqueness + check constraint bio length + backfill idempotent (re-run no duplicate) + slug regex `/^[a-z0-9]+(-[a-z0-9]+)*$/` Story 3.2 VO format

2. **AC2 — Backend `GET /v1/pros/{slug}` gateway endpoint + similar pros endpoint + 410 Gone mapping** : Given AC1 + Story 3.2 livré `list-pro-listings.usecase` + Story 1.10 livré internal endpoints pattern, When Story 3.11 wire backend, Then :
   - **NEW DTO** `packages/contracts/src/dtos/identity/pro-public-profile.dto.ts` :
     ```ts
     export const ProPublicProfileResponseSchema = z.object({
       pro: z.object({
         id: z.string().uuid(),
         slug: z.string(),
         companyName: z.string(),
         bio: z.string().nullable(),
         avatar: z.object({ urls: z.object({ thumbnail: z.string().url(), card: z.string().url(), detail: z.string().url() }) }).nullable(),
         address: z.object({ city: z.string(), postalCode: z.string(), country: z.string() }), // partial public (no street privacy)
         verifiedSince: z.string().datetime().nullable(),
         createdAt: z.string().datetime(),
         siret: z.string().nullable(), // exposed for Schema.org Organization taxID — public legal info FR
         vatNumber: z.string().nullable(), // optional
       }),
       listings: z.array(z.object({ /* MeilisearchListingDocument shape Story 3.7 OR full ListingCard shape — reuse Meilisearch shape — */ })), // filtered status='published'
       reviewsAggregate: z.object({
         average: z.number().min(0).max(5),
         count: z.number().int().nonnegative(),
         distribution: z.record(z.string(), z.number()).optional(), // V1+ Story 5.8
       }),
       reviewsSample: z.array(z.object({ /* Story 5.x review shape */ })).max(3), // MVP empty []
     });
     ```
   - **NEW DTO** `packages/contracts/src/dtos/identity/similar-pros.dto.ts` — Story 3.11 (réutilise partial `ProPublicProfileResponse.pro` shape minus PII fields — id, slug, companyName, avatar, city, verifiedSince, reviewsAggregate)
   - **NEW identity-svc internal endpoint** `apps/identity-svc/src/infrastructure/http/controllers/internal-pro-public.controller.ts` (NEW Story 3.11 — co-located avec Story 1.10 internal controllers) :
     - `GET /internal/pros/by-slug/:slug?locale=fr|en` — query Postgres `pro_profiles JOIN user_profiles` (cross-aggregate read OK in same service) + return ProPublicProfileResponse.pro shape OR throw 4 differentiated exceptions :
       - `ProDeletedException('IDENTITY-PRO-DELETED-001')` si `pro_profiles.deleted_at != null` OR `user_profiles.deleted_at != null`
       - `ProSuspendedException('IDENTITY-PRO-SUSPENDED-002')` si `tukio_status='suspended'` (Story 6.5 V1+ enum — Story 1.3 livré enum baseline may not include 'suspended' yet → Story 3.11 UPDATE Story 1.3 enum to add 'suspended' OR Story 3.11 stub MVP enum exposed via TukioUserStatus type Story 2.5)
       - `ProRejectedException('IDENTITY-PRO-REJECTED-003')` si `tukio_status='rejected'` (Story 2.5 livré)
       - `ProPendingException('IDENTITY-PRO-PENDING-004')` si `tukio_status='pending_admin_review'`
       - `ProNotFoundException('IDENTITY-PRO-NOT-FOUND-005')` si slug doesn't exist
     - `GET /internal/pros/by-slug/:slug/similar?limit=4` (NEW) — query Postgres `WHERE address->>'city' = source.address->>'city' AND id != source.id AND deleted_at IS NULL AND tukio_status='active' AND kyc_status='approved' ORDER BY kyc_decision_at DESC LIMIT 4` (V1+ Meilisearch index pros if needed for richer ranking — MVP simple Postgres city match)
   - **NEW gateway-api controller** `apps/gateway-api/src/infrastructure/http/controllers/pros.controller.ts` (NEW Story 3.11) :
     - `GET /v1/pros/:slug` — slug Zod regex validation + forwards to identity-svc internal + parallel catalog-svc internal `GET /internal/listings/by-pro/:proProfileId?status=published&limit=50` (NEW catalog-svc internal endpoint Story 3.11 — wraps `list-pro-listings.usecase` Story 3.2 livré) + review-svc internal `GET /internal/aggregates/pro/:proProfileId` (Story 5.5/5.8 V1+ — MVP stub returns `{ average: 0, count: 0 }`)
     - `GET /v1/pros/:slug/similar?limit=4` — forwards to identity-svc internal
     - Cache HTTP `Cache-Control: public, max-age=120, stale-while-revalidate=600` (Story 3.10 pattern — Pro profile moins dynamique que listing detail, cache 2min OK)
     - Throttle `60/min/IP`
     - **Error mapping ADR-014** : map 4 identity-svc exceptions → 410 Gone with `error.tukioCode` correspondant + 404 Not Found for IDENTITY-PRO-NOT-FOUND-005
   - **NEW catalog-svc internal endpoint** `apps/catalog-svc/src/infrastructure/http/controllers/internal-pro-listings.controller.ts` (NEW Story 3.11 — wraps `list-pro-listings.usecase` filtered status='published') — pattern Story 3.10 internal controller reused
   - **review-svc stub** : Story 5.5 V1+ pas encore livré — Story 3.11 gracieux dégradement : si review-svc HTTP unreachable → catch + default `{ average: 0, count: 0, distribution: {}, sample: [] }`. Pattern Story 1.9 `IBookingSvcClient` stub réutilisé.
   - Tests integration testcontainer Postgres + Meilisearch 10 scenarios :
     - T1 happy path GET /v1/pros/:slug locale=fr → 200 envelope full shape
     - T2 happy path locale=en → 200 with bio fallback FR (V1+ EN translations — MVP bio FR-only stored Story 1.3 → return same bio + meta.fallbackUsed if applicable)
     - T3 deleted pro → 410 Gone IDENTITY-PRO-DELETED-001
     - T4 suspended pro → 410 Gone IDENTITY-PRO-SUSPENDED-002
     - T5 rejected pro → 410 Gone IDENTITY-PRO-REJECTED-003
     - T6 pending pro → 410 Gone IDENTITY-PRO-PENDING-004
     - T7 non-existent slug → 404 IDENTITY-PRO-NOT-FOUND-005
     - T8 similar pros endpoint returns 4 by city
     - T9 review-svc unreachable → graceful default `{ count: 0 }`
     - T10 listings filtered status='published' (no draft/pending_moderation leak)

3. **AC3 — `apps/public/src/app/[locale]/pro/[slug]/page.tsx` Server Component + `generateMetadata`** : Given AC2, When je consulte le file (NEW Story 3.11), Then :
   - **Server Component** (`export const dynamic = 'force-dynamic'` MVP — pattern Story 3.10 réutilisé, V1+ ISR explore) :
     ```tsx
     export default async function Page({ params }: { params: Promise<{ locale: 'fr' | 'en'; slug: string }> }) {
       const { locale, slug } = await params;
       const [detailResponse, similarResponse] = await Promise.allSettled([
         fetchProPublicProfile(slug, locale),
         fetchSimilarPros(slug, locale, 4),
       ]);
       if (detailResponse.status === 'rejected') {
         const err = detailResponse.reason;
         const variantMap = {
           'IDENTITY-PRO-DELETED-001': 'deleted',
           'IDENTITY-PRO-SUSPENDED-002': 'suspended',
           'IDENTITY-PRO-REJECTED-003': 'rejected',
           'IDENTITY-PRO-PENDING-004': 'pending',
         } as const;
         if (err.tukioCode in variantMap) {
           const similar = similarResponse.status === 'fulfilled' ? similarResponse.value : [];
           return <ProUnavailableErrorPage variant={variantMap[err.tukioCode]} similar={similar} />;
         }
         if (err.tukioCode === 'IDENTITY-PRO-NOT-FOUND-005') notFound();
         throw err;
       }
       const detail = detailResponse.value.data;
       return (
         <>
           <Organization jsonLd={buildOrganizationJsonLd(detail, locale)} />
           <ProProfileLayout detail={detail} locale={locale} />
         </>
       );
     }
     ```
   - **`generateMetadata`** Server function returns Next.js 15 Metadata :
     ```tsx
     export async function generateMetadata({ params }: { params: Promise<{ locale, slug }> }): Promise<Metadata> {
       const { locale, slug } = await params;
       const detail = await fetchProPublicProfile(slug, locale).catch(() => null);
       if (!detail) return { title: 'Profil indisponible', robots: { index: false } };
       const desc = detail.pro.bio?.slice(0, 160) ?? `${detail.pro.companyName} sur Tukio — ${detail.listings.length} services à ${detail.pro.address.city}`;
       return {
         title: `${detail.pro.companyName} | Tukio`,
         description: desc,
         alternates: { canonical: `https://tukio.one/${locale}/pro/${slug}`, languages: buildHreflangMap(`/${locale}/pro/${slug}`) },
         openGraph: { title: detail.pro.companyName, description: desc, images: detail.pro.avatar?.urls.detail ? [detail.pro.avatar.urls.detail] : [], type: 'profile' },
         twitter: { card: 'summary', images: detail.pro.avatar?.urls.detail ? [detail.pro.avatar.urls.detail] : [] },
       };
     }
     ```
   - Tests Vitest 5 scenarios (render locale=fr + en, deleted → ProUnavailableErrorPage variant, not-found → notFound() 404, metadata canonical, JSON-LD rendered)

4. **AC4 — `<ProProfileLayout>` orchestrator + 5 feature-scoped components** : Given AC3, When je consulte `apps/public/src/features/public/pro-profile/components/`, Then :
   - **NEW `ProProfileLayout.tsx`** orchestrator
   - **NEW `ProHeaderHero.tsx`** (avatar initials + H1 + badge verified + stars mini + location + member since)
   - **NEW `ProBioSection.tsx`** (bio prose OR placeholder MVP)
   - **NEW `ProServicesSection.tsx`** (grid `<ListingCard>` Story 3.8 réutilisé + EmptyState placeholder)
   - **NEW `ProReviewsSection.tsx`** (wraps `<ReviewsDisplay>` Story 0.5 toggle empty/active selon count > 0)
   - **NEW `CtaContactSection.tsx`** (CTA placeholder Epic 5 → router.push search filtered by pro)
   - **NEW `ProUnavailableErrorPage.tsx`** (5 variants — réutilise `<ErrorPage variant="entity-unavailable">` Story 0.5 — renommé depuis 'listing-unavailable' Story 3.10)
   - Tests `@testing-library/react` + axe-core 8 scenarios (header render with/without avatar/verifiedSince/reviewsAggregate, bio placeholder, services grid + empty, reviews placeholder, CTA contact, all 5 variants ProUnavailableErrorPage)
   - Coverage ≥ 90 % ProProfileLayout + ProUnavailableErrorPage

5. **AC5 — `<ErrorPage>` Story 0.5 UPDATE — rename 'listing-unavailable' → 'entity-unavailable' + accommodate Story 3.11** : Given Story 3.10 livré 4ᵉ variant `'listing-unavailable'` (UPDATE Story 0.5 ErrorPage.tsx), When Story 3.11 needs generic entity-unavailable variant for pros, Then :
   - **UPDATE** `packages/ui/src/patterns/ErrorPage/ErrorPage.tsx` Story 0.5/3.10 :
     - Rename variant `'listing-unavailable'` → `'entity-unavailable'`
     - Generic props : `entityType: 'listing' | 'pro' | 'category'` (extensible Stories 3.12 + V1+) + `headlineKey`, `descriptionKey`, `ctas: Array<{ label, href, variant }>`
     - Default subtitle copy uses i18n keys from `commons.errors.entityUnavailable.{listing,pro,category}.{title,description}` — Story 3.11 ajoute keys `commons.errors.entityUnavailable.pro.*` × 2 locales
   - **UPDATE Story 3.10 file** `_bmad-output/implementation-artifacts/3-10-listing-detail-public-page.md` (already ready-for-dev — pre-implementation update) : `<ErrorPage variant="listing-unavailable">` → `<ErrorPage variant="entity-unavailable" entityType="listing">`. **Document MD doc sync** — no impact code (Story 3.10 not yet implemented, fresh start).
   - **Backwards-compatibility** : Story 0.5 ErrorPage.tsx tests pattern (variant '404', '500', 'maintenance', 'listing-unavailable') → tests UPDATE Story 3.11 rename variant string
   - Tests : 6 scenarios ErrorPage (4 original variants + 'entity-unavailable' with entityType='listing' + 'entity-unavailable' with entityType='pro') — coverage maintained ≥ 90 %

6. **AC6 — JSON-LD `Organization` Schema.org helper — étend Story 3.10 foundation** : Given FR116 + Story 3.10 livré `apps/public/src/lib/schema-org/Service.tsx` + helper foundation pattern, When je consulte `apps/public/src/lib/schema-org/Organization.tsx` (NEW Story 3.11 — étend pattern), Then :
   - **Helper `buildOrganizationJsonLd(detail, locale)`** returns `Record<string, unknown>` Schema.org Organization spec (cf. story body section f)
   - **`<Organization>` component** renders `<script type="application/ld+json">` (pattern Story 3.10 `<Service>` réutilisé)
   - **AggregateRating sub-schema** : included si `count > 0` (idem Story 3.10 toggle)
   - **HasOfferCatalog OfferCatalog** : nested ItemList des `listings.map(l => Offer)` — riche structured data B2B Google Knowledge Graph ingestion
   - **Tests** : 5 scenarios (valid Schema.org Organization type, aggregateRating conditional, address PostalAddress structured, hasOfferCatalog correct mapping, taxID + vatID legal compliance) — coverage ≥ 80 %
   - **Foundation continuation** : Stories 3.12 (ItemList JSON-LD category), 7.8 (LocalBusiness + BreadcrumbList systematic) utilisent même pattern `lib/schema-org/` directory

7. **AC7 — `@tukio/api-client` hooks `useProPublicProfile` + `useSimilarPros` + UPDATE catalog hooks** : Given AC2 + Story 3.10 livré `useListingDetail` + `useSimilarListings`, When Story 3.11 wires identity hooks (NEW), Then :
   - **NEW hook** `packages/api-client/src/hooks/identity/useProPublicProfile.ts` :
     ```ts
     export function useProPublicProfile(slug: string, locale: 'fr' | 'en') {
       return useSuspenseQuery({
         queryKey: ['pro-public-profile', slug, locale],
         queryFn: () => apiClient.get<ProPublicProfileResponse>(`/v1/pros/${slug}?locale=${locale}`).then(unwrapEnvelope),
         staleTime: 2 * 60 * 1000, // 2min
       });
     }
     export function useSimilarPros(slug: string, locale: 'fr' | 'en', limit = 4) {
       return useQuery({
         queryKey: ['similar-pros', slug, locale, limit],
         queryFn: () => apiClient.get<SimilarProsResponse>(`/v1/pros/${slug}/similar?locale=${locale}&limit=${limit}`).then(unwrapEnvelope),
         staleTime: 10 * 60 * 1000, // 10min
       });
     }
     ```
   - **Architecture line 2225** référence `useProProfile` hook — Story 3.11 livre (différent du concept `useProfile` Story 1.8 pour authenticated `/v1/me` — `useProPublicProfile` est public, no auth required)
   - Tests Vitest 3 scenarios (hook fetch happy, similar deferred refetch, error 410 propagation)

8. **AC8 — i18n FR/EN namespace `public.proProfile.*` ~30 keys × 2 locales** : Given AC4, When :
   - **i18n namespace `public.proProfile.*`** :
     ```
     header.{verifiedSinceFormat,memberSinceFormat,locationFormat,avatarInitialsAria}
     bio.{title,emptyPlaceholder,emptyPlaceholderHint,readMore,readLess}
     services.{title,titleWithCount,emptyTitle,emptyHint}
     reviews.{title,emptyMessage,emptyHint,seeAllCta,distributionLabel}
     cta.{contactLabel,contactAria,contactDisabledV1Note}
     errors.{deleted,suspended,rejected,pending,notFound}.{title,description,ctaCategory,ctaHome,similarTitle}
     breadcrumb.{home,prosList,proName}
     ```
   - **i18n namespace `commons.errors.entityUnavailable.{listing,pro,category}.*`** (cf. AC5 ErrorPage UPDATE)
   - **i18n namespace `commons.placeholders.proAvatarFallback`** (Avatar initials Aria description)
   - Tests : CI `pnpm i18n:audit` Story 0.9 réutilisé (both files contain all keys, no orphans)

9. **AC9 — Métriques + tests Playwright e2e + Lighthouse SEO ≥ 95 + perf** : Given AC1-8, When :
   - **Métriques NEW** (extend Story 3.10 metrics) :
     - `tukio_pro_profile_views_total{locale,city,has_avatar,has_bio}` (counter — analytics)
     - `tukio_pro_profile_fetch_duration_seconds` (histogram — gateway → identity + catalog + review parallel fetch p95)
     - `tukio_pro_unavailable_total{variant}` (counter — 410/404 occurrences)
     - `tukio_similar_pros_fetch_duration_seconds` (histogram)
     - `tukio_pro_profile_lcp_seconds` (histogram Lighthouse CI Story 0.11 ingest — Web Vitals client-side)
   - **Prometheus alert** `ProProfileLatencyHigh` `histogram_quantile(0.95, tukio_pro_profile_fetch_duration_seconds_bucket) > 0.500` for 5m → warning Slack
   - **Dashboard Grafana NEW** `infra/k8s/grafana-dashboards/pro-profile.json` (NEW Story 3.11 ~5 panels — symetric to listing-detail.json Story 3.10)
   - **Tests Playwright e2e** 10 scenarios :
     - T1-2 happy proProfile FR + EN content render full
     - T3 avatar initials computed correctly (e.g., "EC" for "Event Co")
     - T4 verified badge format date locale-aware FR/EN
     - T5 services grid click `<ListingCard>` navigates `/{locale}/services/{slug}` Story 3.10
     - T6 reviews empty placeholder MVP (count=0)
     - T7 CTA "Contacter le pro" placeholder → router.push search filtered by pro
     - T8 JSON-LD Schema.org Organization valid (Google Rich Results Test API call OR schema-dts type-check)
     - T9 hreflang head injection + canonical
     - T10 410 Gone 4 variants (deleted, suspended, rejected, pending) + 404 not-found + RGAA kbd nav full page + axe-core 0 violations + Lighthouse SEO ≥ 95 + Accessibility ≥ 90 (Story 0.11 CI gate)
   - **Test perf NFR3 LCP < 2,5s** : Lighthouse CI Story 0.11 assert on `/fr/pro/<seed-slug>` (CI gate fail regression)
   - **k6 load test** GET /v1/pros/:slug p95 < 250ms (un peu plus que /v1/services 200ms because 3 services parallel fetch)
   - Coverage thresholds NFR71 (≥ 90 % critical, ≥ 85 % gateway, ≥ 80 % helpers/hooks)

## Tasks / Subtasks

- [ ] **Task 1 — DB migration `pro_profiles` slug + bio + ProProfile aggregate UPDATE Story 1.3** (AC: #1)
  - [ ] 1.1 — Migration `<timestamp>-AddProProfileSlugAndBio.ts` (up + backfill + down)
  - [ ] 1.2 — UPDATE `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts` Story 1.3 livré — add `slug: string` field + `bio: string | null` field + factory `register({...})` generates slug (use `Slug.fromTitle` VO Story 3.2 pattern réutilisé OR colocate `Slug.fromCompanyName` helper identity-svc)
  - [ ] 1.3 — UPDATE Story 1.3 `pro-profile.aggregate.spec.ts` — add tests slug generation + bio invariant length
  - [ ] 1.4 — UPDATE Story 1.3 ProProfile TypeORM entity (`apps/identity-svc/src/infrastructure/persistence/typeorm/entities/pro-profile.entity.ts`) — add columns
  - [ ] 1.5 — UPDATE Story 1.3 ProProfileRepository — handle new fields (likely no logic change, just persistence)
  - [ ] 1.6 — Tests migration testcontainer Postgres 6 scenarios AC1

- [ ] **Task 2 — `@tukio/contracts` DTOs pro-public-profile + similar-pros + Zod** (AC: #2)
  - [ ] 2.1 — `dtos/identity/pro-public-profile.dto.ts` (NEW)
  - [ ] 2.2 — `dtos/identity/similar-pros.dto.ts` (NEW)
  - [ ] 2.3 — Tests Zod parse happy + edge cases (avatar nullable, bio nullable, reviewsAggregate count=0 + count>0)

- [ ] **Task 3 — identity-svc internal endpoints + 4 exceptions + similar pros use case** (AC: #2) — coverage ≥ 90 %
  - [ ] 3.1 — NEW exceptions `apps/identity-svc/src/domain/exception/{pro-deleted,pro-suspended,pro-rejected,pro-pending}.exception.ts`
  - [ ] 3.2 — UPDATE Story 1.3 ProProfileRepository — add `findBySlug(slug)` method
  - [ ] 3.3 — NEW use case `apps/identity-svc/src/usecases/get-pro-public-profile.usecase.ts` (Story 1.10 pattern réutilisé — joins pro_profiles + user_profiles + throws 4 differentiated exceptions)
  - [ ] 3.4 — NEW use case `apps/identity-svc/src/usecases/find-similar-pros.usecase.ts` (Postgres city match query — pattern Story 3.10 FindSimilarListingsUseCase réutilisé)
  - [ ] 3.5 — NEW controller `apps/identity-svc/src/infrastructure/http/controllers/internal-pro-public.controller.ts` — 2 endpoints
  - [ ] 3.6 — Wire use cases in `usecases-proxy.module.ts`
  - [ ] 3.7 — Tests integration testcontainer Postgres 10 scenarios AC2

- [ ] **Task 4 — catalog-svc internal endpoint `internal-pro-listings.controller.ts` + review-svc stub** (AC: #2)
  - [ ] 4.1 — NEW controller `apps/catalog-svc/src/infrastructure/http/controllers/internal-pro-listings.controller.ts` — wraps `list-pro-listings.usecase` Story 3.2 livré filtered status='published'
  - [ ] 4.2 — Stub `apps/gateway-api/src/usecases/review/get-pro-aggregate-stub.ts` (gracieux dégradement review-svc unreachable → returns `{ average: 0, count: 0, distribution: {}, sample: [] }`) — pattern Story 1.9 IBookingSvcClient stub réutilisé
  - [ ] 4.3 — Tests 4 scenarios (catalog endpoint filtered published, stub graceful default, Meilisearch reachable, Meilisearch unreachable fallback)

- [ ] **Task 5 — gateway-api `pros.controller.ts` + 2 forwarders + error mapping 410/404** (AC: #2) — coverage ≥ 85 %
  - [ ] 5.1 — `apps/gateway-api/src/usecases/identity/get-pro-public-profile.forwarder.ts` (NEW Story 3.11)
  - [ ] 5.2 — `apps/gateway-api/src/usecases/identity/get-similar-pros.forwarder.ts` (NEW)
  - [ ] 5.3 — `apps/gateway-api/src/infrastructure/http/controllers/pros.controller.ts` (NEW) — 2 endpoints + Zod + cache HTTP + throttle 60/min + parallel fetch (identity + catalog + review-stub)
  - [ ] 5.4 — Error mapping ADR-014 : 4 identity exceptions → 410 Gone + 1 → 404 (envelope `error.tukioCode`)
  - [ ] 5.5 — Tests E2E gateway 10 scenarios AC2

- [ ] **Task 6 — `apps/public/src/app/[locale]/pro/[slug]/page.tsx` Server Component + `generateMetadata`** (AC: #3)
  - [ ] 6.1 — Page.tsx Server Component (force-dynamic) + parallel fetch Promise.allSettled
  - [ ] 6.2 — `generateMetadata` Next.js 15 alternates languages + canonical + OG + Twitter card (pattern Story 3.10 réutilisé)
  - [ ] 6.3 — `not-found.tsx` (404 generic fallback) + `error.tsx` (5xx + ProUnavailableErrorPage variant routing)
  - [ ] 6.4 — Tests Vitest 5 scenarios AC3

- [ ] **Task 7 — `<ProProfileLayout>` orchestrator + 5 feature-scoped components + ProUnavailableErrorPage** (AC: #4) — coverage ≥ 90 %
  - [ ] 7.1 — `apps/public/src/features/public/pro-profile/components/ProProfileLayout.tsx`
  - [ ] 7.2 — `ProHeaderHero.tsx` (avatar initials + H1 + verified badge + stars mini + location + member since)
  - [ ] 7.3 — `ProBioSection.tsx` (bio prose OR EmptyState placeholder MVP)
  - [ ] 7.4 — `ProServicesSection.tsx` (grid `<ListingCard>` Story 3.8 réutilisé responsive + EmptyState placeholder)
  - [ ] 7.5 — `ProReviewsSection.tsx` (wraps `<ReviewsDisplay>` Story 0.5 toggle empty/active)
  - [ ] 7.6 — `CtaContactSection.tsx` (placeholder Epic 5 → search filtered)
  - [ ] 7.7 — `ProUnavailableErrorPage.tsx` (5 variants — réutilise `<ErrorPage variant="entity-unavailable">` Story 0.5 UPDATE)
  - [ ] 7.8 — Tests `@testing-library/react` + axe-core 8 scenarios AC4

- [ ] **Task 8 — UPDATE `<ErrorPage>` Story 0.5 — rename 'listing-unavailable' → 'entity-unavailable' generic** (AC: #5)
  - [ ] 8.1 — UPDATE `packages/ui/src/patterns/ErrorPage/ErrorPage.tsx` Story 0.5 — rename variant + add `entityType` prop
  - [ ] 8.2 — UPDATE existing tests Story 0.5/3.10 + add new tests AC5
  - [ ] 8.3 — UPDATE Story 3.10 MD file `_bmad-output/implementation-artifacts/3-10-listing-detail-public-page.md` — rename references `variant="listing-unavailable"` → `variant="entity-unavailable" entityType="listing"` (MD doc sync, no code impact — Story 3.10 fresh start)
  - [ ] 8.4 — UPDATE i18n keys — move `public.serviceDetail.errors.*` shared parts to `commons.errors.entityUnavailable.listing.*` + add `commons.errors.entityUnavailable.pro.*`

- [ ] **Task 9 — JSON-LD `Organization` Schema.org helper — étend Story 3.10 foundation** (AC: #6) — coverage ≥ 80 %
  - [ ] 9.1 — `apps/public/src/lib/schema-org/Organization.tsx` (NEW Story 3.11)
  - [ ] 9.2 — Helper `buildOrganizationJsonLd(detail, locale)` + `<Organization jsonLd={...} />` component
  - [ ] 9.3 — Validation type-check via `schema-dts` v1+ (Story 3.10 dep réutilisé) + Google Rich Results Test API e2e
  - [ ] 9.4 — Tests Vitest 5 scenarios AC6

- [ ] **Task 10 — `@tukio/api-client` hooks `useProPublicProfile` + `useSimilarPros`** (AC: #7) — coverage ≥ 80 %
  - [ ] 10.1 — `packages/api-client/src/hooks/identity/useProPublicProfile.ts` (NEW)
  - [ ] 10.2 — `packages/api-client/src/hooks/identity/useSimilarPros.ts` (NEW)
  - [ ] 10.3 — Tests Vitest 3 scenarios AC7

- [ ] **Task 11 — i18n FR/EN namespace `public.proProfile.*` + `commons.errors.entityUnavailable.*` + Avatar Aria** (AC: #8)
  - [ ] 11.1 — `apps/public/messages/{fr,en}.json` update namespaces (~30 + ~15 keys × 2)
  - [ ] 11.2 — CI check `pnpm i18n:audit` Story 0.9 réutilisé

- [ ] **Task 12 — hreflang réutilisation Story 3.9 helper + canonical Pro slug pattern** (AC: #3)
  - [ ] 12.1 — Verify `apps/public/src/lib/hreflang.ts` Story 3.9 works for `/pro/:slug` route (likely no change — helper accepts arbitrary path)
  - [ ] 12.2 — Tests verify head rendered links FR + EN + x-default + canonical

- [ ] **Task 13 — Métriques + Prometheus alerts + Grafana dashboard** (AC: #9)
  - [ ] 13.1 — 5 nouvelles métriques (cf. AC9) instrumentées
  - [ ] 13.2 — Prometheus alert `ProProfileLatencyHigh` `infra/k8s/prometheus-rules/pro-profile.yaml` (NEW)
  - [ ] 13.3 — Dashboard Grafana `pro-profile.json` (NEW ~5 panels — symetric Story 3.10)

- [ ] **Task 14 — Tests Playwright e2e 10 scenarios + Lighthouse CI + k6 perf** (AC: #9)
  - [ ] 14.1 — `apps/public/e2e/pros/pro-profile.spec.ts` (NEW 10 tests AC9)
  - [ ] 14.2 — Lighthouse CI Story 0.11 update — add `/fr/pro/<seed-slug>` budgets + SEO ≥ 95 + LCP < 2,5s + Accessibility ≥ 90
  - [ ] 14.3 — k6 load test `infra/k6/pro-profile.k6.js` (NEW — 20 req/s × 5min, p95 < 250ms)
  - [ ] 14.4 — Coverage thresholds enforced NFR71

- [ ] **Task 15 — Seed Pro fixture E2E + docs + commit**
  - [ ] 15.1 — UPDATE `infra/scripts/seed-test-pros.ts` (NEW Story 3.11 — pattern Story 3.1 seed-categories réutilisé) — 5 Pros fixtures avec slug deterministic pour e2e tests (e.g., `event-co-nantes-test01`, `pierre-evenementiel-rennes-test02`, etc.) + 1 deleted + 1 suspended + 1 pending
  - [ ] 15.2 — UPDATE `docs/project-context.md` section "Pro Public Profile (Story 3.11)"
  - [ ] 15.3 — Runbook `docs/runbook/pro-profile-debug.md` (NEW Story 3.11 ~30 lignes — debugging cache 2min + identity/catalog/review parallel fetch + 410 variants)
  - [ ] 15.4 — Commit `feat(public,identity,catalog,gateway,api-client,ui): Story 3.11 pro public profile page + JSON-LD Organization Schema.org + 410 Gone 4 variants + similar pros + slug+bio migration + ErrorPage rename entity-unavailable generic`

## Dev Notes

### Pourquoi Story 3.11 complète la chaîne Visitor

Story 3.10 livre le **funnel close service detail**. Story 3.11 livre le **funnel close pro profile** — Visitor qui clique un nom de Pro Story 3.10 OU atterrit via Google "Event Co Nantes avis" via SEO long-tail. C'est l'équivalent **côté pro** du listing detail. Pattern complet réutilisé Story 3.10 : Server Component RSC + JSON-LD Schema.org + hreflang systematic + 410 Gone graceful + locale fallback + sticky CTA pattern (ici CTA Contact). Story 3.11 introduit la **généralisation `<ErrorPage variant="entity-unavailable">`** (rename Story 3.10 `'listing-unavailable'`) qui devient réutilisable Stories 3.12 + V1+ pour tout entity-unavailable case.

### Décisions techniques majeures actées

1. **slug field ajouté à `pro_profiles` migration Story 3.11** — pas dans Story 1.3 livré (deferred). Generated via slugify(companyName) + 6-char nanoid suffix (pattern Story 3.2 `Slug.fromTitle` réutilisé). Backfill in-migration pour pros existants Epic 1-2.

2. **bio field ajouté à `pro_profiles` migration Story 3.11** — nullable, max 2000 chars. **MVP placeholder Empty state** si null. **FR11 portfolio V1+** : Story V1+ étend avec portfolio photos + équipe + certifications dans section séparée `<ProPortfolioSection>` — pas couvert Story 3.11.

3. **Avatar MVP initials only** — `<Avatar>` Story 0.4 atomic réutilisé en mode initials (computed from companyName 2 premières lettres uppercase). **V1+ upload avatar via Story 1.8 profile management extended** — Story 3.11 backend déjà ready (champ `avatar` nullable dans DTO + Schema.org Organization image conditional rendering).

4. **5 statuts 410/404 différenciés** : deleted (RGPD Story 1.9) + suspended (Story 6.5 V1+) + rejected (Story 2.5 livré) + pending (Story 1.3/2.5 livré tukio_status enum). 5ᵉ = not-found (slug doesn't exist). Tukio error codes `IDENTITY-PRO-*-00X` enveloppe ADR-014.

5. **ErrorPage Story 0.5 rename `listing-unavailable` → `entity-unavailable` generic** — Story 3.10 fresh start (pas encore implémenté), donc rename safe + UPDATE Story 3.10 MD references. Bénéfice : single variant code path réutilisable Stories 3.11 + 3.12 + V1+.

6. **Reviews + Bio placeholder pattern Story 3.10 réutilisé** — toggle automatique au futur populate Story 5.5 (reviews) / Story V1+ (bio Pro UI Story 1.8 extended) sans code change frontend.

7. **CTA Contact placeholder** — anti-désintermédiation R10/FR45 strict : pas de contact direct hors-plateforme MVP. CTA → router.push search filtered by pro. **V1+ Epic 5 Story 5.3** messaging livre flow "Demander un devis" depuis pro profile direct.

8. **Server Component RSC `dynamic = 'force-dynamic'` MVP** — pattern Story 3.10 réutilisé.

9. **JSON-LD Organization pattern foundation** — étend Story 3.10 `lib/schema-org/Service.tsx` + ajoute `Organization.tsx`. Stories 3.12 + 7.8 ajouteront ItemList + LocalBusiness + BreadcrumbList + AggregateRating.

10. **review-svc graceful degradation stub** — Story 5.5 V1+ pas encore livré → Story 3.11 stub returns count=0. Pattern Story 1.9 `IBookingSvcClient` réutilisé.

11. **Similar pros endpoint MVP** — Postgres city match query simple (pas Meilisearch index pros MVP — V1+ peut explorer si granularity ranking needed).

12. **Cache HTTP 2min** — Pro profile less dynamic que listing detail (1min Story 3.10). Throttle 60/min/IP (pattern Story 3.10).

13. **EN strict + i18n + RGAA AA + latest stable versions + Clean Architecture + Envelope ADR-014** memories — toutes respectées.

14. **No backwards compatibility hacks** — `pro_profiles.slug` field migration generates slug for existing rows directly. ErrorPage rename direct.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `slugify` | Pro slug generation | (Story 3.2 already) | v1.6+ — réutilisé identity-svc migration backfill + factory |
| `nanoid` | 6-char slug suffix | latest stable v5+ | Cryptographically random, URL-safe |
| `next` | Next.js 15 metadata API + Server Components | (Sprint 0 already) | force-dynamic MVP, ISR V1+ |
| `next-intl` | i18n FR/EN | (Sprint 0 already) | namespace public.proProfile.* + commons.errors.entityUnavailable.* |
| `@tanstack/react-query` | API hooks | (Story 0.9 already) | useSuspenseQuery for SSR — pattern Story 3.10 |
| `schema-dts` | JSON-LD type-check | (Story 3.10 already) | Réutilisé Organization type-check |
| `web-vitals` | LCP/INP/CLS reporting | (Story 3.10 already) | Tukio Prometheus ingest |
| `@radix-ui/*` | Modal Dialog si needed | (Stories 3.6/3.9/3.10 already) | Réutilisé si modal needed pro profile (V1+ portfolio gallery) |

### Project Structure cible

```
# ====== NEW Story 3.11 ======

packages/contracts/src/dtos/identity/
├─ pro-public-profile.dto.ts                                                # NEW (ProPublicProfileResponseSchema)
└─ similar-pros.dto.ts                                                      # NEW

packages/api-client/src/hooks/identity/
├─ useProPublicProfile.ts + spec                                            # NEW Story 3.11
└─ useSimilarPros.ts + spec                                                 # NEW

apps/identity-svc/src/
├─ domain/exception/
│  ├─ pro-deleted.exception.ts                                              # NEW (IDENTITY-PRO-DELETED-001) — 410 mapping
│  ├─ pro-suspended.exception.ts                                            # NEW (IDENTITY-PRO-SUSPENDED-002) — 410
│  ├─ pro-rejected.exception.ts                                             # NEW (IDENTITY-PRO-REJECTED-003) — 410
│  └─ pro-pending.exception.ts                                              # NEW (IDENTITY-PRO-PENDING-004) — 410
├─ usecases/
│  ├─ get-pro-public-profile.usecase.ts + spec                              # NEW
│  └─ find-similar-pros.usecase.ts + spec                                   # NEW
├─ usecases-proxy/usecases-proxy.module.ts                                  # UPDATE — wire 2 new use cases
├─ infrastructure/persistence/typeorm/migrations/
│  └─ <timestamp>-AddProProfileSlugAndBio.ts                                # NEW (up + backfill slug + down)
├─ infrastructure/http/controllers/
│  └─ internal-pro-public.controller.ts                                     # NEW — 2 internal endpoints
├─ domain/model/pro-profile.aggregate.ts                                    # UPDATE Story 1.3 — add slug + bio + factory generates slug
├─ infrastructure/persistence/typeorm/entities/pro-profile.entity.ts        # UPDATE Story 1.3 — add columns
└─ infrastructure/persistence/typeorm/repositories/pro-profile.repository.ts # UPDATE — add findBySlug

apps/catalog-svc/src/infrastructure/http/controllers/
└─ internal-pro-listings.controller.ts                                      # NEW — wraps list-pro-listings.usecase filtered published

apps/gateway-api/src/
├─ usecases/identity/get-pro-public-profile.forwarder.ts                    # NEW
├─ usecases/identity/get-similar-pros.forwarder.ts                          # NEW
├─ usecases/review/get-pro-aggregate-stub.ts                                # NEW (graceful default Story 5.5 V1+ pas livré)
└─ infrastructure/http/controllers/pros.controller.ts                       # NEW — GET /v1/pros/:slug + /v1/pros/:slug/similar

apps/public/src/
├─ app/[locale]/pro/[slug]/
│  ├─ page.tsx                                                              # NEW Server Component + generateMetadata
│  ├─ not-found.tsx                                                         # NEW (404 generic)
│  └─ error.tsx                                                             # NEW (5xx + ProUnavailableErrorPage variant routing)
├─ features/public/pro-profile/
│  └─ components/
│     ├─ ProProfileLayout.tsx + spec                                        # NEW orchestrator
│     ├─ ProHeaderHero.tsx + spec                                           # NEW
│     ├─ ProBioSection.tsx                                                  # NEW
│     ├─ ProServicesSection.tsx                                             # NEW (réutilise ListingCard Story 3.8)
│     ├─ ProReviewsSection.tsx                                              # NEW (wraps ReviewsDisplay Story 0.5 toggle)
│     ├─ CtaContactSection.tsx                                              # NEW (placeholder Epic 5)
│     └─ ProUnavailableErrorPage.tsx + spec                                 # NEW (5 variants)
├─ lib/schema-org/
│  └─ Organization.tsx + spec                                               # NEW Story 3.11 — étend Story 3.10 foundation
├─ lib/hreflang.ts                                                          # REUSE Story 3.9 (verify works for /pro/:slug)
└─ messages/{fr,en}.json                                                    # UPDATE — namespace public.proProfile.* + commons.errors.entityUnavailable.* + Avatar Aria

packages/ui/src/patterns/ErrorPage/
└─ ErrorPage.tsx                                                            # UPDATE Story 0.5/3.10 — rename variant 'listing-unavailable' → 'entity-unavailable' generic + entityType prop

apps/public/e2e/pros/pro-profile.spec.ts                                    # NEW 10 tests AC9

infra/k8s/prometheus-rules/pro-profile.yaml                                 # NEW
infra/k8s/grafana-dashboards/pro-profile.json                               # NEW (~5 panels)
infra/k6/pro-profile.k6.js                                                  # NEW

infra/scripts/seed-test-pros.ts                                             # NEW (5 fixtures + 1 deleted + 1 suspended + 1 pending)

docs/runbook/pro-profile-debug.md                                           # NEW (~30 lignes)
docs/project-context.md                                                     # UPDATE — section "Pro Public Profile (Story 3.11)"

# ====== UPDATE Story 3.10 MD doc sync ======

_bmad-output/implementation-artifacts/3-10-listing-detail-public-page.md    # UPDATE — rename ErrorPage variant references (MD only, no code commit)

# Estimation : ~35 nouveaux + ~7 updates = ~42 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.4 (atomics Avatar/Badge/Stars), 0.5 (patterns ErrorPage/EmptyState/ReviewsDisplay), 0.9 (TanStack Query + next-intl + i18n CI lint), 0.11 (Lighthouse CI + axe-core), 1.3 (Pro registration + ProProfile aggregate + companyName + address — UPDATE Story 3.11 ajoute slug + bio), 1.9 (RGPD soft-delete + tukio_status + anonymisation propagation pattern réutilisé Story 3.11 410 Gone), 1.10 (identity-svc internal endpoints pattern + audit_log), 2.5 (state machine tukio_status enum), 3.1 (categories taxonomy), 3.2 (catalog-svc + list-pro-listings.usecase + Slug VO pattern + ProProfileClient port), 3.7 (Meilisearch — V1+ potential pros index), 3.8 (ListingCard atomic réutilisé), 3.9 (hreflang helper réutilisé), 3.10 (Server Component + JSON-LD Service foundation + 410 Gone pattern Next.js 15 + similar listings — Story 3.11 généralise).

1. **API responses envelope ADR-014** — Story 3.11 toutes responses wrapped. 4 error codes `IDENTITY-PRO-*` enveloppe.

2. **EN strict path URLs (`/pro/<slug>`) + i18n FR/EN frontend + RGAA AA + latest stable versions + Clean Architecture + Cross-svc boundary (catalog-svc cannot SELECT pro_profiles directly)** memories — toutes respectées.

3. **NFR3 LCP < 2,5s** — hero header simple markup, mostly static text + small avatar image.

4. **NFR5 Core Web Vitals SEO** — Lighthouse SEO ≥ 95 via JSON-LD Organization + canonical + OG + hreflang systematic.

5. **NFR47 prefers-reduced-motion** respecté.

6. **NFR50 alt text obligatoire** — Avatar `<Avatar aria-label="${initials} avatar for ${companyName}">` (no image MVP) OR alt si image.

7. **NFR53 touch targets 44×44 px** — CTA Contact size="lg".

8. **NFR58 hreflang systematic** — Story 3.9 helper réutilisé.

9. **NFR60 fallback FR for UGC EN missing** — bio FR-only stored MVP Story 1.3 → Story 3.11 graceful pas de badge "Available in French only" car bio est PII non-translatable Story V1+ FR11 may add translations.

10. **NFR71 coverage thresholds** — ≥ 90 % critical, ≥ 85 % gateway, ≥ 80 % helpers/hooks.

11. **R10/FR45 anti-désintermédiation** — CTA Contact placeholder, pas de contact direct hors-plateforme. V1+ Epic 5 Story 5.3 messaging.

### Previous Story Intelligence

**Story 0.4 (atomics Avatar, Badge, Stars)** : réutilisés directement.

**Story 0.5 (patterns ErrorPage, EmptyState, ReviewsDisplay)** : Story 3.11 UPDATE ErrorPage rename variant generic. Réutilise EmptyState (variants placeholder Story 3.10 + reviews-empty), ReviewsDisplay (toggle pattern Story 3.10).

**Story 0.9 (TanStack Query + next-intl + i18n CI)** : infrastructure réutilisée.

**Story 0.11 (CI Lighthouse + axe-core)** : Story 3.11 ajoute `/fr/pro/<seed-slug>` aux budgets SEO ≥ 95 + LCP < 2,5s gate.

**Story 1.3 (Pro registration + ProProfile aggregate)** : UPDATE Story 1.3 — Story 3.11 ajoute slug + bio fields à `pro_profiles` table + ProProfile aggregate factory. **READ Story 1.3 file complete avant modification** — pattern ADR + aggregate factory + ProProfileRepository state to preserve.

**Story 1.9 (RGPD soft-delete + anonymisation)** : Story 3.11 410 Gone consume `pro_profiles.deleted_at != null` trigger. Anonymisation pattern propagé (companyName préservé légal, PII anonymisée).

**Story 1.10 (identity-svc internal endpoints + audit_log)** : Story 3.11 réutilise pattern internal-controller. **NEW endpoint `/internal/pros/by-slug/:slug`** étend pattern Story 1.10 `/internal/pros/by-id/:id` Story 1.10 livré.

**Story 2.5 (tukio_status state machine enum)** : Story 3.11 410 Gone consume 4 statuts (deleted, suspended, rejected, pending). Story 2.5 livré `active|pending_admin_review|rejected|suspended` enum.

**Story 3.2 (catalog-svc + list-pro-listings.usecase + Slug VO + ProProfileClient port)** : Story 3.11 consume `list-pro-listings.usecase` filtered status='published' via NEW gateway internal endpoint + wraps Story 3.2 livré use case. Slug VO pattern réutilisé identity-svc migration backfill.

**Story 3.8 (ListingCard atomic réutilisable Stories 3.10/3.11/3.12)** : Story 3.11 réutilise `<ListingCard>` pour services grid.

**Story 3.9 (hreflang helper apps/public/src/lib/hreflang.ts + ListingCard hover prefetch)** : Story 3.11 réutilise hreflang helper + bénéficie du hover prefetch pour navigation Story 3.10 fluide.

**Story 3.10 (Server Component RSC + JSON-LD Service foundation + 410 Gone Next.js 15 pattern + similar listings + ErrorPage variant)** : Story 3.11 **généralise** :
- Server Component pattern → réutilisé
- JSON-LD foundation `lib/schema-org/` → étend avec `Organization.tsx`
- 410 Gone pattern middleware.ts → réutilisé (runbook Story 3.10 partagé)
- Similar entity pattern → étendu `similar-pros.dto.ts`
- ErrorPage variant → **renommé `'listing-unavailable'` → `'entity-unavailable'` generic** + entityType prop. Story 3.10 MD references updated en cascade.

### What this story does NOT do

- ❌ **Portfolio Pro V1+** (FR11 — photos travaux + équipe + certifications) — Story 3.11 livre bio simple MVP.
- ❌ **Upload avatar Pro Story 1.8 extended** — Story 3.11 MVP initials uniquement.
- ❌ **Messaging direct contact** — Epic 5 Story 5.3. Story 3.11 CTA placeholder → search filtered.
- ❌ **Reviews populate** (Story 5.5/5.8 V1) — Story 3.11 toggle empty/active selon count.
- ❌ **EN bio translation** (V1+ FR11) — bio FR-only MVP.
- ❌ **Pros pagination** services grid (> 50 listings) — MVP all-in-one.
- ❌ **Meilisearch pros index** — V1+ si granularity ranking needed. MVP Postgres city match similar pros.
- ❌ **Category page generic** (Story 3.12 — next story).
- ❌ **Sitemap.xml dynamic generation** (Story 7.3).
- ❌ **Avatar moderation** (Story 6.x V1+).

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 3.11` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :
1. `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts` Story 1.3 — add slug + bio fields + factory generation
2. `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/pro-profile.entity.ts` Story 1.3 — add columns
3. `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/pro-profile.repository.ts` Story 1.3 — add findBySlug
4. `apps/identity-svc/src/usecases-proxy/usecases-proxy.module.ts` Story 1.10 livré — wire 2 new use cases
5. `packages/ui/src/patterns/ErrorPage/ErrorPage.tsx` Story 0.5/3.10 — rename variant 'listing-unavailable' → 'entity-unavailable' + entityType prop
6. `apps/public/messages/{fr,en}.json` — namespaces public.proProfile.* + commons.errors.entityUnavailable.* + Avatar Aria
7. `apps/public/src/lib/hreflang.ts` Story 3.9 livré — verify works for /pro/:slug (likely no change)
8. `apps/public/e2e/lighthouse.config.{ts,js}` Story 0.11 — add /fr/pro/<seed-slug> budgets
9. `_bmad-output/implementation-artifacts/3-10-listing-detail-public-page.md` MD doc sync ErrorPage variant rename
10. `docs/project-context.md` Story 1.10 livré — add section "Pro Public Profile (Story 3.11)"

**Lire l'état complet de chaque UPDATE file avant édition** — ProProfile aggregate notamment (factory state + invariants), ErrorPage.tsx (4 variants existing + tests).

### Testing Standards

- Coverage ≥ 90 % `ProProfileLayout` + `ProHeaderHero` + `ProUnavailableErrorPage`
- Coverage ≥ 85 % gateway controllers + identity-svc use cases + migration testcontainer
- Coverage ≥ 80 % `schema-org/Organization.tsx` + hreflang reuse + api-client hooks
- E2E Playwright FR/EN axe-core 0 violations 10 tests AC9
- k6 load test : p95 < 250ms gateway roundtrip (3 services parallel)
- Lighthouse CI Story 0.11 : SEO ≥ 95, Accessibility ≥ 90, LCP < 2,5s gate
- Schema.org validation : `schema-dts` v1+ type-check OR Google Rich Results Test API e2e

### Project Structure Notes

✅ **Aligné** architecture.md (Pretre strict + ADR-014 envelope + ADR-013 multi-zones + feature-based frontend + cross-svc boundary catalog↔identity via internal endpoints), PRD §FR21 (profil public Pro), §FR98 (URLs locale), §FR99-100 (fallback FR — Story 3.11 N/A bio FR-only), §FR116 (JSON-LD Organization), §FR45 (anti-désintermédiation), §NFR3 (LCP), §NFR5 (SEO), §NFR47 (motion), §NFR50 (alt), §NFR53 (touch), §NFR58 (hreflang), §NFR71 (coverage), ux-design-specification.md (`pro-profile.jsx` figé bundle Cloud Design + composants Avatar/Badge/Stars/ReviewsDisplay/EmptyState/ErrorPage), Stories 0.4/0.5/0.9/0.11/1.3/1.9/1.10/2.5/3.2/3.8/3.9/3.10, memories.

⚠️ **Déviations** vs `architecture.md` :
- **URL `/{locale}/pro/<slug>` (singular `pro`)** vs architecture line 2093 `pro/[slug]/page.tsx` (singular) ✅ aligné — pas de déviation ici (différence avec Story 3.10 services plural).
- **Feature folder `features/public/pro-profile/`** vs architecture line 2103 `features/pro-profile/` (sans `public/` prefix) — Story 3.11 aligne avec convention Stories 3.8/3.9/3.10 (`features/public/<feature>/`).

⚠️ **Décisions clés Story 3.11** :
- Migration `pro_profiles` ajoute slug + bio (déférés Story 1.3) avec backfill cron in-migration
- 4 exceptions identity-svc différenciées (deleted/suspended/rejected/pending) + 1 not-found → 410/404 mapping
- ErrorPage Story 0.5 rename variant generic 'entity-unavailable' + entityType prop — réutilisable Stories 3.12 + V1+
- JSON-LD Organization helper étend Story 3.10 foundation `lib/schema-org/`
- review-svc graceful degradation stub Story 5.5 V1+ pas encore livré
- CTA Contact placeholder Epic 5 — anti-désintermédiation R10
- Similar pros MVP Postgres city match (V1+ Meilisearch pros index si granularity needed)
- bio FR-only MVP (V1+ FR11 portfolio + translations)
- Avatar initials only MVP (V1+ upload via Story 1.8 extended)

### References

- [Source: epics.md#Epic-3-Story-3.11 — Lines 1552-1565]
- [Source: prd.md#FR21 (profil pro), #FR98 (URLs locale), #FR45 (anti-désintermédiation), #FR116 (JSON-LD), #NFR3 (LCP), #NFR5 (SEO), #NFR47 (motion), #NFR50 (alt), #NFR53 (touch), #NFR58 (hreflang), #NFR71 (coverage)]
- [Source: ux-design-specification.md — UX-DR `pro-profile.jsx` figé bundle Cloud Design + composants atomic/pattern + UX patterns + RGAA AA]
- [Source: architecture.md — ADR-014 envelope, ADR-013 multi-zones, project structure `features/pro-profile/` line 2103, JSON-LD pattern line 2115 + lines 818-821, FR116 Schema.org, cross-svc boundary]
- [Source: Stories 0.4 (atomics), 0.5 (patterns), 0.9 (TanStack/i18n), 0.11 (Lighthouse CI), 1.3 (Pro registration + ProProfile aggregate — UPDATE Story 3.11), 1.9 (RGPD soft-delete + anonymisation), 1.10 (internal endpoints + audit_log), 2.5 (tukio_status enum), 3.2 (list-pro-listings.usecase + Slug VO), 3.8 (ListingCard), 3.9 (hreflang helper), 3.10 (Server Component + JSON-LD Service foundation + 410 Gone pattern)]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_i18n_frontend, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(points d'attention pour Story 3.12 (category general page — réutiliser pattern Server Component + JSON-LD ItemList helper foundation Story 3.10/3.11 + ListingCard grid + median price FR31), Story 5.3 (messaging — Story 3.11 CTA Contact placeholder devient effective avec direct chat flow), Story 5.5/5.8 (review aggregates — Story 3.11 ProReviewsSection toggle auto active quand `count > 0` populated), Story 1.8 V1+ (Pro profile update — étendre pour avatar upload + bio editor), Story 7.3 (sitemap.xml — Pro profile URLs ajouter au sitemap dynamique), Story 7.8 (SEO foundation — pattern Schema.org systématisé Story 3.11 livre Organization, Story 7.8 systématise BreadcrumbList + LocalBusiness + AggregateRating), V1+ FR11 (portfolio Pro — étendre ProBioSection avec ProPortfolioSection séparée))

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-13
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (11ᵉ story Epic 3 — funnel close pro profile post-Story 3.10)
- **Estimation effort** : 4-5 jours (1 dev fullstack — 8 composants frontend NEW + JSON-LD Organization helper + 3 gateway endpoints + 2 identity-svc use cases + 1 catalog-svc internal endpoint + DB migration slug+bio backfill + UPDATE 5 Story 1.3/0.5 files + 10 e2e + Lighthouse CI gate + k6 perf + 1 seed script + 2 runbooks, ~42 fichiers)
- **Dépendances upstream** :
  - Stories 0.4, 0.5, 0.9, 0.11 (atomics + patterns + i18n + CI)
  - Stories 1.3 (Pro registration + ProProfile aggregate — UPDATE), 1.9 (RGPD soft-delete), 1.10 (identity-svc internal endpoints pattern)
  - Stories 2.5 (tukio_status enum)
  - Stories 3.2 (catalog-svc + list-pro-listings.usecase + Slug VO), 3.8 (ListingCard), 3.9 (hreflang helper), 3.10 (Server Component RSC + JSON-LD Service foundation + 410 Gone Next.js 15 pattern + ErrorPage variant — UPDATE)
- **Dépendances downstream** :
  - Story 3.12 (category page) — réutilise pattern Server Component + Schema.org ItemList foundation + ListingCard grid + median price
  - Story 5.3 (messaging) — CTA Contact placeholder devient effective avec direct chat flow
  - Story 5.5/5.8 (review aggregates) — ProReviewsSection toggle auto active
  - Story 1.8 V1+ extended (Pro profile update avatar upload + bio editor)
  - Story 7.3 (sitemap.xml) — Pro profile URLs ajoutées
  - Story 7.8 (SEO foundation) — pattern Schema.org systématisé Organization → BreadcrumbList + LocalBusiness + AggregateRating
  - V1+ FR11 (portfolio Pro) — étend ProBioSection avec ProPortfolioSection
- **FRs covered** :
  - **FR21** ✅ Visitor peut consulter le profil public d'un Pro (bio, services proposés, avis agrégés)
  - **FR98** ✅ URL locale-prefixée + hreflang systématique (réutilise Story 3.9 helper)
  - **FR116** ✅ JSON-LD Organization Schema.org auto
  - **FR45 partial** ✅ Anti-désintermédiation — CTA Contact placeholder, pas de contact direct hors-plateforme
- **NFRs touchés** :
  - **NFR3** ✅ LCP < 2,5s (hero markup simple + small avatar)
  - **NFR5** ✅ Core Web Vitals SEO (Lighthouse SEO ≥ 95 gate)
  - **NFR47** ✅ prefers-reduced-motion respect
  - **NFR50** ✅ alt text Avatar Aria
  - **NFR53** ✅ touch targets 44×44 px (Button size="lg")
  - **NFR58** ✅ hreflang systematic
  - **NFR71** ✅ coverage thresholds

> **Prochaine story → Story 3.12** (Category general page + median price display FR22 MVP/FR31 — `/{locale}/category/<slug>` réutilise pattern Server Component + Schema.org ItemList foundation Story 3.10/3.11 + ListingCard grid + median price PRINT FR31)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.4/0.5/0.9/0.11/1.3/1.9/1.10/2.5/3.2/3.8/3.9/3.10 implémentées (sprint-status.yaml)
3. Lire l'état complet de chaque UPDATE file avant édition (cf. section "Files to UPDATE vs CREATE")
4. Implémenter Tasks 1-15 dans l'ordre (migration slug+bio → DTOs → identity-svc use cases + endpoints → catalog-svc internal endpoint → review-svc stub → gateway-api → Server Component page.tsx → composants feature-scoped → ProUnavailableErrorPage → UPDATE ErrorPage rename → JSON-LD Organization helper → api-client hooks → i18n → hreflang reuse → métriques → tests + Lighthouse + k6 → seed + runbook + commit)
5. Lancer `pnpm playwright test --grep "pro profile"` après chaque jalon + Lighthouse CI assert SEO ≥ 95 + LCP < 2,5s + k6 perf p95 < 250ms
6. Commit Story 3.11 quand : 10/10 e2e + coverage NFR71 thresholds + axe-core 0 violations + Lighthouse SEO ≥ 95 + Accessibility ≥ 90 + LCP < 2,5s + JSON-LD Schema.org valid (Google Rich Results Test pass) + k6 p95 < 250ms + hreflang head verified + 410 Gone 4 variants + 404 not-found gracieux verified + migration slug+bio reversible
7. Update sprint-status : `3-11-pro-public-profile-page: review` puis `done`
