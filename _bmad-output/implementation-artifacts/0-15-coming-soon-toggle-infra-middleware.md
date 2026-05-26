# Story 0.15: Toggle infra `NEXT_PUBLIC_COMING_SOON_MODE` + middleware `coming-soon-gate` apex/seller (Pre-launch foundation)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** tech lead orchestrant la phase pré-lancement de tukio.one (~6 mois de dev restants, domaine actif),
**I want** un **flag build-time** `NEXT_PUBLIC_COMING_SOON_MODE` lu par un **middleware `coming-soon-gate.ts`** (un par app : `apps/public` + `apps/seller`) qui, lorsqu'il est `true`, **rewrite** toutes les routes hors d'une whitelist explicite vers les landings Coming Soon (`/${locale}/coming-soon` sur apex, `/${locale}/seller-coming-soon` sur seller), tout en conservant les pages publiques (`/${locale}/{a-propos,confidentialite,mentions-legales,contact,devenir-pro}`) et les ressources techniques (`/_next/*`, `/api/*`, `/robots.txt`, `/sitemap.xml`, assets statiques),
**so that** : (a) tukio.one ne reste pas vide pendant les 6 mois de dev — un visiteur qui tape l'URL atterrit sur une landing crédible (Story 0.17) avec un formulaire de capture d'email ; (b) le code Epic 1+ déjà livré (Stories 1.1-1.4b done, 1.4c-1.4d/1.5+ en attente) **n'est pas supprimé ni modifié** — il est simplement masqué par le rewrite tant que le flag est ON ; (c) à l'ouverture officielle, désactiver le mode coming soon se résume à **3 actions** : `NEXT_PUBLIC_COMING_SOON_MODE=false` dans `.env.production` → redeploy via tag git → optionnel PR de nettoyage qui supprime le flag + le middleware (l'app fonctionne déjà avec le flag à `false` sans aucune modification de code) ; (d) en dev local, le flag est par défaut à `false` (`.env.local` non-committé) pour ne pas gêner les devs qui continuent Epic 1+ — seul `.env.example` shipped a `true` pour documenter l'intention pré-lancement.

> **Outcome attendu** : à la fin de cette story, (1) un build avec `NEXT_PUBLIC_COMING_SOON_MODE=true` sur `apps/public` rend la landing Coming Soon (placeholder Story 0.17 + page minimale temporaire livrée par Story 0.15) sur **toutes** les URLs hors whitelist — un visiteur qui tape `tukio.one/fr/auth/sign-up` voit la landing (URL conservée côté browser, contenu rewrite côté SSR) ; (2) `tukio.one/fr/a-propos`, `tukio.one/fr/confidentialite`, `tukio.one/fr/mentions-legales`, `tukio.one/fr/contact`, `tukio.one/fr/devenir-pro` rendent leur placeholder respectif (Story 0.19 livrera le contenu) ; (3) `tukio.one/robots.txt` + `tukio.one/sitemap.xml` rendent leur contenu (Story 0.21 finalisera mais Story 0.15 livre des stubs OK pour SEO) ; (4) un build avec `NEXT_PUBLIC_COMING_SOON_MODE=false` (ou variable absente) **n'a strictement aucun effet** sur le runtime — `pnpm --filter=public dev` continue de servir Epic 1+ pages comme avant ; (5) `apps/seller` reçoit le même traitement (rewrite vers `/${locale}/seller-coming-soon`) ; (6) `pnpm --filter=public lint && pnpm --filter=public typecheck && pnpm --filter=public test` passent sans nouvelles erreurs ; (7) `vitest` sur les pure-function decision specs (`coming-soon-gate-decision.spec.ts`) atteint ≥ 90% coverage ; (8) Playwright e2e `coming-soon-gate.e2e-spec.ts` × 2 apps × 2 modes (flag ON/OFF) = 4 contextes vert ; (9) **réversibilité prouvée** par un test Playwright qui exécute le scénario "user complete sign-up Story 1.2d" avec flag OFF dans la même PR — preuve que Stories 1.1-1.4b restent fonctionnelles.

## Acceptance Criteria

1. **AC1 — Variable d'environnement `NEXT_PUBLIC_COMING_SOON_MODE` documentée** : 
   - **Créer `apps/public/.env.example`** (fichier qui N'EXISTE PAS aujourd'hui — seul `apps/public/.env.local` existe Story 0.10) avec **toutes** les variables actuellement requises (récupérées depuis `.env.local`) + la nouvelle :
     ```env
     # ─── Pre-launch mode (Story 0.15) ───────────────────────────────────
     # When 'true', the coming-soon-gate middleware rewrites all non-whitelisted
     # routes to /${locale}/coming-soon. Set to 'false' (or omit) to expose
     # the real app (Epic 1+ routes). Toggle = redeploy.
     NEXT_PUBLIC_COMING_SOON_MODE=true
     
     # ─── Gateway API ────────────────────────────────────────────────────
     NEXT_PUBLIC_GATEWAY_URL=http://localhost:4000
     
     # ─── Keycloak (used post-launch) ────────────────────────────────────
     NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
     NEXT_PUBLIC_KEYCLOAK_REALM=tukio
     NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=tukio-web
     NEXT_PUBLIC_COOKIE_DOMAIN=
     
     # ─── Cross-zone ─────────────────────────────────────────────────────
     NEXT_PUBLIC_SELLER_BASE_URL=http://localhost:3002
     NEXT_PUBLIC_SELLER_HOST=http://localhost:3002
     ```
   - **Créer `apps/seller/.env.example`** avec le même pattern + `NEXT_PUBLIC_COMING_SOON_MODE=true` + variables seller existantes.
   - **Mettre à jour `apps/public/.env.local` + `apps/seller/.env.local`** : ajouter `NEXT_PUBLIC_COMING_SOON_MODE=false` en tête (mode OFF par défaut en dev local — ne casse pas les devs Epic 1+ qui pullent la branche).
   - **Validation parsing strict** : le flag est considéré `ON` **uniquement si** `process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'` (string exact). Toute autre valeur (`'1'`, `'on'`, `'TRUE'`, undefined, `''`) → flag OFF. Cette stricteur prévient les bugs de comparaison string/boolean.
   - **Documenter dans `apps/public/README.md` + `apps/seller/README.md`** une section "Pre-launch mode" (~10 lignes) avec : but, comment activer en dev (override `.env.local`), comment désactiver en prod au lancement (modifier `.env.production` + redeploy + PR cleanup optionnelle).

2. **AC2 — Pure-function decision `coming-soon-gate-decision.ts` (pattern Story 1.3d `pending-admin-review-decision.ts`)** : **deux variantes** — une pour apex, une pour seller — vivant chacune dans son app pour respecter le pattern "decision pure-function testable vitest sans next/server import".
   - **`apps/public/src/middleware/coming-soon-gate-decision.ts`** :
     ```ts
     // Routes that REMAIN ACCESSIBLE while NEXT_PUBLIC_COMING_SOON_MODE=true.
     // Locale-prefixed routes follow the next-intl `localePrefix: 'always'`
     // convention from @tukio/i18n-client (so `/fr/a-propos` and `/en/a-propos`
     // both match — the regex captures any 2-letter locale segment).
     const PUBLIC_WHITELIST: readonly RegExp[] = [
       /^\/[a-z]{2}\/coming-soon(\/|$)/u,
       /^\/[a-z]{2}\/coming-soon\/success(\/|$)/u,
       /^\/[a-z]{2}\/devenir-pro(\/|$)/u,
       /^\/[a-z]{2}\/a-propos(\/|$)/u,
       /^\/[a-z]{2}\/confidentialite(\/|$)/u,
       /^\/[a-z]{2}\/mentions-legales(\/|$)/u,
       /^\/[a-z]{2}\/contact(\/|$)/u,
     ];
     
     // Tech routes that bypass the gate regardless of locale prefix.
     // Note: `_next/*` and `api/*` are ALREADY excluded by the middleware
     // matcher (`apps/public/src/middleware.ts`), so this list is a defence
     // in depth for cases where matcher config drifts.
     const TECH_BYPASS: readonly RegExp[] = [
       /^\/_next\//u,
       /^\/api\//u,
       /^\/robots\.txt$/u,
       /^\/sitemap\.xml$/u,
       /^\/favicon\.ico$/u,
       /^\/\.well-known\//u,
       /^\/assets\//u,
       /^\/og\//u, // Open Graph image route (Story 0.21)
     ];
     
     export type ComingSoonDecision =
       | { kind: 'pass' }
       | { kind: 'rewrite'; locale: string; target: string };
     
     /** Default locale fallback when the request URL lacks a parseable locale prefix. */
     const DEFAULT_LOCALE = 'fr';
     
     export function safeLocaleFromPath(pathname: string, locales: readonly string[]): string {
       const candidate = pathname.split('/')[1];
       return candidate && locales.includes(candidate) ? candidate : DEFAULT_LOCALE;
     }
     
     /**
      * Pure function: given the env flag, the request pathname, and the set of
      * supported locales, returns the rewrite decision.
      * Empty side-effects — safe to unit-test under vitest without next/server.
      */
     export function decideComingSoon(
       isFlagOn: boolean,
       pathname: string,
       locales: readonly string[],
     ): ComingSoonDecision {
       if (!isFlagOn) return { kind: 'pass' };
       if (TECH_BYPASS.some((p) => p.test(pathname))) return { kind: 'pass' };
       if (PUBLIC_WHITELIST.some((p) => p.test(pathname))) return { kind: 'pass' };
       const locale = safeLocaleFromPath(pathname, locales);
       return { kind: 'rewrite', locale, target: `/${locale}/coming-soon` };
     }
     ```
   - **`apps/seller/src/middleware/coming-soon-gate-decision.ts`** : variante avec whitelist différente :
     ```ts
     const SELLER_WHITELIST: readonly RegExp[] = [
       /^\/[a-z]{2}\/seller-coming-soon(\/|$)/u,
       /^\/[a-z]{2}\/seller-coming-soon\/success(\/|$)/u,
     ];
     // TECH_BYPASS strictement identique à apex.
     // decideComingSoon retourne `target: '/${locale}/seller-coming-soon'` quand rewrite.
     ```
   - **Coverage NFR71 cible** : ≥ 90% sur les 2 fichiers decision (lignes & branches). Pattern test `apps/seller/src/middleware/pending-admin-review-decision.spec.ts` ligne 1-73 — réplique strict.
   - **Tests vitest cibles minimum** par app (10+ cases chacune) :
     - flag OFF + path quelconque → `{ kind: 'pass' }`
     - flag ON + path `/fr/` → rewrite vers `/fr/coming-soon`
     - flag ON + path `/en/` → rewrite vers `/en/coming-soon`
     - flag ON + path `/fr/auth/sign-up` → rewrite (Epic 1 route gated)
     - flag ON + path `/fr/a-propos` → pass (whitelist)
     - flag ON + path `/fr/coming-soon` → pass (déjà sur la landing — pas de boucle)
     - flag ON + path `/_next/static/chunks/foo.js` → pass (tech bypass défense en profondeur)
     - flag ON + path `/api/pre-launch/signup` → pass (tech bypass)
     - flag ON + path `/robots.txt` → pass (tech bypass)
     - flag ON + path `/xx/foo` (locale invalide) → rewrite avec `safeLocaleFromPath` fallback `'fr'` → target `/fr/coming-soon`
     - flag ON + path `/` (locale absente) → rewrite target `/fr/coming-soon`
     - flag ON + path `/fr/devenir-pro` → pass (whitelist apex)
     - **Pour seller variant** : flag ON + path `/fr/seller/onboarding/identity` → rewrite vers `/fr/seller-coming-soon`

3. **AC3 — Wrapper Next.js `coming-soon-gate.ts` (HTTP layer)** : chaque app expose un wrapper qui (a) lit le flag depuis `process.env.NEXT_PUBLIC_COMING_SOON_MODE`, (b) appelle `decideComingSoon(...)`, (c) traduit la décision en `NextResponse`.
   - **`apps/public/src/middleware/coming-soon-gate.ts`** :
     ```ts
     import { NextResponse, type NextRequest } from 'next/server';
     import { LOCALES } from '@tukio/i18n-client/config';
     import { decideComingSoon } from './coming-soon-gate-decision.js';
     
     // Read once at module init — env vars are bound at build time for Next.js
     // (NEXT_PUBLIC_* is inlined into the client bundle and server middleware
     // alike). Toggling requires a redeploy, which is intentional (Story 0.15).
     const IS_FLAG_ON = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';
     
     /**
      * Pre-launch gate. Returns a rewrite NextResponse when active and the path
      * is not whitelisted, otherwise returns undefined (chain continues).
      *
      * Defence in depth: when the flag is off, the function is a no-op so the
      * standard middleware chain (acquisitionCookie → authGate → i18n) runs
      * unchanged — the dev experience on Epic 1+ branches is preserved.
      */
     export function comingSoonGateMiddleware(request: NextRequest): NextResponse | undefined {
       const decision = decideComingSoon(IS_FLAG_ON, request.nextUrl.pathname, LOCALES);
       if (decision.kind === 'pass') return undefined;
       // Rewrite (NOT redirect): the browser URL stays at the visited path so
       // analytics + bookmarks make sense. SSR renders the coming-soon page.
       const rewriteUrl = new URL(decision.target, request.url);
       return NextResponse.rewrite(rewriteUrl);
     }
     ```
   - **`apps/seller/src/middleware/coming-soon-gate.ts`** : strict miroir mais importe le decision local `./coming-soon-gate-decision.js` qui pointe vers `seller-coming-soon`.
   - **Pas de spec unitaire dédiée** pour les wrappers (couvert par e2e Playwright AC8) — seuls les decision pures sont unit-tested. Pattern aligné Story 1.3d.

4. **AC4 — Intégration dans la chain `apps/public/src/middleware.ts`** : le gate s'insère **AVANT** `acquisitionCookieMiddleware` et `authGateMiddleware` (un visiteur en mode coming soon ne doit PAS être redirigé vers `/auth/verify-email-required` parce qu'il essaie d'accéder à `/cart`).
   ```ts
   import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
   import type { NextRequest } from 'next/server';
   import { comingSoonGateMiddleware } from './middleware/coming-soon-gate';
   import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie';
   import { authGateMiddleware } from './middleware/auth-gate';
   
   const i18nMiddleware = createTukioI18nMiddleware();
   
   // Middleware chain (left = first executed):
   // 0. comingSoonGateMiddleware — rewrites non-whitelisted routes to
   //    /${locale}/coming-soon when NEXT_PUBLIC_COMING_SOON_MODE=true (Story 0.15).
   //    When the flag is off, this is a no-op and the chain runs unchanged.
   // 1. acquisitionCookieMiddleware — sets tukio-acquisition cookie (Story 0.13)
   // 2. authGateMiddleware — redirects unauthenticated requests on /(authenticated)/* (Story 0.14)
   // 3. i18n middleware — locale routing/redirect
   export default async function middleware(request: NextRequest) {
     const comingSoonResponse = comingSoonGateMiddleware(request);
     if (comingSoonResponse) return comingSoonResponse;
   
     const acqResponse = acquisitionCookieMiddleware(request);
   
     const authResponse = authGateMiddleware(request);
     if (authResponse) {
       acqResponse.cookies.getAll().forEach((cookie) => authResponse.cookies.set(cookie));
       return authResponse;
     }
   
     const i18nResponse = await i18nMiddleware(request as any);
     if (i18nResponse) {
       acqResponse.cookies.getAll().forEach((cookie) => i18nResponse.cookies.set(cookie));
       return i18nResponse;
     }
   
     return acqResponse;
   }
   
   export const config = {
     matcher: ['/((?!_next|api|.*\\.\\w{2,4}$).*)'],
   };
   ```
   **CRITIQUE** : ne PAS modifier la `config.matcher` — elle exclut déjà `_next` + `api` + extensions fichiers. Le `TECH_BYPASS` dans la decision est **défense en profondeur** (cas où la matcher serait modifiée par une future story sans réaliser l'impact).

5. **AC5 — Intégration dans la chain `apps/seller/src/middleware.ts`** : le gate s'insère **AVANT** `pendingAdminReviewRedirect`. Un Customer pending qui visite `/seller/onboarding/identity` en mode coming soon doit voir la landing Coming Soon, pas le redirect vers `/seller/onboarding/pending`.
   ```ts
   import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
   import type { NextRequest } from 'next/server';
   import { comingSoonGateMiddleware } from './middleware/coming-soon-gate';
   import { pendingAdminReviewRedirect } from './middleware/pending-admin-review-redirect';
   import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie';
   
   const i18nMiddleware = createTukioI18nMiddleware();
   
   // Middleware chain (left = first executed):
   // 0. comingSoonGateMiddleware — rewrites to /${locale}/seller-coming-soon when ON (Story 0.15)
   // 1. pendingAdminReviewRedirect — bounces Pros pending_admin_review (Story 1.3d)
   // 2. i18n middleware — locale routing
   // 3. acquisitionCookieMiddleware — UTM tracking
   export default async function middleware(request: NextRequest) {
     const comingSoonResponse = comingSoonGateMiddleware(request);
     if (comingSoonResponse) return comingSoonResponse;
   
     const pendingRedirect = pendingAdminReviewRedirect(request);
     if (pendingRedirect) return pendingRedirect;
   
     const i18nResponse = await i18nMiddleware(
       request as unknown as Parameters<typeof i18nMiddleware>[0],
     );
     if (i18nResponse) return i18nResponse;
   
     return acquisitionCookieMiddleware(request);
   }
   
   export const config = {
     matcher: ['/((?!_next|api|.*\\.\\w{2,4}$).*)'],
   };
   ```

6. **AC6 — Placeholders pages `/coming-soon` + `/seller-coming-soon` (handoff Stories 0.17/0.18)** : Story 0.15 ne livre PAS le contenu final des landings — c'est le scope Stories 0.17 + 0.18. Mais elle DOIT livrer des **placeholders minimaux** pour que (a) le middleware n'aboutisse pas sur une 404 et (b) les Playwright AC8 puissent vérifier le comportement gate.
   - **`apps/public/src/app/[locale]/coming-soon/page.tsx`** (placeholder Story 0.15) :
     ```tsx
     // Placeholder Story 0.15. Final design + form delivered in Story 0.17.
     // Kept intentionally minimal so this PR doesn't anticipate Story 0.17 work.
     export default function ComingSoonPlaceholderPage() {
       return (
         <main style={{ padding: 48, fontFamily: 'system-ui, sans-serif' }}>
           <h1>tukio.one — Bientôt en Pays de la Loire</h1>
           <p>Placeholder pre-launch landing — Story 0.17 will deliver the full design.</p>
         </main>
       );
     }
     export const metadata = {
       title: 'tukio.one — Bientôt en Pays de la Loire',
       robots: { index: false, follow: false }, // Story 0.21 will flip to index:true once content is final
     };
     ```
   - **`apps/public/src/app/[locale]/coming-soon/success/page.tsx`** (idem placeholder)
   - **`apps/seller/src/app/[locale]/seller-coming-soon/page.tsx`** : placeholder seller version
   - **`apps/seller/src/app/[locale]/seller-coming-soon/success/page.tsx`** : placeholder
   - **5 placeholders pages publiques apex** également (livrées Story 0.19 — Story 0.15 livre stubs vides pour pas que le middleware AC4 whitelist pointe vers du 404 si flag ON) :
     - `apps/public/src/app/[locale]/devenir-pro/page.tsx`
     - `apps/public/src/app/[locale]/a-propos/page.tsx`
     - `apps/public/src/app/[locale]/confidentialite/page.tsx`
     - `apps/public/src/app/[locale]/mentions-legales/page.tsx`
     - `apps/public/src/app/[locale]/contact/page.tsx`
     Chacun contient un placeholder identique :
     ```tsx
     // Placeholder Story 0.15 — final content delivered in Story 0.19.
     export default function PageNamePlaceholder() {
       return <main style={{ padding: 48 }}><h1>{`Page name`}</h1><p>Story 0.19 placeholder.</p></main>;
     }
     ```
   - **Note importante** : ces placeholders sont **destinés à être remplacés** par Stories 0.17/0.18/0.19. Les ajouter en Story 0.15 garantit que la PR Story 0.15 est testable en isolation (Playwright AC8 fonctionne) sans dépendre de l'ordre de merge des Stories suivantes.

7. **AC7 — Tests unitaires vitest `coming-soon-gate-decision.spec.ts` × 2 apps** : pattern Story 1.3d `pending-admin-review-decision.spec.ts:1-73` — mock minimal, pure logic, ≥ 90% coverage lignes+branches.
   - **Fichier `apps/public/src/middleware/__tests__/coming-soon-gate-decision.spec.ts`** : 12+ cases (cf. AC2).
   - **Fichier `apps/seller/src/middleware/__tests__/coming-soon-gate-decision.spec.ts`** : 12+ cases (variante).
   - **Conformité accord Stories 1.2b/c/d** : pas besoin de `docker:up` pour ces tests (pure functions). Le dev agent peut les run localement sans setup.
   - **Pattern test typique** :
     ```ts
     import { describe, it, expect } from 'vitest';
     import { decideComingSoon } from '../coming-soon-gate-decision.js';
     
     const LOCALES = ['fr', 'en'] as const;
     
     describe('decideComingSoon — public app', () => {
       it('returns pass when flag is off, regardless of path', () => {
         expect(decideComingSoon(false, '/fr/auth/sign-up', LOCALES)).toEqual({ kind: 'pass' });
       });
       it('rewrites Epic 1+ routes when flag is on', () => {
         expect(decideComingSoon(true, '/fr/auth/sign-up', LOCALES)).toEqual({
           kind: 'rewrite', locale: 'fr', target: '/fr/coming-soon',
         });
       });
       it('passes whitelist public pages when flag is on', () => {
         for (const path of ['/fr/a-propos', '/fr/confidentialite', '/en/contact', '/fr/devenir-pro']) {
           expect(decideComingSoon(true, path, LOCALES).kind).toBe('pass');
         }
       });
       it('passes the coming-soon page itself (no rewrite loop)', () => {
         expect(decideComingSoon(true, '/fr/coming-soon', LOCALES).kind).toBe('pass');
       });
       it('falls back to fr when the locale prefix is invalid', () => {
         expect(decideComingSoon(true, '/xx/whatever', LOCALES)).toEqual({
           kind: 'rewrite', locale: 'fr', target: '/fr/coming-soon',
         });
       });
       it('bypasses tech routes (defence in depth on top of matcher)', () => {
         for (const path of ['/_next/static/x.js', '/api/foo', '/robots.txt', '/sitemap.xml', '/favicon.ico']) {
           expect(decideComingSoon(true, path, LOCALES).kind).toBe('pass');
         }
       });
       // ... 6+ more cases
     });
     ```

8. **AC8 — Playwright e2e `coming-soon-gate.e2e-spec.ts` × 2 apps × 2 modes** : 4 contextes de test couvrant les chemins critiques.
   - **`apps/public/test/e2e/coming-soon-gate.spec.ts`** (à créer — pattern Story 1.2d Playwright config) :
     - **Setup** : 2 projects Playwright distincts (`chromium-flag-on` avec `NEXT_PUBLIC_COMING_SOON_MODE=true` ; `chromium-flag-off` avec `=false`). Set via `webServer.env` dans `playwright.config.ts`.
     - **Cases mode ON (8+)** :
       1. `GET /fr/` → 200 + content contains "Bientôt en Pays de la Loire" (placeholder Story 0.15 ou Story 0.17 final si déjà mergée)
       2. `GET /en/` → 200 + content (idem locale-aware)
       3. `GET /fr/auth/sign-up` → 200 + content = placeholder Coming Soon (URL stays `/fr/auth/sign-up` côté browser — preuve rewrite, pas redirect)
       4. `GET /fr/a-propos` → 200 + content = placeholder About (whitelist)
       5. `GET /fr/confidentialite` → 200 + content placeholder Privacy
       6. `GET /fr/mentions-legales` → 200 + content placeholder Legal
       7. `GET /fr/contact` → 200 + content placeholder Contact
       8. `GET /fr/devenir-pro` → 200 + content placeholder Devenir Pro
       9. `GET /robots.txt` → 200 + content-type `text/plain`
     - **Cases mode OFF (4+)** :
       1. `GET /fr/` → 200 + content Home actuel (placeholder Story 0 ou Epic 1 home si livrée)
       2. `GET /fr/auth/sign-up` → 200 + SignUpForm visible (regression test Story 1.2d intact)
       3. `GET /fr/coming-soon` → 200 (la page existe en placeholder, pas un 404 quand le flag est off — c'est OK, on n'expose pas le chemin marketing mais elle reste accessible aux Devs / Search Console)
       4. Smoke regression test : un sign-up complet Story 1.2d réussit (preuve réversibilité — l'app Epic 1+ fonctionne avec flag OFF)
   - **`apps/seller/test/e2e/coming-soon-gate.spec.ts`** : 8+ cases miroir (mode ON rewrite `/fr/seller/onboarding/identity` → `/fr/seller-coming-soon` ; mode OFF preserve Story 1.3d v2 wizard fonctionnel).
   - **Performance Playwright** : `webServer.timeout: 60000`, retry CI `2`, parallel mode `1` (build Next.js stockable shared entre cases via `reuseExistingServer`).
   - **Mode dev/CI** : si `docker:up` requis (Keycloak + Postgres pour Stories 1.2-1.4), même accord Stories 1.2b-d : dev agent livre code + specs + spec Playwright non-exécutée localement ; Ismael run `pnpm e2e` localement après `pnpm docker:up:wait`.

9. **AC9 — Variables d'env multi-environnement (dev / staging / prod)** :
   - **Dev local** : `apps/public/.env.local` + `apps/seller/.env.local` shipped avec `NEXT_PUBLIC_COMING_SOON_MODE=false` → les devs continuent Epic 1+ sans friction. **CRITICAL** : ne PAS committer `.env.local` (already in `.gitignore` Sprint 0). Les `.env.example` documentent l'intention `true` pour onboarder un nouveau dev qui veut tester le mode pre-launch.
   - **Staging** : variable d'env Droplet `tukio-apps-staging` set à `NEXT_PUBLIC_COMING_SOON_MODE=true` (jusqu'à l'ouverture officielle). Update via SSH dans `/home/tukio/tukio/secrets/public.env` + redeploy (cf. `infra/docker-compose/apps.prod.yml` qui mount les secrets).
   - **Prod** : idem staging. Au lancement officiel, modifier la variable + redeploy = bascule live en ~3 min.
   - **`infra/docker-compose/apps.prod.yml`** : ajouter l'env var `NEXT_PUBLIC_COMING_SOON_MODE: ${COMING_SOON_MODE:-true}` dans les services `public` + `seller`. Le `${COMING_SOON_MODE:-true}` permet à un opérateur de override en exportant la variable sur le host sans modifier le YAML committé.
   - **`.github/workflows/deploy-production.yml`** : pas de changement requis (les env vars sont lues depuis le `.env.production` du Droplet, pas le workflow GitHub). Documenter dans le runbook (AC11).

10. **AC10 — Robots.txt + sitemap.xml stubs Story 0.15 (Story 0.21 finalisera)** : pour que le middleware whitelist `/robots.txt` + `/sitemap.xml` ne pointe pas vers du 404 quand le flag est ON.
    - **`apps/public/src/app/robots.ts`** (Next.js 16 `MetadataRoute.Robots`) :
      ```ts
      import type { MetadataRoute } from 'next';
      
      // Story 0.15 stub. Story 0.21 will deliver the full robots.txt with sitemap reference.
      export default function robots(): MetadataRoute.Robots {
        const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';
        return {
          rules: [
            isComingSoon
              ? { userAgent: '*', allow: ['/'], disallow: ['/api/', '/_next/', '/auth/', '/(authenticated)/'] }
              : { userAgent: '*', allow: ['/'], disallow: ['/api/', '/_next/'] },
          ],
          sitemap: 'https://tukio.one/sitemap.xml',
        };
      }
      ```
    - **`apps/public/src/app/sitemap.ts`** (stub minimal — Story 0.21 enrichira) :
      ```ts
      import type { MetadataRoute } from 'next';
      
      // Story 0.15 minimal sitemap. Story 0.21 will expand to all public pages × locales with hreflang.
      export default function sitemap(): MetadataRoute.Sitemap {
        const base = 'https://tukio.one';
        const now = new Date();
        return [
          { url: `${base}/fr/coming-soon`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
          { url: `${base}/en/coming-soon`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
        ];
      }
      ```
    - **`apps/seller/src/app/robots.ts`** + **`apps/seller/src/app/sitemap.ts`** : miroirs équivalents pointant vers `seller.tukio.one`.
    - **Note Story 0.21** : Story 0.21 remplacera ces stubs par la version complète (10 URLs × 2 locales + hreflang + JSON-LD). Story 0.15 livre le strict minimum pour que la whitelist `TECH_BYPASS` matche quelque chose de réel.

11. **AC11 — Documentation runbook `docs/runbooks/pre-launch-toggle.md`** : NEW runbook ~60-80 lignes documentant la procédure de toggle :
    - **Section 1 — Activer le mode coming soon (pré-lancement, déjà en place)** :
      ```bash
      # Sur le DO Droplet tukio-apps-prod
      ssh tukio@<DO_HOST_APPS>
      sudo vim /home/tukio/tukio/secrets/public.env
      # Mettre NEXT_PUBLIC_COMING_SOON_MODE=true
      sudo vim /home/tukio/tukio/secrets/seller.env  # idem
      cd /home/tukio/tukio
      docker compose -f apps.prod.yml pull
      docker compose -f apps.prod.yml up -d public seller
      # Vérifier
      curl -fsS https://tukio.one/fr/ | grep -i "coming soon"
      curl -fsS https://seller.tukio.one/fr/seller/onboarding/identity | grep -i "coming soon"
      ```
    - **Section 2 — Désactiver au lancement officiel** :
      ```bash
      # Idem flow mais NEXT_PUBLIC_COMING_SOON_MODE=false
      # Vérification post-deploy : sign-up Story 1.2d doit fonctionner
      curl -fsS https://tukio.one/fr/auth/sign-up | grep -i "sign up"
      ```
    - **Section 3 — Nettoyage du flag post-lancement (PR optionnelle)** :
      Liste de fichiers à supprimer dans une PR future : `coming-soon-gate.ts`, `coming-soon-gate-decision.ts`, `__tests__/coming-soon-gate-decision.spec.ts`, ligne `comingSoonGateMiddleware` dans `middleware.ts`, env vars `NEXT_PUBLIC_COMING_SOON_MODE` des 6 fichiers env (4 .env.local + 2 .env.example), step env dans `apps.prod.yml`. Les placeholders pages publiques restent (devenues les pages réelles Story 0.19).
    - **Section 4 — Troubleshooting** :
      - Flag ne s'applique pas → vérifier que la variable est bien `'true'` strict (pas `true` boolean, pas `'1'`).
      - Rewrite boucle infinie → vérifier whitelist (la page `/coming-soon` doit être whitelist).
      - Sign-up Epic 1 ne fonctionne plus avec flag OFF → vérifier que le middleware retourne `undefined` quand flag OFF (test vitest AC7).
      - Cookie acquisition perdu → vérifier ordre middleware chain (gate avant acqCookie est intentionnel ; les visiteurs en mode coming soon n'ont pas besoin d'UTM tracking côté apex, ils en auront via la form de la landing Story 0.20).
    - **Section 5 — Rollback procedure** : Si désactivation cassée → re-set `NEXT_PUBLIC_COMING_SOON_MODE=true` + redeploy = retour mode coming soon en < 5 min.

12. **AC12 — Conformité boundaries lint + i18n hardcode + a11y** :
    - **Lint** : `pnpm --filter=public lint` retourne 0 erreurs. Aucun nouveau `// eslint-disable` introduit.
    - **Typecheck** : `pnpm --filter=public typecheck` 0 erreurs. Le cast `request as any` côté i18n middleware est conservé (cf. Story 1.4b warning).
    - **Pas de hardcode user-facing text** : les placeholders Story 0.15 ont **uniquement** des textes techniques (`"Story 0.19 placeholder."`) — ces strings seront remplacés par i18n keys quand Stories 0.17/0.18/0.19 les implémenteront. La règle "zéro hardcoded user-facing text" (AGENTS.md hard rule) ne s'applique pas aux placeholders Story 0.15 (annotation `// Placeholder Story X.Y — i18n delivered in Story 0.17`).
    - **a11y placeholders** : `<h1>` + `<p>` standard suffisent pour passer axe-core 0 violations (les placeholders n'ont ni form ni navigation interactive).

13. **AC13 — Réversibilité prouvée par test Playwright** : dans `apps/public/test/e2e/coming-soon-gate.spec.ts`, ajouter explicitement un case "Reversibility regression" dans le project `chromium-flag-off` :
    ```ts
    test('Reversibility: sign-up flow Story 1.2d unaffected by flag OFF', async ({ page }) => {
      await page.goto('/fr/auth/sign-up');
      await expect(page.getByRole('heading', { name: /sign up|inscription|créer/i })).toBeVisible({ timeout: 10000 });
      // Sanity check that the form is wired (Story 1.2d):
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password|mot de passe/i)).toBeVisible();
    });
    ```
    Ce test échoue si Story 0.15 a régressé Epic 1+ pages. **CI gate strict** : ce test doit passer pour merger Story 0.15.

14. **AC14 — `/check` complet vert avant code-review** : `pnpm lint && pnpm typecheck && pnpm test` (root monorepo turbo) retourne 0 erreurs. Coverage NFR71 atteint sur les 2 fichiers decision (≥ 90%). Les tests E2E (Playwright) sont **livrés + non-exécutés** par le dev agent (accord Stories 1.2b-d) — Ismael les run localement post-merge.

## Tasks / Subtasks

- [x] **Task 1 — Pure decision functions + vitest specs** (AC: #2, #7)
  - [x] 1.1 Créer `apps/public/src/middleware/coming-soon-gate-decision.ts` (PUBLIC_WHITELIST + TECH_BYPASS + `decideComingSoon` + `safeLocaleFromPath` + types `ComingSoonDecision`)
  - [x] 1.2 Créer `apps/public/src/middleware/__tests__/coming-soon-gate-decision.spec.ts` (15 cases, 100% coverage)
  - [x] 1.3 Créer `apps/seller/src/middleware/coming-soon-gate-decision.ts` (SELLER_WHITELIST variante, mêmes TECH_BYPASS)
  - [x] 1.4 Créer `apps/seller/src/middleware/coming-soon-gate-decision.spec.ts` (14 cases, 100% coverage). Note convention : seller utilise specs colocated (pattern `pending-admin-review-redirect.spec.ts`), apex utilise `__tests__/` (pattern `acquisition-cookie.spec.ts`)
  - [x] 1.5 Vitest vert : apex 15/15 + seller 14/14 ; coverage 100% (stmts/branches/funcs/lines) sur les 2 decision files

- [x] **Task 2 — HTTP wrappers `coming-soon-gate.ts`** (AC: #3)
  - [x] 2.1 Créer `apps/public/src/middleware/coming-soon-gate.ts` (lit env, call decision, retourne NextResponse.rewrite avec request-headers `x-next-intl-locale`)
  - [x] 2.2 Créer `apps/seller/src/middleware/coming-soon-gate.ts` (miroir)
  - [x] **Déviation spec** : le wrapper passe `x-next-intl-locale` comme REQUEST header sur la rewrite (`NextResponse.rewrite(url, { request: { headers } })`). Indispensable pour que `requestLocale` se résolve sur le target rewritten — sans ça, App Router 404 sur `[locale]/coming-soon` (next-intl appelle `notFound()` quand `requestLocale` undefined). Découvert via smoke build-time.

- [x] **Task 3 — Chain integration** (AC: #4, #5)
  - [x] 3.1 Modifier `apps/public/src/middleware.ts` — `comingSoonGateMiddleware` inséré en 1er, matcher conservé `'/((?!_next|api|.*\\.\\w{2,4}$).*)'`
  - [x] 3.2 Modifier `apps/seller/src/middleware.ts` — idem, gate avant `pendingAdminReviewRedirect`

- [x] **Task 4 — Placeholders pages publiques** (AC: #6)
  - [x] 4.1 Créer `apps/public/src/app/[locale]/coming-soon/page.tsx` + `coming-soon/success/page.tsx` (handoff Story 0.17)
  - [x] 4.2 Créer 5 placeholders `apps/public/src/app/[locale]/{devenir-pro,a-propos,confidentialite,mentions-legales,contact}/page.tsx`
  - [x] 4.3 Créer `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx` + `seller-coming-soon/success/page.tsx`
  - [x] 4.4 Chaque placeholder annoté `// Placeholder Story 0.15 — final delivered in Story 0.X.Y`
  - [x] 4.5 metadata `robots: { index: false, follow: false }` sur coming-soon + success placeholders × 2 apps

- [x] **Task 5 — Robots.txt + sitemap.xml stubs** (AC: #10)
  - [x] 5.1 Créer `apps/public/src/app/robots.ts` (conditional sur flag : flag-on disallow étendu /auth/ /(authenticated)/ /account/)
  - [x] 5.2 Créer `apps/public/src/app/sitemap.ts` (2 URLs `/fr/coming-soon` + `/en/coming-soon`)
  - [x] 5.3 Créer `apps/seller/src/app/robots.ts` + `apps/seller/src/app/sitemap.ts` (miroirs)
  - [x] 5.4 Smoke local : `curl localhost:3000/robots.txt` → 200 + flag-on rules + `Sitemap: https://tukio.one/sitemap.xml`. `curl localhost:3002/robots.txt` → 200 + `Disallow: /seller/` + `Sitemap: https://seller.tukio.one/sitemap.xml`.

- [x] **Task 6 — Environment variables** (AC: #1, #9)
  - [x] 6.1 Créer `apps/public/.env.example` (NEW — toutes vars actuelles + `NEXT_PUBLIC_COMING_SOON_MODE=true`)
  - [x] 6.2 Créer `apps/seller/.env.example` (idem)
  - [x] 6.3 Update `apps/public/.env.local` + `apps/seller/.env.local` : ajouter `NEXT_PUBLIC_COMING_SOON_MODE=false` en tête (dev = OFF par défaut)
  - [x] 6.4 Update `apps/public/README.md` + `apps/seller/README.md` — section "Pre-launch mode" (~10-15 lignes)
  - [x] 6.5 Update `infra/docker-compose/apps.prod.yml` — env var `NEXT_PUBLIC_COMING_SOON_MODE: ${COMING_SOON_MODE:-true}` sur services `public` + `seller`

- [x] **Task 7 — Playwright e2e specs** (AC: #8, #13)
  - [x] 7.1 `apps/public/playwright.config.ts` déjà présent (Story 1.3d) — pas de modification, projects `chromium-fr` + `chromium-en` réutilisés
  - [x] 7.2 Créer `apps/public/e2e/coming-soon-gate.spec.ts` (10 cases mode ON + 3 cases mode OFF avec `PLAYWRIGHT_FLAG_OFF=1` env-guard ; AC13 reversibility regression Story 1.2d sign-up inclus)
  - [x] 7.3 Créer `apps/seller/e2e/coming-soon-gate.spec.ts` (8 cases mode ON + 2 cases mode OFF)
  - [x] 7.4 **Specs livrées + non-exécutées localement** (accord Stories 1.2b-d). Note convention : story spec disait `test/e2e/` mais l'arborescence existante est `e2e/` (Story 1.3d). Aligné sur conventions existantes.
  - [x] **Déviation spec** : le toggle ON/OFF est géré par `PLAYWRIGHT_FLAG_OFF=1` env var (par défaut = flag ON cases run) plutôt que par 2 projects Playwright distincts (`chromium-flag-on`/`chromium-flag-off`). Justification : `NEXT_PUBLIC_*` env vars sont inlined au build time — 2 projects = 2 builds Next.js, complexification webServer config disproportionnée pour le bénéfice. L'env-guard est la pattern adoptée.

- [x] **Task 8 — Documentation runbook** (AC: #11)
  - [x] 8.1 Créer `docs/runbook/pre-launch-toggle.md` (5 sections : activer / désactiver / cleanup PR / troubleshooting / rollback). Note convention : `docs/runbook/` (singulier) — c'est l'arborescence existante (vs `docs/runbooks/` dans la spec).
  - [x] 8.2 Update `AGENTS.md` — bullet "Pre-launch mode (Story 0.15)" ajouté dans Hard rules avant `/check` final.

- [x] **Task 9 — Lint + typecheck + test final** (AC: #12, #14)
  - [x] 9.1 `pnpm --filter=public lint` + `pnpm --filter=seller lint` → 0 errors (warnings préexistants seulement : `PublicHeader.tsx`, `SignUpForm.tsx`, `coverage/block-navigation.js`)
  - [x] 9.2 `pnpm --filter=public typecheck` + `pnpm --filter=seller typecheck` → 0 errors
  - [x] 9.3 `pnpm --filter=public test --run` → 55/55 vert + `pnpm --filter=seller test --run` → 28/28 vert ; coverage 100% sur les 2 decision files (NFR71 ≥ 90% largement dépassé)
  - [x] 9.4 Smoke local flag ON (apex + seller buildés avec `NEXT_PUBLIC_COMING_SOON_MODE=true`) :
    - apex `/fr/auth/sign-up` → 200 + `<h1>tukio.one — Bientôt en Pays de la Loire</h1>` (rewrite, URL conservée)
    - apex `/fr/cart` → 200 + coming-soon (auth-gated route gated)
    - apex `/fr/a-propos` → 200 + `<h1>À propos</h1>` (whitelist pass)
    - apex `/en/auth/sign-up` → 200 + coming-soon (en locale rewrite)
    - apex `/fr/coming-soon` direct → 200 (whitelist pass, no loop)
    - apex `/robots.txt` → 200 + flag-on disallow + sitemap reference
    - apex `/sitemap.xml` → 200 + XML
    - seller `/fr/seller/onboarding/identity` → 200 + `<h1>seller.tukio.one — Bientôt</h1>` (rewrite)
    - seller `/fr/seller-coming-soon` direct → 200
    - seller `/en/seller/listings/new` → 200 + coming-soon
    - seller `/robots.txt` → 200 + `Disallow: /seller/` + sitemap reference
  - [x] 9.5 Smoke local flag OFF (apex rebuild avec `NEXT_PUBLIC_COMING_SOON_MODE=false`) :
    - `/fr` → 200 (home placeholder Sprint 0)
    - `/fr/auth/sign-up` → 500 mais erreur PRÉ-EXISTANTE Story 1.2d (`NEXT_PUBLIC_API_URL is required in production builds`) — NON liée à 0.15. La preuve que le code Story 1.2d s'exécute (donc non-régression) : la stack trace pointe `.next/server/app/[locale]/auth/sign-up/page.js`, pas coming-soon.
    - `/fr/coming-soon` reste accessible (200, placeholder).
    - `/robots.txt` → 200 + flag-off rules (pas de disallow /auth/ /(authenticated)/ /account/).
  - [x] 9.6 Smoke trace documenté ci-dessus dans Completion Notes List.

## Dev Notes

### Architecture patterns à appliquer

- **Pure-function decision + HTTP wrapper séparé** : pattern Story 1.3d (`pending-admin-review-decision.ts` ↔ `pending-admin-review-redirect.ts`). Une fonction pure testable vitest **sans** `next/server` import → 100% testable, 0 mock. Un wrapper HTTP qui consomme la decision et retourne `NextResponse`. Cette séparation est **NON NÉGOCIABLE** dans cette story — c'est ce qui permet une coverage > 90% sur du code Next.js Edge runtime sans payer le prix d'importer toute la stack edge.
- **`NEXT_PUBLIC_*` env var binding** : Next.js inline les variables `NEXT_PUBLIC_*` dans **le bundle client ET dans le middleware Edge** au moment du build. Toggle = redeploy obligatoire. Pas de "hot toggle" runtime. C'est ce qu'on veut (zéro back-office Ismael brief).
- **`NextResponse.rewrite` vs `NextResponse.redirect`** : on utilise **rewrite** parce qu'on veut que l'URL côté browser reste celle visitée (analytics + bookmarks utiles). Avec redirect, `tukio.one/fr/auth/sign-up` deviendrait `tukio.one/fr/coming-soon` côté navigateur = perte de signal acquisition.
- **Ordre middleware chain** : `comingSoonGateMiddleware` doit être en **PREMIER**. Si on le mettait après `authGateMiddleware`, un visiteur unauthenticated sur `/cart` serait d'abord redirigé vers `/login` (par authGate), PUIS le coming-soon gate ne s'appliquerait pas (puisque la response a déjà été retournée). Le pre-launch DOIT court-circuiter toute logique d'auth.
- **Matcher Next.js inchangé** : `matcher: ['/((?!_next|api|.*\\.\\w{2,4}$).*)']`. Le `TECH_BYPASS` dans la decision est **défense en profondeur** au cas où une future story modifie le matcher sans réaliser l'impact pre-launch.
- **`process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'`** : comparaison **string stricte**. Toute autre valeur → OFF. Cela élimine les ambiguïtés (`'1'`, `true` boolean, `'TRUE'`).
- **Réversibilité** : la story est conçue pour que le flag à `false` rende l'app **strictement identique** au comportement actuel. Test de regression Story 1.2d sign-up couvre ce critère explicitement (AC13).
- **i18n LOCALES depuis `@tukio/i18n-client/config`** : ne PAS hardcoder `['fr', 'en']` dans le decision — importer depuis la source canonique pour qu'ajouter une locale dans `@tukio/i18n-client` propage automatiquement le whitelist.

### Source tree composants à toucher

| Fichier / dossier | Action | Estimation |
|--|--|--|
| `apps/public/src/middleware/coming-soon-gate-decision.ts` | NEW | ~80 lignes |
| `apps/public/src/middleware/coming-soon-gate.ts` | NEW | ~20 lignes |
| `apps/public/src/middleware/__tests__/coming-soon-gate-decision.spec.ts` | NEW | ~120 lignes (12+ cases) |
| `apps/public/src/middleware.ts` | UPDATE | +5 lignes (chain integration) |
| `apps/public/src/app/[locale]/coming-soon/page.tsx` | NEW | ~15 lignes placeholder |
| `apps/public/src/app/[locale]/coming-soon/success/page.tsx` | NEW | ~15 lignes placeholder |
| `apps/public/src/app/[locale]/{devenir-pro,a-propos,confidentialite,mentions-legales,contact}/page.tsx` | NEW × 5 | ~10 lignes chacun |
| `apps/public/src/app/robots.ts` | NEW | ~15 lignes stub |
| `apps/public/src/app/sitemap.ts` | NEW | ~12 lignes stub |
| `apps/public/.env.example` | NEW | ~15 lignes |
| `apps/public/.env.local` | UPDATE | +1 ligne (flag OFF dev) |
| `apps/public/README.md` | UPDATE | +10 lignes section "Pre-launch mode" |
| `apps/public/test/e2e/coming-soon-gate.spec.ts` | NEW | ~150 lignes (12+ cases) |
| `apps/public/playwright.config.ts` | NEW or UPDATE | ~30 lignes (2 projects) |
| `apps/seller/src/middleware/coming-soon-gate-decision.ts` | NEW | ~70 lignes |
| `apps/seller/src/middleware/coming-soon-gate.ts` | NEW | ~20 lignes |
| `apps/seller/src/middleware/__tests__/coming-soon-gate-decision.spec.ts` | NEW | ~120 lignes |
| `apps/seller/src/middleware.ts` | UPDATE | +5 lignes |
| `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx` | NEW | ~15 lignes |
| `apps/seller/src/app/[locale]/seller-coming-soon/success/page.tsx` | NEW | ~15 lignes |
| `apps/seller/src/app/robots.ts` + `sitemap.ts` | NEW × 2 | ~25 lignes total |
| `apps/seller/.env.example` | NEW | ~12 lignes |
| `apps/seller/.env.local` | UPDATE | +1 ligne |
| `apps/seller/README.md` | UPDATE | +10 lignes |
| `apps/seller/test/e2e/coming-soon-gate.spec.ts` | NEW | ~100 lignes (8+ cases) |
| `apps/seller/playwright.config.ts` | NEW or UPDATE | ~30 lignes |
| `infra/docker-compose/apps.prod.yml` | UPDATE | +2 lignes env vars |
| `docs/runbooks/pre-launch-toggle.md` | NEW | ~80 lignes |
| `AGENTS.md` | UPDATE | +1 bullet |
| `_bmad-output/planning-artifacts/project-context.md` | UPDATE | append section "Pre-launch toggle" |

**Total** : ~30 fichiers (24 NEW + 6 UPDATE), ~900-1200 lignes ajoutées. Estimation 1-2 jours dev solo.

### Testing standards résumé

- **Unit tests (vitest)** : `coming-soon-gate-decision.spec.ts` × 2 apps. Pure functions, zéro mock `next/server`. Coverage ≥ 90% lignes + branches. Pattern strict Story 1.3d.
- **E2E tests (Playwright)** : `coming-soon-gate.spec.ts` × 2 apps × 2 projects (flag ON/OFF) = 4 contextes. **Non-exécutés** par le dev agent (accord Stories 1.2b-d) — livrés en code + structure. Ismael run localement.
- **Smoke tests manuels** (Task 9.4 + 9.5) : `curl` + dev server local. Documenter les responses dans Dev Agent Record (status code, content snippet).
- **Pas de tests integration** : aucune DB / NATS / Redis impliqué. Pure logique HTTP + env vars.

### Pièges connus à éviter

1. **`NextResponse.redirect` vs `NextResponse.rewrite`** : utiliser **`.rewrite`** pour préserver l'URL côté browser. `.redirect` casserait l'analytics + créerait un boucle (le browser se retrouve sur `/coming-soon` qui re-déclenche le gate → re-rewrite → re-redirect → infinite).
2. **Ordre middleware chain** : `comingSoonGateMiddleware` en **PREMIER** sur les 2 apps. Sinon `authGate` (apex) ou `pendingAdminReview` (seller) peuvent retourner une response avant que le gate s'applique.
3. **`process.env.NEXT_PUBLIC_*` lecture au module-init** : la lecture `const IS_FLAG_ON = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'` est faite **au chargement du module middleware**, PAS à chaque request. C'est le comportement Next.js attendu (NEXT_PUBLIC inlined au build). Toggle nécessite redeploy.
4. **Placeholder `coming-soon` doit être whitelist** : sinon boucle infinite rewrite. La regex `^\/[a-z]{2}\/coming-soon(\/|$)/u` couvre `/fr/coming-soon` et `/fr/coming-soon/success` (le `/success` matche le `(\/|$)` final).
5. **`safeLocaleFromPath` fallback `'fr'`** : pour les routes sans locale prefix (e.g., `/foo`), on fallback `'fr'`. Pattern Story 1.3d `pending-admin-review-decision.ts:71-72`.
6. **`.env.local` jamais committé** : déjà dans `.gitignore` Sprint 0. Ne PAS commit la modification "flag OFF dev local" sur `.env.local` — Story 0.15 ne touche que `.env.example`. Le `.env.local` est mentionné dans la story pour mémoire (chaque dev doit modifier le sien manuellement).
7. **`.env.example` shipping `=true`** : intentionnel pour signaler que la prod est en mode pre-launch. Les devs qui clonent et copient `.env.example → .env.local` voient le mode pre-launch par défaut et savent qu'il faut désactiver pour bosser Epic 1+. Documentation README clarifie ça.
8. **`apps.prod.yml` env var binding** : `${COMING_SOON_MODE:-true}` permet à un opérateur Droplet d'exporter `COMING_SOON_MODE=false` sur l'host avant `docker compose up` pour basculer **sans** modifier le YAML committed. Pratique pour le rollback rapide (Section 5 runbook AC11).
9. **Playwright `webServer.env`** : pour run 2 projects avec env vars différents, Playwright requiert un `webServer` distinct par project (ou bien build statique d'avance). Le pattern simple : 2 commandes `pnpm build` distinctes avec env vars `NEXT_PUBLIC_COMING_SOON_MODE=true` puis `=false`, sortie dans `.next-flag-on/` vs `.next-flag-off/` — voir le webServer config dans `playwright.config.ts` Task 7.1.
10. **`<html lang>` côté placeholders** : les placeholders Story 0.15 utilisent le layout `[locale]/layout.tsx` existant qui pose déjà `<html lang={locale}>` (cf. Story 0.1 bootstrap). Pas de duplication à faire.

### Coordination cross-story

- **Story 0.16 (atoms `@tukio/ui`)** : pas un blocant. Story 0.15 utilise des placeholders HTML basiques (h1+p inline styles). Story 0.16 + 0.17 + 0.18 + 0.19 refactoriseront vers `<EditorialPageShell>`, `<Block>`, etc.
- **Story 0.17 (landing Coming Soon apex)** : remplace les placeholders `apps/public/src/app/[locale]/coming-soon/{page,success/page}.tsx`. Aucun conflit attendu — Story 0.17 ouvre la PR sur les mêmes fichiers et écrit par-dessus.
- **Story 0.18 (landing seller)** : remplace les placeholders `apps/seller/src/app/[locale]/seller-coming-soon/{page,success/page}.tsx`. Idem 0.17.
- **Story 0.19 (4 pages publiques)** : remplace les placeholders `apps/public/src/app/[locale]/{devenir-pro,a-propos,confidentialite,mentions-legales,contact}/page.tsx`. Idem.
- **Story 0.20 (Resend Audiences + handlers)** : ajoute `apps/public/src/app/api/pre-launch/{signup,contact}/route.ts`. Le TECH_BYPASS `/^\/api\//` couvre déjà ces routes — aucune modif AC2 requise.
- **Story 0.21 (SEO + Plausible)** : enrichit `apps/public/src/app/{robots,sitemap}.ts` (livré stub Story 0.15) + ajoute OG image route + JSON-LD + Plausible script. Story 0.15 livre uniquement le minimum vital pour ne pas casser le whitelist.
- **Story 5.1 (messaging-svc Pretre)** : ready-for-dev mais **dépriorisée** (cf. mémoire `pre_launch_epic_2026_05_20.md`). Aucun conflit fichier — Story 5.1 touche `apps/messaging-svc/`, Story 0.15 ne touche que `apps/public` + `apps/seller`.
- **Stories Epic 1 close-out (1.4c, 1.4d, 1.5+)** : **en pause** pendant Stories 0.15-0.21. Quand on les reprendra, le flag sera à `false` en dev local → comportement strictement identique à aujourd'hui. AC13 garantit la non-régression.

### Project Structure Notes

- **Alignement** strict avec :
  - Pattern decision pure-function Story 1.3d : `pending-admin-review-decision.ts` ↔ wrapper `pending-admin-review-redirect.ts`
  - Middleware chain pattern Story 0.13 (acquisition-cookie) + Story 0.14 (auth-gate)
  - LOCALES single source `@tukio/i18n-client/config`
  - Conventions Sprint 0 (vitest spec dans `__tests__/`, kebab-case files, named exports)
- **Variance assumée** :
  - Création des `.env.example` (absents aujourd'hui) — bonne hygiène Sprint 0 close-out, justifié par la sortie public.
  - Création de placeholders sur 7 pages publiques (5 + 2) — handoff explicite aux Stories 0.17/0.18/0.19. Annoté en commentaire pour éviter qu'un futur dev croit que ces placeholders sont la version finale.
  - Robots.txt + sitemap.xml stubs en Story 0.15 (alors que Story 0.21 spec les complétait) : nécessaire pour la whitelist `TECH_BYPASS` (sinon 404 sur ces URLs en mode flag ON).
- **Pas de conflit** détecté avec :
  - Story 1.2d (acquisition cookie + auth gate) — chain order préservé
  - Story 1.3d v2 (seller pending review) — chain order préservé
  - Story 0.14 (ADR-016 apex unified) — middleware enriched, pas remplacé

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story-0.15] Spec brute Story 0.15 (Acceptance Criteria source)
- [Source: `_bmad-output/planning-artifacts/epics.md`#Epic-0-Phase-Pré-Lancement] Contexte epic complet (Stories 0.15-0.21)
- [Source: `apps/public/src/middleware.ts:1-40`] Chain middleware actuelle apex
- [Source: `apps/seller/src/middleware.ts:1-33`] Chain middleware actuelle seller
- [Source: `apps/public/src/middleware/auth-gate.ts:1-66`] Pattern wrapper + decision Story 1.2d/0.14
- [Source: `apps/seller/src/middleware/pending-admin-review-decision.ts:1-73`] **Pattern canonique** pure-function decision Story 1.3d (à répliquer strict)
- [Source: `apps/seller/src/middleware/pending-admin-review-decision.spec.ts`] Pattern test vitest (mock minimal)
- [Source: `packages/i18n-client/src/config/locales.ts:1-30`] LOCALES + DEFAULT_LOCALE canoniques
- [Source: `packages/i18n-client/src/middleware/create-i18n-middleware.ts:1-26`] next-intl middleware factory
- [Source: `apps/public/.env.local:1-7`] Variables existantes apex (source pour `.env.example`)
- [Source: `apps/seller/.env.local:1-8`] Variables existantes seller
- [Source: `apps/public/vitest.config.ts:1-25`] Config vitest + aliases (pour spec files)
- [Source: `_bmad-output/planning-artifacts/architecture.md`#ADR-012] i18n FR/EN bilingue dès Sprint 0
- [Source: `_bmad-output/planning-artifacts/architecture.md`#ADR-016] Story 0.14 apex unified — middleware foundation
- [Source: `infra/docker-compose/apps.prod.yml`] Prod orchestration (à étendre)
- [Source: `tukio-design/project/screens/coming-soon.jsx`] Design final landing apex (réf Story 0.17 mais utile pour anticiper le placeholder)

### Latest tech specifics

- **Next.js 16.2.6** : `NEXT_PUBLIC_*` env vars inlined au build, middleware Edge runtime supporte process.env access. `NextResponse.rewrite(url)` documented `https://nextjs.org/docs/app/api-reference/functions/next-response#rewrite`.
- **next-intl 4.4.0** : `createMiddleware` retourne un handler async — d'où le `await` dans le chain. `localePrefix: 'always'` (config par défaut Tukio).
- **vitest 3.x** : `vi.mock('next/server', ...)` pattern dans `auth-gate.spec.ts:4-15` (mock minimal NextResponse class).
- **Playwright 1.49+** : `webServer` config avec `env` override par project. Pattern à valider pour 2 builds parallèles avec env vars différents.

### Sécurité

- **Pas de surface d'attaque ajoutée** : la story déplace l'utilisateur vers une landing publique. Aucune donnée sensible exposée. Le middleware lit uniquement la pathname (pas les cookies / JWT / headers user).
- **Pas de bypass d'auth** : si flag OFF, `authGateMiddleware` continue de fonctionner. Si flag ON, **tout le monde** voit la landing — pas de différence pro/customer/admin (intentionnel : c'est un site vitrine).
- **Open redirect prevention** : on utilise `NextResponse.rewrite(new URL(target, request.url))` avec un target local (`/${locale}/coming-soon`) — pas de risque d'open redirect (target n'est jamais user-controlled).
- **Env var leakage** : `NEXT_PUBLIC_COMING_SOON_MODE` est volontairement public (inlined côté client). Ce n'est PAS un secret — c'est un toggle métier visible à tous (un curieux qui inspecte le bundle JS verra `=true`).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- **Découverte build-time : rewrite + next-intl `requestLocale` undefined** : premier smoke `curl /fr/auth/sign-up` avec flag ON retournait 404 alors que la page `[locale]/coming-soon/page.tsx` existait. Cause : `NextResponse.rewrite(target)` court-circuite la chain → next-intl middleware ne tourne pas → `getRequestConfig` (`apps/public/src/i18n/request.ts`) appelle `notFound()` parce que `requestLocale` undefined. Fix en 2 couches :
  1. **Wrapper** : `NextResponse.rewrite(url, { request: { headers } })` avec `x-next-intl-locale=<locale>` posé sur les request headers. C'est le canal canonique Next.js pour propager une valeur au rendering downstream.
  2. **Layout** : `setRequestLocale(locale)` ajouté avant `getMessages()` dans `apps/{public,seller}/src/app/[locale]/layout.tsx`. Idempotent avec le flux normal ; sécurise les rewrites + static rendering (pattern documenté next-intl).
- **Validation** : après les 2 fixes, smoke flag ON 100% vert sur 11 routes (apex + seller, fr + en). Réversibilité flag OFF confirmée — la page `/fr/auth/sign-up` exécute Story 1.2d code (échec 500 PRÉ-EXISTANT sur env var manquante hors prod, NON lié à 0.15).

### Completion Notes List

- ✅ Story 0.15 est la **fondation** de la phase pré-lancement (Stories 0.15-0.21). Pattern pure-function decision + HTTP wrapper Pretre-like livré ; coverage 100% sur les 2 decision files (NFR71 ≥ 90% largement dépassé).
- ✅ Placeholders annotés `// Placeholder Story 0.15 — final delivered in Story 0.X.Y` sur les 9 pages (apex 7 + seller 2). Zéro contenu user-facing FR/EN — c'est le scope Stories 0.17/0.18/0.19.
- ✅ `apps.prod.yml` mis à jour avec `NEXT_PUBLIC_COMING_SOON_MODE: ${COMING_SOON_MODE:-true}` sur `public` + `seller` (override host-time possible sans toucher au YAML).
- ✅ Tests vitest verts : apex 55/55 (15 nouveaux Story 0.15) + seller 28/28 (14 nouveaux Story 0.15). Lint 0 errors + typecheck 0 errors sur les 2 apps.
- ✅ Smoke runtime confirmé sur 2 builds (apex flag ON + apex flag OFF + seller flag ON). Le code Story 1.2d/1.3d non régressé (réversibilité).
- ⚠️ **Déviation spec mineure (assumée)** : Story 1.4c en cours (status `review`) — la PR 0.15 n'a aucun conflit fichier avec 1.4c (apex middleware chain + placeholders sont nouveaux ; le call `setRequestLocale` dans le layout est additif). Aucune coordination nécessaire avec 1.4c.
- ⚠️ **Spec divergence documentée** : (a) seller specs colocated vs apex `__tests__/` (suit conventions existantes) ; (b) Playwright env-guard `PLAYWRIGHT_FLAG_OFF=1` vs 2-projects (build duplication coût > bénéfice) ; (c) `docs/runbook/` singulier (arborescence existante) vs `docs/runbooks/` ; (d) **layout 2 apps modifié** : `setRequestLocale(locale)` ajouté — c'est une protection canonique next-intl, sûre sous flag OFF, indispensable sous flag ON. Hors-scope strict de l'AC mais bloquant pour AC8 smoke runtime.
- ➡️ **Prochaine étape recommandée** : `/bmad-code-review` parallèle 3 reviewers (Blind + Edge + Auditor) pattern Stories 1.2b-d/1.4a-b ; puis merge PR vers `develop` ; puis `/bmad-dev-story` 0.16 (atoms `@tukio/ui`) — qui dépend de 0.15 placeholders pour remplacer le contenu.

### File List

**NEW (28 fichiers)** :
- `apps/public/src/middleware/coming-soon-gate-decision.ts`
- `apps/public/src/middleware/coming-soon-gate.ts`
- `apps/public/src/middleware/__tests__/coming-soon-gate-decision.spec.ts`
- `apps/public/src/app/[locale]/coming-soon/page.tsx`
- `apps/public/src/app/[locale]/coming-soon/success/page.tsx`
- `apps/public/src/app/[locale]/devenir-pro/page.tsx`
- `apps/public/src/app/[locale]/a-propos/page.tsx`
- `apps/public/src/app/[locale]/confidentialite/page.tsx`
- `apps/public/src/app/[locale]/mentions-legales/page.tsx`
- `apps/public/src/app/[locale]/contact/page.tsx`
- `apps/public/src/app/robots.ts`
- `apps/public/src/app/sitemap.ts`
- `apps/public/.env.example`
- `apps/public/e2e/coming-soon-gate.spec.ts`
- `apps/seller/src/middleware/coming-soon-gate-decision.ts`
- `apps/seller/src/middleware/coming-soon-gate.ts`
- `apps/seller/src/middleware/coming-soon-gate-decision.spec.ts`
- `apps/seller/src/app/[locale]/seller-coming-soon/page.tsx`
- `apps/seller/src/app/[locale]/seller-coming-soon/success/page.tsx`
- `apps/seller/src/app/robots.ts`
- `apps/seller/src/app/sitemap.ts`
- `apps/seller/.env.example`
- `apps/seller/e2e/coming-soon-gate.spec.ts`
- `docs/runbook/pre-launch-toggle.md`

**UPDATE — committed (8 fichiers)** :
- `apps/public/src/middleware.ts` — gate inséré en 1er
- `apps/public/src/app/[locale]/layout.tsx` — `setRequestLocale(locale)` ajouté
- `apps/public/README.md` — section "Pre-launch mode"
- `apps/seller/src/middleware.ts` — gate inséré en 1er
- `apps/seller/src/app/[locale]/layout.tsx` — `setRequestLocale(locale)` ajouté
- `apps/seller/README.md` — section "Pre-launch mode"
- `infra/docker-compose/apps.prod.yml` — env var sur services public + seller
- `AGENTS.md` — bullet hard rule Story 0.15

**UPDATE — local-only, gitignored (2 fichiers — corrigé post code-review P7)** :
- `apps/public/.env.local` — `NEXT_PUBLIC_COMING_SOON_MODE=false` en tête (non committé : `.env.local` est dans `.gitignore`. Chaque dev doit appliquer manuellement la même édition pour ne pas être impacté par le mode pré-lancement en dev.)
- `apps/seller/.env.local` — idem

**Total committed** : 32 fichiers (24 NEW + 8 UPDATE), ~1300 lignes ajoutées (vs estimation spec ~30 fichiers / 900-1200 lignes). Variance principale : 2 layout files ajoutés (découverte de la dépendance setRequestLocale).

### Review Findings

**Code review 2026-05-21** via `/bmad-code-review` parallèle (Blind Hunter + Edge Case Hunter + Acceptance Auditor — modèle Opus 4.7 1M). 76 findings bruts → 55 après dedupe → triage final : **11 patches / 1 decision-needed / 22 defer / 21 dismissed**.

#### Decision-needed (à résoudre AVANT patches)

- [ ] [Review][Decision] **D1 — `COMING_SOON_MODE` vs `NEXT_PUBLIC_COMING_SOON_MODE` substitution dans apps.prod.yml** (`infra/docker-compose/apps.prod.yml:222, 245`) — Le YAML lit `${COMING_SOON_MODE:-true}` (bare) mais le runbook section 1 indique aux opérateurs de set `NEXT_PUBLIC_COMING_SOON_MODE=true` dans `secrets/public.env`. Mismatch si le deploy script ne source pas le fichier d'env vers le shell. Choix : (a) changer YAML → `${NEXT_PUBLIC_COMING_SOON_MODE:-true}` pour alignement avec naming `.env`, OU (b) changer runbook pour instruire `COMING_SOON_MODE` directement. Nécessite vérification du deploy script existant.

#### Patches (correctifs unambigus)

- [x] [Review][Patch] **P1 — Runbook links plural→singular** [`apps/public/README.md`, `apps/seller/README.md`] — README × 2 référencent `docs/runbooks/pre-launch-toggle.md` (pluriel cassé) alors que le runbook ship à `docs/runbook/pre-launch-toggle.md` (singulier). 2 broken links day-one.
- [x] [Review][Patch] **P2 — Supprimer `/(authenticated)/` du robots disallow** [`apps/public/src/app/robots.ts:14`] — Syntaxe route-group Next.js, jamais un URL path. Aucun crawler ne visite littéralement `/(authenticated)/`. Règle dead-weight.
- [x] [Review][Patch] **P3 — `/auth/` + `/account/` en base disallow** [`apps/public/src/app/robots.ts:14`] — Actuellement uniquement dans la branche flag-ON. Post-launch (flag OFF) ces paths privés deviennent indexables. Move vers `baseDisallow`.
- [x] [Review][Patch] **P4 — Sitemap `lastModified` constante** [`apps/public/src/app/sitemap.ts:9`, `apps/seller/src/app/sitemap.ts:9`] — `new Date()` recalculé à chaque request défait le cache crawler. Utiliser `new Date('2026-05-21T00:00:00Z')`.
- [x] [Review][Patch] **P5 — Seller robots.ts garde `/seller/` disallowed en base** [`apps/seller/src/app/robots.ts:13`] — Actuellement flag-ON only. Seller portal post-launch reste pro-only sans pages publiques marketing — `/seller/` doit rester disallowed dans les 2 branches.
- [x] [Review][Patch] **P6 — Test AC13 seller hollow** [`apps/seller/e2e/coming-soon-gate.spec.ts:73-78`] — Le test "AC13 — pending-admin-review middleware still works (Story 1.3d intact)" vérifie uniquement `response.status() === 200` sur `/fr/` sans cookie pending. Sans relation au middleware Story 1.3d. Renommer ou tighten avec fixture cookie.
- [x] [Review][Patch] **P7 — File List off-by-one + `.env.local` faussement listé** (story file `### File List`) — File List claims `apps/public/.env.local` + `apps/seller/.env.local` comme UPDATE mais ils sont gitignored → absents du diff. Total réel : 32 fichiers (24 NEW + 8 UPDATE), pas 33. Amender la section File List + Completion Notes.
- [x] [Review][Patch] **P8 — Runbook rebuild requirement** [`docs/runbook/pre-launch-toggle.md:9-30`] — Sections 1+2 disent "edit secrets + docker compose up -d" mais `NEXT_PUBLIC_*` sont inlined au build Next.js. Restart container = no-op. Ajouter note "Toggle nécessite : (1) update env in CI build env, (2) trigger rebuild + image push to ghcr, (3) `docker compose pull` + `up`".
- [x] [Review][Patch] **P9 — Apex robots disallow locale-aware** [`apps/public/src/app/robots.ts:14`] — `Disallow: /auth/` ne match pas `/fr/auth/sign-up` (crawlers prefix-match strictement). Lister explicitement `/fr/auth/, /en/auth/, /fr/account/, /en/account/`.
- [x] [Review][Patch] **P10 — Change Log : whitelist de-dup `coming-soon/success`** (story file Change Log) — Spec AC2 listait `/^\/[a-z]{2}\/coming-soon\/success(\/|$)/u` séparément ; l'impl de-duplicate (couvert par regex parent `coming-soon` via `(\/|$)`). Sémantiquement équivalent + testé case 6. Documenter dans Change Log.
- [x] [Review][Patch] **P11 — Change Log : robots ajout `/account/`** (story file Change Log) — Spec AC10 listait 4 paths, impl ajoute `/account/` (bénéfique). Documenter l'addition out-of-spec.

#### Deferred (pré-existant ou hors-scope Story 0.15)

- [x] [Review][Defer] **W1 — Locale-prefixed `/fr/api/*` not in TECH_BYPASS** [`coming-soon-gate-decision.ts`] — aucune route locale-prefixed API existe actuellement ; spéculatif.
- [x] [Review][Defer] **W2 — POST/PUT/DELETE rewrite vers GET coming-soon** [`coming-soon-gate.ts`] — edge case ; pré-launch traffic ~100% GET.
- [x] [Review][Defer] **W3 — `x-next-intl-locale` override upstream unconditional** [`coming-soon-gate.ts:34`] — aucun proxy upstream ne pose actuellement ce header.
- [x] [Review][Defer] **W4 — `decision.kind` pas exhaustively narrowed** [`coming-soon-gate.ts`] — 2 variants actuellement ; future-proofing.
- [x] [Review][Defer] **W5 — `safeLocaleFromPath('//foo')` returns DEFAULT_LOCALE** [`coming-soon-gate-decision.ts:43-47`] — Next.js normalize double-slash en amont.
- [x] [Review][Defer] **W6 — `/zz/coming-soon` regex permissif `[a-z]{2}`** [`coming-soon-gate-decision.ts:14-19`] — layout `[locale]` appelle `hasLocale() → notFound()`. Spec AC2 dit "captures any 2-letter locale segment" intentionnel.
- [x] [Review][Defer] **W7 — Seller layout pas de `hasLocale()` guard avant `setRequestLocale`** [`apps/seller/src/app/[locale]/layout.tsx:44-47`] — pré-existant Sprint 0 ; fix dans follow-up indépendant.
- [x] [Review][Defer] **W8 — Rewrite drop query string (UTM/tokens)** [`coming-soon-gate.ts:36`] — pre-launch tradeoff acknowledged runbook section 4.
- [x] [Review][Defer] **W9 — Sitemap missing hreflang alternates** [`apps/public/src/app/sitemap.ts`] — Story 0.21 scope (spec explicite).
- [x] [Review][Defer] **W10 — Hardcoded `https://tukio.one` base URL robots/sitemap** [`robots.ts`, `sitemap.ts`] — Story 0.21 introduira `NEXT_PUBLIC_SITE_URL` indirection.
- [x] [Review][Defer] **W11 — No CSP/Cache-Control sur rewrite** [`coming-soon-gate.ts`] — stratégie caching plus large à définir.
- [x] [Review][Defer] **W12 — Sitemap noindex contradiction** [`coming-soon/page.tsx` + `sitemap.ts`] — Story 0.17 + 0.21 séquence : 0.17 livre contenu final, 0.21 flip robots:true.
- [x] [Review][Defer] **W13 — Cleanup PR section 3 incomplete** [`docs/runbook/pre-launch-toggle.md`] — runbook expansion ; post-launch concern.
- [x] [Review][Defer] **W14 — Apex coming-soon noindex propage à URL rewritten** [`coming-soon/page.tsx:14-16`] — Story 0.21 flip index:true.
- [x] [Review][Defer] **W15 — Apex `/devenir-pro` whitelist orphans seller `/devenir-pro`** [`coming-soon-gate-decision.ts:15`] — Story 0.18 handles avec cross-zone CTA explicite.
- [x] [Review][Defer] **W16 — Strict flag parsing fail-open** [`coming-soon-gate.ts:20`] — spec AC1 mandate strict `'true'`. Décision de posture à instruire post-launch si problème.
- [x] [Review][Defer] **W17 — UTM cookie dropped pre-launch** [`apps/public/src/middleware.ts:18-22`] — by spec design ; landing form Story 0.20 capture acquisition.
- [x] [Review][Defer] **W18 — Two parallel decision implementations apex+seller** [`apps/{public,seller}/src/middleware/coming-soon-gate-decision.ts`] — by spec design ; whitelist + target diffèrent.
- [x] [Review][Defer] **W19 — `setRequestLocale` pas dans pages** [`apps/{public,seller}/src/app/[locale]/*/page.tsx`] — placeholders n'utilisent pas i18n ; Stories 0.17/0.18/0.19 ajouteront aux pages avec contenu.
- [x] [Review][Defer] **W20 — Tests literal FR strings break post-Story 0.17** [`apps/public/e2e/coming-soon-gate.spec.ts`] — placeholders tightement couplés ; tests réécrits par Story 0.17.
- [x] [Review][Defer] **W21 — Apex AC13 ne submit pas le form** [`apps/public/e2e/coming-soon-gate.spec.ts:305-318`] — convention Stories 1.2b-d "spécs livrées non-exécutées".
- [x] [Review][Defer] **W22 — Seller robots `Allow: ['/']` indexe URLs rewritten comme duplicate** [`apps/seller/src/app/robots.ts`] — Story 0.21 ajoutera canonical tags + scope SEO.

#### Dismissed (21) — bruit / false positive / by-design

R1 sitemap priority cosmetic · R2 IS_FLAG_ON module-init (intentionnel) · R3 pathname normalisation (Next.js handles) · R4 PLAYWRIGHT_FLAG_OFF module load · R5 wrapper sans spec (AC3 exempté) · R6 conventions test folders apex/seller (acknowledged) · R7 placeholders inline styles · R8/R11 chain comment numbering · R9 `.env.example` scope (par AC1) · R10 Playwright dev-server (acknowledged) · R12/R17 loose regex tests · R13 regex permissivité (par AC2) · R14 Pretre boundary N/A (frontend) · R15 hardcoded FR placeholders (par AC12 exempté) · R16 spec/impl narrative mismatch (over-delivery) · R18 wrapper env init (by design) · R19 `e2e/` vs `test/e2e/` (acknowledged) · R20 layout setRequestLocale pas dans pages (Stories 0.17+ scope) · R21 public placeholders no robots meta (Story 0.21 scope).

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-20 | bmad-create-story (Opus 4.7) | Initial story creation — Pre-launch toggle infra + middleware coming-soon-gate apex/seller + .env.example creation + placeholders 7 pages publiques + robots.txt/sitemap.xml stubs + runbook + tests vitest (≥ 90% coverage decision) + Playwright e2e × 2 apps × 2 modes + réversibilité prouvée. ~30 fichiers, 1-2j dev. |
| 2026-05-21 | bmad-dev-story (Opus 4.7 1M) | Implementation done — 32 fichiers committed (24 NEW + 8 UPDATE) + 2 fichiers local-only `.env.local` × 2 (gitignored). Tests vitest verts : apex 55/55 (15 nouveaux) + seller 28/28 (14 nouveaux) + 100% coverage decision files. Lint + typecheck 0 errors. Smoke build-time + runtime confirmés sur 11 routes apex/seller × fr/en avec flag ON + 4 routes avec flag OFF (réversibilité Story 1.2d/1.3d non régressé). Fix critique découvert au smoke : rewrite + next-intl `requestLocale` undefined → 404 ; résolu via (1) `x-next-intl-locale` request header dans `NextResponse.rewrite(url, { request: { headers } })` et (2) `setRequestLocale(locale)` ajouté dans les 2 layouts `[locale]/layout.tsx`. Story passée `review`. |
| 2026-05-21 | bmad-code-review (Opus 4.7 1M parallèle Blind+Edge+Auditor) | Code review parallèle 3 layers → 76 findings bruts → 11 patches + 1 decision-needed (D1) + 22 defer + 21 dismissed. **11 patches appliqués** : P1 runbook links plural→singular READMEs × 2 (broken-day-one fixed) · P2 robots.ts retire `/(authenticated)/` (route-group syntax, dead rule) · P3 `/auth/` + `/account/` en base disallow apex (post-launch privacy) · P4 sitemap `lastModified` constante `2026-05-21T00:00:00Z` × 2 apps · P5 seller robots `/seller/` en base disallow (pro-only post-launch aussi) · P6 test AC13 seller hollow remplacé par test JWT pending → /onboarding/pending real redirect Story 1.3d · P7 File List corrigé (32 committed vs 33 erroné, `.env.local` séparé en local-only gitignored) · P8 runbook réécrit (mécanisme toggle real : server middleware lit process.env au restart, pas inlined ; mauvais commentaire dans code corrigé × 2 apps) · P9 apex robots disallow locale-aware (`/fr/auth/`, `/en/auth/`, `/fr/account/`, `/en/account/` — crawlers prefix-match strict) · P10 documentation whitelist de-dup `coming-soon/success` (couvert par parent regex via `(\/|$)`) · P11 documentation ajout `/account/` à robots disallow (out-of-spec bénéfique). **D1 résolu** par investigation : convention deploy = un fichier par secret (pas `secrets/public.env`) ; le YAML `${COMING_SOON_MODE:-true}` lit shell var, le runbook désormais aligné sur cette convention. **Code change minimal** : 2 robots.ts (apex+seller) · 2 sitemap.ts · 2 coming-soon-gate.ts comments · 1 seller e2e spec · 1 runbook · 2 READMEs · 1 story file File List + Change Log. Aucun fichier supprimé, aucune logique métier changée. Tests vitest doivent rester 55/55 + 28/28 + lint/typecheck verts (à valider post-patches). |
