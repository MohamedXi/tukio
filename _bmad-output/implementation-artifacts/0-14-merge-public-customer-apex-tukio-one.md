# Story 0.14 — Merge `apps/public` + `apps/customer` en app unifiée sur l'apex `tukio.one` (tunnel B2C)

Status: ready-for-dev

> **Cf. ADR-016** dans `_bmad-output/planning-artifacts/architecture.md` —
> **supersedes ADR-013** (multi-zones 4 apps frontend). La séparation Sprint 0
> `apps/public` (visiteur) vs `apps/customer` (authentifié) était une
> sur-optimisation prématurée. Les marketplaces matures (Airbnb, Booking,
> Vinted, Doctolib) hébergent toutes le tunnel guest → customer sur le même
> domain pour une UX sans rupture et une SEO apex maximale.

## Story

**En tant que** founder de tukio.one,
**je veux** que les visiteurs (recherche, landing, fiches services) et les
customers authentifiés (compte, réservations, favoris, paiements) partagent
le même domaine `tukio.one`,
**afin de** offrir une UX continue sans jarring cross-subdomain (pas de hop
`app.tukio.one` → `customer.tukio.one` après login), simplifier
massivement l'état applicatif (cart, session, cookies, locale tous sur la
même origin), optimiser le ranking SEO (apex > subdomain), et réduire la
charge ops (3 apps Next.js au lieu de 4, -200-300 MB RAM sur `tukio-apps`,
-1 image GHCR, -1 cert LE).

Topology finale (post-Story) :

| Hostname | Audience | App source |
| --- | --- | --- |
| `tukio.one` (apex) | **Visiteurs + Customers B2C** (mergés, tunnel unifié) | `apps/public` (renommé conceptuellement "B2C") |
| `seller.tukio.one` | **Pros B2B** | `apps/seller` (inchangé) |
| `admin.tukio.one` | **Staff** (modération, KYC) | `apps/admin` (inchangé) |
| `api.tukio.one` | gateway-api (inchangé) | — |
| `auth.tukio.one` | Keycloak (inchangé) | — |

Subdomains retirés : `app.tukio.one` (était public), `customer.tukio.one`
(était customer authentifié), `www.tukio.one` (redirect optionnel apex).

## Acceptance Criteria

1. **Routes mergées** : toutes les routes actuellement dans `apps/customer/src/app/[locale]/**` sont migrées dans `apps/public/src/app/[locale]/**` sous un préfixe sémantique (`/account`, `/bookings`, `/favorites`, `/messages`, etc.) — l'arborescence app router est préservée.
2. **Auth-gating** : un middleware Next.js (`apps/public/src/middleware.ts`) protège les routes auth-gated et redirige les requêtes non authentifiées vers `/login` (callback URL préservé). Les routes publiques (landing, listings, search, fiche service) restent accessibles sans session.
3. **Layouts** : un layout public-default + un layout `(authenticated)` group servent le shell visiteur (NavbarPublic, footer marketing) vs shell customer (NavbarCustomer, sidebar account). Story 0.5 patterns réutilisés.
4. **next-intl** : configuration locale dispatch unifiée (`/fr`, `/en`) — pas de duplication du fichier `i18n/request.ts`. Les messages `messages/{fr,en}.json` mergés (clés `public.*` + `customer.*` préservées pour rétro-compat).
5. **`apps/customer` retiré** : codebase supprimée, package supprimé de `pnpm-workspace.yaml`, image GHCR `tukio/customer` retirée (devient orpheline — à purger manuellement post-merge).
6. **CI/CD** : `build-images.yml` allowlist passe de 14 → 13 services (drop `customer`). `deploy-staging.yml` + `deploy-production.yml` BACKENDS list drop `customer` (passe à 14 services live : caddy + 10 backends + 3 frontends).
7. **Caddy** : `Caddyfile` retire le bloc `customer.tukio.one`. Le bloc `tukio.one` (actuellement redirect → app) devient le bloc principal et `reverse_proxy public:3000` (preserved Host, port-strip).
8. **DNS Squarespace** : record A `customer.tukio.one` retiré (peut rester sans risque). Record A `app.tukio.one` retiré OU laissé pour rétro-compat 6 mois (redirect 301 → apex).
9. **PRD updated** : section "Applications" (PRD v1, ligne ~480) passe de 4 à 3 apps frontend. Audiences mappées : B2C particuliers → apex, B2B pros → seller subdomain, staff/admin → admin subdomain.
10. **Stories Epic 1+ scannées** : toute story qui référence `app.tukio.one` ou `customer.tukio.one` (Epic 1 stories 1.4 login callback, 1.5 password reset email link, 1.6 verification landing) renommée vers `tukio.one/<route>`. Estimation initiale : 5-10 stories à patcher (search dans `_bmad-output/implementation-artifacts/`).
11. **next.config.ts** : `apps/public/next.config.ts` augmenté avec `output: 'standalone'` recommandé (vrai fix root-cause du port-leak observé en Story 0.13b — voir Dev Notes). Dockerfile mis à jour pour standalone server.
12. **E2E smoke** : `curl https://tukio.one/` retourne HTTP 200 + HTML Next.js (locale par défaut FR), `curl https://tukio.one/login` retourne 200 (page publique), `curl https://tukio.one/account` non-authentifié retourne 302 → `/login?callback=/account`. Tests Playwright actuels dans `apps/public/e2e/` étendus.

## Tasks / Subtasks

- [ ] **Task 1 — Préparation refactor (audit + diff)** (AC: #1, #10)
  - [ ] 1.1 — Lister exhaustivement les routes de `apps/customer/src/app/[locale]/**` (~ `find`)
  - [ ] 1.2 — Lister exhaustivement les fichiers `apps/customer/src/{components,lib,hooks,types}/**` à migrer
  - [ ] 1.3 — Lister les dépendances `apps/customer/package.json` qui ne sont pas déjà dans `apps/public/package.json` → merger
  - [ ] 1.4 — Scanner toutes les stories `_bmad-output/implementation-artifacts/*.md` pour références à `app.tukio.one` ou `customer.tukio.one` → table des stories à patcher (Epic 1 minimum, surtout 1.4 / 1.5 / 1.6)
  - [ ] 1.5 — Identifier les patterns `@tukio/ui/patterns/*` utilisés différemment public vs customer (Navbar, Sidebar)

- [ ] **Task 2 — Migration de l'arborescence routes** (AC: #1, #3, #4)
  - [ ] 2.1 — Copier `apps/customer/src/app/[locale]/account/` → `apps/public/src/app/[locale]/(authenticated)/account/`
  - [ ] 2.2 — Copier `apps/customer/src/app/[locale]/bookings/` → `apps/public/src/app/[locale]/(authenticated)/bookings/`
  - [ ] 2.3 — Copier `apps/customer/src/app/[locale]/favorites/` → `apps/public/src/app/[locale]/(authenticated)/favorites/`
  - [ ] 2.4 — Copier `apps/customer/src/app/[locale]/messages/` → `apps/public/src/app/[locale]/(authenticated)/messages/`
  - [ ] 2.5 — Copier autres routes auth-gated identifiées en Task 1
  - [ ] 2.6 — Créer `apps/public/src/app/[locale]/(authenticated)/layout.tsx` = AuthCustomerLayout (NavbarCustomer + sidebar)
  - [ ] 2.7 — Conserver `apps/public/src/app/[locale]/layout.tsx` = NavbarPublic + footer marketing
  - [ ] 2.8 — Vérifier que les routes `(authenticated)` n'ont pas de path-conflict avec les routes publiques (ex: `/login`, `/about`)

- [ ] **Task 3 — Middleware auth-gating** (AC: #2)
  - [ ] 3.1 — Créer `apps/public/src/middleware.ts` qui :
    - matche `/(fr|en)/(account|bookings|favorites|messages)/**`
    - vérifie le cookie session Keycloak (via `@tukio/auth-client`)
    - redirige vers `/${locale}/login?callback=${encodeURIComponent(pathname)}` si absent
  - [ ] 3.2 — Update `apps/public/src/i18n/request.ts` ou créer un wrapper pour permettre middleware composable
  - [ ] 3.3 — Tests middleware : Playwright `auth-gate.spec.ts` (visit /account anonyme → redirect login, visit /listings → 200)

- [ ] **Task 4 — Merger les messages i18n** (AC: #4)
  - [ ] 4.1 — Copier `apps/customer/messages/fr.json` clés (souvent `customer.*`) → `apps/public/messages/fr.json`
  - [ ] 4.2 — Idem `en.json`
  - [ ] 4.3 — Détecter et résoudre les collisions de clés (`public.cta.book` vs `customer.cta.book` si identiques → factoriser, sinon namespacer)
  - [ ] 4.4 — Run `pnpm --filter=public typecheck` → vérifier zero erreur de clé manquante

- [ ] **Task 5 — Merger les dépendances + cleanup `apps/customer`** (AC: #5)
  - [ ] 5.1 — Diff `apps/{public,customer}/package.json` → ajouter les manquantes dans public (probablement `@tanstack/react-query`, `zod` côté forms)
  - [ ] 5.2 — `pnpm install` à la racine pour rebuild lockfile
  - [ ] 5.3 — `rm -rf apps/customer/`
  - [ ] 5.4 — Retirer `apps/customer` de `pnpm-workspace.yaml` si listé explicitement
  - [ ] 5.5 — Retirer `apps/customer` de tout `tsconfig.references` ou `turbo.json` si listé
  - [ ] 5.6 — `pnpm typecheck` + `pnpm lint` repo entier zéro régression

- [ ] **Task 6 — Next.js `output: 'standalone'` + Dockerfile** (AC: #11)
  - [ ] 6.1 — Ajouter `output: 'standalone'` dans `apps/public/next.config.ts`
  - [ ] 6.2 — Idem pour `apps/seller/next.config.ts` et `apps/admin/next.config.ts` (cohérence + bénéfice port-leak fix root-cause)
  - [ ] 6.3 — Mettre à jour `infra/scripts/gen-dockerfiles.sh` template Next.js : copier `.next/standalone/` + `.next/static/` + `public/` au lieu de `/deploy` complet + CMD `["node","server.js"]`
  - [ ] 6.4 — Re-run gen-dockerfiles.sh → vérifier les 3 Dockerfiles frontend (public, seller, admin) régénérés
  - [ ] 6.5 — Build local d'un frontend en mode standalone pour valider (`docker build -f apps/public/Dockerfile . -t test-public`)
  - [ ] 6.6 — Vérifier que Caddyfile `header_down Location ":3000"` peut être retiré (standalone server respecte X-Forwarded-Host)

- [ ] **Task 7 — CI/CD : drop customer du pipeline** (AC: #6)
  - [ ] 7.1 — `build-images.yml` : retirer `customer` des 3 occurrences de l'ALL allowlist (string fallback, validator case, JSON filter Set)
  - [ ] 7.2 — `build-images.yml` smoke step : retirer la ligne `customer) PORT=3001 ;;`
  - [ ] 7.3 — `build-images.yml` triggers paths : retirer `apps/customer/**`
  - [ ] 7.4 — `deploy-staging.yml` BACKENDS : retirer `customer` (passe à 14 services)
  - [ ] 7.5 — `deploy-production.yml` BACKENDS : idem (2 occurrences)
  - [ ] 7.6 — Push + verify `gh workflow run build-images.yml --ref develop` reconstruit 13 services
  - [ ] 7.7 — `gh workflow run deploy-staging.yml` re-déploie + smoke

- [ ] **Task 8 — Caddyfile + apps.prod.yml retire customer** (AC: #7)
  - [ ] 8.1 — Retirer le bloc `customer.tukio.one { … }` de `infra/docker-compose/Caddyfile`
  - [ ] 8.2 — Modifier le bloc apex `tukio.one { redir … }` → `tukio.one { reverse_proxy public:3000 { header_up Host {host} ; header_up X-Forwarded-Proto https ; … } }` (= bloc actuel de `app.tukio.one`)
  - [ ] 8.3 — Retirer le bloc `app.tukio.one` OU le transformer en `app.tukio.one { redir https://tukio.one{uri} permanent }` (rétro-compat 6 mois pour anciens liens partagés)
  - [ ] 8.4 — Retirer le service `customer:` de `infra/docker-compose/apps.prod.yml`
  - [ ] 8.5 — Vérifier `infra/docker-compose/apps.prod.yml` : `public` service reste (sert l'apex), `customer` retiré, `seller` et `admin` inchangés
  - [ ] 8.6 — `docker compose -f apps.prod.yml config --quiet` validation syntax

- [ ] **Task 9 — DNS Squarespace cleanup** (AC: #8)
  - [ ] 9.1 — [USER] Sur Squarespace DNS panel : retirer le record A `customer.tukio.one` (ne pointe plus vers rien)
  - [ ] 9.2 — [USER, optional] Retirer le record A `app.tukio.one` SI option B sans rétro-compat ; sinon laisser
  - [ ] 9.3 — Mettre à jour `docs/ci-cd/digitalocean-deployment.md` table DNS post-Story (5 records au lieu de 7)

- [ ] **Task 10 — PRD + stories Epic 1+ patches** (AC: #9, #10)
  - [ ] 10.1 — Patch `_bmad-output/planning-artifacts/prd.md` section "Applications" : 4 → 3 apps frontend (public B2C apex, pro seller subdomain, admin subdomain)
  - [ ] 10.2 — Patch `.agents/acs.yaml` `codebases.frontends` array : retirer `customer`, audience `public` devient "Marketing + B2C tunnel (visitor + authenticated customer)"
  - [ ] 10.3 — `grep -rEn "(app|customer)\.tukio\.one" _bmad-output/implementation-artifacts/*.md` → patcher chaque story listée Task 1.4 vers `tukio.one/<route>` approprié
  - [ ] 10.4 — Mettre à jour `.agents/context/architecture.md` et `directory-layout.md` (3 apps au lieu de 4)
  - [ ] 10.5 — Update memory `do_phase_b_started_2026_05_14.md` notes si pertinent

- [ ] **Task 11 — Tests + smoke deploy** (AC: #12)
  - [ ] 11.1 — `pnpm test` repo entier zéro régression (Vitest frontend + Jest backend)
  - [ ] 11.2 — Playwright e2e dans `apps/public/e2e/` : ajouter spec `auth-gate.spec.ts` (anonymous /account → 302, customer /account → 200)
  - [ ] 11.3 — Push + watch CI green
  - [ ] 11.4 — Trigger `deploy-staging.yml` → smoke
  - [ ] 11.5 — `curl https://tukio.one/` → 200 + HTML Next.js
  - [ ] 11.6 — `curl https://tukio.one/login` → 200 (page publique)
  - [ ] 11.7 — `curl -o /dev/null -w "%{http_code} %{redirect_url}" https://tukio.one/account` → 302 → `/fr/login?callback=...`
  - [ ] 11.8 — `curl https://seller.tukio.one/` → 200 ou 404 selon état app (pas régression)
  - [ ] 11.9 — `curl https://admin.tukio.one/` idem
  - [ ] 11.10 — `curl https://api.tukio.one/` + `https://auth.tukio.one/realms/master` zéro régression
  - [ ] 11.11 — Vérifier RAM tukio-apps < 1800 MB (gain attendu ~200-300 MB du drop customer)

- [ ] **Task 12 — Sprint status + memory + ADR final** (cross-cutting)
  - [ ] 12.1 — sprint-status.yaml : `0-14-merge-public-customer-apex-tukio-one: done`
  - [ ] 12.2 — Marquer ADR-013 dans architecture.md comme **superseded by ADR-016**
  - [ ] 12.3 — Memory file : ajouter pointer reference vers cette story + ADR-016
  - [ ] 12.4 — Mettre à jour `MEMORY.md` index

## Dev Notes

### Pourquoi cette pivot ? Rationale détaillé

**Constat Sprint 0** : la séparation `apps/public` + `apps/customer` a été
décidée tôt (Story 0.1 bootstrap + ADR-013 multi-zones) sous l'hypothèse
que les 2 audiences (visiteur anonyme vs customer authentifié) justifient
des codebases séparées pour :

1. Séparation des concerns (code public léger SEO-first vs code customer
   plus lourd avec providers session)
2. Bundle size : visiteur ne charge pas le JS customer-only
3. Isolation deploy (un bug customer ne fait pas tomber le landing)

**Réalité observée Phase B Story 0.13b** :

1. Les marketplaces matures **toutes** (Airbnb, Booking, Vinted, Doctolib,
   leboncoin, Frichti, Manomano…) hébergent le tunnel guest → customer sur
   le même domain. Le bundle-split est résolu par Next.js code-splitting
   automatique + dynamic imports, pas par un split de codebases.
2. Le cross-subdomain cookie (`.tukio.one` shared cookies) demande un
   travail non-trivial (set-cookie domain correct, CORS pour API…) et
   reste source de bugs subtils.
3. Le cart anonyme → customer authentifié (story 4.3 Zustand
   cross-zone persistence) **nécessite déjà** un cookie cross-zone.
   Sur même domain c'est trivial (LocalStorage / IndexedDB suffisent).
4. SEO : un visiteur qui search un service voit le résultat sur
   `tukio.one/services/marquees/...`. Si après login le compte est sur
   `customer.tukio.one`, l'URL change → confusion + canonical URLs
   complexes à gérer (`<link rel="canonical">`).
5. Coût ops : 4 apps Next.js sur tukio-apps consomment ~1 GB RAM ensemble
   (≈ 250 MB chacune en prod). Sur droplet 2 GB c'est tendu. -1 app = +250
   MB de marge pour Caddy + backends.

**Trade-offs résolus** :

| Trade-off | Décision |
|---|---|
| Bundle size visiteur | Next.js dynamic imports + Server Components → le visiteur ne télécharge pas le code customer-gated (split automatique par route) |
| Deploy isolation | Mitigé : healthcheck + auto-rollback dans deploy-production.yml + un bug customer n'impacte que les routes auth-gated (visiteur public OK) |
| Code organization | Conserver `(authenticated)` group folder Next.js App Router pour ségréguer mentalement |
| URL design | `tukio.one/account` est plus court et plus mémorisable que `customer.tukio.one/account` |

### Architecture Next.js post-merge

```
apps/public/
├─ src/
│  ├─ app/
│  │  └─ [locale]/
│  │     ├─ layout.tsx                    # Root layout (next-intl provider, Tailwind)
│  │     ├─ page.tsx                      # Landing (visiteur, SSR statique avec ISR)
│  │     ├─ login/page.tsx                # Auth pages (publiques, sortantes vers Keycloak PKCE)
│  │     ├─ register/page.tsx
│  │     ├─ services/[slug]/page.tsx      # Fiche service (visiteur OU customer)
│  │     ├─ search/page.tsx               # Recherche (visiteur OU customer)
│  │     ├─ (marketing)/                  # Group route (n'apparaît pas dans URL)
│  │     │  ├─ about/page.tsx
│  │     │  ├─ contact/page.tsx
│  │     │  └─ terms/page.tsx
│  │     └─ (authenticated)/              # Group route (n'apparaît pas dans URL)
│  │        ├─ layout.tsx                 # AuthCustomerLayout (NavbarCustomer + sidebar)
│  │        ├─ account/page.tsx
│  │        ├─ bookings/page.tsx
│  │        ├─ favorites/page.tsx
│  │        ├─ messages/page.tsx
│  │        └─ ...
│  ├─ middleware.ts                       # Auth-gate (authenticated)/* + locale dispatch
│  ├─ i18n/request.ts                     # next-intl Server Components config
│  └─ components/, hooks/, lib/           # App-local (utiliser @tukio/ui pour atoms/patterns)
├─ messages/
│  ├─ fr.json                             # Mergé public.* + customer.*
│  └─ en.json
├─ public/                                # Assets statiques (logo, og-image…)
├─ package.json                           # Mergé deps public + customer
├─ next.config.ts                         # `output: 'standalone'`
└─ Dockerfile                             # Mode standalone (server.js + .next/static)
```

### Auth-gating middleware pattern

```ts
// apps/public/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { hasValidSession } from '@tukio/auth-client/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const AUTH_GATED = /^\/(fr|en)\/(account|bookings|favorites|messages)(\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (AUTH_GATED.test(pathname)) {
    const ok = await hasValidSession(request);
    if (!ok) {
      const locale = pathname.split('/')[1] ?? 'fr';
      const callback = encodeURIComponent(pathname + request.nextUrl.search);
      return NextResponse.redirect(
        new URL(`/${locale}/login?callback=${callback}`, request.url),
      );
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

### Stories Epic 1+ probablement impactées

À scanner / patcher en Task 10.3 :

| Story | Impact attendu |
| --- | --- |
| 1.4 Login flow Keycloak PKCE | Callback redirect URL : `app.tukio.one/callback` → `tukio.one/callback` |
| 1.5 Password reset flow | Email link : `https://customer.tukio.one/reset/<token>` → `https://tukio.one/reset/<token>` |
| 1.6 Email verification landing | Email link : idem |
| 1.7 Admin 2FA TOTP | Pas d'impact (admin subdomain inchangé) |
| 1.8 Profile management | URL `customer.tukio.one/account/profile` → `tukio.one/account/profile` |
| 1.9 Account deletion soft-delete | Idem `tukio.one/account/delete` |
| 3.3 Pro create listing wizard | Pas d'impact (seller subdomain) |
| 4.3 Cart UI mono-vendor persistence | **Simplification** : cookie cross-zone plus nécessaire — LocalStorage `tukio.one` suffit. PRD à rebriefer. |

Total estimé : **6-10 stories** à patcher. Patch léger (1 ligne par story
en moyenne) mais nécessite revue méticuleuse.

### Standalone mode = root-cause fix du port-leak

Story 0.13b a observé Next.js 16 + next-intl qui injecte `:3000` dans
les Location headers de redirect. Workaround Caddy `header_down`
fonctionne mais fragile (regex par port, à maintenir).

`output: 'standalone'` produit un serveur Node.js custom (`server.js`)
qui respecte correctement `X-Forwarded-*` headers et ne pollue pas l'URL
avec le port d'écoute. Bonus : image Docker plus petite (~50-80 MB vs
~250 MB) car les `node_modules` du standalone sont pruned au strict
minimum.

### Files to UPDATE vs CREATE vs DELETE

> **À CREATE** :
> - `apps/public/src/app/[locale]/(authenticated)/layout.tsx`
> - `apps/public/src/middleware.ts`
> - `apps/public/e2e/auth-gate.spec.ts` (Playwright)
>
> **À UPDATE** :
> - `apps/public/src/app/[locale]/(authenticated)/account/` + bookings + favorites + messages (copiés depuis customer)
> - `apps/public/messages/{fr,en}.json` (merged keys)
> - `apps/public/package.json` (deps merged)
> - `apps/public/next.config.ts` (output: 'standalone')
> - `apps/seller/next.config.ts` + `apps/admin/next.config.ts` (output: 'standalone' pour cohérence)
> - `infra/scripts/gen-dockerfiles.sh` (frontend template standalone)
> - `apps/{public,seller,admin}/Dockerfile` (régénérés depuis gen-dockerfiles.sh)
> - `infra/docker-compose/Caddyfile` (drop customer block + apex devient principal)
> - `infra/docker-compose/apps.prod.yml` (drop customer service)
> - `.github/workflows/build-images.yml` (allowlist 14 → 13)
> - `.github/workflows/deploy-{staging,production}.yml` (BACKENDS drop customer)
> - `.agents/acs.yaml` (frontends array 4 → 3)
> - `_bmad-output/planning-artifacts/prd.md` (section Applications)
> - `_bmad-output/planning-artifacts/architecture.md` (marquer ADR-013 superseded, ajouter ADR-016 — déjà fait dans le commit créateur de cette story)
> - Stories Epic 1+ scannées (6-10 patches légers)
>
> **À DELETE** :
> - `apps/customer/` (codebase entière)
> - GHCR package `ghcr.io/mohamedxi/tukio/customer` (action manuelle GitHub UI ou `gh api -X DELETE`)
> - DNS record `customer.tukio.one` (action manuelle Squarespace)

### Critical Architecture Constraints

1. **Pas de régression UX visiteur** : la landing `tukio.one/` doit servir le contenu actuel de `apps/public` (search bar, fiche services, marketing). Le merge ne doit pas changer la perception visiteur.
2. **Pas de régression UX customer** : un customer existant qui bookmark `customer.tukio.one/account` doit être redirigé (301) vers `tukio.one/account` automatiquement (Task 8.3 décide entre rétro-compat 6 mois ou cleanup immédiat).
3. **Bundle size** : la page `tukio.one/` (visiteur) doit conserver un First Load JS < 250 KB. Vérifier via Lighthouse CI / Next.js build output. Le code customer-gated ne doit pas alourdir la landing → Next.js code-splitting automatique par route group le garantit normalement.
4. **next-intl** : pas de hardcoded text user-facing, pas de fuite de clé de l'autre app. Une clé manquante = erreur runtime.
5. **Auth state** : la transition non-authentifié → authentifié doit fonctionner sans full page reload (Server Components + revalidate après login callback).
6. **CSP / security headers** : Caddy applique déjà HSTS + X-Content-Type-Options. Le bloc apex doit en hériter (copie du bloc app.tukio.one actuel).
7. **Logs / monitoring** : UptimeRobot monitor pour `app.tukio.one` doit être mis à jour pour pointer vers `tukio.one/` (action user post-deploy).

### Testing Standards

- **Vitest** : tests unitaires colocated avec source (`*.spec.tsx`)
- **Playwright** : tests e2e dans `apps/public/e2e/` — couverture cible :
  - Visit landing → 200 + locale FR par défaut
  - Visit `/services/<slug>` → 200 + données mock
  - Visit `/account` anonymous → 302 → `/login`
  - Login flow → `/account` → 200
  - Cart anonyme → login → cart persisté (Story 4.3 contract)
- **Lighthouse CI** : LCP < 1s sur `/` (NFR3 PRD)

### Project Structure Notes

Le pivot **n'affecte que** la couche frontend. Backend NestJS services
inchangés. Pattern Pretre inchangé. NATS events inchangés. Base de
données schema inchangé. Voilà pourquoi cette story est isolable et
sûre à exécuter avant les Epics 1+.

### References

- ADR-016 dans `_bmad-output/planning-artifacts/architecture.md` (commit créateur de cette story)
- ADR-013 (frontend multi-zones, **superseded**)
- Story 0.13b PR #26 (`feature/story-0.13-frontend-images`) qui a démasqué le port-leak Next.js
- Mémoire `do_phase_b_started_2026_05_14.md` (état infra DO post Phase B)
- Next.js docs : [Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files)
- Next.js docs : [Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- Marketplace patterns : Airbnb, Booking, Vinted (apex single-app)

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent)

### Debug Log References

(à remplir — bundle size avant/après, RAM gain tukio-apps mesurée, durée smoke deploy, liste finale des stories Epic 1+ patched, GHCR package customer purge timestamp)

### Completion Notes List

(à remplir)

### File List

(à remplir)

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-15 (post Story 0.13b PR #26 + founder UX feedback `tukio.one` apex)
- **Created by** : founder request + ADR-016 décision
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational topology refactor)
- **Sprint cible** : Sprint 0 fin (avant Epic 1 dev démarre — sinon trop de stories Epic 1+ à re-patcher après)
- **Estimation effort** : 1-2 jours (~25 fichiers : 1 middleware + 1 layout group + ~10 routes copiées + Dockerfile/compose/Caddy/workflows + PRD/architecture/stories doc patches)
- **Dépendances upstream** :
  - Story 0.13b PR #26 (`feature/story-0.13-frontend-images`) — **merged ou non** (la stack 4-apps marche, 0.14 démolira `customer` peu importe)
  - ADR-016 ajouté dans architecture.md — **done** (dans le commit créateur de cette story)
- **Dépendances downstream** :
  - Toutes les stories Epic 1+ qui référencent `app.tukio.one` ou `customer.tukio.one` (à patcher en Task 10.3)
  - Future story Epic 7 (acquisition + multi-zones SEO) doit considérer la nouvelle topology
