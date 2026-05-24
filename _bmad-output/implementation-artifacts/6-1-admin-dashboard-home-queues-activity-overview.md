# Story 6.1: Admin dashboard home (queues counts + activity overview) + admin app foundation (FR89, NFR82, NFR9, NFR50)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As an** Admin Tukio (rôle `admin-support`, `admin-modo` ou `admin-super`),
**I want** un **dashboard home centralisé** sur `admin.tukio.one/{locale}/` qui affiche en **grid responsive desktop-only** (UX-DR admin) les **queues nécessitant attention** + les **KPI plateforme 24h** : (1) Pro Verifications pending (Story 2.3 cross-svc identity-svc), (2) Listings pending_moderation (Story 6.2 cross-svc catalog-svc), (3) Reviews pending_moderation auto-hidden (Story 5.7 review-svc baseline `status='pending_moderation'`), (4) Reports open breakdown par type (Story 6.4 cross-svc identity-svc reports table), (5) Saga alerts active (Story 4.13 baseline saga-watchdog), (6) KPI Today (new pros 24h + new bookings 24h + new transactions 24h cross-svc booking-svc/order-svc) + 2 cards EXCLUSIVES `admin-super` : (7) Admin accounts (Story 6.7) + (8) Audit log activity last 24h (Story 6.6) — **RBAC 3 roles strict** : `admin-support` read-only consultation only (peut voir queues mais boutons modération désactivés), `admin-modo` accès actions modération Stories 6.2-6.5, `admin-super` accès complet + 2 cards exclusive — **admin-2fa-totp Story 1.7 baseline enforced** sur tous endpoints admin (KeycloakJwtGuard + `acr_values=mfa` claim required, redirect to `/login?reauth=mfa` si missing),

**So that** un Admin sait **immédiatement quoi traiter en priorité** dès qu'il se connecte (signal queues actionable + KPI plateforme health) — l'**admin app scaffolding** (`<AdminLayout>` + `<AdminSidebar>` + `<AdminTopBar>` + `<QueueCountCard>` + `<KpiCard>`) est **réutilisable par Stories 6.2-6.8** (Listings/Reviews/Reports moderation queues + Suspend/Ban + Audit log + Admin user mgmt + Taxonomy editor) — **RBAC 3 roles strict** garantit sécurité multi-niveaux (support consult, modo moderate, super admin tout) — admin-2fa-totp Story 1.7 enforced empêche compromis compte admin via vol JWT seul — **Epic 6 kick-off Sprint 8 démarre** sur fondation solide (4ème app frontend admin scaffold + cross-svc aggregation pattern + RBAC strict + UX-DR mvp-admin sidebar layout).

Story 6.1 livre :

- (a) **`<AdminLayout>` foundation component NEW** Story 6.1 baseline réutilisable Stories 6.2-6.8 :
  - `apps/admin/src/components/AdminLayout.tsx` NEW — sidebar vertical left (240px width fixe desktop) + topbar 56px height + main content scrollable
  - **`<AdminSidebar>`** : vertical nav avec items conditional render selon role :
    - `admin-support` voit : Dashboard, Verifications, Listings moderation, Reviews moderation, Reports, Saga alerts (all read-only)
    - `admin-modo` voit en plus : actions activées (suspend/hide etc. Stories 6.2-6.5)
    - `admin-super` voit en plus : Admin accounts (Story 6.7) + Taxonomy editor (Story 6.8) + Audit log full view (Story 6.6)
    - Active state highlighting via Next.js `usePathname()` + Tailwind v4 `data-active` state
    - Icons via `lucide-react` (Story 0.4 baseline) : `Home`, `Shield`, `Package`, `Star`, `Flag`, `Activity`, `Users`, `Settings`, `FileText`
  - **`<AdminTopBar>`** : breadcrumb left + user dropdown right + `<LocaleSwitcher>` Story 7.x baseline reused + notification bell stub (V1+ feature)
  - **`<UserDropdown>`** : displayName + role badge `<Badge variant="info">` ("Support" / "Modérateur" / "Super Admin") + "Mon profil" link `/account/profile` Story 1.8 baseline + "Déconnexion" CTA → POST `/v1/auth/logout` Story 1.4 baseline + redirect `/login`
  - **Responsive desktop-only** : `<DesktopOnlyGuard>` component qui render `<Alert variant="warning">` "Cette interface admin est conçue pour desktop uniquement. Veuillez utiliser un écran ≥ 1024px." si viewport < 1024px (admin tools = desktop usage uniquement)
  - **A11y RGAA AA** : `<nav role="navigation" aria-label="Admin navigation">` + sidebar items `<Link>` Story 0.4 baseline + skip-to-main-content link + keyboard focus visible + ARIA `aria-current="page"` on active nav item

- (b) **Dashboard home page** `apps/admin/src/app/[locale]/page.tsx` NEW Server Component :
  - Server Component fetch via `@tukio/api-client/server` `getAdminDashboardSummary()` → renvoie 8 fields counts + KPI 24h
  - Server-side RBAC check via Keycloak JWT — si pas admin role → redirect `/login`
  - Pass data to `<DashboardClient>` Client Component (hydrate TanStack Query)
  - Render grid responsive `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4` Tailwind v4
  - 8 `<QueueCountCard>` rendered conditional selon role (super voit +2)

- (c) **`<QueueCountCard>` NEW reusable component** Story 6.1 baseline réutilisable Stories 6.2-6.8 :
  - Props : `{ title, count, breakdown?: { label, count }[], ctaLabel, ctaHref, icon: LucideIcon, variant: 'default' | 'warning' | 'danger', isReadOnly?: boolean }`
  - Render `<Card>` Story 0.4 atom + icon + title + count badge `<Badge variant>` + breakdown list (optional 3 sub-items max) + CTA `<Button as={Link} href={ctaHref}>` "Voir la queue" → si `isReadOnly === true` → CTA "Consulter (read-only)"
  - Visual variant : `default` neutral gray-100 + `warning` amber-50 si count > threshold (e.g. > 10 verifications pending) + `danger` red-50 si count > critical threshold (e.g. > 5 saga alerts)
  - Loading state skeleton via Story 0.4 baseline
  - Animation `prefers-reduced-motion` respect

- (d) **`<KpiCard>` NEW reusable component** :
  - Props : `{ label: string, value: number, trend?: '+5%' | '-2%' | '=', period: 'today' | 'last-24h' | 'last-7d' }`
  - Compact card 1 ligne value + trend arrow `<TrendingUp>` / `<TrendingDown>` / `<Minus>` icon + period text
  - Story 6.1 render 3 KPI : new pros today + new bookings today + new transactions today

- (e) **Gateway-api `GET /v1/admin/dashboard-summary` endpoint NEW** :
  - Controller `apps/gateway-api/src/admin/admin-dashboard.controller.ts` NEW
  - `@UseGuards(KeycloakJwtGuard, AdminMfaGuard, RolesGuard)` — `AdminMfaGuard` NEW Story 6.1 enforce `acr_values=mfa` claim required Story 1.7 baseline (Keycloak Required Action TOTP) — si missing → 401 with `error.code: 'AUTH-MFA-REQUIRED-001'` + redirect frontend `/login?reauth=mfa`
  - `@Roles('admin-support', 'admin-modo', 'admin-super')` (3 admin roles allowed)
  - `@Throttle({ adminDashboard: { limit: 60, ttl: 60_000 } })` (admin moderate frequency — refresh dashboard ok)
  - **Aggregation 5 cross-svc parallel `Promise.all`** :
    - identity-svc `GET /internal/admin/pro-verifications-count` (Story 2.3 baseline endpoint EXTEND OR NEW Story 6.1)
    - catalog-svc `GET /internal/admin/listings-pending-moderation-count` (Story 6.2 STUB endpoint Story 6.1 livre baseline)
    - review-svc `GET /internal/admin/reviews-pending-moderation-count` (Story 5.7 baseline `status='pending_moderation'` count)
    - identity-svc `GET /internal/admin/reports-open-count` + breakdown (Story 6.4 baseline + Story 6.1 endpoint NEW)
    - order-svc `GET /internal/admin/saga-alerts-active-count` (Story 4.13 baseline `saga-health` endpoint réutilisé) + booking-svc 24h KPIs + payment-svc 24h transactions
  - InternalServiceGuard HMAC body-sha256 Story 1.2b baseline pour cross-svc calls
  - Response envelope ADR-014 :
    ```json
    {
      "method": "GET",
      "code": 200,
      "data": {
        "queues": {
          "proVerificationsPending": 7,
          "listingsPendingModeration": 12,
          "reviewsPendingModeration": 3,
          "reportsOpen": 4,
          "reportsBreakdown": { "inappropriate": 2, "fake": 1, "off_topic": 1 },
          "sagaAlertsActive": 1,
          "adminAccountsCount": 8,
          "auditLog24h": 142
        },
        "kpi24h": {
          "newPros": 3,
          "newBookings": 28,
          "newTransactionsTotal": 4250.50
        }
      },
      "meta": { "timestamp": "...", "correlationId": "..." }
    }
    ```
  - Cross-svc fallback : si un service down (Story 4.13 saga-health endpoint pas répondu) → field set `null` avec warning log + dashboard render `<Card variant="danger">` "Service indisponible — réessayez plus tard"
  - Performance : aggregation parallel `Promise.all` ~50ms p95 (5 internal calls × 10ms each parallèle)

- (f) **5 cross-svc internal endpoints NEW (un par svc concerné)** :
  - `apps/identity-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW (Story 1.10 baseline EXTEND) : `GET /internal/admin/pro-verifications-count` (réutilise Story 2.3 baseline query) + `GET /internal/admin/reports-open-count` (Story 6.4 STUB Story 6.1 livre count baseline) + `GET /internal/admin/admin-accounts-count` (admin-super only — Story 6.7 STUB)
  - `apps/catalog-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : `GET /internal/admin/listings-pending-moderation-count` (Story 6.2 STUB baseline)
  - `apps/review-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : `GET /internal/admin/reviews-pending-moderation-count` (réutilise Story 5.7 `status='pending_moderation'` query)
  - `apps/order-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW (Story 4.13 baseline `saga-health` EXTEND) : `GET /internal/admin/saga-alerts-active-count` (Story 4.13 baseline réutilisé)
  - `apps/booking-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : `GET /internal/admin/kpi-24h` (returns `{ newPros, newBookings, newTransactionsTotal }` via cross-aggregation queries)
  - All endpoints `InternalServiceGuard` HMAC + envelope ADR-014

- (g) **`AdminMfaGuard` NEW** dans `apps/gateway-api/src/auth/guards/admin-mfa.guard.ts` :
  - Custom `@Injectable()` NestJS guard extends `KeycloakJwtGuard` Story 1.4 baseline pattern
  - Inspect JWT claims : `acr_values` claim must contain `mfa` (Keycloak ACR — Authentication Context Class Reference)
  - Si `acr === '1'` (password only) OR no `acr` claim → throw `AuthMfaRequiredException` (`AUTH-MFA-REQUIRED-001`) → gateway maps to 401 + custom header `WWW-Authenticate: MFA required` + frontend mappe sur redirect `/login?reauth=mfa`
  - Si `acr === '2'` ou `'mfa'` (TOTP completed Story 1.7 baseline) → allow
  - Apply guard to ALL admin endpoints (Story 6.1 livre baseline guard, Stories 6.2-6.8 réutilisent)
  - Tests unit 4 scenarios (no acr → 401, acr=1 → 401, acr=2 → 200, malformed JWT → 401)

- (h) **NEW NATS event `admin.dashboard.viewed.v1`** — STUB Story 6.1 (audit_log Story 2.7 baseline consume — pas critical mais traçabilité) :
  - Schema `packages/contracts/src/events/admin/dashboard-viewed.v1.{schema.json,ts}` strict Zod `{ adminUserId, role, viewedAt, correlationId }`
  - Emit dans `GetAdminDashboardSummaryUseCase` (NEW gateway-api side) — chaque page view dashboard = 1 event (volume modéré ~10/jour par admin)
  - Pas applicable réellement queues views (Stories 6.2-6.5 emit `admin.queue.viewed.v1` separate event quand queue opened with filter — Story 6.1 baseline reserve schema)

- (i) **Frontend hooks `@tukio/api-client/hooks/admin/` 1 NEW** :
  - `useAdminDashboardSummary()` `useQuery` `GET /v1/admin/dashboard-summary` + 30s `staleTime` (admin dashboard polling moderate fresh — pas critical real-time) + `refetchOnWindowFocus: true` (admin returns to tab → re-fetch fresh counts) + initialData SSR hydration

- (j) **Admin app foundation Next.js 16 App Router scaffolding** :
  - `apps/admin/src/app/[locale]/layout.tsx` NEW — wraps children avec `<AdminLayout>` + `<AdminMfaGate>` Server Component (server-side JWT check `acr_values=mfa` — redirect `/login?reauth=mfa` si missing)
  - `apps/admin/src/middleware.ts` NEW — next-intl locale-prefix routing Story 7.x baseline (ou Story 1.2d baseline pattern réutilisé) + auth-gate Story 1.8 baseline réutilisé (admin role required + redirect `/login` si missing)
  - `apps/admin/src/app/[locale]/page.tsx` dashboard home (cf. b)
  - `apps/admin/src/app/[locale]/login/page.tsx` NEW — admin login page (réutilise Story 1.4 baseline auth flow + admin-2fa-totp Story 1.7 enforced)
  - `apps/admin/src/app/[locale]/login/reauth-mfa/page.tsx` NEW — page redirected when MFA required mais user has only password auth → trigger Keycloak `kc_action=update-totp` flow Story 1.7 baseline

- (k) **i18n FR/EN ~25 strings** dans `apps/admin/messages/{fr,en}/dashboard.json` NEW namespace + `apps/admin/messages/{fr,en}/admin-layout.json` NEW namespace :
  - `dashboard.page_title` "Tableau de bord admin"
  - `dashboard.queues_section_title` "Files d'attente"
  - `dashboard.kpi_section_title` "Activité plateforme (24h)"
  - `dashboard.queue.pro_verifications.title` "Vérifications Pro en attente"
  - `dashboard.queue.listings_pending.title` "Fiches en modération"
  - `dashboard.queue.reviews_pending.title` "Avis auto-masqués"
  - `dashboard.queue.reports_open.title` "Signalements ouverts"
  - `dashboard.queue.saga_alerts.title` "Alertes saga"
  - `dashboard.queue.admin_accounts.title` "Comptes admin"
  - `dashboard.queue.audit_log.title` "Activité audit 24h"
  - `dashboard.queue.cta_view` "Voir la queue"
  - `dashboard.queue.cta_view_readonly` "Consulter (read-only)"
  - `dashboard.kpi.new_pros` "Nouveaux Pros"
  - `dashboard.kpi.new_bookings` "Nouvelles réservations"
  - `dashboard.kpi.new_transactions` "Volume transactions"
  - `dashboard.kpi.period_today` "Aujourd'hui"
  - `admin_layout.nav.dashboard` "Tableau de bord"
  - `admin_layout.nav.verifications` "Vérifications"
  - `admin_layout.nav.listings` "Fiches"
  - `admin_layout.nav.reviews` "Avis"
  - `admin_layout.nav.reports` "Signalements"
  - `admin_layout.nav.saga` "Saga alerts"
  - `admin_layout.nav.admin_accounts` "Comptes admin"
  - `admin_layout.nav.audit_log` "Journal audit"
  - `admin_layout.nav.taxonomy` "Taxonomie"
  - `admin_layout.user_dropdown.profile` "Mon profil"
  - `admin_layout.user_dropdown.logout` "Déconnexion"
  - `admin_layout.role_badge.support` "Support"
  - `admin_layout.role_badge.modo` "Modérateur"
  - `admin_layout.role_badge.super` "Super Admin"
  - `admin_layout.desktop_only_warning` "Cette interface admin est conçue pour desktop uniquement. Veuillez utiliser un écran ≥ 1024px."
  - `admin_layout.mfa_required.title` "Authentification MFA requise"
  - `admin_layout.mfa_required.cta_setup` "Configurer mon authentificateur"

- (l) **A11y RGAA AA + Lighthouse Accessibility ≥ 90** : sidebar nav `aria-current` + skip-to-main + keyboard navigation strict (Tab order rationnel sidebar → main → topbar) + focus visible + `<Card>` `role="region"` + `<QueueCountCard>` `aria-label` localized + axe-core 0 violations sur dashboard page

- (m) **Apps/admin Next.js 16 app NEW scaffolding** (foundation pour Stories 6.2-6.8) :
  - `apps/admin/package.json` + `tsconfig.json` + `next.config.mjs` (Story 0.13b multi-zones baseline réutilisé ADR-016) + `tailwind.config.ts` (Story 0.3 baseline) + `Dockerfile` multi-stage + docker-compose `admin` service port 3003
  - `apps/admin/src/app/[locale]/{layout,page}.tsx` + middleware + features structure
  - 4ème frontend Next.js confirmé (post-ADR-016 = 3 frontends — public + seller + admin) — `admin.tukio.one` subdomain
  - Verify `pnpm-workspace.yaml` includes `apps/admin/*` (already in `apps/*` glob)

- (n) **Tests** :
  - **Playwright E2E 6 scenarios** : (1) admin-support login + MFA → dashboard render all queues read-only, (2) admin-modo → actions buttons enabled, (3) admin-super → +2 cards Admin accounts + Audit log, (4) viewport < 1024px → DesktopOnlyGuard warning, (5) JWT without MFA acr → redirect `/login?reauth=mfa`, (6) one cross-svc down → dashboard renders other cards + error card for down svc
  - **axe-core 0 violations** + Lighthouse Accessibility ≥ 90 sur dashboard page
  - **Hooks unit 3 scenarios** MSW (useAdminDashboardSummary + initial data hydration + refetch on focus)
  - **Gateway E2E 7 scenarios** : 200 admin-support / 200 admin-modo / 200 admin-super avec +2 fields / 401 no JWT / 401 no MFA acr / 403 non-admin role / 429 throttle
  - **Integration testcontainer 5 scenarios** : 5 cross-svc internal endpoints (1 per svc happy + 1 cross-svc down fallback null)
  - **AdminMfaGuard unit 4 scenarios** : valid acr / acr=1 / no acr / malformed JWT

**So that** Epic 6 Admin Moderation Console démarre Sprint 8 sur **fondation admin app scaffolded** (`<AdminLayout>` + `<AdminSidebar>` + `<AdminTopBar>` + `<QueueCountCard>` + `<KpiCard>` réutilisables Stories 6.2-6.8) — Admin se connecte → MFA Story 1.7 baseline enforced → dashboard home avec 6-8 cards selon role → click card → naviguer vers queue spécifique (Stories 6.2-6.5 livrent les queues) — RBAC 3 roles strict sécurise multi-niveaux (support consult + modo moderate + super tout) — Epic 6 kick-off réussi avec **4ème frontend admin scaffold complet** (foundation Sprint 8 Stories 6.2-6.8 livrables sans refactor admin app structure).

> **Outcome attendu** : à la fin de cette story, un Admin authentifié sur `https://admin.tukio.one/fr/` (avec MFA TOTP Story 1.7 baseline complete) → voit `<AdminLayout>` sidebar gauche + topbar avec user dropdown affichant "John D. — Super Admin" + main content grid 8 `<QueueCountCard>` (queues counts) + 3 `<KpiCard>` KPI Today + click "Vérifications Pro en attente (7)" card → navigate `/fr/verifications` Story 2.3 baseline page ; un `admin-support` voit même dashboard mais CTAs "Consulter (read-only)" + zero action button activé ; un `admin-modo` voit actions buttons Stories 6.2-6.5 ; un `admin-super` voit +2 cards "Comptes admin (8)" + "Activité audit 24h (142)" ; un user qui passe à viewport tablette < 1024px → `<DesktopOnlyGuard>` warning visible ; un user qui auth password-only sans TOTP → redirect `/login?reauth=mfa` + Keycloak `kc_action=update-totp` flow ; `pnpm lint && typecheck && test --coverage` exit 0 maintained NFR71 ; `sprint-status.yaml` flip Story 6.1 = ready-for-dev → done.

## Acceptance Criteria

1. **AC1 — Admin app foundation Next.js 16 scaffolding (4ème frontend) + middleware locale-prefix + auth-gate** : Given Story 0.13b multi-zones baseline + Story 1.4/1.8 auth-gate pattern, When Story 6.1 livre `apps/admin/` scaffolding : (a) `apps/admin/package.json + tsconfig.json + next.config.mjs + tailwind.config.ts + Dockerfile + .env.example` ; (b) `apps/admin/src/app/[locale]/{layout,page,login}.tsx` + `middleware.ts` (next-intl Story 7.x pattern + auth-gate admin role required) ; (c) docker-compose update ADD `admin` service port 3003 ; (d) pnpm-workspace.yaml verify already glob ; (e) Verify `pnpm --filter=admin dev` boot ok + Storybook (V1+ optional). Tests : `docker compose up admin` healthy.

2. **AC2 — `<AdminLayout>` + `<AdminSidebar>` + `<AdminTopBar>` + `<UserDropdown>` + `<DesktopOnlyGuard>` reusable foundation** : Given Story 0.4 atoms baseline, When Story 6.1 NEW : (a) `<AdminLayout>` wraps children sidebar+main+topbar ; (b) `<AdminSidebar>` 240px width fixed desktop + 9 nav items conditional render selon role + active state `usePathname()` + Tailwind v4 `data-active` + lucide-react icons ; (c) `<AdminTopBar>` 56px height + breadcrumb + `<UserDropdown>` (displayName + `<Badge>` role + Mon profil link + Déconnexion CTA) + `<LocaleSwitcher>` reused ; (d) `<DesktopOnlyGuard>` render `<Alert variant="warning">` si viewport < 1024px (admin desktop-only UX) ; (e) A11y `<nav aria-label>` + skip-to-main + `aria-current="page"`. Tests RTL 5 scenarios.

3. **AC3 — Dashboard home page Server Component + 8 cards + 3 KPI conditional role render** : Given Story 6.1 admin app foundation, When Server Component `apps/admin/src/app/[locale]/page.tsx` render : (a) Server-side fetch `getAdminDashboardSummary()` via `@tukio/api-client/server` + Server-side RBAC check ; (b) Pass data to `<DashboardClient>` Client Component (TanStack Query hydrate) ; (c) Render grid `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4` Tailwind v4 ; (d) **3 roles conditional render** : `admin-support` → 6 queue cards + 3 KPI cards (CTAs disabled "Consulter (read-only)") ; `admin-modo` → 6 queue cards + 3 KPI cards (actions activées Stories 6.2-6.5) ; `admin-super` → **8 queue cards + 3 KPI cards** (+2 exclusive Admin accounts + Audit log) ; (e) Loading state skeletons Story 0.4 baseline. Tests Playwright E2E 3 role scenarios.

4. **AC4 — `<QueueCountCard>` + `<KpiCard>` reusable components Story 6.1 baseline pour Stories 6.2-6.8** : Given Story 0.4 `<Card>` atom + lucide-react icons, When Story 6.1 NEW :
   - `<QueueCountCard>` props : `{ title, count, breakdown?, ctaLabel, ctaHref, icon, variant: 'default'|'warning'|'danger', isReadOnly?: boolean }` — variant logic auto-set : `count > 10 → 'warning'` + `count > 50 OR isSagaAlert > 0 → 'danger'` + breakdown 3 sub-items max
   - `<KpiCard>` props : `{ label, value, trend?, period: 'today'|'last-24h'|'last-7d' }` — render value + trend arrow + period text
   - Both components ARIA `role="region"` + `aria-labelledby` + keyboard focus visible
   - Story 6.1 reuse pour Stories 6.2-6.8 (sidebar links lead to queue pages que Stories 6.2-6.5 livrent + Audit log Story 6.6 etc.)
   - Tests RTL 4 scenarios per component (default + warning + danger + readonly + KPI 3 periods)

5. **AC5 — Gateway-api `GET /v1/admin/dashboard-summary` + AdminMfaGuard + RolesGuard + Throttler + cross-svc aggregation parallel** : Given gateway-api Story 1.4 baseline + Story 1.2c forwarder, When Story 6.1 NEW : (a) `apps/gateway-api/src/admin/admin-dashboard.controller.ts` NEW + `@UseGuards(KeycloakJwtGuard, AdminMfaGuard, RolesGuard)` + `@Roles('admin-support', 'admin-modo', 'admin-super')` + `@Throttle({ adminDashboard: { limit: 60, ttl: 60_000 } })` ; (b) `GetAdminDashboardSummaryUseCase` NEW orchestrate parallel `Promise.all([identitySvcClient.getProVerifications(), catalogSvcClient.getListingsPending(), reviewSvcClient.getReviewsPending(), identitySvcClient.getReportsOpen(), orderSvcClient.getSagaAlerts(), bookingSvcClient.getKpi24h()])` ; (c) Aggregation response shape cf. section (e) above ; (d) **Conditional fields admin-super** : aggregated response includes `adminAccountsCount + auditLog24h` only si `req.user.role === 'admin-super'` (Story 6.7/6.6 baseline) ; (e) Cross-svc fallback : if any service down → field set `null` + log warning + dashboard render error card for down svc ; (f) Performance : aggregation parallel ~50ms p95 (5 internal calls × 10ms parallèle). Tests E2E 7 scenarios (3 roles + 401 + 401 MFA + 403 non-admin + 429).

6. **AC6 — `AdminMfaGuard` NEW custom guard + `acr_values=mfa` claim check Story 1.7 enforced** : Given Story 1.7 baseline admin-2fa-totp obligatoire + Keycloak ACR claim, When Story 6.1 NEW :
   - `apps/gateway-api/src/auth/guards/admin-mfa.guard.ts` NEW `@Injectable()` + custom `canActivate(context): boolean`
   - Inspect JWT decoded `acr` claim : si `acr === '1'` (password only) OR no acr → throw `AuthMfaRequiredException` (`AUTH-MFA-REQUIRED-001`) → gateway maps to 401 with `WWW-Authenticate: MFA required` header
   - Frontend EnvelopeExceptionFilter Story 1.2c P4 baseline maps to envelope error `{ code: 'AUTH-MFA-REQUIRED-001', message: '...' }` → frontend hook `useAdminDashboardSummary` onError → router.push(`/login?reauth=mfa`)
   - Si `acr === '2'` ou `'mfa'` (TOTP completed Story 1.7) → allow
   - Apply guard to ALL admin endpoints (Story 6.1 livre baseline, Stories 6.2-6.8 réutilisent automatically)
   - Tests unit 4 scenarios (valid acr=2 → 200 + acr=1 → 401 + no acr → 401 + malformed JWT → 401)

7. **AC7 — 5 cross-svc internal `/internal/admin/*-count` endpoints NEW** : Given Stories 2.3 / 5.7 / 4.13 baselines + Story 1.10 controller pattern, When Story 6.1 livre :
   - `apps/identity-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : 3 endpoints `GET /internal/admin/pro-verifications-count` (Story 2.3 baseline réutilisé) + `GET /internal/admin/reports-open-count` + breakdown (Story 6.4 STUB Story 6.1 livre count baseline schema) + `GET /internal/admin/admin-accounts-count` (Story 6.7 STUB)
   - `apps/catalog-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : `GET /internal/admin/listings-pending-moderation-count` (Story 6.2 STUB)
   - `apps/review-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : `GET /internal/admin/reviews-pending-moderation-count` (réutilise Story 5.7 baseline `status='pending_moderation'`)
   - `apps/order-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : `GET /internal/admin/saga-alerts-active-count` (Story 4.13 baseline saga-health endpoint EXTEND OR new aggregation)
   - `apps/booking-svc/src/infrastructure/controllers/internal-admin.controller.ts` NEW : `GET /internal/admin/kpi-24h` (returns aggregated `{ newProsCount, newBookingsCount, newTransactionsTotalCents }` via Postgres queries last 24h)
   - All endpoints `InternalServiceGuard` HMAC Story 1.2b + envelope ADR-014 + Pretre usecases pattern
   - Tests E2E 5 scenarios (1 per svc happy)

8. **AC8 — Frontend hook `useAdminDashboardSummary()` + SSR hydration + onError MFA redirect** : Given Story 5.x baseline hooks pattern, When Story 6.1 NEW : (a) `packages/api-client/src/hooks/admin/use-admin-dashboard-summary.ts` `useQuery` + 30s `staleTime` + `refetchOnWindowFocus: true` + initialData SSR ; (b) `onError(error)` if `error.code === 'AUTH-MFA-REQUIRED-001'` → `router.push('/login?reauth=mfa')` ; (c) Mirror types `packages/api-client/src/types/admin.ts` (DashboardSummaryResponse). Tests unit 3 scenarios MSW.

9. **AC9 — NEW NATS event `admin.dashboard.viewed.v1` STUB + audit_log Story 2.7 consume** : Given Story 2.7 baseline audit_log consumer pattern Story 1.10 Phasetwo replication, When Story 6.1 :
   - NEW schema `packages/contracts/src/events/admin/dashboard-viewed.v1.{schema.json,ts}` strict Zod `{ adminUserId, role, viewedAt, correlationId }`
   - `GetAdminDashboardSummaryUseCase` emit event via outbox each page view (~10 events/jour/admin moderate volume)
   - Story 2.7 audit_log consumer Story 1.10 baseline EXTEND consume new event subject `admin.dashboard.viewed.v1` → INSERT audit row
   - Tests Zod parse + audit consumer integration 2 scenarios

10. **AC10 — i18n FR/EN ~30 strings admin namespaces + zero hardcoded** : Given Story 1.2d next-intl pattern, When Story 6.1 NEW :
    - NEW `apps/admin/messages/{fr,en}/dashboard.json` + `admin-layout.json` namespaces ~30 strings × 2 locales = 60 strings
    - ICU plural for `dashboard.queue.*.count` si applicable (FR + EN parité Story 5.4 baseline pattern)
    - Verify lint no hardcoded text NFR56-57

11. **AC11 — A11y RGAA AA + axe-core 0 + Lighthouse Accessibility ≥ 90 + admin desktop-only UX** : Given Story 0.4/0.5 baseline a11y, When Story 6.1 render :
    - `<nav role="navigation" aria-label="Admin navigation">` sidebar + skip-to-main-content link + Tab order rationnel (sidebar → main → topbar)
    - `<QueueCountCard>` `role="region"` + `aria-labelledby` + keyboard focus visible
    - `<DesktopOnlyGuard>` `role="alert"` warning si viewport < 1024px
    - Lighthouse Accessibility ≥ 90 + axe-core 0 violations sur dashboard page
    - Tests Playwright axe-core 2 specs + Lighthouse CI

12. **AC12 — RBAC 3 admin roles enforcement (support/modo/super) + tests verify each role** : Given Story 1.1 baseline Keycloak roles + Story 1.4 RolesGuard, When Story 6.1 RBAC :
    - `admin-support` : voit toutes queues mais boutons modération désactivés + CTA "Consulter (read-only)" + dashboard limité à 6 queues + 3 KPI (no admin-super exclusive)
    - `admin-modo` : voit toutes queues + actions modération enabled + dashboard limité à 6 queues + 3 KPI
    - `admin-super` : voit toutes queues + actions + **8 queues** (+2 exclusive Admin accounts + Audit log) + 3 KPI + Taxonomy editor (Story 6.8 sidebar nav)
    - Backend enforcement via `@Roles()` decorator gateway + conditional response fields admin-super
    - Frontend enforcement via `user.role` from session context + conditional render
    - Defense in depth : backend ne renvoie pas fields si role pas suffisant (e.g. `adminAccountsCount: undefined` si pas admin-super), frontend ne render pas cards si user.role pas admin-super (double check)
    - Tests Playwright 3 role scenarios + Gateway E2E 3 role scenarios

## Tasks / Subtasks

- [ ] **Task 1 — Apps/admin Next.js 16 app NEW scaffolding (foundation 4ème frontend)** (AC: #1)
  - [ ] 1.1 — NEW `apps/admin/package.json + tsconfig.json + next.config.mjs + tailwind.config.ts + .env.example + Dockerfile`
  - [ ] 1.2 — NEW `apps/admin/src/middleware.ts` (next-intl + auth-gate admin role required + admin-2fa-totp acr check)
  - [ ] 1.3 — NEW `apps/admin/src/app/[locale]/{layout,page,login}/page.tsx` + login/reauth-mfa subpage
  - [ ] 1.4 — UPDATE `docker-compose.yml` ADD `admin` service port 3003
  - [ ] 1.5 — Verify `pnpm-workspace.yaml` includes `apps/admin/*`
  - [ ] 1.6 — Tests `docker compose up admin` healthy + Playwright E2E boot

- [ ] **Task 2 — `<AdminLayout>` + `<AdminSidebar>` + `<AdminTopBar>` + `<UserDropdown>` + `<DesktopOnlyGuard>`** (AC: #2)
  - [ ] 2.1 — NEW `apps/admin/src/components/AdminLayout.tsx`
  - [ ] 2.2 — NEW `apps/admin/src/components/AdminSidebar.tsx` (9 nav items conditional role)
  - [ ] 2.3 — NEW `apps/admin/src/components/AdminTopBar.tsx`
  - [ ] 2.4 — NEW `apps/admin/src/components/UserDropdown.tsx`
  - [ ] 2.5 — NEW `apps/admin/src/components/DesktopOnlyGuard.tsx`
  - [ ] 2.6 — A11y RGAA AA enforced (aria-current + skip-to-main + Tab order)
  - [ ] 2.7 — Tests RTL 5 scenarios + axe-core a11y

- [ ] **Task 3 — Dashboard home page Server Component + DashboardClient + grid + RBAC conditional render** (AC: #3)
  - [ ] 3.1 — UPDATE `apps/admin/src/app/[locale]/page.tsx` — Server Component fetch + RBAC check
  - [ ] 3.2 — NEW `apps/admin/src/features/dashboard/components/DashboardClient.tsx` (Client Component grid + hydrate)
  - [ ] 3.3 — RBAC conditional render 3 roles (support/modo/super)
  - [ ] 3.4 — Tests Playwright E2E 3 role scenarios

- [ ] **Task 4 — `<QueueCountCard>` + `<KpiCard>` reusable components** (AC: #4)
  - [ ] 4.1 — NEW `apps/admin/src/features/dashboard/components/QueueCountCard.tsx` (variant logic auto + breakdown)
  - [ ] 4.2 — NEW `apps/admin/src/features/dashboard/components/KpiCard.tsx` (value + trend + period)
  - [ ] 4.3 — Tests RTL 4 scenarios per component

- [ ] **Task 5 — Gateway-api `GET /v1/admin/dashboard-summary` + AdminMfaGuard + cross-svc aggregation** (AC: #5, #6)
  - [ ] 5.1 — NEW `apps/gateway-api/src/admin/admin-dashboard.controller.ts`
  - [ ] 5.2 — NEW `apps/gateway-api/src/admin/usecases/get-admin-dashboard-summary.usecase.ts` (parallel Promise.all 5 cross-svc + RBAC conditional fields + fallback null si svc down)
  - [ ] 5.3 — NEW 5 clients `apps/gateway-api/src/admin/clients/{identity,catalog,review,order,booking}-svc.client.ts` (axios + HMAC body-sha256 Story 1.2c)
  - [ ] 5.4 — NEW `apps/gateway-api/src/auth/guards/admin-mfa.guard.ts` (acr claim check)
  - [ ] 5.5 — NEW DTOs response types
  - [ ] 5.6 — UPDATE `throttler/throttler.config.ts` — add `adminDashboard: 60/min` scope
  - [ ] 5.7 — UPDATE `app.module.ts` wire AdminModule + AdminMfaGuard
  - [ ] 5.8 — Tests E2E 7 scenarios + AdminMfaGuard unit 4 scenarios

- [ ] **Task 6 — 5 cross-svc internal `/internal/admin/*` endpoints NEW** (AC: #7)
  - [ ] 6.1 — NEW `apps/identity-svc/src/infrastructure/controllers/internal-admin.controller.ts` (3 endpoints)
  - [ ] 6.2 — NEW `apps/catalog-svc/src/infrastructure/controllers/internal-admin.controller.ts` (1 endpoint)
  - [ ] 6.3 — NEW `apps/review-svc/src/infrastructure/controllers/internal-admin.controller.ts` (1 endpoint)
  - [ ] 6.4 — NEW `apps/order-svc/src/infrastructure/controllers/internal-admin.controller.ts` (1 endpoint)
  - [ ] 6.5 — NEW `apps/booking-svc/src/infrastructure/controllers/internal-admin.controller.ts` (1 endpoint KPI 24h)
  - [ ] 6.6 — NEW usecases per svc (count queries Pretre pattern)
  - [ ] 6.7 — InternalServiceGuard HMAC Story 1.2b applied
  - [ ] 6.8 — Tests E2E 5 scenarios

- [ ] **Task 7 — Frontend hook + types** (AC: #8)
  - [ ] 7.1 — NEW `packages/api-client/src/hooks/admin/use-admin-dashboard-summary.ts`
  - [ ] 7.2 — NEW `packages/api-client/src/types/admin.ts` (DashboardSummaryResponse types)
  - [ ] 7.3 — UPDATE `packages/api-client/src/hooks/index.ts` — export subpath admin/
  - [ ] 7.4 — Tests unit 3 scenarios MSW

- [ ] **Task 8 — NATS event `admin.dashboard.viewed.v1` + audit_log consumer EXTEND** (AC: #9)
  - [ ] 8.1 — NEW schema `packages/contracts/src/events/admin/dashboard-viewed.v1.{schema.json,ts}`
  - [ ] 8.2 — Emit event dans `GetAdminDashboardSummaryUseCase` outbox
  - [ ] 8.3 — UPDATE Story 2.7 audit_log consumer Story 1.10 pattern — consume new event
  - [ ] 8.4 — Tests integration 2 scenarios

- [ ] **Task 9 — i18n FR/EN ~30 strings + admin namespaces** (AC: #10)
  - [ ] 9.1 — NEW `apps/admin/messages/{fr,en}/dashboard.json` (16 strings × 2 locales)
  - [ ] 9.2 — NEW `apps/admin/messages/{fr,en}/admin-layout.json` (14 strings × 2 locales)
  - [ ] 9.3 — Verify no hardcoded text lint NFR56-57

- [ ] **Task 10 — A11y RGAA AA + axe-core + Lighthouse** (AC: #11)
  - [ ] 10.1 — `<nav>` ARIA + skip-to-main + Tab order
  - [ ] 10.2 — `<QueueCountCard>` + `<KpiCard>` ARIA roles
  - [ ] 10.3 — `<DesktopOnlyGuard>` role=alert
  - [ ] 10.4 — Tests Playwright axe-core 2 specs + Lighthouse CI 1 spec

- [ ] **Task 11 — RBAC 3 roles testing + defense in depth** (AC: #12)
  - [ ] 11.1 — Tests Playwright 3 role scenarios (support read-only + modo actions + super +2 cards)
  - [ ] 11.2 — Tests Gateway E2E 3 role scenarios + 401 + 403 + 429
  - [ ] 11.3 — Tests AdminMfaGuard 4 scenarios

- [ ] **Task 12 — Documentation + ADR updates** (no AC — docs)
  - [ ] 12.1 — NEW `docs/runbook/admin-app-bootstrap.md` (operator manual admin login + MFA + role assignment + Keycloak admin realm config)
  - [ ] 12.2 — UPDATE `docs/adr/0001-clean-architecture.md` — note Story 6.1 livre admin app foundation 4ème frontend Next.js 16
  - [ ] 12.3 — UPDATE `docs/adr/0006-saga-choreographed.md` — note Story 6.1 ajoute `admin.dashboard.viewed.v1` + `admin.queue.viewed.v1` STUB Stories 6.2-6.5
  - [ ] 12.4 — UPDATE `docs/project-context.md` — extend Admin section
  - [ ] 12.5 — UPDATE `AGENTS.md` Hard rules — add bullet "✅ admin-2fa-totp Story 1.7 baseline enforced sur tous endpoints admin + RBAC 3 roles strict"

- [ ] **Task 13 — Validation & Commit**
  - [ ] 13.1 — `pnpm lint && pnpm typecheck` 0 errors
  - [ ] 13.2 — `pnpm test --coverage` NFR71 maintained
  - [ ] 13.3 — Tests integration testcontainer green
  - [ ] 13.4 — Playwright E2E 6 scenarios + axe-core 0 + Lighthouse ≥ 90 green
  - [ ] 13.5 — `docker compose up admin` healthy + manual smoke test login + MFA + dashboard render
  - [ ] 13.6 — Commit `feat(admin,gateway-api,identity-svc,catalog-svc,review-svc,order-svc,booking-svc,api-client,contracts,docs): Story 6.1 admin dashboard home + admin app foundation 4ème frontend Next.js 16 + <AdminLayout> + <AdminSidebar> + <AdminTopBar> + <UserDropdown> + <DesktopOnlyGuard> + dashboard home page Server Component + <QueueCountCard> + <KpiCard> reusable + gateway /v1/admin/dashboard-summary parallel cross-svc aggregation 5 svc + AdminMfaGuard acr_values=mfa Story 1.7 enforced + 5 cross-svc internal /admin/*-count endpoints + RBAC 3 roles strict admin-support/modo/super + NEW event admin.dashboard.viewed.v1 + audit_log consumer EXTEND + ~30 i18n strings + a11y RGAA AA + axe-core 0 + Lighthouse 90 — **EPIC 6 KICK-OFF**`
  - [ ] 13.7 — PR title `Story 6.1 — Admin dashboard home + admin app foundation — EPIC 6 KICK-OFF` ; target `develop`

## Dev Notes

### Story 6.1 livre — Epic 6 kick-off

**Frontend admin app NEW (4ème frontend Next.js 16) :**

1. **Apps/admin scaffolding** : package.json + tsconfig + next.config + tailwind + Dockerfile + middleware + layout + page + login + login/reauth-mfa
2. **`<AdminLayout>` foundation réutilisable Stories 6.2-6.8** : `<AdminSidebar>` 9 nav items conditional role + `<AdminTopBar>` + `<UserDropdown>` + `<DesktopOnlyGuard>` viewport < 1024px warning
3. **Dashboard home page Server Component + RBAC conditional render 3 roles** : 6-8 cards selon role + 3 KPI Today
4. **`<QueueCountCard>` + `<KpiCard>` reusable** Story 6.1 baseline pour Stories 6.2-6.8

**Backend (gateway-api + 5 svc internal endpoints) :**

1. **Gateway `GET /v1/admin/dashboard-summary`** + `AdminMfaGuard` `acr_values=mfa` Story 1.7 enforced + RolesGuard 3 roles + Throttler 60/min + parallel cross-svc aggregation 5 calls `Promise.all` ~50ms p95
2. **`AdminMfaGuard` NEW custom guard** inspect JWT `acr` claim — réutilisable Stories 6.2-6.8 + autres admin endpoints futurs
3. **5 cross-svc internal endpoints `/internal/admin/*-count`** : identity-svc 3 + catalog-svc 1 + review-svc 1 + order-svc 1 + booking-svc 1 (KPI 24h)
4. **NEW NATS event `admin.dashboard.viewed.v1`** STUB + Story 2.7 audit_log consumer Story 1.10 pattern EXTEND

**Frontend hook + i18n** :

1. **NEW hook `useAdminDashboardSummary()`** + SSR hydration + onError MFA redirect
2. **~30 i18n strings × 2 locales** admin namespaces (dashboard + admin-layout)

**Tests : ~35 scenarios totale**

### Story 6.1 NE livre PAS (déféré Stories 6.2-6.8)

- ❌ **Listings moderation queue page** → **Story 6.2**
- ❌ **Reviews moderation queue page** → **Story 6.3**
- ❌ **Reports/Signalements queue page** → **Story 6.4**
- ❌ **Suspend/Ban account + sanction graduée** → **Story 6.5**
- ❌ **Audit log viewer + export full page** → **Story 6.6**
- ❌ **Admin user management page** → **Story 6.7**
- ❌ **Taxonomy editor page** → **Story 6.8**
- ❌ **`admin.queue.viewed.v1` event** (emit côté Stories 6.2-6.5) → **Stories 6.2-6.5** (Story 6.1 reserve schema STUB seulement)

### Dependencies inputs (Stories livrées)

| Story | Livrable réutilisé Story 6.1 |
|-------|--------------------------------|
| 0.2 | `@tukio/contracts` envelope + event schemas pattern |
| 0.3 | Tailwind v4 + Inter + Fraunces tokens |
| 0.4 | `<Card>` + `<Badge>` + `<Button>` + `<Alert>` + `<Link>` + lucide-react icons |
| 0.6 | Pretre scaffolding + envelope interceptor |
| 0.7 | `@tukio/messaging` OutboxPublisher + CorrelationContext |
| 0.9 | testcontainer helpers + axe-core Playwright |
| 0.11 | CI workflow + Lighthouse |
| 0.13b | Frontend multi-zones Vercel + Dockerfile pattern (admin = 4ème frontend) |
| 1.1 | **Keycloak realm baseline + 3 admin roles** (admin-support, admin-modo, admin-super) |
| 1.2c | gateway forwarder pattern (axios + axios-retry HMAC body-sha256) + ThrottlerModule scopes |
| 1.4 | **KeycloakJwtGuard + RolesGuard pattern** Story 6.1 EXTEND avec AdminMfaGuard |
| 1.7 | **admin-2fa-totp baseline** : Keycloak Required Action TOTP + `acr_values=mfa` claim Story 1.7 baseline — Story 6.1 enforce via AdminMfaGuard sur tous admin endpoints |
| 1.8 | `<AccountLayout>` Customer pattern référence (Story 6.1 reproduit pour AdminLayout) |
| 1.10 | identity-svc Pretre canonical + audit_log consumer pattern — Story 6.1 EXTEND admin endpoints + audit consumer |
| 2.3 | Pro verifications queue baseline (Story 6.1 réutilise count endpoint) |
| 4.13 | saga-watchdog `saga-health` endpoint Story 4.13 baseline réutilisé pour count |
| 5.7 | reviews `status='pending_moderation'` Story 5.7 baseline réutilisé pour count |
| 5.x | TanStack Query patterns hooks |

### Architecture compliance

- ✅ **ADR-001 Clean Architecture Pretre** : 5 cross-svc usecases respect Pretre baseline (orchestrate ports). Gateway-api orchestrate via forwarders.
- ✅ **ADR-003 DB per service** : Story 6.1 ne touche pas DB existing — pure read aggregation cross-svc via internal endpoints.
- ✅ **ADR-006 Saga choreographed** : Story 6.1 émet 1 NEW event `admin.dashboard.viewed.v1` + reserve schema `admin.queue.viewed.v1` STUB Stories 6.2-6.5.
- ✅ **ADR-007 Transactional outbox** : `GetAdminDashboardSummaryUseCase` emit event via outbox.
- ✅ **ADR-013 → ADR-016 frontend topology** : Story 6.1 livre `apps/admin` 4ème frontend confirmé `admin.tukio.one` subdomain (post-ADR-016 = 3 frontends mais admin distinct).
- ✅ **ADR-014 envelope REST canonique** : gateway endpoint wrap response.
- ✅ **NFR1 perfs reads** : aggregation parallel ~50ms p95.
- ✅ **NFR9 admin 2FA TOTP obligatoire** : AdminMfaGuard `acr_values=mfa` Story 1.7 baseline enforce strict sur tous admin endpoints.
- ✅ **NFR50/54 a11y** : RGAA AA + axe-core 0 + Lighthouse ≥ 90.
- ✅ **NFR56-57 zero hardcoded text** : ~60 i18n strings.
- ✅ **NFR71 coverage** : maintained.
- ✅ **NFR82 audit immutable** : `admin.dashboard.viewed.v1` event consumed Story 2.7 audit_log.

### File structure

```
apps/admin/                                                            (NEW Story 6.1 — 4ème frontend)
├── package.json + tsconfig.json + next.config.mjs + tailwind.config.ts + Dockerfile + .env.example
├── src/
│   ├── middleware.ts                                                   (auth-gate admin role + admin-2fa-totp acr check)
│   ├── app/[locale]/
│   │   ├── layout.tsx                                                  (wraps children + AdminLayout)
│   │   ├── page.tsx                                                    (dashboard home Server Component)
│   │   └── login/
│   │       ├── page.tsx                                                (admin login)
│   │       └── reauth-mfa/page.tsx                                     (Keycloak update-totp flow)
│   ├── components/
│   │   ├── AdminLayout.tsx
│   │   ├── AdminSidebar.tsx                                            (9 nav items conditional role)
│   │   ├── AdminTopBar.tsx
│   │   ├── UserDropdown.tsx
│   │   └── DesktopOnlyGuard.tsx
│   ├── features/dashboard/components/
│   │   ├── DashboardClient.tsx
│   │   ├── QueueCountCard.tsx                                          (reusable Stories 6.2-6.8)
│   │   └── KpiCard.tsx                                                 (reusable)
│   └── messages/{fr,en}/{dashboard,admin-layout}.json                   (~30 strings × 2 locales)

apps/gateway-api/src/
├── admin/
│   ├── admin-dashboard.controller.ts                                    (GET /v1/admin/dashboard-summary)
│   ├── usecases/get-admin-dashboard-summary.usecase.ts                  (parallel cross-svc aggregation)
│   ├── clients/{identity,catalog,review,order,booking}-svc.client.ts    (5 axios clients HMAC)
│   ├── dtos/dashboard-summary-response.dto.ts
│   └── admin.module.ts
├── auth/guards/admin-mfa.guard.ts                                       (NEW acr_values=mfa check)
├── throttler/throttler.config.ts                                        (UPDATE — adminDashboard 60/min)
└── app.module.ts                                                         (UPDATE wire AdminModule)

apps/identity-svc/src/infrastructure/controllers/internal-admin.controller.ts  (NEW 3 endpoints)
apps/catalog-svc/src/infrastructure/controllers/internal-admin.controller.ts   (NEW 1 endpoint)
apps/review-svc/src/infrastructure/controllers/internal-admin.controller.ts    (NEW 1 endpoint)
apps/order-svc/src/infrastructure/controllers/internal-admin.controller.ts     (NEW 1 endpoint)
apps/booking-svc/src/infrastructure/controllers/internal-admin.controller.ts   (NEW 1 endpoint KPI 24h)

packages/api-client/src/
├── hooks/admin/use-admin-dashboard-summary.ts                           (NEW)
├── hooks/index.ts                                                       (UPDATE subpath exports)
└── types/admin.ts                                                       (NEW DashboardSummaryResponse)

packages/contracts/src/events/admin/
├── dashboard-viewed.v1.{schema.json,ts}                                 (NEW Story 6.1)
└── queue-viewed.v1.{schema.json,ts}                                     (STUB Stories 6.2-6.5)

docker-compose.yml                                                         (UPDATE ADD admin service port 3003)

docs/
├── runbook/admin-app-bootstrap.md                                        (NEW operator manual)
├── adr/0001-clean-architecture.md                                        (UPDATE Implementation Notes)
├── adr/0006-saga-choreographed.md                                        (UPDATE — 2 NEW events)
└── project-context.md                                                    (UPDATE Admin section)

AGENTS.md                                                                  (UPDATE Hard rules admin-2fa-totp + RBAC 3 roles)
```

### Lib / framework choices

| Lib | Usage Story 6.1 | Version | Why |
|-----|------------------|---------|-----|
| Next.js 16 App Router | Admin app foundation Server Component + middleware | latest (Story 0.13b baseline) | 4ème frontend confirmé `admin.tukio.one` |
| Tailwind v4 | UI tokens + grid responsive | latest (Story 0.3 baseline) | Réutilisé brand tokens |
| `@tukio/ui` Card + Badge + Button + Alert + Link | UI atoms | workspace (Story 0.4 baseline) | Réutilisés |
| `lucide-react` | Icons sidebar + cards (`<Home>`, `<Shield>`, etc.) | latest (Story 0.4 baseline) | Standard icons |
| TanStack Query | useQuery + initialData SSR hydration | latest (Story 0.9 baseline) | Cache pattern |
| `next-intl` | locale-prefix routing + ~30 i18n strings | latest (Story 7.x baseline ou Story 1.2d) | FR/EN parité |
| NestJS 11 + `@nestjs/platform-fastify` | gateway-api endpoint | latest (Story 0.6 baseline) | Pretre canonical |
| Zod | DTO validation | latest | No class-validator |
| axios + axios-retry | 5 cross-svc clients gateway HMAC | latest (Story 1.2c baseline) | Réutilisé |
| Playwright + axe-core | E2E + a11y | latest (Story 0.11 baseline) | NFR50/54 |

### Previous Story Intelligence (1.7 + 1.4 + 1.2c + 2.3 + 5.7 + 4.13)

- **Story 1.7 admin-2fa-totp** : Keycloak Required Action TOTP + `acr_values=mfa` claim — Story 6.1 enforce via `AdminMfaGuard` custom guard inspecting JWT acr
- **Story 1.4 KeycloakJwtGuard + RolesGuard** : pattern réutilisé + extended avec AdminMfaGuard
- **Story 1.2c gateway forwarder** : axios + axios-retry + HMAC body-sha256 pattern réutilisé pour 5 cross-svc clients
- **Story 2.3 Pro verifications queue baseline** : count endpoint réutilisé via cross-svc
- **Story 5.7 reviews status='pending_moderation'** : count endpoint réutilisé
- **Story 4.13 saga-watchdog `saga-health` endpoint** : EXTEND ou réutilisé pour saga alerts count

### Project Context Reference

- **PRD §FR84-90** — Admin moderation actions (Stories 6.2-6.8 livreront)
- **PRD §FR89** — Audit log viewer — Story 6.6 livrera (Story 6.1 inclut Audit 24h count card admin-super)
- **PRD §NFR9** — Admin 2FA TOTP obligatoire — **Story 6.1 enforce via AdminMfaGuard**
- **PRD §NFR50/54** — A11y RGAA AA + Lighthouse — enforced
- **PRD §NFR82** — Audit immutable — audit_log consume new event
- **Architecture §Pattern Pretre canonique** — gateway-api forwarders réutilisés
- **Architecture §DB-per-service ADR-003** — pure cross-svc aggregation read
- **Architecture §Envelope REST ADR-014** — gateway response wrap
- **ADR-013/ADR-016 frontend topology** — admin = 4ème frontend `admin.tukio.one` distinct (public+seller+admin)
- **Stories livrées** : 0.2, 0.3, 0.4, 0.6, 0.7, 0.9, 0.11, 0.13b, 1.1, 1.2c, 1.4, 1.7, 1.8, 1.10, 2.3, 4.13, 5.7
- **Memories Tukio** : `feedback_clean_architecture_explicit`, `feedback_api_envelope_response`, `feedback_tech_layer_english`, `feedback_i18n_frontend`, `feedback_comprehensive_briefs`

### Project Structure Notes

- 1 NEW app `apps/admin/` complete scaffolding (4ème frontend Next.js 16) + foundation components réutilisables Stories 6.2-6.8
- 5 internal endpoints `/internal/admin/*-count` cross-svc + 1 gateway endpoint + 1 NEW custom guard AdminMfaGuard
- 1 NEW hook + 2 NEW components reusable + 5 admin layout components + 1 dashboard page + 1 login + 1 reauth-mfa
- 2 NEW NATS events (1 émis + 1 STUB Stories 6.2-6.5)
- ~60 i18n strings totale
- ~35 test scenarios totale
- Coverage NFR71 maintained
- Epic 6 kick-off réussi sur fondation solide

### Testing

| Layer | Framework | Coverage cible | Story 6.1 scenarios |
|-------|-----------|----------------|----------------------|
| Domain | — | maintained | No domain changes (read-only aggregation) |
| Usecases | Jest unit | ≥ 70 % | GetAdminDashboardSummaryUseCase 5 + AdminMfaGuard 4 = 9 |
| Infrastructure | Jest integration testcontainer | ≥ 50 % | 5 cross-svc internal endpoints (5) + cross-svc fallback (1) = 6 |
| Components frontend | RTL | All variants | AdminLayout (5) + QueueCountCard (4) + KpiCard (4) = 13 |
| Hooks frontend | @testing-library/react + MSW | All hooks | 3 scenarios |
| Gateway E2E | Jest E2E supertest | 1 endpoint × 7 | 7 scenarios |
| Playwright E2E | Playwright + axe-core | 6 critical paths | 6 scenarios (3 roles + viewport + MFA redirect + cross-svc fallback) |
| A11y + Lighthouse | axe-core + Lighthouse CI | 0 + ≥ 90 | 2 specs |
| **Total** | | | **~35 test scenarios** |

### References

- [Source: epics.md#Story-6.1 (lines 2059-2079)]
- [Source: epics.md#Epic-6 (lines 2048-2057)] — **Epic 6 kick-off**
- [Source: prd.md#FR84-90 (admin moderation)]
- [Source: prd.md#FR89 (audit log)]
- [Source: prd.md#NFR9 (admin 2FA TOTP obligatoire)]
- [Source: prd.md#NFR50/54 (a11y + Lighthouse)]
- [Source: prd.md#NFR82 (audit)]
- [Source: architecture.md#Pattern-Pretre-canonique]
- [Source: architecture.md#DB-per-service (ADR-003)]
- [Source: architecture.md#Envelope-REST (ADR-014)]
- [Source: architecture.md#Frontend-multi-zones (ADR-013 → ADR-016)]
- [Source: implementation-artifacts/1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo.md (Keycloak realm + 3 admin roles)]
- [Source: implementation-artifacts/1-7-admin-2fa-totp-obligatoire.md (admin-2fa-totp baseline + acr_values=mfa)]
- [Source: implementation-artifacts/1-4-login-flow-keycloak-authorization-code-pkce.md (KeycloakJwtGuard pattern)]
- [Source: implementation-artifacts/1-2c-gateway-api-pretre-forwarder.md (gateway forwarder pattern)]
- [Source: implementation-artifacts/2-3-admin-verification-queue.md (Pro verifications queue baseline)]
- [Source: implementation-artifacts/4-13-saga-monitoring-r11-alerts.md (saga-health endpoint baseline)]
- [Source: implementation-artifacts/5-7-customer-leave-review-report-abuse.md (reviews status pending_moderation)]
- [Source: .agents/context/pretre-pattern.md]
- [Source: .agents/context/rest-envelope.md (ADR-014)]
- [Source: .agents/context/i18n.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-create-story workflow `_bmad/bmm/skills/bmad-create-story` adapté ACS Tukio (`{user_name}=Ismael`, `{communication_language}=Français`, `{document_output_language}=Français`)

### Debug Log References

(populated during dev-story)

### Completion Notes List

(populated during dev-story)

### File List

(populated during dev-story)
