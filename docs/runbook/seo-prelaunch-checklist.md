# Runbook — SEO checklist pré-lancement (Story 0.21)

Procédure complète pour activer Search Console + Bing Webmaster + Plausible
Analytics sur `tukio.one` + `seller.tukio.one`, et valider la signature SEO
sur les 7 pages publiques de la phase pré-lancement.

À exécuter **après** un premier deploy prod (les outils Google/Bing fetch
les URLs live — pas testable localement).

## Section 1 — Google Search Console (compte → property → sitemap)

1. Ouvrir <https://search.google.com/search-console> avec le compte Google qui
   reçoit `contact@tukio.one` (alias Workspace).
2. **Add property** → **URL prefix** → `https://tukio.one/`.
3. Vérification ownership : choisir **DNS TXT record** (permanent, recommandé).
   - Copier le TXT (`google-site-verification=...`).
   - Aller sur Squarespace → **Domains** → **tukio.one** → **DNS** → **Add Record**.
   - Type `TXT`, Host `@` (apex), Value = la valeur copiée, TTL `3600`.
   - Save, attendre 5-15 min, cliquer **Verify** dans Search Console.
4. Répéter étapes 2-3 pour `https://seller.tukio.one/`.
   - Le TXT pour seller s'ajoute sur Host `seller` (sous-domaine).
5. **Submit sitemap** :
   - Property `tukio.one` → **Sitemaps** → `https://tukio.one/sitemap.xml` → **Submit**.
   - Property `seller.tukio.one` → idem `https://seller.tukio.one/sitemap.xml`.
6. **URL Inspection** sur 1-2 URLs clés (e.g. `https://tukio.one/fr/coming-soon`).
   Demander indexing → "URL is on Google" sous 7 jours.

## Section 2 — Bing Webmaster

1. Ouvrir <https://www.bing.com/webmasters> avec le même compte Google
   (Bing supporte OAuth Google) OU importer depuis Search Console.
2. **Add a site** → `https://tukio.one/` + `https://seller.tukio.one/`.
3. Vérification : choisir **DNS verification** → ajouter le TXT fourni
   (même procédure Squarespace que §1.3).
4. **Submit sitemap** → URL `/sitemap.xml` × 2 propriétés.
5. Bing indexing est plus lent que Google — patience ~14 jours.

## Section 3 — Outils de validation SEO (à passer post-deploy)

Lancer ces tests **après chaque deploy** qui touche aux meta, OG, ou JSON-LD.

| Outil | URL | Ce qu'on attend |
|---|---|---|
| Rich Results Test | <https://search.google.com/test/rich-results> | `Organization` schema détecté, 0 erreur, 0 warning |
| Mobile-Friendly Test | <https://search.google.com/test/mobile-friendly> | "Page is mobile-friendly" sur les 7 pages |
| Schema Markup Validator | <https://validator.schema.org/> | JSON-LD valide schema.org strict |
| Twitter Card Validator | <https://cards-dev.twitter.com/validator> | Preview `summary_large_image` correct |
| Facebook Sharing Debugger | <https://developers.facebook.com/tools/debug/> | Preview Open Graph + scrape OK + image 200 |
| Lighthouse | `pnpm lighthouse:ci` ou DevTools | SEO ≥ 95 (cible ≥ 98) sur les 7 pages × 2 locales |
| axe-core | Lighthouse ou DevTools | 0 violation accessibilité |

Pages à tester (× 2 locales `fr` + `en`) :

- `https://tukio.one/{locale}/coming-soon`
- `https://tukio.one/{locale}/a-propos`
- `https://tukio.one/{locale}/confidentialite`
- `https://tukio.one/{locale}/mentions-legales`
- `https://tukio.one/{locale}/contact`
- `https://seller.tukio.one/{locale}/seller-coming-soon`

Plus les URLs OG :

- `https://tukio.one/og/coming-soon` → PNG 1200×630 200 OK
- `https://seller.tukio.one/og/seller-coming-soon` → idem

## Section 4 — Update OG image ou Plausible config

### Modifier un visuel OG

1. Éditer `apps/public/src/app/og/[slug]/route.tsx` (ou variant seller).
2. Modifier le JSX ou la mapping `SLUGS` (titre/subtitle/badge).
3. Commit + deploy. L'Edge runtime regénère.
4. **Purger le cache CDN** (Cache-Control 24h) — sinon les preview restent
   anciens 24h. Sur DO : pas de CDN front actuellement (Caddy direct).
   À l'ajout de Cloudflare CDN (V1+), purge depuis le dashboard.
5. Re-tester via Facebook Sharing Debugger → **Scrape Again** pour
   forcer Meta à re-fetcher la page.

### Activer Plausible en production

1. Compte Plausible (<https://plausible.io>) → **Add a website**.
2. Domain à entrer **exact** : `tukio.one` (pas `www.tukio.one`).
3. Répéter pour `seller.tukio.one`.
4. Sur DO Droplet, set `NEXT_PUBLIC_PLAUSIBLE_ENABLED=true` dans le
   `.env.production` (ou équivalent), puis redeploy. Le script charge.
5. Visiter `https://tukio.one/fr/coming-soon` depuis un navigateur sans
   ad-blocker → Plausible dashboard montre la visite sous 60s.

### Goals / custom events Plausible

Pour avoir le funnel dans le dashboard Plausible :

1. Plausible dashboard → **Site settings** → **Goals & Funnels** → **Add Goal**.
2. Goals à créer :
   - `Pageview` → `/fr/coming-soon` (et `/en/coming-soon`)
   - `Custom event` → `Coming Soon Form Submit`
   - `Custom event` → `Coming Soon Form Submit Success`
   - `Custom event` → `Contact Form Submit`
   - `Custom event` → `Devenir Pro CTA Click` (côté `seller.tukio.one`)
3. **Funnel** : `Pageview /coming-soon` → `Coming Soon Form Submit` →
   `Coming Soon Form Submit Success`. Plausible affiche le % de
   conversion à chaque étape. Cible MVP : ≥ 3 %.

## Section 5 — Plausible dashboard sharing / API

- **Lecture publique** (transparence pré-lancement, optionnel) :
  dashboard → **Site settings** → **Visibility** → **Make stats public**.
  À considérer plutôt côté footer transparency post-launch.
- **API stats** : Plausible expose une API REST (token requis) pour
  intégrer des graphiques en admin. Pas requis MVP.

## Section 6 — Cleanup au lancement (Epic 1+ go-live)

À exécuter quand on bascule `NEXT_PUBLIC_COMING_SOON_MODE=false` :

1. **`apps/public/src/app/robots.ts`** : la branche `post-launch` est déjà
   active automatiquement (conditional sur la flag). Vérifier que :
   - `/api/`, `/_next/`, `/fr/auth/`, `/en/auth/`, `/fr/account/`,
     `/en/account/`, `/fr/cart/`, `/en/cart/`, `/fr/checkout/`,
     `/en/checkout/` restent disallowed.
   - Plus de blanket `/fr/`+`/en/` disallow (qui cachait Epic 1+).
2. **`apps/public/src/app/sitemap.ts`** : enrichir le tableau `ROUTES`
   avec les nouvelles routes Epic 1+ (`/services/[slug]`, `/pro/[slug]`,
   `/categories/[slug]`, etc.). Le pattern `flatMap × LOCALES` les
   propage automatiquement avec hreflang.
3. **`apps/public/src/app/[locale]/layout.tsx`** : enrichir le JSON-LD
   Organization en ajoutant les nouveaux `sameAs` (URLs LinkedIn, Twitter,
   Facebook une fois les comptes créés). Considérer ajouter un schema
   `LocalBusiness` séparé pour SEO local Pays de la Loire.
4. **Plausible** : les events existants continuent. Ajouter de nouveaux
   custom events pour le funnel post-launch :
   - `Listing View` / `Listing Save` / `Booking Start` / `Booking Complete`.
5. **Search Console** : re-submit sitemap si nouvelles routes ajoutées.
6. **OG images** : créer de nouveaux slugs au besoin
   (`/og/services-pilot`, `/og/categories-pilot`, etc.).

## Voir aussi

- [Pre-launch toggle runbook](./pre-launch-toggle.md) — flag
  `NEXT_PUBLIC_COMING_SOON_MODE` et reversibility
- [Pre-launch Resend cleanup](./pre-launch-resend-cleanup.md) — migration
  waitlist vers Brevo (Epic 16.2)
