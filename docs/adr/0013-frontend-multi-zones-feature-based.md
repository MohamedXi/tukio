# ADR-0013: 4 Next.js apps multi-zones, feature-based decomposition

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `frontend`

## Context

Tukio.one serves four distinct user contexts, each with radically different UI requirements,
authentication levels, and access patterns:

| App | Audience | Auth | URL |
|-----|----------|------|-----|
| `public` | Visitors (anonymous) | None | `tukio.one` / `app.tukio.one` |
| `customer` | Authenticated B2C/B2B customers | Required | `customer.tukio.one` |
| `seller` | Pro dashboard (KYC, listings, bookings) | Required + pro role | `seller.tukio.one` |
| `admin` | Moderation console | Required + admin role + 2FA TOTP | `admin.tukio.one` |

Forces in tension:

- **Bundle size**: a monolith Next.js app that includes admin panel code is shipped to anonymous
  visitors — every kilobyte increases LCP (NFR54 Lighthouse ≥ 90).
- **Security isolation**: the admin panel code, admin RBAC logic, and admin API calls must not be
  accessible to unauthenticated visitors. Physical app separation is stronger than route-level guards.
- **Deployment independence**: the seller pro dashboard can be deployed and iterated on independently
  of the public marketplace. A bug in `seller` does not require redeploying `public`.
- **Team scaling**: future teams can own entire apps without merge conflicts. A customer team works
  on `customer`; a catalog team works on `public` — no shared `pages/` directory.
- **URL experience**: from the user's perspective, navigating from `tukio.one/fr/marquees` to
  their account at `customer.tukio.one/fr/account/bookings` must feel seamless — same cookie
  (`Domain=.tukio.one`), same design system.
- **Cookie session sharing**: Keycloak sets the `tukio-access-token` cookie with `Domain=.tukio.one`
  so all 4 apps share the same auth session without re-login.

## Decision

Deploy 4 separate Next.js 16 applications. Each app is an independent Next.js project in the monorepo
under `apps/<name>/` with its own:

- `next.config.ts` — rewrites, image domains, bundle config
- `src/app/` — App Router pages, layouts, loading states
- `src/messages/{fr,en}.json` — translation strings specific to this app
- `package.json` — app-specific dependencies
- Docker image — `ghcr.io/mohamedxi/tukio/<name>:${IMAGE_TAG}` (Story 0.13b)

**Composition via Next.js rewrites** (`apps/public/next.config.ts`):

```typescript
async rewrites() {
  const customerHost = process.env.NEXT_PUBLIC_CUSTOMER_HOST ?? 'https://customer.tukio.one';
  const sellerHost   = process.env.NEXT_PUBLIC_SELLER_HOST   ?? 'https://seller.tukio.one';
  return [
    { source: '/:locale/account/:path*', destination: `${customerHost}/:locale/account/:path*` },
    { source: '/:locale/cart/:path*',    destination: `${customerHost}/:locale/cart/:path*` },
    { source: '/:locale/seller/:path*',  destination: `${sellerHost}/:locale/seller/:path*` },
  ];
}
```

Visitors who navigate to `tukio.one/fr/account/bookings` are transparently served by `customer`
while the URL in the browser stays under `tukio.one/fr/account/bookings`. This is the Next.js
multi-zones pattern.

**admin is excluded** from rewrites: `admin.tukio.one` is a completely isolated subdomain — no rewrite
from `tukio.one` into `admin.tukio.one`. This is intentional: admin users navigate directly to the
admin subdomain. Security by separation (ADR-0008 analogy: one entry point per trust level).

**Shared design system**: all 4 apps consume `@tukio/ui` atoms and patterns via subpath imports.
No inline CSS, no Tailwind utility classes that are not covered by the shared token set (ADR-0003
parallel: shared DB on one instance, shared design system in one package).

**Caddy routing in production** (ADR-0015): Caddy reverse-proxies each subdomain to its container
(`public:3000`, `customer:3001`, `seller:3002`, `admin:3003`). The Next.js rewrites operate at
SSR level for the client-side navigation; the Caddy routes handle the initial request routing.

## Consequences

### Positive

- **Optimal bundle size per app**: `public` does not ship admin or seller code. Lighthouse 90+
  for the marketing/listing pages is achievable because the JS budget is not polluted by
  authenticated-only UI.
- **Strong security boundary**: `admin.tukio.one` is only served to its own Next.js container
  behind its own Caddy route — no code path from `public` can accidentally render admin components.
- **Independent deployments**: a new `seller` Docker image can be deployed without rebuilding
  `public`. Turborepo `--filter=seller` builds only the affected workspace.
- **Team-friendly**: future product teams own entire app directories without stepping on each other's
  `app/` tree.
- **Shared auth session**: `Domain=.tukio.one` cookie makes the user feel like they are on one
  platform while physically hopping between 4 independent Next.js apps.

### Negative / Trade-offs

- **4 Docker images to build**: CI build time is 4× what a monolith would be (partially offset by
  Turborepo remote caching and parallel builds — Story 0.13b).
- **Cross-app navigation caveats**: server-to-server rewrites (Next.js multi-zones) work seamlessly
  for SSR, but client-side `router.push('/:locale/account/...')` from `public` requires a full
  page reload to cross the zone boundary. In practice this is invisible to users (< 200ms).
- **State synchronization**: React state in `public` is lost when the user crosses to `customer`
  via a rewrite. Session state is in the cookie; UI state must be re-initialized in `customer`.
  This is by design — multi-zones apps are independent single-page apps, not one SPA.
- **`tukio.one` apex**: the apex redirects to `app.tukio.one` via Caddy permanent redirect
  (`redir https://app.tukio.one{uri} permanent`). This means the canonical marketing URL is
  `app.tukio.one`, not `tukio.one` — a trade-off for the multi-zone architecture where `public`
  serves on its own subdomain. Story 0.14 evaluates merging `public` and the apex via Caddy.

### Neutral

- Module Federation (Webpack 5) was considered for runtime code sharing across zones — deferred to
  V3+ when the team exceeds ~30 engineers who need runtime-shared micro-frontends.

## Alternatives Considered

### Single Next.js monolith app

One app, all routes, all user types. **Rejected**:

- Admin panel code ships to anonymous visitors — security risk and bundle size explosion.
- Route-level guards (`middleware.ts`) are the only protection — a misconfiguration exposes admin
  routes. Physical isolation is stronger.
- One CI build for every UI change — no independent deployability.

### Single app with multiple layouts + RBAC route guards

One app, different layouts per user role. **Rejected for the same reasons as above** plus: the
design system `@tukio/ui` is shared, but the page-level code for a pro booking management dashboard
is structurally incompatible with a marketing landing page in one `app/` tree without significant
directory complexity.

### Module Federation (Webpack 5 runtime)

Runtime code sharing across separately deployed microfrontends. **Deferred to V3+**: adds significant
infrastructure complexity (versioning of shared modules at runtime, build tooling), and the team
size (1-2 engineers) does not justify this overhead at MVP.

## References

- [Source: Architecture §Frontend multi-zones — lines 582, 416-425]
- [Source: Architecture §apps/admin isolation — line 1069]
- [Source: Story 0.1 — 4 apps scaffolded as separate Next.js workspaces]
- [Source: Story 0.8 — @tukio/auth-client PKCE session shared via Domain=.tukio.one cookie]
- [Source: Story 0.12 / ADR-0015 — Caddy routes each subdomain to its container]
- [Source: Story 0.13 — Next.js rewrites implemented in apps/public/next.config.ts]
- [ADR-0012 — each app has its own messages/{fr,en}.json bilingual strings]

## Implementation Notes

- Dev ports: `public:3000`, `customer:3001`, `seller:3002`, `admin:3003` (locked, Story 0.1).
- `NEXT_PUBLIC_CUSTOMER_HOST` and `NEXT_PUBLIC_SELLER_HOST` env vars control rewrite destinations:
  - Dev: `http://localhost:3001`, `http://localhost:3002`
  - Prod: `https://customer.tukio.one`, `https://seller.tukio.one`
- Caddy config (Story 0.12) handles the subdomain routing in production independently of Next.js rewrites.
  The rewrites are for the SSR request path (Next.js server proxying to another Next.js server).
- `@tukio/ui` is a shared design system — import via subpath: `import { Button } from '@tukio/ui/components/Button'`.
  Barrel imports rejected by `tukio/no-barrel-import-ui` lint rule (Story 0.11).
- `admin.tukio.one` enforces 2FA TOTP via Keycloak authentication policy (Story 1.7) — not a
  Next.js middleware concern.
