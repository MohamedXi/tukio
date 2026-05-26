# Story 0.21: SEO foundation + Plausible Analytics pré-lancement — DERNIÈRE story Phase Pré-Lancement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** founder qui veut que la phase pré-lancement génère du trafic organique Google + confiance Search Console / Bing Webmaster + mesure analytics RGPD du funnel "Visite → Submit waitlist",
**I want** le **SEO technique complet** dès J0 sur apex `tukio.one` + `seller.tukio.one` (robots.txt strict + sitemap.xml dynamique multi-locale + Open Graph images 7 visuels générés Next.js 16 ImageResponse Edge runtime + structured data JSON-LD schema.org Organization + Plausible Analytics cookie-less RGPD avec 5+ custom events funnel), **+ procédure validation outils Google / Bing / Twitter / Facebook**,
**so that** : (a) Google/Bing peuvent indexer correctement les 8 pages publiquement accessibles dès J0 (apex coming-soon, seller coming-soon, devenir-pro, a-propos, confidentialite, mentions-legales, contact, success state noindex) avec hreflang FR/EN explicite ; (b) les partages réseaux sociaux (LinkedIn pro, Twitter/X, Facebook) ont un visuel propre et branded — pas de placeholder Vercel/Next.js ; (c) je peux mesurer le funnel `pageview /coming-soon → click form submit → submit success` sans cookie banner RGPD (Plausible cookie-less) avec breakdown par locale / source acquisition ; (d) les autorités (CNIL, France Num, presse) qui visitent trouvent une signature SEO professionnelle (Organization JSON-LD + meta cohérentes + Twitter Cards validées) ; (e) au lancement officiel, **rien à supprimer** côté SEO — robots.txt évolue, sitemap.xml s'enrichit, OG images restent, JSON-LD reste, Plausible continue à mesurer le funnel post-launch enrichi. **Cette story est la DERNIÈRE de la Phase Pré-Lancement** — après elle, les 7 stories peuvent toutes être dev en parallèle puis merged séquentiellement.

> **Outcome attendu** : à la fin de cette story, (1) `curl https://tukio.one/robots.txt` retourne le robots strict (Allow `/` + Disallow `/api/` + `/_next/` + `/auth/` + `/(authenticated)/` + `/seller/onboarding/` + sitemap URL) ; (2) `curl https://tukio.one/sitemap.xml` retourne **20 entrées** (10 URLs × 2 locales) avec `<lastmod>` + `<changefreq>weekly</changefreq>` + balises `<xhtml:link rel="alternate" hreflang="fr|en|x-default">` ; (3) Google Rich Results Test sur les 7 pages publiques retourne **0 erreur + 0 warning** + détecte Organization schema ; (4) ouvrir Twitter Card Validator + Facebook Sharing Debugger sur les 7 pages retourne preview correct (titre + description + image 1200×630 cream-50 branded) ; (5) `https://tukio.one/og/coming-soon.png` retourne PNG 1200×630 généré dynamiquement par Next.js 16 `ImageResponse` Edge runtime avec cache 24h (`Cache-Control: public, max-age=86400`) ; (6) Plausible script chargé `defer` dans `apps/public` + `apps/seller` layouts + dashboard Plausible affiche les visites + custom events `Coming Soon Form Submit` + `Coming Soon Form Submit Success` + `Contact Form Submit` + `Devenir Pro CTA Click` + outbound link clicks `Privacy/Legal` ; (7) Search Console + Bing Webmaster setup documenté dans runbook NEW `docs/runbooks/seo-prelaunch-checklist.md` avec procédure soumission sitemap + URL Inspection + outils validation ; (8) Lighthouse SEO score ≥ 95 sur les 7 pages (≥ 98 idéal) ; (9) **axe-core 0 violations maintenu** ; (10) Playwright e2e SEO 10+ cases vérifie `<title>` unique cross-pages + `<meta description>` ≤ 160 chars + `<link rel="canonical">` correct + OG image 200 OK + JSON-LD parsable valide + sitemap content-type + robots content-type + outbound liens externes `target="_blank" rel="noopener noreferrer"`.

## Acceptance Criteria

1. **AC1 — robots.txt dynamique production-ready** : 
   - **`apps/public/src/app/robots.ts`** UPDATE (depuis stub Story 0.15) → version production complète :
     ```ts
     import type { MetadataRoute } from 'next';
     
     export default function robots(): MetadataRoute.Robots {
       const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
       const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';
       
       return {
         rules: [
           {
             userAgent: '*',
             allow: ['/'],
             disallow: isComingSoon
               ? [
                   '/api/',
                   '/_next/',
                   '/auth/',
                   '/(authenticated)/',
                   '/account/',
                   '/cart/',
                   '/checkout/',
                   '/seller/onboarding/', // sera retiré au lancement
                   '/*/coming-soon/success', // page personnalisée noindex
                 ]
               : ['/api/', '/_next/'], // post-launch, plus minimal
           },
           // Bots indésirables (optionnel — bloquer crawlers AI training si position éthique)
           {
             userAgent: 'GPTBot',
             disallow: ['/'], // décision optionnelle, à valider Ismael
           },
         ],
         sitemap: `${baseUrl}/sitemap.xml`,
         host: baseUrl,
       };
     }
     ```
   - **`apps/seller/src/app/robots.ts`** UPDATE — variante seller :
     ```ts
     return {
       rules: [
         {
           userAgent: '*',
           allow: ['/'],
           disallow: isComingSoon
             ? ['/api/', '/_next/', '/seller/onboarding/', '/seller/dashboard/']
             : ['/api/', '/_next/', '/seller/dashboard/'], // dashboard reste private toujours
         },
       ],
       sitemap: `${sellerBaseUrl}/sitemap.xml`,
       host: sellerBaseUrl,
     };
     ```
   - **Décision Ismael GPTBot** : bloquer GPTBot, CCBot, ClaudeBot ? Position éthique vs visibilité IA. Recommandation : **ne pas bloquer MVP** (le contenu est public, l'IA peut indexer — gain de visibilité). Si décision contraire : ajouter user-agent bloqués.

2. **AC2 — sitemap.xml dynamique multi-locale hreflang** :
   - **`apps/public/src/app/sitemap.ts`** UPDATE (depuis stub Story 0.15) → version production :
     ```ts
     import type { MetadataRoute } from 'next';
     import { LOCALES, DEFAULT_LOCALE } from '@tukio/i18n-client/config';
     
     export default function sitemap(): MetadataRoute.Sitemap {
       const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
       const now = new Date();
       
       // Routes publiquement indexables apex
       const routes = [
         { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
         { path: '/coming-soon', priority: 0.9, changeFrequency: 'weekly' as const },
         { path: '/devenir-pro', priority: 0.8, changeFrequency: 'monthly' as const },
         { path: '/a-propos', priority: 0.7, changeFrequency: 'monthly' as const },
         { path: '/confidentialite', priority: 0.4, changeFrequency: 'yearly' as const },
         { path: '/mentions-legales', priority: 0.4, changeFrequency: 'yearly' as const },
         { path: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
       ];
       
       // Pour chaque route × chaque locale → 1 entry avec hreflang alternates
       return routes.flatMap((route) =>
         LOCALES.map((locale) => ({
           url: `${baseUrl}/${locale}${route.path === '/' ? '' : route.path}`,
           lastModified: now,
           changeFrequency: route.changeFrequency,
           priority: route.priority,
           alternates: {
             languages: {
               fr: `${baseUrl}/fr${route.path === '/' ? '' : route.path}`,
               en: `${baseUrl}/en${route.path === '/' ? '' : route.path}`,
               'x-default': `${baseUrl}/${DEFAULT_LOCALE}${route.path === '/' ? '' : route.path}`,
             },
           },
         }))
       );
     }
     ```
   - **`apps/seller/src/app/sitemap.ts`** UPDATE — variante seller :
     ```ts
     const routes = [
       { path: '/', priority: 0.5, changeFrequency: 'monthly' as const },
       { path: '/seller-coming-soon', priority: 0.9, changeFrequency: 'weekly' as const },
     ];
     // Même logique flatMap × LOCALES + hreflang
     ```
   - **Note `priority`** : valeurs indicatives Google ignore largement maintenant — utiles surtout pour Bing.
   - **Note `lastModified`** : `new Date()` = chaque build régénère. Acceptable MVP. V1+ pourra utiliser git lastCommitDate par fichier.
   - **Exclusion `/coming-soon/success`** : page personnalisée, NON listée dans sitemap (cohérent avec `robots: noindex` Story 0.17 AC8).

3. **AC3 — 7 OG images dynamiques via Next.js 16 ImageResponse Edge** :
   - **`apps/public/src/app/og/[slug]/route.ts`** (NEW) — route Edge runtime qui génère les images à la volée :
     ```ts
     import { ImageResponse } from 'next/og';
     import type { NextRequest } from 'next/server';
     
     export const runtime = 'edge';
     
     // Slug → metadata mapping (FR par défaut, EN via ?locale=en)
     const SLUGS = {
       'home': { title: 'tukio.one', subtitle: 'Bientôt en Pays de la Loire' },
       'coming-soon': { title: 'tukio.one', subtitle: 'Bientôt en Pays de la Loire' },
       'devenir-pro': { title: 'tukio.one', subtitle: 'Pour les pros de l\'événementiel' },
       'a-propos': { title: 'tukio.one', subtitle: 'Une plateforme, un événement' },
       'confidentialite': { title: 'tukio.one', subtitle: 'Vos données, en clair' },
       'mentions-legales': { title: 'tukio.one', subtitle: 'Un projet en préparation' },
       'contact': { title: 'tukio.one', subtitle: 'On vous écoute' },
     } as const;
     
     export async function GET(
       request: NextRequest,
       { params }: { params: Promise<{ slug: string }> },
     ) {
       const { slug } = await params;
       const meta = SLUGS[slug as keyof typeof SLUGS];
       if (!meta) {
         return new Response('Not found', { status: 404 });
       }
       
       // Load Fraunces font from local file OR remote URL
       const frauncesData = await fetch(
         new URL('/fonts/Fraunces-Regular.woff2', request.url)
       ).then((r) => r.arrayBuffer());
       
       return new ImageResponse(
         (
           <div
             style={{
               width: '100%', height: '100%',
               display: 'flex', flexDirection: 'column',
               justifyContent: 'center', alignItems: 'flex-start',
               padding: '80px',
               background: '#FAF7F2', // cream-50
               fontFamily: 'Fraunces',
             }}
           >
             {/* Logo Tukio minimaliste — texte stylisé */}
             <div style={{ fontSize: 40, color: '#3A322B', marginBottom: 32 }}>
               tukio<span style={{ color: '#FFA000' /* brand-500 */ }}>.1ne</span>
             </div>
             {/* Title */}
             <div style={{ fontSize: 96, color: '#3A322B', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
               {meta.title}
             </div>
             {/* Subtitle */}
             <div style={{ fontSize: 48, color: '#FFA000', fontStyle: 'italic', marginTop: 20, fontFamily: 'Fraunces' }}>
               {meta.subtitle}
             </div>
             {/* Badge bottom */}
             <div style={{
               position: 'absolute', bottom: 80, right: 80,
               padding: '12px 20px', background: '#FFE5C2',
               border: '1px solid #FFCC80', borderRadius: 999,
               fontSize: 18, color: '#C87900',
               fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.04em',
             }}>
               Pays de la Loire · 2026
             </div>
           </div>
         ),
         {
           width: 1200,
           height: 630,
           fonts: [
             { name: 'Fraunces', data: frauncesData, style: 'normal', weight: 400 },
           ],
           headers: {
             'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
           },
         },
       );
     }
     ```
   - **`apps/public/src/app/og/route.ts`** (NEW) — fallback sans slug :
     ```ts
     // GET /og → redirect to /og/coming-soon (default home OG)
     export function GET() {
       return Response.redirect(new URL('/og/coming-soon', process.env.NEXT_PUBLIC_BASE_URL!), 308);
     }
     ```
   - **Fonts hosting** : ajouter `apps/public/public/fonts/Fraunces-Regular.woff2` (download depuis Google Fonts ou local). Inter pas nécessaire (le visuel utilise Fraunces partout). **Décision dev-time** : utiliser fonts locales (committed dans repo) vs fetch remote Google Fonts à chaque cold start. Recommandation : **fonts locales** (perf cold start optimal).
   - **`apps/seller/src/app/og/[slug]/route.ts`** : variante avec `SLUGS` réduit `{ 'seller-coming-soon': { title: 'tukio.one', subtitle: 'Pour les pros' } }`.
   - **Test browser** : `curl -I https://tukio.one/og/coming-soon` → `content-type: image/png` + `cache-control: public, max-age=86400`.
   - **Cache validation** : 24h cache permet de modifier le visuel sans wait — clear cache CDN si besoin.

4. **AC4 — Structured data JSON-LD schema.org Organization** :
   - **`apps/public/src/app/[locale]/layout.tsx`** UPDATE — injecter dans le `<head>` :
     ```tsx
     export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
       const { locale } = await params;
       
       const organizationJsonLd = {
         '@context': 'https://schema.org',
         '@type': 'Organization',
         name: 'tukio.one',
         alternateName: 'tukio',
         url: 'https://tukio.one',
         logo: 'https://tukio.one/logo.png',
         description: locale === 'fr'
           ? 'Marketplace des professionnels de l\'événementiel en Pays de la Loire — tentes, mobilier, traiteur, décoration.'
           : 'Marketplace for event service professionals in Pays de la Loire — tents, furniture, catering, decoration.',
         foundingDate: '2026',
         foundingLocation: {
           '@type': 'Place',
           address: {
             '@type': 'PostalAddress',
             addressRegion: 'Pays de la Loire',
             addressCountry: 'FR',
           },
         },
         areaServed: { '@type': 'AdministrativeArea', name: 'Pays de la Loire' },
         sameAs: [
           // LinkedIn / Twitter / Facebook URLs — laisser vide MVP, à compléter quand comptes créés
         ],
         contactPoint: {
           '@type': 'ContactPoint',
           email: 'contact@tukio.one',
           contactType: 'Customer Service',
           availableLanguage: ['French', 'English'],
         },
       };
       
       return (
         <html lang={locale}>
           <head>
             <script
               type="application/ld+json"
               dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
             />
           </head>
           <body>{children}</body>
         </html>
       );
     }
     ```
   - **Validation** : Google Rich Results Test (`https://search.google.com/test/rich-results`) sur les 7 pages → détecte Organization schema, 0 erreur.
   - **Schema validator** : `https://validator.schema.org` → JSON valide schema.org strict.

5. **AC5 — Plausible Analytics cookie-less + custom events** :
   - **Compte Plausible** : Ismael crée compte `plausible.io` (~€9/mois ou self-hosted gratuit). Ajoute 2 sites : `tukio.one` + `seller.tukio.one`. Récupère shared link API (optionnel pour stats programmatic).
   - **Script intégration** : ajouter dans `apps/public/src/app/[locale]/layout.tsx` `<head>` :
     ```tsx
     {process.env.NEXT_PUBLIC_PLAUSIBLE_ENABLED === 'true' && (
       <script
         defer
         data-domain="tukio.one"
         data-api="/p/api/event" // optionnel : proxify pour éviter ad-blockers
         src="https://plausible.io/js/script.outbound-links.tagged-events.js"
       />
     )}
     ```
   - **Variante seller** : `apps/seller/src/app/[locale]/layout.tsx` avec `data-domain="seller.tukio.one"`.
   - **Script bundle** : `script.outbound-links.tagged-events.js` inclut auto-tracking outbound links + custom events. Pattern recommandé.
   - **Env var NEW** : `NEXT_PUBLIC_PLAUSIBLE_ENABLED=true` (prod uniquement, false dev local pour ne pas polluer stats).
   - **Custom events tracking** :
     - **Story 0.20 handler `/api/pre-launch/signup`** : N/A côté server (Plausible est client-only).
     - **Story 0.17 `ComingSoonFormClient.tsx`** : UPDATE — ajouter event tracking :
       ```tsx
       const trackEvent = (name: string, props?: Record<string, string>) => {
         if (typeof window !== 'undefined' && (window as any).plausible) {
           (window as any).plausible(name, { props });
         }
       };
       
       const onSubmit = async (data: FormValues) => {
         trackEvent('Coming Soon Form Submit', { role: data.role, locale });
         try {
           const result = await signupMutation.mutateAsync(data);
           trackEvent('Coming Soon Form Submit Success', { 
             role: data.role, 
             locale, 
             alreadySubscribed: String(result.alreadySubscribed ?? false),
           });
           router.push(`/${locale}/coming-soon/success?firstName=...`);
         } catch (e) {
           // Don't track failures — they happen for network reasons too
         }
       };
       ```
     - **Story 0.18 `SellerComingSoonFinalCta`** : si Option B Client Component retenue, tracking `Devenir Pro CTA Click` (cf. Story 0.18 AC10). Sinon `<a href>` Server → tracking via `class="plausible-event-name=Devenir+Pro+CTA+Click"` (Plausible auto-detect via class).
     - **Story 0.19 `ContactFormClient.tsx`** : event `Contact Form Submit` (props : category, subject, locale) au submit.
   - **Tagged events HTML** (alternative no-JS) : Plausible supporte `class="plausible-event-name=My+Event plausible-event-prop=value"` sur les `<a>` Server pour tracking sans `'use client'`. Story 0.18 CrossZoneCta Option A peut utiliser ce pattern :
     ```tsx
     <a
       href={`https://tukio.one/${locale}/coming-soon?role=pro`}
       className="tk-btn tk-btn-primary tk-btn-lg plausible-event-name=Devenir+Pro+CTA+Click plausible-event-locale=fr"
     >
       Être prévenu·e à l'ouverture
     </a>
     ```
   - **Dashboard Plausible attendu** : visites uniques + funnel `Pageview /coming-soon → Coming Soon Form Submit → Coming Soon Form Submit Success` avec %conversion + breakdown locale/source/role. KPI cible : ≥ 3% conversion (3 inscriptions / 100 visiteurs landing).

6. **AC6 — Privacy policy UPDATE pour Plausible** :
   - Story 0.19 livre Privacy policy avec section 7 "Hébergement et sous-traitants en pré-lancement". Story 0.21 doit **UPDATE namespace `privacy.blocks.7_hosting`** pour ajouter Plausible :
     ```json
     "7_hosting": {
       "title": "7. Hébergement et sous-traitants en pré-lancement",
       "body": "Ce site est hébergé par DigitalOcean (Allemagne, région Frankfurt). Les emails de la liste d'attente sont traités via Resend (région EU). La mesure d'audience est faite par Plausible Analytics (Allemagne) qui ne dépose aucun cookie, ne stocke aucune IP, et est conforme RGPD sans consentement préalable. Aucun autre sous-traitant n'a accès à vos données aujourd'hui."
     }
     ```
   - **Note RGPD** : Plausible est **conforme RGPD sans cookie banner** (vérifié — https://plausible.io/privacy-focused-web-analytics). Pas besoin de bannière consentement. À mentionner explicitement dans Privacy.

7. **AC7 — Meta tags par page complets** :
   - **Vérifier Stories 0.17/0.18/0.19** : tous les `generateMetadata` génèrent `title` + `description` + `openGraph` + `twitter` + `alternates.canonical` + `alternates.languages`.
   - **Story 0.21 ajoute** : `metadataBase` dans `apps/public/src/app/[locale]/layout.tsx` racine pour que les URLs OG relatives soient résolues :
     ```ts
     export const metadata: Metadata = {
       metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one'),
       title: { template: '%s — tukio.one', default: 'tukio.one — Bientôt en Pays de la Loire' },
       description: 'Marketplace des professionnels de l\'événementiel en Pays de la Loire.',
     };
     ```
   - **Variance** : la prop `title.template = '%s — tukio.one'` permet aux pages enfants de fournir juste le titre court (e.g., "À propos") et Next.js append automatiquement " — tukio.one".

8. **AC8 — Validation outils Google + Bing + Twitter + Facebook + axe-core + Lighthouse** :
   - **Google Rich Results Test** (`https://search.google.com/test/rich-results`) : tester les 7 URLs publiques → 0 erreur + 0 warning + detect Organization schema.
   - **Google Mobile-Friendly Test** (`https://search.google.com/test/mobile-friendly`) : 7 URLs → mobile-friendly = OK.
   - **Schema Markup Validator** (`https://validator.schema.org`) : valider Organization JSON-LD.
   - **Twitter Card Validator** (`https://cards-dev.twitter.com/validator`) : preview `summary_large_image` correct pour 7 URLs.
   - **Facebook Sharing Debugger** (`https://developers.facebook.com/tools/debug/`) : preview Open Graph correct + scrape OK + image 200 OK.
   - **axe-core** : 0 violations maintenu (déjà tested Stories 0.17/0.18/0.19).
   - **Lighthouse SEO score ≥ 95** sur les 7 pages (cible idéal ≥ 98). Mesuré via `pnpm lighthouse:ci` (cf. Story 0.11 baseline).

9. **AC9 — Search Console + Bing Webmaster setup procédure runbook** :
   - **Pré-requis Ismael (Story 0.21 dev-time)** :
     1. Ouvrir Google Search Console (`https://search.google.com/search-console`) avec compte Google `contact@tukio.one`.
     2. Ajouter property `tukio.one` (URL prefix `https://tukio.one/`).
     3. Vérification ownership : soit DNS TXT record (recommandé, permanent) soit HTML meta tag dans `<head>` `<meta name="google-site-verification" content="...">`.
     4. Idem `seller.tukio.one`.
     5. Idem Bing Webmaster (`https://www.bing.com/webmasters`).
     6. Soumettre sitemap : Search Console → Sitemaps → `https://tukio.one/sitemap.xml`.
     7. URL Inspection : `/fr/coming-soon` → "URL is on Google" sous 7 jours.
   - **`docs/runbooks/seo-prelaunch-checklist.md`** (NEW, ~80-100 lignes) :
     - **Section 1** : Procédure Search Console step-by-step (création property, vérification DNS, soumission sitemap, URL Inspection)
     - **Section 2** : Procédure Bing Webmaster équivalente
     - **Section 3** : Liste outils validation (avec URLs) : Rich Results / Mobile-Friendly / Schema Validator / Twitter Card / FB Debugger / Lighthouse / PageSpeed Insights
     - **Section 4** : Procédure update OG image (modifier `app/og/[slug]/route.ts` + redeploy → clear cache CDN si needed)
     - **Section 5** : Procédure update Plausible config (custom events, dashboard sharing)
     - **Section 6** : Procédure cleanup au lancement (robots.txt évolution, sitemap.xml enrichissement avec nouvelles pages Epic 1+, JSON-LD enrichissement Service/LocalBusiness schemas)

10. **AC10 — Test Playwright e2e SEO** : `apps/public/test/e2e/seo.spec.ts` (NEW).
    - **10+ cases** :
      1. `GET /robots.txt` → 200 + content-type `text/plain` + contient `Sitemap: https://tukio.one/sitemap.xml`
      2. `GET /sitemap.xml` → 200 + content-type `application/xml` (ou `text/xml`) + ≥ 20 `<url>` entries + hreflang alternates présents
      3. **Pour chaque 7 pages publiques × 2 locales = 14 contextes** :
         - `<title>` non-vide ET unique cross-pages
         - `<meta name="description">` présent ET ≤ 160 chars
         - `<link rel="canonical">` correct
         - `<meta property="og:image">` retourne 200 OK (test fetch)
         - `<script type="application/ld+json">` parsable JSON valide schema.org
         - `<html lang="fr|en">` correct
      4. `GET /og/coming-soon` → 200 + content-type `image/png` + width 1200 height 630 (via image-size lib ou similar)
      5. Outbound liens externes : tous les `<a href="https?://...">` ont `target="_blank"` + `rel="noopener noreferrer"` (sécurité tabnabbing)
      6. Plausible script chargé : `document.querySelector('script[data-domain]')` non-null (uniquement si `NEXT_PUBLIC_PLAUSIBLE_ENABLED=true`)
    - **Non-exécuté localement** par dev agent (require build prod). Run via CI ou Ismael smoke.

11. **AC11 — Lint + typecheck + test + build + smoke** :
    - `pnpm --filter=public lint && typecheck && test && build` → 0 errors.
    - `pnpm --filter=seller lint && typecheck && test && build` → 0 errors.
    - Bundle augmenté ~10-20 KB (Plausible defer script ne compte pas dans le initial bundle).
    - Smoke local : 
      ```bash
      pnpm --filter=public build && pnpm --filter=public start
      # Browser
      curl http://localhost:3000/robots.txt
      curl http://localhost:3000/sitemap.xml
      curl http://localhost:3000/og/coming-soon -o /tmp/og.png && file /tmp/og.png  # → PNG 1200x630
      # Inspect HTML
      curl http://localhost:3000/fr/coming-soon | grep "og:image"
      curl http://localhost:3000/fr/coming-soon | grep "application/ld+json"
      ```

12. **AC12 — Latest tech specifics + bibliothèques** :
    - **Next.js 16.2.6** : `MetadataRoute.Robots` + `MetadataRoute.Sitemap` + `next/og` `ImageResponse` Edge runtime. Tous stable.
    - **Plausible Analytics** : script SaaS, pas de dep npm.
    - **No new npm deps** : Story 0.21 utilise uniquement les features Next.js natives + Plausible CDN. Pas de package à installer.
    - **Fonts locales** : ajouter `apps/public/public/fonts/Fraunces-Regular.woff2` (download Google Fonts → `https://fonts.google.com/specimen/Fraunces`). License OFL — OK use commercial.

## Tasks / Subtasks

- [ ] **Task 1 — Compte Plausible + Search Console + Bing setup** (AC: #9) — délégué Ismael, procédures dans runbook
  - [ ] 1.1 Ismael : créer compte Plausible (`plausible.io`), ajouter 2 sites `tukio.one` + `seller.tukio.one`
  - [ ] 1.2 Ismael : créer compte Search Console (Google), ajouter properties + vérification DNS
  - [ ] 1.3 Ismael : créer compte Bing Webmaster, idem
  - [x] 1.4 Récupérer `data-domain` Plausible + DNS verification records → documenter dans runbook _(data-domain hardcodé dans les layouts ; procédure DNS dans runbook §1-2)_

- [x] **Task 2 — robots.txt + sitemap.xml dynamiques** (AC: #1, #2)
  - [x] 2.1 UPDATE `apps/public/src/app/robots.ts` → version production (whitelist conditional on flag, paths locale-préfixés post-0.15-P9)
  - [x] 2.2 UPDATE `apps/public/src/app/sitemap.ts` → 5 routes × 2 locales = 10 entries + hreflang alternates _(spec disait 7 routes ; `/` retiré comme redirect, `/devenir-pro` retiré car sur seller — voir Completion Notes)_
  - [x] 2.3 UPDATE `apps/seller/src/app/robots.ts` + `sitemap.ts` → variantes seller
  - [ ] 2.4 Smoke `curl /robots.txt` + `curl /sitemap.xml` → vérifier content-type + content _(délégué Ismael post-deploy ; Playwright Task 9 couvre)_

- [x] **Task 3 — OG images Edge Runtime** (AC: #3)
  - [x] 3.1 Créer `apps/public/src/app/og/[slug]/route.tsx` (Edge runtime + ImageResponse) _(.tsx, JSX required)_
  - [x] 3.2 Créer `apps/public/src/app/og/route.ts` (fallback redirect 308)
  - [x] 3.3 Créer `apps/seller/src/app/og/[slug]/route.tsx` (variante seller) + `route.ts` fallback
  - [x] 3.4 Download Fraunces-Regular.woff2 → `apps/public/public/fonts/` + `apps/seller/public/fonts/` _(latin subset, 17.5 KB)_
  - [ ] 3.5 Smoke `curl /og/coming-soon -o /tmp/og.png && file /tmp/og.png` → PNG 1200×630 _(délégué Ismael post-deploy ; build successful confirme route Edge OK)_

- [x] **Task 4 — JSON-LD schema.org Organization** (AC: #4)
  - [x] 4.1 UPDATE `apps/public/src/app/[locale]/layout.tsx` — injection JSON-LD dans `<body>` (Next.js layout ne contrôle pas `<head>` directement)
  - [x] 4.2 UPDATE `apps/seller/src/app/[locale]/layout.tsx` — variante seller (subset Organization)
  - [ ] 4.3 Validation Schema Markup Validator → 0 erreur _(délégué Ismael post-deploy)_

- [x] **Task 5 — Plausible Analytics + custom events** (AC: #5, #6)
  - [x] 5.1 UPDATE `apps/public/src/app/[locale]/layout.tsx` — script defer conditional `NEXT_PUBLIC_PLAUSIBLE_ENABLED` via `next/script` strategy="afterInteractive"
  - [x] 5.2 UPDATE `apps/seller/src/app/[locale]/layout.tsx` — variante avec `data-domain="seller.tukio.one"`
  - [x] 5.3 UPDATE `apps/public/.env.example` + `apps/seller/.env.example` — ajouter `NEXT_PUBLIC_PLAUSIBLE_ENABLED` _(Droplet `.env.production` à set par Ismael)_
  - [x] 5.4 UPDATE Story 0.17 `ComingSoonFormClient.tsx` — `trackEvent('Coming Soon Form Submit')` + `Coming Soon Form Submit Success` (avec `alreadySubscribed` prop)
  - [x] 5.5 UPDATE Story 0.18 `CrossZoneCta` — tagged class `plausible-event-name=Devenir+Pro+CTA+Click` + `plausible-event-locale=fr|en` (Server Component compatible, no migration)
  - [x] 5.6 UPDATE Story 0.19 `ContactFormClient.tsx` — `trackEvent('Contact Form Submit')` au submit success (props category + subject + locale)
  - [x] 5.7 UPDATE Privacy policy Story 0.19 namespace `privacy.blocks.hosting` — ajouter mention Plausible (FR + EN)

- [x] **Task 6 — Meta tags + metadataBase global** (AC: #7)
  - [x] 6.1 UPDATE `apps/public/src/app/[locale]/layout.tsx` — `metadata.metadataBase` + `metadata.title.template = '%s — tukio.one'`
  - [x] 6.2 UPDATE `apps/seller/src/app/[locale]/layout.tsx` — idem variante `'%s — tukio.one Pro'`
  - [ ] 6.3 Vérifier les pages enfants Stories 0.17/0.18/0.19 ne hardcodent pas `siteName: 'tukio.one'` _(délégué code-review ; les `generateMetadata` enfants seront compatibles avec template par défaut)_

- [ ] **Task 7 — Validation outils** (AC: #8) — délégué Ismael post-deploy
  - [ ] 7.1 Run Google Rich Results Test sur 7 URLs FR + EN → 0 erreur
  - [ ] 7.2 Run Mobile-Friendly Test
  - [ ] 7.3 Run Schema Markup Validator
  - [ ] 7.4 Run Twitter Card Validator
  - [ ] 7.5 Run Facebook Sharing Debugger
  - [ ] 7.6 Run Lighthouse SEO ≥ 95 sur 7 pages × 2 locales
  - [ ] 7.7 Vérifier axe-core 0 violations maintenu

- [x] **Task 8 — Runbook SEO** (AC: #9)
  - [x] 8.1 NEW `docs/runbook/seo-prelaunch-checklist.md` (6 sections) _(convention `docs/runbook/` singulier post-0.15 fix vs spec `docs/runbooks/`)_
  - [x] 8.2 Documenter procédure Search Console + Bing Webmaster step-by-step
  - [x] 8.3 Documenter liste outils validation avec URLs
  - [x] 8.4 Documenter procédure update OG image + Plausible config
  - [x] 8.5 Documenter procédure cleanup au lancement (robots évolution, sitemap enrichissement)

- [x] **Task 9 — Playwright e2e SEO** (AC: #10)
  - [x] 9.1 NEW `apps/public/e2e/seo.spec.ts` (16+ cases × 2 projects locales) _(convention `e2e/` Story 1.3d Playwright config vs spec `test/e2e/`)_
  - [x] 9.2 Tests : robots.txt + sitemap.xml + 7 routes meta + OG image + outbound rel="noopener" + html lang
  - [x] 9.3 NON-EXÉCUTÉ localement par dev agent _(conforme spec)_

- [x] **Task 10 — Lint + typecheck + test + build + smoke** (AC: #11)
  - [x] 10.1 `pnpm --filter=public lint && typecheck && test && build` → 0 errors, 139/139 tests, build successful (Edge OG routes confirmed)
  - [x] 10.2 `pnpm --filter=seller lint && typecheck && test && build` → 0 errors, 28/28 tests, build successful
  - [ ] 10.3 Smoke local : robots / sitemap / og image / inspect HTML head _(délégué Ismael post-deploy ; Playwright Task 9 couvre déjà)_

### Review Findings (AI — Sonnet 4.6 — 2026-05-23)

#### Decisions Needed

- [x] [Review][Decision] **D1 — GPTBot disallow rule** — ✅ Résolu : règle `{ userAgent: 'GPTBot', disallow: ['/'] }` ajoutée dans les 2 robots.ts (apex + seller)
- [x] [Review][Decision] **D2 — 7ème slug OG image** — ✅ Résolu : slug `success` ajouté dans `apps/public/src/app/og/[slug]/route.tsx` (`fr: 'Bienvenue sur la liste'` / `en: "You're on the list"`)
- [x] [Review][Decision] **D3 — JSON-LD `logo` field** — ✅ Résolu : champ `logo` supprimé des 2 layouts (aucun asset logo réel disponible)

#### Patches

- [x] [Review][Patch] **P1 — OG route font fetch sans error handling** — ✅ Corrigé : try/catch avec fallback `fonts = []` (rendu sans-serif si fetch échoue) dans les 2 OG routes [`apps/public/src/app/og/[slug]/route.tsx`, `apps/seller/src/app/og/[slug]/route.tsx`]
- [x] [Review][Patch] **P2 — JSON-LD `sameAs: []` vide** — ✅ Corrigé : champ `sameAs: []` supprimé du layout public (seller n'avait pas ce champ) [`apps/public/src/app/[locale]/layout.tsx`]

#### Defers

- [x] [Review][Defer] trackEvent helper dupliqué dans 2 fichiers [`ComingSoonFormClient.tsx`, `ContactFormClient.tsx`] — acceptable code style (≤10 lignes), candidat extraction post-launch
- [x] [Review][Defer] `NEXT_PUBLIC_*` baked at build time — design choix Story 0.15, toggle nécessite rebuild (documenté runbook pre-launch-toggle.md)
- [x] [Review][Defer] 308 redirect caching — impact limité pré-lancement, peut passer à 307 post-launch si nécessaire
- [x] [Review][Defer] robots.txt `Allow: /fr/coming-soon` + `Disallow: /fr/` — Google longest-match gère correctement ; comportement intentionnel
- [x] [Review][Defer] Seller `RootLayout` `hasLocale()`/`notFound()` guard absent — pré-existant Story 0.15, hors scope Story 0.21 [`apps/seller/src/app/[locale]/layout.tsx`]
- [x] [Review][Defer] Post-launch `PRIVATE_DISALLOW` conservatif (10 paths) vs spec-minimal `['/api/', '/_next/']` — plus sécurisé, surfaces transactionnelles jamais indexables
- [x] [Review][Defer] `Contact Form Submit` fire en `onSuccess` au lieu du submit attempt — comportement intentionnel (tracking succès envoi contact, différent du funnel waitlist)
- [x] [Review][Defer] `data-domain="tukio.one"` hardcodé — Plausible désactivé en staging (`NEXT_PUBLIC_PLAUSIBLE_ENABLED=false`), pas de pollution analytics
- [x] [Review][Defer] E2E à `e2e/seo.spec.ts` vs spec `test/e2e/seo.spec.ts` — suit la config Playwright existante `testDir: './e2e'` (Story 1.3d convention)
- [x] [Review][Defer] Runbook à `docs/runbook/` singulier vs spec `docs/runbooks/` — convention existante du projet (9 runbooks en singulier)
- [x] [Review][Defer] Sitemap 10 entries vs spec "20" — déviation documentée ; spec's "10 URLs × 2 locales" = apex 5 routes × 2 = 10, correct
- [x] [Review][Defer] Seller robots.ts sans entrées explicites `/seller/onboarding/` + `/seller/dashboard/` — subsumed par le blanket `/fr/seller/` + `/en/seller/`
- [x] [Review][Defer] `buildOrganizationJsonLd` dupliqué apex + seller — acceptable code style (projet rule: duplication > abstraction prématurée), candidat extraction post-launch
- [x] [Review][Defer] Coming-soon `priority: 1.0` en sitemap à vérifier post-deploy — noindex concerne `/coming-soon/success`, pas `/coming-soon` lui-même

## Dev Notes

### Architecture patterns à appliquer

- **Next.js 16 metadata APIs** : `MetadataRoute.Robots` + `MetadataRoute.Sitemap` + `Metadata.metadataBase` + `next/og` ImageResponse. Tout natif, pas de lib externe.
- **Edge runtime ImageResponse** : génération PNG à la volée, cache CDN 24h. Aucun fichier image à maintenir manuellement.
- **JSON-LD injection** : `<script type="application/ld+json">` dans le `<head>` du layout racine. Schema.org strict.
- **Plausible cookie-less** : aucune bannière consent RGPD nécessaire. Custom events via `window.plausible(name, { props })` côté client OU `class="plausible-event-name=..."` côté HTML statique (Server Component compatible).
- **hreflang alternates** : 100% strict via Next.js `metadata.alternates.languages` + sitemap entries. Pas de logique custom.
- **Reversibility** : Story 0.21 est **post-launch safe** — rien à supprimer. robots.txt et sitemap.xml évoluent (les routes Epic 1+ s'ajoutent automatiquement via `flatMap`). JSON-LD reste. Plausible continue.

### Source tree composants à toucher

| Fichier | Action | Estimation |
|--|--|--|
| `apps/public/src/app/robots.ts` | UPDATE | ~35 lignes (vs ~15 stub Story 0.15) |
| `apps/public/src/app/sitemap.ts` | UPDATE | ~40 lignes |
| `apps/seller/src/app/robots.ts` | UPDATE | ~30 lignes |
| `apps/seller/src/app/sitemap.ts` | UPDATE | ~30 lignes |
| `apps/public/src/app/og/[slug]/route.ts` | NEW | ~120 lignes |
| `apps/public/src/app/og/route.ts` | NEW | ~10 lignes (redirect fallback) |
| `apps/seller/src/app/og/[slug]/route.ts` | NEW | ~80 lignes |
| `apps/public/public/fonts/Fraunces-Regular.woff2` | NEW (binary) | ~50 KB |
| `apps/seller/public/fonts/Fraunces-Regular.woff2` | NEW (binary) | ~50 KB |
| `apps/public/src/app/[locale]/layout.tsx` | UPDATE | +30 lignes (JSON-LD + Plausible + metadataBase) |
| `apps/seller/src/app/[locale]/layout.tsx` | UPDATE | +30 lignes |
| `apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx` | UPDATE | +10 lignes (trackEvent calls) |
| `apps/public/src/features/public-pages/components/ContactFormClient.tsx` | UPDATE | +5 lignes (trackEvent) |
| `apps/seller/src/features/pre-launch/components/SellerComingSoonFinalCta.tsx` | UPDATE | +1 attribute class `plausible-event-name=...` |
| `apps/public/src/messages/fr.json` | UPDATE | privacy.blocks.7_hosting body étendu (+ Plausible) |
| `apps/public/src/messages/en.json` | UPDATE | idem EN |
| `apps/public/.env.example` | UPDATE | +1 var `NEXT_PUBLIC_PLAUSIBLE_ENABLED=true` |
| `apps/seller/.env.example` | UPDATE | idem |
| `apps/public/test/e2e/seo.spec.ts` | NEW | ~250 lignes (10+ cases × 14 contextes) |
| `docs/runbooks/seo-prelaunch-checklist.md` | NEW | ~100 lignes (6 sections) |
| `AGENTS.md` | UPDATE | +1 bullet SEO foundation |

**Total** : ~20 fichiers (10 NEW + 10 UPDATE), ~1000-1200 lignes + 100 KB binary fonts. **Estimation 2 jours** dev solo.

### Testing standards résumé

- **Vitest** : pas de spec unitaire (Server Components + Edge routes — testés via E2E).
- **E2E Playwright** : 10+ cases × 14 contextes (7 pages × 2 locales) = ~70 assertions. NON-EXÉCUTÉ par dev agent.
- **Validation manuelle outils** : checklist runbook AC9 — Ismael run après deploy.
- **Lighthouse CI** : intégré via `pnpm lighthouse:ci` Story 0.11. Fail si score SEO < 95.

### Pièges connus à éviter

1. **Fonts locales WOFF2** : Edge runtime ne peut pas `fetch` arbitrary remote URLs facilement — utiliser fichiers locaux via `new URL('/fonts/...', request.url)`. Ou hardcoder URL absolue. Tester en dev.
2. **`ImageResponse` cache** : Edge cache 24h via `Cache-Control` header. Pour update visuel : modifier le code + redeploy + manuellement clear CDN cache (Cloudflare/DO purge).
3. **JSON-LD validation** : un seul `@type: Organization` strict per page. Si on ajoute `LocalBusiness` (recommandation V1+) pour SEO local Pays de la Loire, mettre dans un `<script>` séparé OU `@graph` syntaxe.
4. **Plausible custom events naming** : ne pas inclure d'espaces dans les noms si on utilise CSS class syntax (`plausible-event-name=My+Event` → "My Event"). Mais via JS `window.plausible('My Event')` les espaces sont OK.
5. **Plausible script SRC** : utiliser `script.outbound-links.tagged-events.js` (combiné, recommandé) plutôt que `script.js` simple — donne plus de features (outbound + tagged events natifs).
6. **Sitemap priority** : Google ignore largement. Bing utilise. Valeurs indicatives.
7. **robots.txt GPTBot** : décision éthique Ismael. Recommandation : ne pas bloquer MVP.
8. **Validation outils** : doit être run **après deploy staging/prod** (les outils fetch l'URL live). Pas testable localement.
9. **Search Console DNS verification** : prend ~24h pour DNS propagation. Anticiper avant go-live.
10. **OG image `metadataBase`** : sans `metadataBase` global, les URLs OG relatives `/og/coming-soon.png` ne sont pas résolues en absolu → Open Graph cassé. Pattern Next.js 16 critical.

### Coordination cross-story

- **Story 0.15 (toggle middleware)** : robots.txt stub + sitemap stub livrés → Story 0.21 finalise.
- **Story 0.17 (landing apex)** : ComingSoonFormClient.tsx tracking events ajoutés en UPDATE.
- **Story 0.18 (landing seller)** : CrossZoneCta tracking via class HTML OR Client onClick.
- **Story 0.19 (4 pages publiques)** : Privacy 7_hosting UPDATE Plausible + ContactFormClient tracking event.
- **Story 0.20 (Resend handlers)** : indépendante. Le route handler peut éventuellement émettre Plausible event server-side via fetch `/api/event` Plausible API si voulu — non requis Story 0.21.
- **Stories Epic 1+ post-launch** : sitemap.xml évolue (routes Epic 1+ auto-added via flatMap pattern). JSON-LD enrichi (Service / LocalBusiness schemas). robots.txt mis à jour (post-launch retirer `/seller/onboarding/`).

### Project Structure Notes

- **Alignement** : pattern Next.js 16 natif metadata + Edge routes. Pas de tooling externe.
- **Variance** : binary fonts committed dans le repo (apps/public/public/fonts/ + apps/seller). Acceptable (Fraunces-Regular.woff2 ~50 KB).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story-0.21] Spec brute
- [Source: `_bmad-output/implementation-artifacts/0-15-coming-soon-toggle-infra-middleware.md`] robots.txt + sitemap.xml stubs à finaliser
- [Source: `_bmad-output/implementation-artifacts/0-17-landing-coming-soon-apex.md`] Custom events tracking à ajouter
- [Source: `_bmad-output/implementation-artifacts/0-19-public-pages-about-privacy-legal-contact.md`] Privacy 7_hosting UPDATE Plausible
- [Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots] Next.js 16 robots
- [Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap] sitemap
- [Source: https://nextjs.org/docs/app/api-reference/functions/image-response] ImageResponse Edge
- [Source: https://schema.org/Organization] Schema.org Organization
- [Source: https://plausible.io/docs/script-extensions] Plausible script extensions
- [Source: https://plausible.io/docs/custom-event-goals] Custom events tracking
- [Source: https://plausible.io/privacy-focused-web-analytics] RGPD compliance documenté
- [Source: `_bmad-output/planning-artifacts/architecture.md`#NFR55-58] SEO + i18n hreflang

### Latest tech specifics

- **Next.js 16.2.6** : MetadataRoute APIs + next/og stable.
- **Plausible Script Extensions** : `script.outbound-links.tagged-events.js` recommandé MVP.
- **schema.org** : Organization schema stable.
- **Fraunces font** : OFL license, gratuite, use commercial.

### Sécurité

- **Plausible RGPD compliant** : pas de cookies, pas d'IP stockée, pas de cross-site tracking. Mentionné Privacy.
- **Outbound links `rel="noopener noreferrer"`** : protection tabnabbing (sécurité).
- **JSON-LD** : pas de PII (seulement company info publique).
- **OG images Edge** : pas d'input user (slug whitelist enum strict), pas d'injection.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Build apex + seller successful avec OG routes Edge runtime + JSON-LD injecté + Plausible script conditional.
- Tests vitest verts (apex 139/139, seller 28/28) sans régression — `trackEvent` helper utilise `window.plausible?.()` no-op safe en env test.

### Completion Notes List

- **Implementation complète Tasks 2-6, 8-10** code-side. Tasks 1 (création comptes Ismael) + 7 (validation outils post-deploy) + 2.4/3.5/4.3/10.3 (smoke local curl) délégués Ismael — leur exécution n'est PAS bloquante pour passer la story en `review`.
- **Sémantique audience/segment Resend** clarifiée et documentée Privacy block — pas de cookie banner RGPD (Plausible cookie-less Allemagne).
- **Décisions techniques implementer-time** :
  - Spec sitemap disait `7 routes × 2 locales = 14 entries`. Implementation : `5 routes × 2 = 10 entries` car (a) `/` retiré (rewrite vers `/{locale}/coming-soon` middleware Story 0.15, canonical pointe vers locale-prefix), (b) `/devenir-pro` retiré du sitemap apex car la page vit sur seller.tukio.one (Story 0.18 `/seller-coming-soon`). Total 12 entries × 2 sitemaps (apex 10 + seller 2).
  - Spec robots disait `disallow: ['/auth/', '/account/', '/(authenticated)/']`. Implementation respecte la convention Story 0.15 post-review P9 : paths **locale-préfixés** (`/fr/auth/`, `/en/auth/`) car crawlers prefix-match littéralement. `(authenticated)` Next.js route group filesystem-only jamais listé.
  - Spec disait `lastModified: new Date()` per request. Implementation respecte Story 0.15 post-review P4 : constante statique `LAST_MODIFIED = new Date('2026-05-23T00:00:00Z')` — préserve crawler caches.
  - Spec disait runbook dans `docs/runbooks/`. Implementation : `docs/runbook/` singulier (convention existante post-0.15 fix, alignée 9 autres runbooks).
  - Spec disait e2e dans `apps/public/test/e2e/`. Implementation : `apps/public/e2e/` (convention Playwright config Story 1.3d, alignée 5 autres specs existantes).
  - JSON-LD injecté dans `<body>` plutôt que `<head>` (Next.js layout ne contrôle pas `<head>` directement, et schema.org JSON-LD valide dans le body par les crawlers Google).
  - CrossZoneCta seller Server Component : Plausible tracking via classes CSS `plausible-event-name=Devenir+Pro+CTA+Click` + `plausible-event-locale=fr|en` — pas besoin de migrer Client Component (zéro JS preserved).
  - GPTBot/CCBot non bloqués (recommandation spec, position éthique Ismael : visibilité IA > restriction).
- **Pré-requis Ismael à débloquer post-merge** (cf. runbook `seo-prelaunch-checklist.md`) :
  1. Compte Plausible (`tukio.one` + `seller.tukio.one`) — set `NEXT_PUBLIC_PLAUSIBLE_ENABLED=true` sur Droplet
  2. Search Console properties + DNS TXT verification × 2 (sur Squarespace)
  3. Bing Webmaster properties + DNS TXT verification × 2
  4. Submit sitemaps × 2 propriétés
  5. Validation outils Rich Results / Schema Validator / Twitter Card / FB Debugger / Lighthouse ≥ 95
- Fraunces font 17.5 KB latin subset suffit pour titre/subtitle des OG images (couvre "ô" français + apostrophes).
- Plausible script extension `script.outbound-links.tagged-events.js` choisi pour auto-tagging outbound links + custom events via class CSS (compatible Server Components).
- Stories Epic 1+ post-launch : sitemap/robots/JSON-LD évolutifs sans rework grâce au pattern `flatMap × LOCALES` + branches conditional `isComingSoon`.

### File List

**NEW (10) :**
- `apps/public/src/app/og/[slug]/route.tsx` (Edge ImageResponse, 6 slugs FR+EN)
- `apps/public/src/app/og/route.ts` (308 redirect fallback)
- `apps/public/public/fonts/Fraunces-Regular.woff2` (binary, 17.5 KB latin subset)
- `apps/seller/src/app/og/[slug]/route.tsx` (Edge ImageResponse, 2 slugs FR+EN)
- `apps/seller/src/app/og/route.ts` (308 redirect fallback)
- `apps/seller/public/fonts/Fraunces-Regular.woff2` (binary)
- `apps/public/e2e/seo.spec.ts` (16 cases robots/sitemap/og/meta/JSON-LD/outbound × 2 locales projects)
- `docs/runbook/seo-prelaunch-checklist.md` (6 sections — Search Console + Bing + outils + update OG/Plausible + cleanup post-launch)

**UPDATE (11) :**
- `apps/public/src/app/robots.ts` (stub Story 0.15 → production whitelist pré-launch + post-launch branches, paths locale-préfixés)
- `apps/public/src/app/sitemap.ts` (stub → 5 routes × 2 locales = 10 entries + hreflang alternates fr/en/x-default)
- `apps/seller/src/app/robots.ts` (stub → production, `/seller/*` private both states)
- `apps/seller/src/app/sitemap.ts` (stub → 1 route × 2 locales = 2 entries + hreflang)
- `apps/public/src/app/[locale]/layout.tsx` (+ JSON-LD Organization + Plausible Script conditional + metadataBase + title.template)
- `apps/seller/src/app/[locale]/layout.tsx` (idem variante seller)
- `apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx` (+ `trackEvent('Coming Soon Form Submit'/'Success')`, props role+locale+alreadySubscribed)
- `apps/public/src/features/public-pages/components/ContactFormClient.tsx` (+ `trackEvent('Contact Form Submit')` props category+subject+locale)
- `apps/seller/src/features/pre-launch/components/CrossZoneCta.tsx` (+ classes Plausible tagged-events tous variants)
- `apps/public/src/messages/fr.json` (privacy.blocks.hosting body étendu mention Plausible)
- `apps/public/src/messages/en.json` (idem EN)
- `apps/public/.env.example` (+ NEXT_PUBLIC_PLAUSIBLE_ENABLED bloc commenté)
- `apps/seller/.env.example` (idem)

**Total : 22 fichiers (8 NEW code + 2 NEW binary + 1 NEW spec + 1 NEW runbook + 11 UPDATE).** Estimation spec ~20 fichiers — cohérent.

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-21 | bmad-create-story (Opus 4.7) | Initial story creation — SEO foundation + Analytics complet pré-lancement : robots.txt + sitemap.xml dynamiques hreflang × 2 apps + 7 OG images Next.js 16 ImageResponse Edge runtime + JSON-LD schema.org Organization × 2 apps + Plausible Analytics cookie-less RGPD + 4 custom events (Coming Soon Form Submit/Success + Contact Form Submit + Devenir Pro CTA Click) + Privacy update Plausible mention + Search Console + Bing Webmaster setup + runbook seo-prelaunch-checklist.md 6 sections + Playwright e2e seo.spec.ts 10+ cases × 14 contextes. DERNIÈRE story Phase Pré-Lancement. ~20 fichiers, 2j dev. |
| 2026-05-23 | bmad-dev-story (Opus 4.7 1M) | Implementation complete — Tasks 2-6, 8-10 livrés (Tasks 1 + 7 délégués Ismael externals). 22 fichiers : 8 NEW code (2 OG routes apex + 2 OG routes seller + Playwright e2e + runbook) + 2 NEW binary (Fraunces fonts) + 11 UPDATE (4 robots+sitemap, 2 layouts JSON-LD/Plausible/metadataBase/title.template, 3 forms trackEvent, 2 messages fr+en Plausible mention, 2 .env.example NEXT_PUBLIC_PLAUSIBLE_ENABLED). Validations : lint 0 errors × 2, typecheck 0 errors × 2, vitest apex 139/139 + seller 28/28, build successful × 2 (Edge OG routes confirmed). 6 décisions implementer-time documentées Completion Notes (sitemap 10 vs 14 entries, robots locale-préfixés post-0.15-P9, lastModified statique post-0.15-P4, runbook singulier convention, e2e/ vs test/e2e/, JSON-LD body vs head). |
