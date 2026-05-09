# Story 0.9: Setup @tukio/api-client + @tukio/i18n-client + @tukio/testing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** developer (équipe Sprint 0),
**I want** **3 libs partagées** livrées en une seule story (densité max — toutes 3 sont small-to-medium et leurs périmètres sont indépendants) :
1. **`@tukio/api-client`** (frontend) — `axios` instance avec **envelope-handler ADR-014** (extract `data` depuis `SuccessEnvelope`, throw `ApiError` typé depuis `ErrorEnvelope`), CSRF header injection, credentials cookies cross-subdomain, **TanStack Query 5.x hooks typés** organisés par domaine (catalog, booking, payment, messaging, review, identity, admin), types `ApiError` + `QueryKeys` exportés
2. **`@tukio/i18n-client`** (frontend) — config **`next-intl` 4.x** partagée (locales `['fr', 'en']` fallback `'fr'`, timeZone `Europe/Paris` default), middleware locale-prefix routing (cohérent NFR58), formatters typés (date, number, currency EUR, relativeTime), composant `<Hreflang />` (SEO bilingue NFR58), helper `getMessages(locale)` server-side
3. **`@tukio/testing`** (backend) — **testcontainers helpers** (`postgres.helper.ts`, `nats.helper.ts`, `redis.helper.ts`, `keycloak.helper.ts`, `meilisearch.helper.ts`) qui démarrent des containers éphémères pour les tests d'intégration, **chaos helpers** (`nats-disconnect.helper.ts`, `db-failure.helper.ts`, `saga-partial-failure.helper.ts`) pour tests R11/R12/R13, **fixtures builders** (`user.fixture.ts`, `listing.fixture.ts`, `booking.fixture.ts`, `order.fixture.ts`, `payment.fixture.ts`, `review.fixture.ts`), **custom matchers** (`toMatchEnvelope`, `toBeUuid`, `toBeIsoDate`)

**so that** tous les apps frontend ont les hooks TanStack Query typés (`useBookingDetail({ id })` return `BookingResponseDto` directement, ApiError propagé en `onError`), l'i18n FR/EN est branché identique sur les 4 apps via `<NextIntlClientProvider>` + middleware Next.js partagé (un seul changelog `messages/{fr,en}.json` par app, pas de duplication config), tous les services backend ont des helpers testcontainers qui démarrent un PG/NATS/Redis réel en < 5 s pour tester en isolation totale, le test chaos NATS Story 0.7 (Task 10 marqué `it.skip`) peut maintenant être implémenté pour de vrai, et le test E2E Keycloak Story 0.8 (Task 12.6 utilise `nock` pour mock JWKS) peut être upgrade en testcontainers Keycloak réel pour validation de bout en bout.

> **Outcome attendu** : à la fin de cette story, `import { useBookingDetail } from '@tukio/api-client/hooks/booking'` fonctionne dans toute app Next.js (consommation TanStack Query typed) ; `import { defineLocale, formatCurrency } from '@tukio/i18n-client'` fonctionne dans le RootLayout de chaque app ; `import { startPostgresContainer, userFixture } from '@tukio/testing'` fonctionne dans tout test d'intégration backend ; le chaos test Story 0.7 (`packages/messaging/src/__tests__/chaos-nats-disconnect.spec.ts`) est maintenant implémenté **réellement** avec un container NATS qu'on stop/restart ; le test E2E user.e2e-spec Story 0.8 utilise un Keycloak réel testcontainer (mais reste rapide via container réutilisable cross-tests).

## Acceptance Criteria

### Pour les 3 libs (transversal)

1. **AC1 — Structure des 3 packages alignée Architecture (lignes 2202-2233)** : Given `packages/{api-client,i18n-client,testing}/src/`, When je les ouvre, Then je trouve **strictement** ces arborescences :
   ```
   packages/api-client/src/
   ├─ index.ts                                       # barrel racine MINIMAL (types globaux)
   ├─ client/
   │  ├─ axios-client.ts                             # axios instance configurée
   │  ├─ envelope-handler.ts                         # extract data, throw ApiError (ADR-014)
   │  ├─ csrf-interceptor.ts                         # ajoute X-CSRF-Token header automatiquement
   │  ├─ correlation-id-interceptor.ts               # propage correlationId from frontend → backend
   │  └─ types.ts                                    # AxiosClientConfig
   ├─ types/
   │  ├─ api-error.ts                                # class ApiError extends Error avec tukioCode + envelope
   │  ├─ query-keys.ts                               # QueryKeys factory pour TanStack Query (typé)
   │  └─ index.ts
   ├─ hooks/                                         # organisé par domaine
   │  ├─ catalog/{useSearchListings,useListingDetail,useCategoryTree,useProProfile}.ts
   │  ├─ booking/{useCreateBooking,useBookingDetail,useListBookings,useAcceptBooking,useCancelBooking}.ts
   │  ├─ payment/{useCheckout,useSavedCards,useInvoices,usePayouts,useSubscription}.ts
   │  ├─ messaging/{useConversations,useSendMessage}.ts
   │  ├─ review/{useSubmitReview,useReviews}.ts
   │  ├─ identity/{useProfile,useUpdateProfile,useNotificationPreferences}.ts
   │  └─ admin/{useVerifications,useDisputes,useAuditTrail,useReplayEvent,useImpersonate}.ts
   ├─ providers/
   │  └─ query-provider.tsx                          # <QueryProvider> wrapper avec defaults Tukio
   └─ __tests__/                                     # tests cross-modules
      ├─ envelope-handler.spec.ts
      └─ api-error.spec.ts

   packages/i18n-client/src/
   ├─ index.ts                                       # barrel racine MINIMAL
   ├─ config/
   │  ├─ locales.ts                                  # const LOCALES = ['fr', 'en'], DEFAULT_LOCALE = 'fr', LOCALE_LABELS
   │  ├─ time-zones.ts                               # default Europe/Paris
   │  └─ next-intl.config.ts                         # getRequestConfig pour next-intl Server Components
   ├─ middleware/
   │  ├─ create-i18n-middleware.ts                   # factory next-intl middleware partagé
   │  └─ create-i18n-middleware.spec.ts
   ├─ formatters/
   │  ├─ date.ts                                     # formatDate, formatDateRange, formatRelativeTime
   │  ├─ number.ts                                   # formatNumber (decimal, percent)
   │  ├─ currency.ts                                 # formatCurrency (input cents → string formatté)
   │  ├─ relative-time.ts                            # "il y a 5 min" / "5 min ago"
   │  └─ formatters.spec.ts
   ├─ components/
   │  ├─ hreflang.tsx                                # <Hreflang locale={...} alternates={...} />
   │  ├─ locale-link.tsx                             # <LocaleLink href="/..." /> qui injecte /{locale} prefix
   │  └─ components.spec.tsx
   ├─ hooks/
   │  └─ use-current-locale.ts                       # useCurrentLocale() hook qui retourne 'fr' | 'en'
   └─ types/
      ├─ locale.ts                                   # type Locale = 'fr' | 'en' (re-export @tukio/contracts)
      └─ index.ts

   packages/testing/src/
   ├─ index.ts                                       # barrel racine MINIMAL (Symbol tokens uniquement)
   ├─ testcontainers/
   │  ├─ postgres.helper.ts                          # startPostgresContainer({ db, user, password }) → { url, stop }
   │  ├─ nats.helper.ts                              # startNatsContainer({ jetstream }) → { url, stop, getClient }
   │  ├─ redis.helper.ts                             # startRedisContainer() → { url, stop }
   │  ├─ keycloak.helper.ts                          # startKeycloakContainer({ realm, importJson }) → { url, stop, getAdminClient }
   │  ├─ meilisearch.helper.ts                       # startMeilisearchContainer({ masterKey }) → { url, stop }
   │  └─ container-pool.ts                           # singleton pool pour réutiliser containers cross-tests (perf)
   ├─ chaos/
   │  ├─ nats-disconnect.helper.ts                   # disconnectNats(container, durationMs) puis reconnect
   │  ├─ db-failure.helper.ts                        # pause container PG + restore après N ms
   │  ├─ saga-partial-failure.helper.ts             # injecte un fail entre 2 events NATS (mock controllable)
   │  └─ chaos.spec.ts
   ├─ fixtures/
   │  ├─ user.fixture.ts                             # buildUser({ overrides }), buildPro, buildAdmin, buildClient
   │  ├─ listing.fixture.ts                          # buildListing({ overrides })
   │  ├─ booking.fixture.ts                          # buildBooking, buildBookingPending, buildBookingConfirmed
   │  ├─ order.fixture.ts                            # buildOrder, buildOrderWithLineItems
   │  ├─ payment.fixture.ts                          # buildPaymentIntent, buildRefund
   │  ├─ review.fixture.ts                           # buildReview, buildReviewWithBreakdown
   │  └─ fixtures.spec.ts
   ├─ matchers/
   │  ├─ to-match-envelope.matcher.ts                # expect(response).toMatchSuccessEnvelope({ data: {...} })
   │  ├─ to-be-uuid.matcher.ts                       # expect(value).toBeUuid()
   │  ├─ to-be-iso-date.matcher.ts                   # expect(value).toBeIsoDate()
   │  ├─ setup.ts                                    # extend expect avec tous les matchers
   │  └─ matchers.spec.ts
   └─ types.ts                                       # ContainerHandle, FixtureOverrides, etc.
   ```

### Pour `@tukio/api-client`

2. **AC2 — `axios-client.ts` configuré avec credentials + envelope unwrapping + retry** : Given `packages/api-client/src/client/axios-client.ts`, When je l'ouvre, Then je trouve une factory `createTukioApiClient(config: AxiosClientConfig)` qui retourne une instance axios :
   - **`baseURL`** : depuis `config.baseURL` (env var `NEXT_PUBLIC_GATEWAY_API_URL` côté apps)
   - **`withCredentials: true`** : envoie automatiquement les cookies `Domain=.tukio.one` (notamment `tukio-access-token` set par gateway-api après login Story 0.8)
   - **`timeout: 10000`** (10 s default, configurable)
   - **Headers default** : `Content-Type: application/json`, `Accept: application/json`, `X-Tukio-Locale: <locale>` (injecté via interceptor depuis `i18n-client.useCurrentLocale()`)
   - **Interceptors** :
     1. `correlationIdInterceptor` (request) : ajoute `X-Tukio-Correlation-Id` depuis frontend (généré au mount via `crypto.randomUUID()` + persisted en sessionStorage pour la durée de la session)
     2. `csrfInterceptor` (request) : ajoute `X-CSRF-Token` header depuis cookie `tukio-csrf-token` (Story 0.8 `cookieManager.addCsrfHeader()`) sur POST/PUT/PATCH/DELETE
     3. `envelopeUnwrapInterceptor` (response) : si réponse 2xx, extract `data` depuis `SuccessEnvelope.data` automatiquement → le caller reçoit directement le DTO nu (cohérent ADR-014)
     4. `envelopeErrorInterceptor` (response error) : si réponse 4xx/5xx, parse `ErrorEnvelope` + throw `ApiError` typé (cf. AC3)
   - **Retry logic** (NFR45) : 3 retries max sur erreurs réseau (5xx, ETIMEDOUT, ECONNRESET) avec backoff exponentiel (200ms, 500ms, 1500ms) — NE retry PAS sur 4xx (erreur client)
   - Tests `__tests__/axios-client.spec.ts` : test interceptors fired in order, test envelope unwrap, test ApiError thrown sur erreur, test retry avec mock axios-mock-adapter

3. **AC3 — `ApiError` class typée + `envelope-handler` extraction** : Given `packages/api-client/src/types/api-error.ts` + `client/envelope-handler.ts`, When je les ouvre, Then :
   - **`class ApiError extends Error`** :
     ```ts
     export class ApiError extends Error {
       constructor(
         public readonly tukioCode: string,
         public readonly httpStatus: number,
         public readonly title: string,
         public readonly detail: string,
         public readonly issues?: ValidationIssue[],
         public readonly correlationId?: string,
         public readonly instance?: string,
       ) {
         super(`[${tukioCode}] ${title}: ${detail}`);
         this.name = 'ApiError';
       }
       isValidationError(): boolean { return this.tukioCode === 'VALIDATION-FAILED-001'; }
       isNotFound(): boolean { return this.httpStatus === 404; }
       isUnauthorized(): boolean { return this.httpStatus === 401; }
       isForbidden(): boolean { return this.httpStatus === 403; }
       isConflict(): boolean { return this.httpStatus === 409; }
       isServerError(): boolean { return this.httpStatus >= 500; }
     }
     ```
   - **Type `ApiError` re-exportée** depuis `@tukio/api-client` (root)
   - **`envelope-handler.ts`** :
     ```ts
     export function unwrapSuccessEnvelope<T>(envelope: SuccessEnvelope<T>): T {
       return envelope.data;
     }
     export function throwApiErrorFromEnvelope(envelope: ErrorEnvelope, correlationId?: string): never {
       throw new ApiError(
         envelope.error.tukioCode,
         envelope.code,
         envelope.error.title,
         envelope.error.detail,
         envelope.error.issues,
         correlationId ?? envelope.meta.correlationId,
         envelope.error.instance,
       );
     }
     ```
   - Tests : test `isValidationError()` etc., test envelope unwrap retourne data correct, test envelope error throw ApiError avec champs corrects

4. **AC4 — `<QueryProvider>` avec defaults Tukio** : Given `packages/api-client/src/providers/query-provider.tsx`, When je l'ouvre, Then :
   - **`<QueryProvider>` wrapper** qui crée `QueryClient` avec defaults Tukio :
     ```ts
     const queryClient = new QueryClient({
       defaultOptions: {
         queries: {
           staleTime: 60_000,                        // 1 min stale (UX rapide, refetch en background si focus)
           gcTime: 5 * 60_000,                       // 5 min garbage collection (TanStack Query 5.x renamed cacheTime)
           retry: (failureCount, error) => {
             if (error instanceof ApiError && error.httpStatus < 500) return false; // pas de retry sur 4xx
             return failureCount < 2;                // 2 retries max sur 5xx
           },
           refetchOnWindowFocus: true,               // refetch au focus tab (UX cohérent multi-onglets)
           refetchOnReconnect: true,
         },
         mutations: {
           retry: false,                              // mutations jamais retry auto (idempotence non garantie)
           onError: (error) => {
             // Hook global pour Sentry (Story 0.12 wire) — placeholder ici
             if (error instanceof ApiError && error.isServerError()) {
               console.error('[ApiError 5xx]', error);
             }
           },
         },
       },
     });
     ```
   - Composant React Server Components-aware (gère SSR via `dehydrate`/`hydrate` quand pertinent — pour pages publiques SEO, Story Epic 3+)
   - Tests `<QueryProvider>` : test queryClient créé avec defaults, test ApiError 4xx pas retry, test 5xx retry 2x

5. **AC5 — Hooks TanStack Query organisés par domaine + types stricts** : Given `packages/api-client/src/hooks/`, When je l'ouvre, Then je trouve **au minimum 1 hook par domaine** (les 7 domaines : catalog, booking, payment, messaging, review, identity, admin) — le reste des hooks listés Architecture lignes 2220-2226 sont **stubs/placeholders** marqués `TODO Story Epic X` :
   - **MVP minimal Story 0.9** (1 hook par domaine, complet) :
     - `catalog/use-search-listings.ts` : `useSearchListings({ q, where, from, to, limit, cursor })` retourne `{ data: ListingResponseDto[], pagination, isPending, isError, error: ApiError }`
     - `booking/use-booking-detail.ts` : `useBookingDetail({ id })` retourne `{ data: BookingResponseDto, ... }`
     - `payment/use-checkout.ts` : `useCheckout()` mutation hook qui call `POST /v1/payments/checkout` avec `CreatePaymentIntentDto`
     - `messaging/use-conversations.ts` : `useConversations()` retourne liste conversations
     - `review/use-reviews.ts` : `useReviews({ listingId })` retourne reviews paginated
     - `identity/use-profile.ts` : `useProfile()` retourne `UserProfileResponseDto` du current user
     - `admin/use-verifications.ts` : `useVerifications({ status })` retourne pending pro verifications
   - **Pattern type-safe** : chaque hook utilise `QueryKeys.<domain>.<operation>(params)` pour la query key (factory typée), `axiosClient.get/post/...` typed avec generic depuis `@tukio/contracts/dtos/...`
   - **Pattern reusable** : créer un helper `createQueryHook<TParams, TResponse>(endpoint, queryKeyFactory)` qui factorise la boilerplate (Story Epic 1+ pourra ajouter ses hooks rapidement)
   - **`QueryKeys` factory** :
     ```ts
     export const QueryKeys = {
       catalog: {
         listings: { all: ['listings'] as const, search: (params: SearchParams) => ['listings', 'search', params] as const, detail: (id: string) => ['listings', id] as const },
         categories: { all: ['categories'] as const, tree: ['categories', 'tree'] as const },
       },
       booking: {
         all: ['bookings'] as const,
         list: (filter: BookingFilter) => ['bookings', filter] as const,
         detail: (id: string) => ['bookings', id] as const,
       },
       // ... idem pour payment, messaging, review, identity, admin
     } as const;
     ```
   - Tests `__tests__/hooks.spec.ts` : 1 test par hook qui mock `axios` via `axios-mock-adapter` ou `msw`, vérifie que `useQuery`/`useMutation` est appelé avec la bonne URL + bons params

### Pour `@tukio/i18n-client`

6. **AC6 — `config/locales.ts` + `next-intl` config Server Components-aware** : Given `packages/i18n-client/src/config/`, When je l'ouvre, Then :
   - `locales.ts` :
     ```ts
     export const LOCALES = ['fr', 'en'] as const;
     export type Locale = typeof LOCALES[number];
     export const DEFAULT_LOCALE: Locale = 'fr';
     export const LOCALE_LABELS: Record<Locale, string> = { fr: 'Français', en: 'English' };
     export const LOCALE_FLAGS: Record<Locale, string> = { fr: '🇫🇷', en: '🇬🇧' };  // emoji flags pour LocaleSwitcher Story 0.5
     export function isLocale(value: string): value is Locale {
       return (LOCALES as readonly string[]).includes(value);
     }
     ```
   - `time-zones.ts` : `export const DEFAULT_TIME_ZONE = 'Europe/Paris';` (cohérent business FR-only au MVP)
   - `next-intl.config.ts` : helper Next.js Server Components :
     ```ts
     import { getRequestConfig } from 'next-intl/server';
     import { notFound } from 'next/navigation';
     import { isLocale, DEFAULT_LOCALE, DEFAULT_TIME_ZONE } from './locales';

     export function createI18nRequestConfig(loadMessages: (locale: Locale) => Promise<Record<string, unknown>>) {
       return getRequestConfig(async ({ requestLocale }) => {
         const locale = await requestLocale;
         if (!locale || !isLocale(locale)) notFound();
         return {
           locale,
           messages: await loadMessages(locale),
           timeZone: DEFAULT_TIME_ZONE,
           now: new Date(),
         };
       });
     }
     ```
   - **Pattern d'usage** côté apps (chaque app crée son propre `i18n.ts` qui wire le loader) :
     ```ts
     // apps/customer/src/i18n.ts
     import { createI18nRequestConfig } from '@tukio/i18n-client';
     export default createI18nRequestConfig(async (locale) => (await import(`./messages/${locale}.json`)).default);
     ```

7. **AC7 — `createI18nMiddleware` factory** : Given `packages/i18n-client/src/middleware/create-i18n-middleware.ts`, When je l'ouvre, Then :
   - Factory `createI18nMiddleware(options?: { localePrefix?: 'always' | 'as-needed' })` qui retourne le middleware next-intl partagé entre les 4 apps :
     ```ts
     import createMiddleware from 'next-intl/middleware';
     import { LOCALES, DEFAULT_LOCALE } from '../config/locales';

     export function createTukioI18nMiddleware(options: { localePrefix?: 'always' | 'as-needed' } = {}) {
       return createMiddleware({
         locales: [...LOCALES],
         defaultLocale: DEFAULT_LOCALE,
         localePrefix: options.localePrefix ?? 'always', // /fr/... toujours, jamais /...
         localeDetection: true,                          // détecte via Accept-Language en first-visit
       });
     }
     ```
   - **Composition avec Story 0.8 KeycloakAuthMiddleware** : helper `composeMiddlewares(i18nMw, authMw)` documenté en Dev Notes :
     ```ts
     export function composeMiddlewares(...middlewares: NextMiddleware[]): NextMiddleware {
       return async (request: NextRequest, event: NextFetchEvent) => {
         for (const mw of middlewares) {
           const result = await mw(request, event);
           if (result instanceof NextResponse && result.status !== 200) return result; // redirect/error → return early
         }
         return NextResponse.next();
       };
     }
     ```
   - Tests : test redirect `/` → `/fr` (default locale), test `/en/...` passes through, test invalid locale `/xx/` → 404, test composition avec auth middleware (redirect login si non authentifié sur `/account/...`)

8. **AC8 — Formatters typés (date, number, currency, relativeTime)** : Given `packages/i18n-client/src/formatters/`, When je l'ouvre, Then :
   - **`date.ts`** :
     ```ts
     export function formatDate(date: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
       const d = typeof date === 'string' ? new Date(date) : date;
       return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long', timeZone: DEFAULT_TIME_ZONE, ...options }).format(d);
     }
     export function formatDateRange(from: Date | string, to: Date | string, locale: Locale): string {
       /* "15-22 juin 2026" / "June 15-22, 2026" */
     }
     ```
   - **`number.ts`** :
     ```ts
     export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
       return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', options).format(value);
     }
     export function formatPercent(value: number, locale: Locale): string {
       return formatNumber(value, locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 1 });
     }
     ```
   - **`currency.ts`** :
     ```ts
     /** Input amount in CENTS (cohérent Money type @tukio/contracts), output formatted string */
     export function formatCurrency(amountInCents: number, currency: 'EUR', locale: Locale): string {
       return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency, currencyDisplay: 'symbol' }).format(amountInCents / 100);
     }
     // exemples :
     // formatCurrency(80000, 'EUR', 'fr') → "800,00 €"
     // formatCurrency(80000, 'EUR', 'en') → "€800.00"
     ```
   - **`relative-time.ts`** :
     ```ts
     export function formatRelativeTime(date: Date | string, locale: Locale, options?: { now?: Date }): string {
       const d = typeof date === 'string' ? new Date(date) : date;
       const now = options?.now ?? new Date();
       const diffSeconds = Math.round((d.getTime() - now.getTime()) / 1000);
       const rtf = new Intl.RelativeTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { numeric: 'auto' });
       // logic: pick best unit (sec, min, hour, day, week, month, year)
       // "il y a 5 min" / "5 minutes ago" / "demain" / "tomorrow"
     }
     ```
   - Tests `formatters.spec.ts` : tester chaque formatter sur les 2 locales avec values typiques, snapshots exhaustifs

9. **AC9 — `<Hreflang>` composant SEO bilingue** : Given `packages/i18n-client/src/components/hreflang.tsx`, When je l'ouvre, Then :
   - Composant React Server Component qui rend les balises `<link>` dans le `<head>` (cohérent NFR58) :
     ```tsx
     export function Hreflang({ currentLocale, alternates, canonicalHref }: { currentLocale: Locale; alternates: Array<{ locale: Locale; href: string }>; canonicalHref: string }) {
       return (
         <>
           {alternates.map(alt => (
             <link key={alt.locale} rel="alternate" hrefLang={alt.locale} href={alt.href} />
           ))}
           <link rel="alternate" hrefLang="x-default" href={canonicalHref} />
           <link rel="canonical" href={canonicalHref} />
         </>
       );
     }
     ```
   - **`<LocaleLink>`** composant qui wrap `next/link` pour injecter `/{locale}` prefix automatiquement :
     ```tsx
     'use client';
     import Link from 'next/link';
     import { useCurrentLocale } from '../hooks/use-current-locale';
     export function LocaleLink({ href, children, ...props }: LinkProps & { children: ReactNode }) {
       const locale = useCurrentLocale();
       const localizedHref = href.toString().startsWith('/') ? `/${locale}${href}` : href;
       return <Link href={localizedHref} {...props}>{children}</Link>;
     }
     ```
   - Tests : test render hreflang correct, test LocaleLink prefixe avec locale courante

10. **AC10 — `useCurrentLocale()` hook** : Given `packages/i18n-client/src/hooks/use-current-locale.ts`, When je l'ouvre, Then :
    - Wrapper minimal sur `useLocale()` next-intl, retourne `Locale` typed (au lieu de `string`)
    - Throw `Error('Invalid locale: ...')` si `useLocale()` retourne autre chose que `'fr' | 'en'` (defensive — should never happen avec middleware actif)

### Pour `@tukio/testing`

11. **AC11 — Testcontainers helpers (5 services : PG, NATS, Redis, Keycloak, Meilisearch)** : Given `packages/testing/src/testcontainers/`, When je les ouvre, Then chaque helper retourne un `ContainerHandle` :
    ```ts
    interface ContainerHandle {
      url: string;        // 'postgres://user:password@localhost:54321/db' ou équivalent
      stop: () => Promise<void>;
      // helpers spécifiques selon container
    }
    ```
    - **`startPostgresContainer({ database, user, password, version = '16' }): Promise<PostgresContainerHandle>`** :
      - Utilise `@testcontainers/postgresql` (PostgreSQL 16 default cohérent Architecture ligne 602)
      - Expose `url` (DSN PG), `getClient()` (returns `pg.Pool`), `runMigrations(migrationsPath)` helper
      - Reuse pattern (singleton) : si même config → réutilise container (perf cross-tests)
    - **`startNatsContainer({ jetstream = true, version = '2.10' }): Promise<NatsContainerHandle>`** :
      - Démarre NATS avec JetStream activé (`--js`)
      - Expose `url` (`nats://localhost:4222`), `getClient()` (returns `NatsConnection`), `disconnect()` + `reconnect()` (pour chaos tests)
    - **`startRedisContainer({ version = '7' }): Promise<RedisContainerHandle>`** :
      - Redis 7 (cohérent Upstash compat)
      - Expose `url`, `getClient()` (returns `ioredis` instance)
    - **`startKeycloakContainer({ realm, importJsonPath, version = '25' }): Promise<KeycloakContainerHandle>`** :
      - Keycloak 25 (cohérent Phasetwo MVP)
      - Import un JSON realm si fourni (`importJsonPath` pointe vers un fichier `realm-export.json`)
      - Expose `url`, `getAdminClient()` (returns `KcAdminClient` officiel pour create/update users dans tests)
      - **Slow** (~10-20 s startup) → singleton fortement recommandé cross-tests
    - **`startMeilisearchContainer({ masterKey = 'test-master-key', version = '1.x latest' }): Promise<MeilisearchContainerHandle>`** :
      - Meilisearch latest stable
      - Expose `url`, `getClient()` (returns Meilisearch SDK client)
    - **`container-pool.ts`** : `getOrCreate(serviceType, config)` singleton qui réutilise les containers si même config — pattern global Vitest `globalSetup` recommandé pour démarrer une fois par test run, partagé cross-files
    - **Cleanup `afterAll`** : helper `cleanupAllContainers()` à appeler en `globalTeardown` Vitest pour stop tous les containers
    - **Healthcheck wait** : tous les helpers wait que le container soit healthy avant de retourner (`Wait.forLogMessage('...')` ou `Wait.forHttpStatusCode('/health', 200)`)

12. **AC12 — Chaos helpers (3 scenarios)** : Given `packages/testing/src/chaos/`, When je les ouvre, Then :
    - **`nats-disconnect.helper.ts`** :
      ```ts
      export async function disconnectNatsForDuration(natsContainer: NatsContainerHandle, durationMs: number): Promise<void> {
        await natsContainer.disconnect();
        await sleep(durationMs);
        await natsContainer.reconnect();
      }
      ```
      Utilisé par Story 0.7 chaos test (qui était `it.skip`) — Story 0.9 le ré-active en `it()` réel.
    - **`db-failure.helper.ts`** :
      ```ts
      export async function pauseDbForDuration(pgContainer: PostgresContainerHandle, durationMs: number): Promise<void> {
        await pgContainer.dockerContainer.pause();
        await sleep(durationMs);
        await pgContainer.dockerContainer.unpause();
      }
      ```
      Pour tests R13 (outbox relay continue à fonctionner si DB down temporaire).
    - **`saga-partial-failure.helper.ts`** :
      ```ts
      export function injectFailureBetweenEvents(natsContainer: NatsContainerHandle, eventTypeToFail: string, failureType: 'consumer-crash' | 'publish-fail'): InjectorHandle {
        // Set up un consumer NATS qui reçoit l'event puis crash/refuse à publier
        // Retourne InjectorHandle avec .restore() pour cleanup
      }
      ```
      Pour tests R11 (saga booking-payment partiellement échouée — Story 4.13 V1 chaos tests CI).
    - Tests `chaos.spec.ts` : test que disconnect + reconnect fonctionne (verifier client peut publish après), test pause + unpause DB (verifier query reprend)

13. **AC13 — Fixtures builders typés** : Given `packages/testing/src/fixtures/`, When je les ouvre, Then chaque fixture expose `build<Entity>(overrides?: Partial<Entity>): Entity` :
    - **`user.fixture.ts`** :
      ```ts
      export function buildUser(overrides: Partial<UserProfile> = {}): UserProfile {
        return {
          id: faker.string.uuid(),
          keycloakUserId: faker.string.uuid(),
          email: faker.internet.email(),
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          role: 'client',
          locale: 'fr',
          createdAt: faker.date.past(),
          updatedAt: new Date(),
          deletedAt: null,
          ...overrides,
        } as UserProfile;
      }
      export const buildPro = (overrides = {}) => buildUser({ role: 'pro', ...overrides });
      export const buildAdminModo = (overrides = {}) => buildUser({ role: 'admin-modo', ...overrides });
      export const buildAdminSuper = (overrides = {}) => buildUser({ role: 'admin-super', ...overrides });
      ```
    - **`listing.fixture.ts`**, **`booking.fixture.ts`**, **`order.fixture.ts`**, **`payment.fixture.ts`**, **`review.fixture.ts`** suivent le même pattern (utilisent `@faker-js/faker` pour valeurs réalistes)
    - **Conventions** :
      - `@faker-js/faker` (latest stable) pour valeurs aléatoires
      - Locale faker `fr` activée par default (génère noms FR — `Camille`, `Léa`, etc.)
      - Variants pré-buildés : `buildBookingPending()`, `buildBookingConfirmed()`, `buildBookingCancelled()` (au lieu de devoir specifier `status` à chaque fois)
      - **Money fields en cents** (cohérent ADR-014 + `@tukio/contracts/types/Money`) : `totalAmount: { amount: 80000, currency: 'EUR' }` (pas 800)
    - Tests `fixtures.spec.ts` : test build with no overrides → valid object, test overrides apply correctly

14. **AC14 — Custom Vitest matchers** : Given `packages/testing/src/matchers/`, When je les ouvre, Then :
    - **`to-match-envelope.matcher.ts`** :
      ```ts
      // Usage : expect(response).toMatchSuccessEnvelope({ data: { id: 'abc' } });
      //        expect(response).toMatchErrorEnvelope({ tukioCode: 'USER-NOT-FOUND-001', httpStatus: 404 });
      export const toMatchSuccessEnvelope: MatcherFunction = (received, expected) => {
        // Vérifier shape SuccessEnvelope (method, code, data, meta) + data match expected partial
      };
      export const toMatchErrorEnvelope: MatcherFunction = (received, expected: { tukioCode: string; httpStatus?: number }) => {
        // Vérifier shape ErrorEnvelope + tukioCode match
      };
      ```
    - **`to-be-uuid.matcher.ts`** : `expect(value).toBeUuid()` — match UUID v4 regex
    - **`to-be-iso-date.matcher.ts`** : `expect(value).toBeIsoDate()` — match ISO 8601 string
    - **`setup.ts`** : appelle `expect.extend({ toMatchSuccessEnvelope, toMatchErrorEnvelope, toBeUuid, toBeIsoDate })` — à importer dans `vitest.config.ts` `setupFiles`
    - **TypeScript declaration merging** : `matchers/types.d.ts` qui étend `Vi.Assertion` interface pour avoir l'autocompletion + type-safety
    - Tests `matchers.spec.ts` : pour chaque matcher, test cas valide + cas invalide

### Transversal

15. **AC15 — `package.json` `exports` exhaustifs pour les 3 packages** : Given les 3 `package.json`, When je les ouvre, Then les `exports` couvrent tous les subpaths (cf. Dev Notes §Subpath exports). Pas de barrel imports anti-pattern (lint `tukio/no-barrel-import-*` enforce — étendre Story 0.9 si besoin).

16. **AC16 — Tests + coverage** : Given les 3 packages, When je lance `pnpm --filter='@tukio/{api-client,i18n-client,testing}' test --coverage`, Then les tests passent (≥ 80 % coverage sur api-client + i18n-client, ≥ 70 % sur testing — testing a beaucoup d'I/O réel donc coverage plus difficile) :
    - **api-client** : tests via `axios-mock-adapter` ou `msw` — pas de gateway-api réel
    - **i18n-client** : tests via mocks Next.js (NextRequest, NextResponse, NextFetchEvent), formatters testés en isolation
    - **testing** : tests via vrais containers (auto-démarrés en CI), avec `globalSetup`/`globalTeardown` Vitest pour partage cross-files

17. **AC17 — Migration Story 0.7 + Story 0.8 vers tests réels** : Given les chaos tests de Story 0.7 (`packages/messaging/src/__tests__/chaos-nats-disconnect.spec.ts` qui était `it.skip()` faute de testcontainers) et le test E2E Story 0.8 (`apps/identity-svc/test/user.e2e-spec.ts` qui utilisait `nock` pour mock JWKS), When je les update :
    - **Story 0.7 chaos test** : remplacer `it.skip` par `it()` réel utilisant `startNatsContainer({ jetstream: true })` + `disconnectNatsForDuration` — test passe
    - **Story 0.8 E2E** : remplacer le mock `nock` JWKS par un vrai `startKeycloakContainer({ realm: 'tukio', importJsonPath: './test/fixtures/test-realm.json' })` qui démarre un Keycloak réel avec realm pré-importé. Génération JWT toujours via `jose.SignJWT` (pour avoir signature Tukio test predictable), mais validation JWKS contre vrai Keycloak.
    - **NB** : ces tests deviennent slow (10-20 s startup Keycloak). **Strategy CI** : containers démarrés en `globalSetup` Vitest (1 fois par test run, partagé cross-tests via `container-pool`)

## Tasks / Subtasks

- [ ] **Task 1 — Configurer les 3 `package.json` + Vitest** (AC: #15, #16)
  - [ ] 1.1 — `pnpm --filter=@tukio/api-client add axios @tanstack/react-query` (runtime)
  - [ ] 1.2 — `pnpm --filter=@tukio/api-client add react react-dom @tukio/contracts@workspace:* @tukio/auth-client@workspace:* @tukio/i18n-client@workspace:* --save-peer`
  - [ ] 1.3 — `pnpm --filter=@tukio/api-client add -D vitest @testing-library/react axios-mock-adapter @types/react jsdom`
  - [ ] 1.4 — `pnpm --filter=@tukio/i18n-client add next-intl@latest` (runtime)
  - [ ] 1.5 — `pnpm --filter=@tukio/i18n-client add react react-dom next @tukio/contracts@workspace:* --save-peer`
  - [ ] 1.6 — `pnpm --filter=@tukio/i18n-client add -D vitest @testing-library/react @types/react`
  - [ ] 1.7 — `pnpm --filter=@tukio/testing add testcontainers @testcontainers/postgresql @testcontainers/keycloak @faker-js/faker pg ioredis nats meilisearch @keycloak/keycloak-admin-client` (runtime — utilisé par services backend en devDeps)
  - [ ] 1.8 — `pnpm --filter=@tukio/testing add @tukio/contracts@workspace:* --save-peer`
  - [ ] 1.9 — `pnpm --filter=@tukio/testing add -D vitest @types/node typescript`
  - [ ] 1.10 — Mettre à jour les 3 `package.json` avec `exports` field exhaustifs (cf. Dev Notes §Subpath exports)

- [ ] **Task 2 — Implémenter `@tukio/api-client/client/`** (AC: #2, #3)
  - [ ] 2.1 — `client/types.ts` : `interface AxiosClientConfig`
  - [ ] 2.2 — `client/correlation-id-interceptor.ts` : génère + persiste `correlationId` en `sessionStorage` + injecte `X-Tukio-Correlation-Id` header
  - [ ] 2.3 — `client/csrf-interceptor.ts` : lit cookie `tukio-csrf-token` + injecte `X-CSRF-Token` header (utilise `@tukio/auth-client/cookies` Story 0.8)
  - [ ] 2.4 — `client/envelope-handler.ts` : `unwrapSuccessEnvelope`, `throwApiErrorFromEnvelope`
  - [ ] 2.5 — `client/axios-client.ts` : factory `createTukioApiClient(config)` qui wire tous les interceptors + retry logic
  - [ ] 2.6 — `types/api-error.ts` : class `ApiError` avec helpers `isValidationError()`, `isNotFound()`, etc.
  - [ ] 2.7 — Tests `__tests__/{envelope-handler,api-error}.spec.ts` + `client/__tests__/axios-client.spec.ts`

- [ ] **Task 3 — Implémenter `@tukio/api-client/providers/<QueryProvider>`** (AC: #4)
  - [ ] 3.1 — `providers/query-provider.tsx` : wrapper avec defaults Tukio (cf. AC4)
  - [ ] 3.2 — Test : test `QueryClient` créé avec defaults, test ApiError 4xx pas retry vs 5xx retry 2x

- [ ] **Task 4 — Implémenter `@tukio/api-client/types/query-keys.ts` + 7 hooks domaine** (AC: #5)
  - [ ] 4.1 — `types/query-keys.ts` : `QueryKeys` factory typée pour 7 domaines (catalog, booking, payment, messaging, review, identity, admin)
  - [ ] 4.2 — `hooks/catalog/use-search-listings.ts` : 1 hook complet exemple (pattern à dupliquer)
  - [ ] 4.3 — `hooks/booking/use-booking-detail.ts` : 1 hook complet
  - [ ] 4.4 — `hooks/payment/use-checkout.ts` : 1 mutation hook complet
  - [ ] 4.5 — `hooks/messaging/use-conversations.ts` : 1 hook stub (TODO Story 5.1)
  - [ ] 4.6 — `hooks/review/use-reviews.ts` : 1 hook stub (TODO Story 5.5)
  - [ ] 4.7 — `hooks/identity/use-profile.ts` : 1 hook complet
  - [ ] 4.8 — `hooks/admin/use-verifications.ts` : 1 hook stub (TODO Story 6.1)
  - [ ] 4.9 — Helper `createQueryHook<TParams, TResponse>(endpoint, queryKeyFactory)` factorize boilerplate
  - [ ] 4.10 — Tests `hooks/__tests__/hooks.spec.ts` : 1 test par hook complet (msw mock gateway-api)

- [ ] **Task 5 — Implémenter `@tukio/i18n-client/config/`** (AC: #6, #10)
  - [ ] 5.1 — `config/locales.ts` : LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, LOCALE_FLAGS, isLocale type guard
  - [ ] 5.2 — `config/time-zones.ts` : DEFAULT_TIME_ZONE
  - [ ] 5.3 — `config/next-intl.config.ts` : factory `createI18nRequestConfig(loadMessages)` Server Components
  - [ ] 5.4 — `hooks/use-current-locale.ts` : wrapper `useLocale()` next-intl typé
  - [ ] 5.5 — Tests `config/__tests__/locales.spec.ts` : isLocale type guard, exports values

- [ ] **Task 6 — Implémenter `@tukio/i18n-client/middleware/`** (AC: #7)
  - [ ] 6.1 — `middleware/create-i18n-middleware.ts` : factory `createTukioI18nMiddleware()` + helper `composeMiddlewares(...)`
  - [ ] 6.2 — Tests : test middleware redirect default locale, test composition avec auth middleware

- [ ] **Task 7 — Implémenter `@tukio/i18n-client/formatters/`** (AC: #8)
  - [ ] 7.1 — `formatters/date.ts` : formatDate, formatDateRange
  - [ ] 7.2 — `formatters/number.ts` : formatNumber, formatPercent
  - [ ] 7.3 — `formatters/currency.ts` : formatCurrency (cents → string)
  - [ ] 7.4 — `formatters/relative-time.ts` : formatRelativeTime (Intl.RelativeTimeFormat + best unit logic)
  - [ ] 7.5 — Tests `formatters/__tests__/formatters.spec.ts` : snapshots exhaustifs sur 2 locales × valeurs typiques

- [ ] **Task 8 — Implémenter `@tukio/i18n-client/components/`** (AC: #9)
  - [ ] 8.1 — `components/hreflang.tsx` : Server Component qui rend `<link rel="alternate" hreflang="fr|en|x-default">` + `<link rel="canonical">`
  - [ ] 8.2 — `components/locale-link.tsx` : `'use client'` wrapper sur next/link avec injection `/{locale}/` prefix
  - [ ] 8.3 — Tests `components/__tests__/components.spec.tsx`

- [ ] **Task 9 — Implémenter `@tukio/testing/testcontainers/` (5 helpers)** (AC: #11)
  - [ ] 9.1 — `testcontainers/postgres.helper.ts` : utilise `@testcontainers/postgresql`, expose url + getClient() + runMigrations(), reuse via container-pool
  - [ ] 9.2 — `testcontainers/nats.helper.ts` : utilise `testcontainers` NatsContainer (community), expose disconnect/reconnect (utilisé par chaos-helpers)
  - [ ] 9.3 — `testcontainers/redis.helper.ts` : utilise `testcontainers` RedisContainer (community ou GenericContainer + image redis:7)
  - [ ] 9.4 — `testcontainers/keycloak.helper.ts` : utilise `@testcontainers/keycloak`, expose getAdminClient() + import realm JSON helper
  - [ ] 9.5 — `testcontainers/meilisearch.helper.ts` : `GenericContainer('getmeili/meilisearch:v1.x')` + masterKey env
  - [ ] 9.6 — `testcontainers/container-pool.ts` : singleton pool `getOrCreate(serviceType, config)` + `cleanupAllContainers()` pour `globalTeardown`
  - [ ] 9.7 — Healthcheck wait pattern uniforme (Wait.forLogMessage ou Wait.forHttpStatusCode)

- [ ] **Task 10 — Implémenter `@tukio/testing/chaos/` (3 helpers)** (AC: #12)
  - [ ] 10.1 — `chaos/nats-disconnect.helper.ts` : `disconnectNatsForDuration(container, durationMs)`
  - [ ] 10.2 — `chaos/db-failure.helper.ts` : `pauseDbForDuration(container, durationMs)` via `dockerContainer.pause/unpause`
  - [ ] 10.3 — `chaos/saga-partial-failure.helper.ts` : `injectFailureBetweenEvents(...)` avec InjectorHandle.restore()
  - [ ] 10.4 — Tests `chaos/__tests__/chaos.spec.ts` : test chaque scenario (slow tests, marqués `@chaos` pour CI séparé optionnel)

- [ ] **Task 11 — Implémenter `@tukio/testing/fixtures/` (6 builders)** (AC: #13)
  - [ ] 11.1 — `fixtures/user.fixture.ts` : buildUser, buildPro, buildAdminModo, buildAdminSuper, buildClient
  - [ ] 11.2 — `fixtures/listing.fixture.ts`
  - [ ] 11.3 — `fixtures/booking.fixture.ts` : buildBooking + variants pré-buildés (Pending, Confirmed, Cancelled, Completed)
  - [ ] 11.4 — `fixtures/order.fixture.ts` : buildOrder + buildOrderWithLineItems
  - [ ] 11.5 — `fixtures/payment.fixture.ts` : buildPaymentIntent + buildRefund
  - [ ] 11.6 — `fixtures/review.fixture.ts` : buildReview + buildReviewWithBreakdown
  - [ ] 11.7 — Configurer `@faker-js/faker` locale `fr` par default dans `fixtures/index.ts`
  - [ ] 11.8 — Tests `fixtures/__tests__/fixtures.spec.ts` : valid object, overrides apply correctly

- [ ] **Task 12 — Implémenter `@tukio/testing/matchers/` (3 matchers + setup)** (AC: #14)
  - [ ] 12.1 — `matchers/to-match-envelope.matcher.ts` : `toMatchSuccessEnvelope` + `toMatchErrorEnvelope`
  - [ ] 12.2 — `matchers/to-be-uuid.matcher.ts`
  - [ ] 12.3 — `matchers/to-be-iso-date.matcher.ts`
  - [ ] 12.4 — `matchers/setup.ts` : `expect.extend(...)` à importer dans `vitest.config.ts` `setupFiles`
  - [ ] 12.5 — `matchers/types.d.ts` : TypeScript declaration merging pour autocomplete
  - [ ] 12.6 — Tests `matchers/__tests__/matchers.spec.ts`

- [ ] **Task 13 — Migrer Story 0.7 chaos test + Story 0.8 E2E** (AC: #17)
  - [ ] 13.1 — Mettre à jour `packages/messaging/src/__tests__/chaos-nats-disconnect.spec.ts` (Story 0.7 task 10) : remplacer `it.skip` par `it()` réel utilisant `startNatsContainer` + `disconnectNatsForDuration` du `@tukio/testing`
  - [ ] 13.2 — Mettre à jour `apps/identity-svc/test/user.e2e-spec.ts` (Story 0.8 task 12.6) : option A — garder `nock` mock (rapide pour CI quotidien) + ajouter un nouveau test `user.e2e-realkc.spec.ts` qui utilise `startKeycloakContainer` (slow, run en CI nightly seulement). Option B — migrer 100 % vers testcontainers. **Décision Story 0.9 : Option A** (perf CI préservée), documentée
  - [ ] 13.3 — Créer `apps/identity-svc/test/fixtures/test-realm.json` (export realm Keycloak avec users de test, role mapping)

- [ ] **Task 14 — Documenter README + smoke** (AC: tous)
  - [ ] 14.1 — `packages/api-client/README.md` (≤ 2 pages) : usage `<QueryProvider>`, hooks pattern, error handling avec ApiError
  - [ ] 14.2 — `packages/i18n-client/README.md` : middleware setup, formatters, hreflang, locale routing
  - [ ] 14.3 — `packages/testing/README.md` : testcontainers setup (globalSetup), fixtures, matchers, chaos helpers
  - [ ] 14.4 — `pnpm --filter='@tukio/{api-client,i18n-client,testing}' test --coverage` → tous passent
  - [ ] 14.5 — `pnpm lint && pnpm typecheck` à la racine → tout passe
  - [ ] 14.6 — Commit `feat(libs): @tukio/api-client (TanStack Query + envelope) + @tukio/i18n-client (next-intl shared) + @tukio/testing (testcontainers + fixtures + chaos helpers)` — Story 0.9 done

## Dev Notes

### Pourquoi cette story est la 9ᵉ — contexte stratégique

> **Sources canoniques** : Architecture lignes 2202-2241 (3 packages structures) + PRD NFR56-60 (i18n) + PRD §Stack frontend (lignes 700-721) + Stories 0.2 + 0.7 + 0.8 dev context.

Les 3 libs sont **indépendantes** mais regroupées dans une seule story car (1) chacune est small-to-medium (1 lib seul ne justifie pas une story complète), (2) elles sont **toutes consommées par les apps frontend ou les tests backend Stories Epic 1+** dès leurs premières features, (3) leur livraison ensemble permet une cohérence Sprint 0 (mêmes versions, mêmes patterns subpath exports, mêmes setup tests).

**Densité Sprint 0 — choix assumé** : Story 0.9 est la story Sprint 0 la plus dense (~85 fichiers à créer pour les 3 libs). Justification : sinon, 3 stories distinctes (0.9a, 0.9b, 0.9c) auraient diluité l'effort sans bénéfice. Le dev qui prend Story 0.9 doit être à l'aise avec frontend (TanStack Query + next-intl) ET backend (testcontainers). Si pas un fullstack senior, **proposer split** en 3 mini-stories.

**Décisions techniques majeures** :
1. **`@tukio/api-client` est `'use client'` partout** (sauf `<Hreflang>` Server Component dans i18n-client) — TanStack Query est client-only par nature. Pour SSR/RSC server-side fetch, utiliser le pattern next-intl `getRequestConfig` + `fetch` direct côté Server Components (pas via api-client).
2. **`@tukio/i18n-client` strictement `next-intl` 4.x** — pas de couche d'abstraction. Architecture figée (PRD §Stack frontend ligne 705) : `next-intl` est la stack i18n. Wrapping minimal pour partager config + formatters cross-apps.
3. **`@tukio/testing` est backend-only** — utilise `testcontainers` (Node-only, pas de browser). Frontend tests utilisent jsdom (Stories 0.4/0.5 setup déjà fait).
4. **`testcontainers` containers réutilisés cross-tests** via `container-pool` singleton + Vitest `globalSetup`/`globalTeardown` — sinon démarrage Keycloak (10-20s) répété par test = catastrophe perf CI.
5. **`@faker-js/faker` locale `fr` par default** dans fixtures — génère noms FR réalistes (cohérent business Pays de la Loire MVP). Override via `faker.locale = 'en'` si besoin.
6. **Migration tests Stories 0.7 + 0.8** vers testcontainers réels = AC17. Pas optionnelle : valide le chaos test NATS (R13) et le test E2E auth (Keycloak réel). Stratégie CI : tests rapides via mocks + tests slow via testcontainers en CI nightly séparé.

### Versions à utiliser (latest stable au moment du Sprint 0)

| Lib | Rôle | Version cible |
|---|---|---|
| **`axios`** | HTTP client (api-client) | latest stable (1.x) |
| **`@tanstack/react-query`** | TanStack Query (api-client) | latest stable **5.x** (NB : 5.x renomme `cacheTime` → `gcTime`, `useQuery({ queryFn })` interface changes vs 4.x) |
| **`axios-mock-adapter`** | Tests api-client mocks | latest stable |
| **`msw`** | (alternative) Mock Service Worker pour tests | latest stable — choisir avec axios-mock-adapter selon préférence dev |
| **`next-intl`** | i18n (i18n-client) | latest stable **4.x** (NB : Server Components-aware, `getRequestConfig` pattern figé v3+) |
| **`testcontainers`** | Containers tests (testing) | latest stable (10.x) |
| **`@testcontainers/postgresql`** | Helper PG | latest stable |
| **`@testcontainers/keycloak`** | Helper Keycloak | latest stable. **Vérifier compat Keycloak 25** au moment du dev — si lib derrière, utiliser `GenericContainer('quay.io/keycloak/keycloak:25.x')` |
| **`@faker-js/faker`** | Test data builders | latest stable (8.x — locale fr supportée nativement) |
| **`@keycloak/keycloak-admin-client`** | Admin Keycloak (testing helpers) | latest stable, version mineure align avec serveur 25 |

> ⚠️ **TanStack Query 5.x breaking changes** : `cacheTime` → `gcTime`, `useQuery` ne prend plus de 2nd argument fonction (toujours objet config). Documenter migration patterns dans README.
>
> ⚠️ **`next-intl` 4.x vs 3.x** : `getRequestConfig` pattern stable depuis v3, mais des breaking dans le middleware config. Vérifier `pnpm view next-intl version` et adapter si v5+ existe.
>
> ⚠️ **`@testcontainers/keycloak`** : si lib pas maintenue, fallback sur `GenericContainer('quay.io/keycloak/keycloak:25')` avec startup command custom (`start-dev`).

### Project Structure cible (cohérent Architecture lignes 2202-2241)

Voir AC1 pour la structure exhaustive des 3 packages.

### Subpath exports (3 `package.json` blocs)

> Étend les Stories 0.2-0.8 patterns. Subpath exports stricts pour tree-shaking.

**`packages/api-client/package.json`** :
```json
{
  "name": "@tukio/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client/axios-client.ts",
    "./client/envelope": "./src/client/envelope-handler.ts",
    "./types": "./src/types/index.ts",
    "./types/api-error": "./src/types/api-error.ts",
    "./types/query-keys": "./src/types/query-keys.ts",
    "./providers": "./src/providers/query-provider.tsx",
    "./hooks/catalog": "./src/hooks/catalog/index.ts",
    "./hooks/catalog/*": "./src/hooks/catalog/*.ts",
    "./hooks/booking": "./src/hooks/booking/index.ts",
    "./hooks/booking/*": "./src/hooks/booking/*.ts",
    "./hooks/payment": "./src/hooks/payment/index.ts",
    "./hooks/payment/*": "./src/hooks/payment/*.ts",
    "./hooks/messaging": "./src/hooks/messaging/index.ts",
    "./hooks/review": "./src/hooks/review/index.ts",
    "./hooks/identity": "./src/hooks/identity/index.ts",
    "./hooks/admin": "./src/hooks/admin/index.ts"
  }
}
```

**`packages/i18n-client/package.json`** :
```json
{
  "name": "@tukio/i18n-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/config/locales.ts",
    "./config/next-intl": "./src/config/next-intl.config.ts",
    "./middleware": "./src/middleware/create-i18n-middleware.ts",
    "./formatters": "./src/formatters/index.ts",
    "./formatters/date": "./src/formatters/date.ts",
    "./formatters/number": "./src/formatters/number.ts",
    "./formatters/currency": "./src/formatters/currency.ts",
    "./formatters/relative-time": "./src/formatters/relative-time.ts",
    "./components/hreflang": "./src/components/hreflang.tsx",
    "./components/locale-link": "./src/components/locale-link.tsx",
    "./hooks/use-current-locale": "./src/hooks/use-current-locale.ts"
  }
}
```

**`packages/testing/package.json`** :
```json
{
  "name": "@tukio/testing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./testcontainers": "./src/testcontainers/index.ts",
    "./testcontainers/postgres": "./src/testcontainers/postgres.helper.ts",
    "./testcontainers/nats": "./src/testcontainers/nats.helper.ts",
    "./testcontainers/redis": "./src/testcontainers/redis.helper.ts",
    "./testcontainers/keycloak": "./src/testcontainers/keycloak.helper.ts",
    "./testcontainers/meilisearch": "./src/testcontainers/meilisearch.helper.ts",
    "./testcontainers/pool": "./src/testcontainers/container-pool.ts",
    "./chaos": "./src/chaos/index.ts",
    "./chaos/nats-disconnect": "./src/chaos/nats-disconnect.helper.ts",
    "./chaos/db-failure": "./src/chaos/db-failure.helper.ts",
    "./chaos/saga-partial-failure": "./src/chaos/saga-partial-failure.helper.ts",
    "./fixtures": "./src/fixtures/index.ts",
    "./fixtures/user": "./src/fixtures/user.fixture.ts",
    "./fixtures/listing": "./src/fixtures/listing.fixture.ts",
    "./fixtures/booking": "./src/fixtures/booking.fixture.ts",
    "./fixtures/order": "./src/fixtures/order.fixture.ts",
    "./fixtures/payment": "./src/fixtures/payment.fixture.ts",
    "./fixtures/review": "./src/fixtures/review.fixture.ts",
    "./matchers": "./src/matchers/setup.ts",
    "./matchers/types": "./src/matchers/types.d.ts"
  }
}
```

### Pattern code — `axios-client.ts` factory (squelette)

```ts
// packages/api-client/src/client/axios-client.ts (squelette)
import axios, { AxiosInstance, AxiosError } from 'axios';
import { unwrapSuccessEnvelope, throwApiErrorFromEnvelope } from './envelope-handler';
import { applyCorrelationIdInterceptor } from './correlation-id-interceptor';
import { applyCsrfInterceptor } from './csrf-interceptor';
import type { AxiosClientConfig } from './types';
import { ApiError } from '../types/api-error';

export function createTukioApiClient(config: AxiosClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    withCredentials: true,
    timeout: config.timeout ?? 10_000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  applyCorrelationIdInterceptor(client);
  applyCsrfInterceptor(client);

  // Envelope unwrap (success)
  client.interceptors.response.use(
    (response) => {
      response.data = unwrapSuccessEnvelope(response.data);
      return response;
    },
    async (error: AxiosError) => {
      if (error.response?.data) {
        throwApiErrorFromEnvelope(error.response.data as any);
      }
      // Network error / timeout → retry logic ici (cf. AC2)
      throw error;
    }
  );

  return client;
}
```

### Critical Architecture Constraints

> Cf. Architecture lignes 700-721 + PRD NFR56-60 + memories `feedback_*.md`.

1. **`@tukio/api-client` `'use client'` strict** : tous les hooks + provider sont client-only (TanStack Query nature). Pour SSR Server Components, utiliser `fetch` direct + `next/cache`.
2. **`@tukio/i18n-client` mix Server + Client Components** : `<Hreflang>` est Server Component (rendu dans `<head>`), `<LocaleLink>` + hooks sont `'use client'`. Documenter clairement.
3. **`@tukio/testing` backend-only** : pas d'imports `react`, `next`, `@tanstack/*`. Pure Node.js + testcontainers.
4. **i18n-agnostic** dans api-client : header `X-Tukio-Locale` injecté via interceptor depuis `useCurrentLocale()` (i18n-client). Aucun string hardcodé.
5. **Money en cents partout** (cohérent ADR-014 + Story 0.2 `Money` type). `formatCurrency(80000, 'EUR', 'fr')` → `"800,00 €"`.
6. **Fixtures genere des UUIDs valides** + dates ISO 8601 valides (cohérent matchers `toBeUuid`, `toBeIsoDate`).
7. **TanStack Query 5.x renamed cacheTime → gcTime** (breaking depuis v4) — ne pas confondre.
8. **`next-intl` Server Components-aware** : utiliser `getTranslations` (server) ou `useTranslations` (client) selon contexte. La lib `@tukio/i18n-client` ne wrap pas ces APIs (re-exports natifs suffit).
9. **Anti-barrel** : tous les imports via subpath strict (`@tukio/api-client/hooks/booking/use-booking-detail`). Pas de `import { useBookingDetail } from '@tukio/api-client'` (lint enforce — extension Story 0.9 du `tukio/no-barrel-import-*`).
10. **PII redaction** : `<QueryProvider>` `mutations.onError` ne doit PAS log les payloads complets (PII). Utiliser `error.tukioCode` + `error.correlationId` uniquement. Story 0.12 wire Sentry avec `beforeSend` redaction.

### What this story does NOT do (out of scope)

- ❌ **Hooks complets pour les 7 domaines (35+ hooks)** → Stories Epic 1+ ajoutent au fur et à mesure. Story 0.9 livre **1 hook par domaine** (7 au total) comme template + helper `createQueryHook` factorisé.
- ❌ **Webhook gateway-api setup** → Stories Epic 1+
- ❌ **Server-side rendering complete avec dehydrate/hydrate** → Story Epic 3+ (search SSR critique pour SEO)
- ❌ **Tests Playwright e2e complets** (Story 0.5 a fait 4 parcours UI patterns ; Story Epic 1+ ajoutera des e2e end-to-end avec api-client réel)
- ❌ **Chaos tests CI séparés** (`@chaos` tag + run nightly) → Story 0.11 (CI setup)
- ❌ **Sentry wiring** dans `<QueryProvider>` mutations.onError → Story 0.12 (observability)
- ❌ **Translations content** dans `messages/fr.json` + `messages/en.json` des 4 apps → Stories Epic 1+ (chaque feature ajoute ses keys)
- ❌ **Helpers ICU MessageFormat custom** (pluralisation complexe, gender, etc.) → next-intl natif suffit, pas de wrapper
- ❌ **Storybook stories pour LocaleSwitcher** → V1+

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `packages/{api-client,i18n-client,testing}/package.json` — placeholders Story 0.1, ajouter deps + `exports`
> - `packages/messaging/src/__tests__/chaos-nats-disconnect.spec.ts` (Story 0.7) — remplacer `it.skip` par `it()` réel utilisant `@tukio/testing`
> - `apps/identity-svc/test/user.e2e-spec.ts` (Story 0.8) — créer `user.e2e-realkc.spec.ts` complémentaire avec testcontainer Keycloak
> - `tools/eslint-plugin-tukio/src/rules/` — ajouter `no-barrel-import-api-client.js`, `no-barrel-import-i18n-client.js`, `no-barrel-import-testing.js` (étend pattern Story 0.3)

> **À CREATE** :
> - **api-client** : ~25 fichiers (client + types + 7 domaines hooks + provider + tests)
> - **i18n-client** : ~15 fichiers (config + middleware + formatters + components + hooks + tests)
> - **testing** : ~30 fichiers (5 testcontainers helpers + 3 chaos + 6 fixtures + 3 matchers + container-pool + tests)
> - **3 README** + setup files
> - **1 fixture realm Keycloak** (`apps/identity-svc/test/fixtures/test-realm.json`)
> - **Estimation total fichiers créés** : ~80-90 fichiers

### Previous Story Intelligence (Stories 0.1 → 0.8)

**Story 0.2** : `@tukio/contracts/envelope` (SuccessEnvelope, ErrorEnvelope, ErrorBody, ValidationIssue) consommée par `envelope-handler` Story 0.9 + matchers `toMatchEnvelope`. `@tukio/contracts/dtos/...` consommés par les hooks api-client.

**Story 0.6** : `apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts` retourne `UserProfileResponseDto` (DTO nu, wrapped en `SuccessEnvelope` par interceptor). `useProfile()` hook Story 0.9 attend ce shape.

**Story 0.7** : `chaos-nats-disconnect.spec.ts` était `it.skip` faute de testcontainers — Story 0.9 task 13.1 le réactive avec `@tukio/testing/chaos/nats-disconnect`.

**Story 0.8** : `@tukio/auth-client/cookies` exposait `addCsrfHeader()` helper — Story 0.9 `csrf-interceptor` l'utilise. `@tukio/auth-client/middleware` `KeycloakAuthMiddleware` — Story 0.9 `composeMiddlewares()` permet de chain avec i18n middleware. `apps/identity-svc/test/user.e2e-spec.ts` mockait JWKS via `nock` — Story 0.9 ajoute version testcontainers Keycloak réel.

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.9 |
|---|---|---|
| EN strict | tous les fichiers + types en EN | ✅ |
| camelCase JS/TS | `useBookingDetail`, `formatCurrency` | ✅ |
| Subpath exports stricts | jamais barrel | ✅ exports field exhaustifs |
| Money en cents | `Intl.NumberFormat(.../100)` | ✅ formatCurrency |
| ISO 8601 dates | partout | ✅ matchers + fixtures |
| UUID v4 | matchers + fixtures | ✅ |
| Locale BCP 47 lowercase | `'fr'`, `'en'` | ✅ |
| `Money = { amount, currency }` | cohérent ADR-014 | ✅ fixtures |
| TanStack Query 5.x API | `gcTime` (pas `cacheTime`) | ✅ |
| next-intl Server Components-aware | `getRequestConfig` pattern | ✅ |
| Coverage NFR71 | api-client + i18n-client ≥ 80 %, testing ≥ 70 % | ✅ |
| i18n-agnostic dans libs (sauf i18n-client) | labels en props avec defaults EN | ✅ api-client neutre |

### Testing Standards

- **Coverage cible** :
  - `@tukio/api-client` : ≥ 80 % (lib pure mockable)
  - `@tukio/i18n-client` : ≥ 80 % (formatters faciles à tester, middleware testable via mocks)
  - `@tukio/testing` : ≥ 70 % (containers réels = slow, mais essentiel ; certains chaos helpers difficile à 100 %)
- **Framework** : Vitest 3.x (cohérent Stories 0.2-0.8).
- **Niveaux de tests** :
  - **api-client** : msw ou axios-mock-adapter pour mocks gateway-api
  - **i18n-client** : mocks Next.js (NextRequest, NextResponse) + tests formatters isolation
  - **testing** : tests **avec vrais containers** (testcontainers Docker) — nécessite Docker daemon up sur la machine dev/CI
- **CI strategy** : tests `@tukio/testing` peuvent être slow (~30s pour démarrer Keycloak) — recommander `globalSetup` Vitest qui démarre containers 1 fois par test run

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 2202-2241 (3 packages structures).

✅ **Aligné** avec PRD NFR56-60 (i18n).

✅ **Aligné** avec Stories 0.2 (envelope types), 0.7 (chaos test), 0.8 (cookieManager + middleware).

⚠️ **Décision documentée** : `@tukio/api-client` ne wrap pas TanStack Query — re-export natif (`export * from '@tanstack/react-query'`) côté barrel + customisation via `<QueryProvider>`. Justification : abstraction zéro-cost.

⚠️ **Décision documentée** : `@tukio/i18n-client` est intentionnellement minimal — wrapper config + formatters + composants helpers, mais ne ré-exporte pas les hooks `useTranslations`/`getTranslations` next-intl (les apps les importent directement). Justification : pas de couche d'abstraction qui cache les APIs natives.

⚠️ **Décision documentée** : `@tukio/testing` est consommée en `devDependencies` par tous les services backend. Pas de runtime usage. Documenter clairement (le package n'est PAS publié npm-style).

⚠️ **À noter** : la migration des tests Stories 0.7 + 0.8 vers testcontainers réels (AC17) est **conditionnelle au Docker daemon** disponible en local + CI. Si CI a des contraintes (ex: GitHub Actions free tier), garder fallback sur mocks (nock, pg-mem) en parallèle. Documenter dans Debug Log References.

⚠️ **À noter** : `@testcontainers/keycloak` peut être derrière le serveur Keycloak 25 (lib lib publiée pour 23/24 typiquement). Si breaking, fallback `GenericContainer('quay.io/keycloak/keycloak:25.0')` avec `start-dev` command + wait for `Keycloak ... started` log.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées-api-client — Lines 2216-2227 (packages/api-client/src structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées-i18n-client — Lines 2229-2233 (packages/i18n-client/src structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées-testing — Lines 2202-2206 (packages/testing/src structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle-Optimization — Lines 956-962 (anti-barrel imports, dynamic imports lourds)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Stack-frontend — Lines 700-721 (next-intl, TanStack Query, Zod, Tailwind anti-patterns)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Response-Format-Enveloppe-REST-canonique — Lines 1252-1505 (envelope ADR-014 consommée par api-client)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication-Patterns — Lines 1572-1611 (DomainEvent envelope)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tests-location — Lines 1238-1242 (testcontainers pour intégration)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.9 — Lines 986-999 (6 ACs originaux : api-client + i18n-client + testing)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR56-60 — i18n (zero hardcoded, traductions en CI, hreflang, templates email FR/EN, Meilisearch index par locale)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR45 — retries exponentiels + circuit breaker timeout 3s]
- [Source: _bmad-output/planning-artifacts/prd.md#FR99-100 — saisie pro FR obligatoire + EN optionnel + badge fallback]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 dev context (envelope types consommés par api-client)]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — Story 0.7 dev context (chaos test à réactiver Story 0.9)]
- [Source: _bmad-output/implementation-artifacts/0-8-setup-tukio-auth-backend-frontend.md — Story 0.8 dev context (cookieManager, KeycloakAuthMiddleware composé avec i18n middleware)]
- [External: https://tanstack.com/query/v5/docs (TanStack Query 5.x docs — gcTime renaming etc.)]
- [External: https://next-intl-docs.vercel.app/docs/getting-started (next-intl 4.x setup pattern)]
- [External: https://testcontainers.com/modules/postgresql/ (testcontainers PostgreSQL helper)]
- [External: https://testcontainers.com/modules/keycloak/ (testcontainers Keycloak helper)]
- [External: https://www.keycloak.org/server/importExport (Keycloak realm import for testing)]
- [Memory: feedback_latest_versions.md]
- [Memory: feedback_clean_architecture_explicit.md]
- [Memory: feedback_api_envelope_response.md — envelope ADR-014 consommée par api-client]
- [Memory: feedback_i18n_frontend.md — i18n FR/EN dès Sprint 0]
- [Memory: feedback_tech_layer_english.md]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent)

### Debug Log References

(à remplir — versions retenues TanStack Query/next-intl/testcontainers/@testcontainers/keycloak, fallback GenericContainer si nécessaire, choix axios-mock-adapter vs msw, stratégie CI Docker daemon, décision Option A vs B pour migration test E2E Story 0.8)

### Completion Notes List

(à remplir — résumé décisions, déviations, points d'attention pour Stories Epic 1+ qui ajouteront 35+ hooks api-client + i18n setup dans les 4 apps + pattern testcontainers réutilisé partout)

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 6-8 jours (3 libs en parallèle, ~85 fichiers, migration tests Stories 0.7 + 0.8)
- **Dépendances upstream** :
  - Story 0.2 (`@tukio/contracts`) — types envelope + DTOs consommés
  - Story 0.6 (`identity-svc` UserController) — `UserProfileResponseDto` shape consommé par `useProfile()`
  - Story 0.7 (`@tukio/messaging` chaos test) — réactivé via `@tukio/testing/chaos/nats-disconnect`
  - Story 0.8 (`@tukio/auth-client` cookieManager + middleware) — consommé par `csrf-interceptor` + `composeMiddlewares()`
- **Dépendances downstream** :
  - **Story 0.10** (Docker Compose) — fournit Docker daemon local pour testcontainers
  - **Stories Epic 1+ (toutes les stories frontend)** : consomment hooks api-client + i18n config + LocaleSwitcher
  - **Stories Epic 1+ (toutes les stories backend)** : consomment testcontainers helpers + fixtures + matchers
  - **Story 0.11** (CI) — branche `globalSetup` Vitest pour testcontainers + tag `@chaos` pour CI nightly
  - **Story 0.12** (Observability) — wire Sentry dans `<QueryProvider>` mutations.onError
- **FRs covered** : aucun FR direct (foundational)
- **NFRs touchés** :
  - **NFR56** — zéro hardcoded text (préparé via i18n-client) ✅
  - **NFR57** — traductions FR + EN dans CI (préparé) ✅
  - **NFR58** — locale-prefix URLs + hreflang ✅ (Hreflang component + middleware)
  - **NFR59** — préparé (templates Resend Story 5.4)
  - **NFR60** — Meilisearch index par locale (préparé, finalisé Story 3.7)
  - **NFR45** — retries exponentiels (axios-client) ✅
  - **NFR67** — patterns figés ✅
  - **NFR71** — coverage 80/70 thresholds ✅
  - **R11/R12/R13** — chaos helpers livrés pour mitigation ✅
