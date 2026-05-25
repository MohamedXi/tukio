# ADR-0017: Auth — client-first registration, pro role by conversion only

- **Status**: Proposed
- **Date**: 2026-05-25
- **Deciders**: Ismael (founder)
- **Tags**: `architecture`, `security`, `frontend`
- **Extends**: [ADR-0009](./0009-keycloak-identity-svc-split.md) (realm + clients), [ADR-0016](./0016-frontend-topology-pivot-apex-unified.md) (apex unified, `.tukio.one` shared cookie)
- **Supersedes**: `tukio_ux_flow_auth_accounts.md` Doc 4 §C.1–C.2 (direct pro registration) and the "dual-portal" signup decision of 2026-05-17

## Context

Tukio runs a single Keycloak realm `tukio` with one frontend PKCE client
(`tukio-web`) serving both the apex `tukio.one` and `seller.tukio.one`
(ADR-0009, ADR-0016). Since ADR-0016, `seller.tukio.one` hosts **no auth
pages** — authentication happens on the apex and the session cookie is
shared on `Domain=.tukio.one`.

Two of the founding documents disagree on how a provider ("pro") account
comes into existence, and the codebase has drifted into a hybrid of both:

1. **`tukio_information_architecture.md` §I.2/I.3** — everyone registers as
   `client`; the `pro` role is obtained by a **voluntary conversion**
   ("Devenir pro" → KYC + Stripe). A user with both roles keeps both. A
   role-based redirect sends `client` → `/account`, `pro` → `/seller`,
   `admin` → `admin.tukio.one`.
2. **`tukio_ux_flow_auth_accounts.md` Doc 4 §C.1–C.2** — a pro registers
   **directly** as a pro via `/sell` → `registration?role=pro`, provisioned
   with `role: pro` from the start. Client→pro conversion is only a
   secondary case (open question F-08).
3. **The "dual-portal" decision (2026-05-17)** added a third framing: a
   separate, pro-branded signup portal on `seller.tukio.one` (Story 1.11),
   on top of a client-first backend.

The implementation built pieces of all three, producing the confusion this
ADR resolves:

- A **direct** pro registration endpoint exists — `POST /v1/auth/pro/register`
  (multipart SIRET + KYC, Story 1.3c, `gateway-api auth-pro.controller.ts:59`).
- A **conversion** path also exists — `ProConversionWizard.tsx` (seller) and
  `become-pro/page.tsx` (apex).
- `seller.tukio.one` has **no** auth pages (the Story 1.11 portal was never
  built).
- There is **no post-login role router**: every authenticated user lands the
  same way. The only routing today is the seller middleware bouncing pros in
  `tukio:status=pending_admin_review` to `/seller/onboarding/pending`.

Forces in tension: a single product mental model vs. the sunk cost of the
already-shipped direct-pro path; one extra hop for pros vs. a single
registration backend with no duplication; pro marketing differentiation vs.
the invariant "a pro is a client who converted".

## Decision

1. **One registration flow, on the apex.** Every account is created with
   role `client`. There is no direct pro registration — the
   `registration?role=pro` entry and the dedicated pro signup portal are
   dropped.
2. **The `pro` role is granted exclusively by the post-signup conversion
   wizard** (KYC + Stripe Connect + admin validation →
   `assignRealmRole('pro')`, status `pending_admin_review` → `active`).
   `seller.tukio.one` hosts no auth pages; it is a workspace gated to
   converted, admin-validated pros.
3. **A server-side post-login role router lives on the apex `/auth/callback`.**
   It reads the roles from the ID token and redirects with this precedence:
   `admin*` → `admin.tukio.one`; else `pro` → `seller.tukio.one/{locale}/seller/dashboard`
   (priority for dual-role accounts, per IA §I.3); else `client` →
   `/{locale}/account/dashboard`. Zone middlewares only **enforce access** —
   they do not decide the landing destination.

## Consequences

### Positive

- One mental model — "a pro is a client who converted" — backed by a single
  registration backend (`POST /v1/auth/customer/register`), no duplication.
- Fixes the "everyone lands the same place" defect via an explicit,
  centralized role router with a single source of truth.
- Ratifies the already-built `ProConversionWizard` as the one canonical path
  to the `pro` role.
- `seller.tukio.one` stays a pure post-validation workspace — no second auth
  surface to build, secure, and keep in sync.

### Negative / Trade-offs

- Requires **deprecating then removing** `POST /v1/auth/pro/register` and the
  direct pro registration page (Story 1.3c) — sunk cost + migration work.
- Pros incur one extra hop (sign up as client → convert) instead of a single
  pro form. Mitigated by a prominent "Devenir pro" CTA in the apex header and
  the `/sell` landing.
- Dual-role default = pro priority, so a converted pro reaches `/account` via
  the in-app menu rather than at login. Accepted.
- No differentiated pro marketing **signup** portal (dual-portal 2026-05-17
  abandoned). Pro storytelling lives on the `/sell` landing and the
  `become-pro` page, not on a separate signup tunnel.

### Neutral

- Realm and clients are unchanged — ADR-0009 stands (single realm,
  `tukio-web` serves apex + seller).
- The conversion wizard already exists; this ADR makes it the only path
  rather than introducing new UI.

## Alternatives Considered

### Direct pro registration (`?role=pro` / `POST /v1/auth/pro/register`)

The UX Flow Doc 4 model. Rejected: it breaks the "one registration"
invariant, duplicates the registration backend, and is the direct source of
the current hybrid confusion (two ways to become a pro).

### Dual-portal — separate pro signup on `seller.tukio.one` (Story 1.11)

The 2026-05-17 decision. Rejected: it adds a second signup surface to build
and secure for a marginal marketing gain; the founder prefers a single apex
entry point with conversion.

### Role router in per-app middleware, or via a Keycloak `redirect_uri` claim

Rejected: per-app middleware distributes the landing logic across apps
(duplication + cross-zone round-trips); a Keycloak role→`redirect_uri` mapper
couples the rule to the IdP and is hard to test and evolve. A single
server-side callback on the apex is simpler and testable.

## References

- [Source: `tukio_information_architecture.md` §I.2/I.3] — client-first +
  conversion + role-based redirect — **adopted**.
- [Source: `tukio_ux_flow_auth_accounts.md` Doc 4 §C.1–C.2] — direct pro
  registration — **superseded by this ADR**.
- Dual-portal signup decision 2026-05-17 (project memory) — **superseded**.
- [ADR-0009](./0009-keycloak-identity-svc-split.md) — realm + clients (extended).
- [ADR-0016](./0016-frontend-topology-pivot-apex-unified.md) — apex unified +
  `.tukio.one` cookie (built on).
- Current code: `apps/gateway-api/src/infrastructure/http/controllers/auth-pro.controller.ts:59`
  (endpoint to deprecate), `apps/seller/src/features/seller-onboarding/components/ProConversionWizard.tsx`
  (canonical path), `apps/seller/src/middleware/pending-admin-review-decision.ts`.
- Follow-up: `/bmad-correct-course` for Story 1.3c (deprecate → remove),
  Stories 1.4 / 1.6 (login + email-verify redirect), and a new story for the
  post-login role router.

## Implementation Notes

- **Role router.** Apex `/auth/callback` (server-side) decodes the ID token
  roles and issues a 302 with the precedence above. Keep it pure and unit-
  testable (a decision function fed the roles + locale, returning a target
  URL), mirroring the existing `*-decision.ts` pattern used by the
  coming-soon and pending-admin-review middlewares.
- **Migration sequence (deprecate then remove).**
  1. Point all pro-facing UI to the conversion wizard (`become-pro` →
     wizard); ensure no caller hits `POST /v1/auth/pro/register`.
  2. Mark the endpoint deprecated — return `410 Gone` (or gate behind a
     kill-switch flag) once traffic is confirmed zero.
  3. Remove the endpoint, the direct-registration page, and the now-unused
     `register-pro` contracts in a later story.
- **Conversion happy path.** client signs up → `become-pro` → wizard
  (profile + KYC + Stripe) → admin validation → `assignRealmRole('pro')` +
  `tukio:status` flips to `active` → seller workspace unlocks.
- **Review invariant.** No code path may assign `pro` at initial
  registration. Worth a focused check in code review (and a candidate for a
  lint/contract test) since the old endpoint did exactly that.
