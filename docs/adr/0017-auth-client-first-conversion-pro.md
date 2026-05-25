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

A closer reading of the codebase (correct-course, 2026-05-25) shows the
backend has **already converged** on the IA-doc model, while the docs and
backlog still describe the others:

- `POST /v1/auth/pro/register` is **not** an anonymous direct registration:
  since Story 1.3b-bis it is an **auth-gated Customer→Pro conversion**
  endpoint (`gateway-api auth-pro.controller.ts` — no `@Public()`,
  `@CurrentActor()` injects the JWT `sub`). The `?role=pro` signup entry was
  already removed in the Story 1.4 re-scope (2026-05-17).
- The conversion path is built and shipped — `ProConversionWizard.tsx`
  (Story 1.3d v2) calls that endpoint via `use-register-pro-mutation.ts`;
  the `become-pro` page and avatar-dropdown CTA exist on the apex.
- `seller.tukio.one` has **no** auth pages (the dual-portal Story 1.11 was
  never built — and is cancelled by this ADR).
- The one real gap: **no post-login role router**. Every authenticated user
  lands the same way; the apex `/auth/callback` merely forwards the gateway
  `Location`. The only role-aware routing today is the seller middleware
  bouncing `tukio:status=pending_admin_review` pros to
  `/seller/onboarding/pending`.

Forces in tension: a single product mental model vs. the sunk cost of the
already-shipped direct-pro path; one extra hop for pros vs. a single
registration backend with no duplication; pro marketing differentiation vs.
the invariant "a pro is a client who converted".

## Decision

1. **One registration flow, on the apex.** Every account is created with
   role `client`; there is no direct pro registration. This is already the
   case in the backend: the `?role=pro` signup entry was removed in the
   Story 1.4 re-scope (2026-05-17) and `POST /v1/auth/pro/register` is an
   auth-gated Customer→Pro _conversion_ endpoint (Story 1.3b-bis), not an
   anonymous registration. This ADR ratifies that conversion-only backend
   and cancels the dual-portal pro signup portal (Story 1.11).
2. **The `pro` role is granted exclusively by the post-signup conversion
   wizard** (KYC + Stripe Connect + admin validation →
   `assignRealmRole('pro')`, status `pending_admin_review` → `active`).
   `seller.tukio.one` hosts no auth pages; it is a workspace gated to
   converted, admin-validated pros.
3. **A single post-login role resolver lives in `gateway-api`** — a pure,
   testable function reused by both the login flow (Story 1.4) and the
   email-verification flow (Story 1.6). It reads the roles + status and
   returns the destination with this precedence: `admin*` → `admin.tukio.one`;
   else `pro` → `seller.tukio.one/{locale}/seller/dashboard` (priority for
   dual-role accounts, per IA §I.3); else `client` → `/{locale}/account/dashboard`.
   The apex / seller / mobile callbacks relay that `Location`; zone
   middlewares only **enforce access**, they do not decide the landing
   destination.

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

- No endpoint removal: the conversion backend already matches this decision.
  The endpoint is merely **misnamed** (`register` vs `convert`) — an optional
  rename is deferred churn, not a blocker.
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
- Current code: `apps/gateway-api/src/infrastructure/http/controllers/auth-pro.controller.ts`
  (auth-gated conversion endpoint — keep), `apps/seller/src/features/seller-onboarding/components/ProConversionWizard.tsx`
  (canonical path), `apps/seller/src/middleware/pending-admin-review-decision.ts`.
- Follow-up: `/bmad-correct-course` (2026-05-25) — cancel Story 1.11, amend
  Story 1.6 redirect, add the post-login role-router story. See
  `sprint-change-proposal-2026-05-25.md`.

## Implementation Notes

- **Role resolver (gateway-side).** A pure function in `gateway-api` fed the
  roles + status + locale, returning a target URL. The Story 1.6
  `post-verify-redirect-resolver.ts` and the Story 1.4 login redirect logic
  are **unified into this one resolver**; frontends relay the resulting
  `Location` (the apex `/auth/callback` already does — `route.ts:54-62`).
  Gateway-side is chosen over an apex-side router because it is more
  centralized for multiple frontends (apex, seller, mobile) and matches the
  shipped Story 1.4 pattern. Keep it unit-testable, mirroring the
  `*-decision.ts` pattern (coming-soon / pending-admin-review).
- **No endpoint migration.** The conversion-only backend is already in
  place; nothing to deprecate or remove. Optional, deferred: rename
  `POST /v1/auth/pro/register` → `.../convert` (+ the `register-pro`
  contracts) so the name stops implying anonymous registration — the very
  misnomer that caused this confusion.
- **Backlog repercussions (correct-course 2026-05-25).** Cancel the
  dual-portal Story 1.11. Add a new story for the post-login role router.
  Amend Story 1.6 (email-verify) to delegate its redirect to that router
  instead of the dropped `signup_intent` mechanism.
- **Conversion happy path.** client signs up → `become-pro` → wizard
  (profile + KYC + Stripe) → admin validation → `assignRealmRole('pro')` +
  `tukio:status` flips to `active` → seller workspace unlocks.
- **Review invariant.** No code path may assign `pro` at initial
  registration. Worth a focused check in code review (and a candidate for a
  lint/contract test) since the old endpoint did exactly that.
