# ADR-0016: Frontend topology pivot — apex `tukio.one` unified B2C tunnel

- **Status**: ✅ Accepted
- **Date**: 2026-05-15
- **Deciders**: Ismael (founder)
- **Tags**: `architecture`, `frontend`, `ops`
- **Supersedes**: [ADR-0013](./0013-frontend-multi-zones-feature-based.md)

## Context

ADR-0013 (2026-05-09) introduced a 4-app multi-zones topology — `public`
(visitors), `customer` (authenticated B2C), `seller` (pros), `admin`
(staff) — with `apps/public` acting as the parent zone and Vercel-style
rewrites pointing `/account` and `/cart` to `customer.tukio.one`. The
rationale at the time was bundle size (visitors should not download
authenticated-customer JS), security isolation, and deploy independence.

Five weeks of building Sprint 0 (the apps shells, the deploy pipeline,
and the cross-zone cookie wiring) surfaced concrete signals that
contradict that rationale:

1. **Marketplace patterns disagree.** Airbnb, Booking, Vinted, Doctolib,
   leboncoin, Frichti, Manomano — every mature B2C marketplace serves
   the visitor → customer tunnel from the same domain. Bundle splitting
   is solved by Next.js automatic code-splitting + dynamic imports, not
   by splitting codebases.
2. **Cross-subdomain cookies are a paper cut.** Sharing
   `Domain=.tukio.one` cookies across `customer.tukio.one` and
   `seller.tukio.one` works but adds non-trivial CORS + Set-Cookie
   surface area for every flow that crosses subdomains.
3. **Story 4.3 (cart UI persistence)** exposed how much accidental
   complexity the multi-zone setup adds for trivially same-origin flows.
   With apps under the same origin, the cart can use LocalStorage /
   IndexedDB without bridging a `tukio-cart-id` cookie cross-zone.
4. **SEO penalty.** A visitor who searches for a service lands on
   `tukio.one/services/marquees/...`. After login the URL would change
   to `customer.tukio.one/...` — confusing for users and forcing
   `<link rel="canonical">` complexity.
5. **Ops cost.** Four Next.js apps consume ≈ 1 GB RAM together on the
   `tukio-apps` 2 GB droplet — tight. Dropping one frees ≈ 250 MB.

## Decision

Merge `apps/public` and `apps/customer` into a single Next.js app served
on the apex `tukio.one`. Authenticated routes live under a Next.js App
Router route group `(authenticated)` and are protected by a Next.js
middleware that redirects unauthenticated requests to
`/login?callback=...`.

Final topology:

| Hostname            | App         | Audience                                     |
| ------------------- | ----------- | -------------------------------------------- |
| `tukio.one` (apex)  | `public`    | Visitors + authenticated B2C customers       |
| `seller.tukio.one`  | `seller`    | B2B pros (KYC, listings, bookings)           |
| `admin.tukio.one`   | `admin`     | Staff console (MFA TOTP)                     |
| `api.tukio.one`     | gateway-api | Public REST gateway                          |
| `auth.tukio.one`    | Keycloak    | Identity provider                            |
| `app.tukio.one`     | _redirect_  | 301 → apex via Caddy (legacy ADR-013, ~6 mo) |

Subdomains retired: `app.tukio.one` (kept as 301 → apex for ~6 months),
`customer.tukio.one` (dropped).

## Consequences

**Benefits.**

- UX continuity — no jarring cross-subdomain hop after login.
- SEO win — apex ranks better than subdomain; canonical URLs are
  trivially stable across the visitor → customer journey.
- −1 app to build, deploy, monitor (3 codebases instead of 4) →
  −1 GHCR image, −200-300 MB RAM on `tukio-apps`, −1 Let's Encrypt
  cert, −1 Caddy block.
- Cart / state / cookies are trivially preserved cross-page since
  every customer-facing route shares the same origin.

**Costs.**

- Refactor pass — Story 0.14 deletes `apps/customer`, installs the
  `(authenticated)` route group + middleware in `apps/public`,
  rewires Caddyfile + apps.prod.yml + CI workflows, and patches
  every Epic 1+ story that referenced `customer.tukio.one`.
- Bundle-split discipline must be respected per route — the visitor
  bundle on `tukio.one/` should stay below 250 KB First Load JS.
  Next.js automatic code-splitting per route group handles this by
  default but it now lives entirely in our hands.

**Re-evaluation trigger.** Volume B2C > 100k MAU (unlikely before V2)
combined with measurable bundle bloat regression on the visitor
landing — at that point we'd reconsider re-extracting a customer app
+ cross-subdomain cookies.

## References

- Story 0.14 — `_bmad-output/implementation-artifacts/0-14-merge-public-customer-apex-tukio-one.md`
- Story 0.13b — surfaced the Next.js 16 + next-intl port leak in
  `Location` headers that hinted at the standalone-mode root-cause
  fix bundled into Story 0.14.
- ADR-013 — superseded by this ADR.
- Next.js docs — [Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files), [Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups).
