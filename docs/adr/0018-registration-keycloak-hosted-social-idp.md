# ADR-0018: Registration moves to Keycloak-hosted themed page + social IdP

- **Status**: Proposed
- **Date**: 2026-05-25
- **Deciders**: Ismael (founder)
- **Tags**: `architecture`, `security`, `frontend`
- **Extends**: [ADR-0009](./0009-keycloak-identity-svc-split.md) (realm + clients)
- **Supersedes**: the local-form registration approach of Story 1.2, and the "single backend `POST /v1/auth/customer/register`" point of [ADR-0017](./0017-auth-client-first-conversion-pro.md) (the client-first **model** is preserved). Honors `tukio_ux_flow_auth_accounts.md` §B.1.

## Context

Login already redirects to a Keycloak-hosted page (Authorization Code + PKCE,
Story 1.4 — `initiate-login.usecase.ts` → `buildAuthorizeUrl`). **Registration,
however, was built as a local Next.js form** (Story 1.2:
`apps/public/.../auth/sign-up/SignUpForm.tsx` → `useRegisterCustomer` →
`POST /v1/auth/customer/register` → identity-svc creates the user via the
Keycloak **Admin API**).

This produces two problems:

1. **Inconsistency** — login is Keycloak-hosted, registration is a bespoke
   form. Two different identity surfaces to build, secure, and theme.
2. **Divergence from the agreed design** — `tukio_ux_flow_auth_accounts.md`
   §B.1 specifies a **Keycloak-themed registration page** (redirect), and the
   founder's intent is "everyone signs up on Keycloak." Social login
   (Google/Microsoft, then Apple) was also expected; today
   `identityProviders: []` — none configured.

The realm is already provisioned for the Keycloak-hosted path:
`registrationAllowed: true`, `verifyEmail: true`,
`registrationEmailAsUsername: true`, `loginTheme: tukio`, with an **existing
themed `register.ftl` + `verify-email.ftl`** (`infra/keycloak/themes/tukio/login/`)
and a realm default role `default-roles-tukio`. So the theming cost is largely
already paid.

The local form captures three things Keycloak self-registration does not
capture natively: CGU acceptance (`acceptTerms`), marketing consent
(`acceptMarketing`), and first-touch acquisition (`tk_acq` / UTM).

## Decision

1. **Customer registration moves to the Keycloak-hosted themed page**
   (`register.ftl`, theme `tukio`). The frontend "S'inscrire" CTA redirects to
   the Keycloak registration endpoint — mirroring the login redirect (PKCE +
   state + `kc_locale`) — instead of rendering the local form.
2. **The local registration path is deprecated then removed**:
   `SignUpForm.tsx`, `useRegisterCustomer`, `POST /v1/auth/customer/register`,
   and the `register-customer` request DTO/contracts.
3. **Role `client` is auto-assigned** by composing `client` into the realm
   default role `default-roles-tukio`, so Keycloak self-registration grants it.
   This preserves the [ADR-0017](./0017-auth-client-first-conversion-pro.md)
   client-first invariant; the `pro` role is still obtained only by conversion.
4. **Email verification is delegated to Keycloak's native flow**
   (`verifyEmail: true`). The custom verify endpoint + landing planned in
   Story 1.6 is largely superseded.
5. **Data capture**: CGU via Keycloak's native **Terms and Conditions**
   required action; **marketing consent** via a custom field in `register.ftl`
   persisted as a user attribute. **First-touch acquisition (UTM/`tk_acq`) at
   registration is dropped** — attribution is handled via Plausible + the
   pre-launch Resend waitlist (ADR-0017 context, Story 0.20/0.21).
6. **Social IdP**: provision **Google + Microsoft** identity providers
   (brokering) in the realm; credentials stored as secrets. **Apple deferred.**

## Consequences

### Positive

- Consistency — login and registration are both Keycloak-hosted; one identity
  UX surface.
- Less bespoke code — deprecates the local form, the register endpoint, and
  its contracts. Native email verification, password policy, bot protection
  (KC reCAPTCHA), and social login are handled by Keycloak config, not app code.
- Social login (Google/Microsoft) unlocked by realm configuration alone.
- Theme cost already paid — `register.ftl` / `verify-email.ftl` exist.

### Negative / Trade-offs

- **Backend inversion (biggest item).** identity-svc no longer *creates* the
  user synchronously (Story 1.2b dual-write). Keycloak self-registration creates
  it, so the `user_profile` row must be created **reactively** on a Keycloak
  registration event — via a Keycloak event-listener SPI (an `infra/keycloak/spi`
  slot already exists) bridging to NATS, or an admin-event consumer — then
  `user_profile` + outbox. This replaces synchronous dual-write with an
  event-driven create.
- Marketing consent needs a custom Freemarker field + user-attribute mapper +
  identity-svc sync on the registration event — modest KC work.
- First-touch acquisition at the registration moment is lost (mitigated by
  Plausible + waitlist); per-user acquisition source becomes best-effort.
- **Story 1.6 (email-verify) shrinks drastically** — KC native flow replaces
  most of the custom endpoint/landing; re-scope or cancel.
- Less pixel-level control over the registration UX than a bespoke React form
  (bounded by Keycloak's form model + theme).

### Neutral

- Realm and clients unchanged — ADR-0009 stands.
- The conversion-to-pro flow (authenticated `POST /v1/auth/pro/register`,
  Story 1.3b-bis) is unaffected.
- The post-login role resolver (`redirect-resolver.ts`, Story 1.4b) already
  routes post-auth and post-verify destinations.

## Alternatives Considered

### Keep the local form, add social via buttons that call KC IdP

Rejected: keeps login and registration inconsistent, leaves the divergence
from the UX doc, and duplicates identity logic. The founder wants Keycloak-hosted.

### Full parity — capture UTM on the Keycloak form (hidden field + SPI)

Rejected for now: more Keycloak SPI work for marginal analytics gain. Plausible
+ the waitlist cover attribution adequately.

### Keycloak for auth only; collect consent + acquisition in a post-login step

Rejected: adds funnel friction, and CGU acceptance belongs at the registration
moment for legal clarity.

## References

- [Source: `tukio_ux_flow_auth_accounts.md` §B.1] — Keycloak-themed registration
  page — now honored.
- [ADR-0009](./0009-keycloak-identity-svc-split.md) — realm + clients (extended).
- [ADR-0017](./0017-auth-client-first-conversion-pro.md) — client-first model
  (preserved); its "single `POST /v1/auth/customer/register`" point is superseded.
- Realm: `infra/keycloak/realm-config/realm-base.json` (`registrationAllowed`,
  `verifyEmail`, `default-roles-tukio`), `infra/keycloak/themes/tukio/login/register.ftl`.
- Code to deprecate: `apps/public/src/features/auth/sign-up/components/SignUpForm.tsx`,
  `@tukio/api-client/hooks/identity` `useRegisterCustomer`,
  `apps/gateway-api/.../controllers/auth-customer.controller.ts` (`POST /v1/auth/customer/register`),
  `register-customer` DTO/contracts.
- Impacts: Story 1.2 (registration — re-scope), Story 1.6 (email-verify —
  mostly superseded by KC native), Story 1.1 (realm: compose `client` into
  default roles, provision Google/Microsoft IdP, add Terms required action).
- Follow-up: `/bmad-correct-course` to re-scope Stories 1.2 / 1.6 and add a
  story for the Keycloak registration provisioning (default role, IdP,
  `register.ftl` marketing field) + the reactive `user_profile`-on-registration
  event listener.

## Implementation Notes

- **Frontend**: "S'inscrire" → `GET /v1/auth/register` on gateway-api (a new
  initiate-register that mirrors `initiate-login`: builds the KC registration
  URL with PKCE verifier + state + `kc_locale`), so the post-registration
  callback reuses the existing `/v1/auth/callback` + `redirect-resolver.ts`.
- **Realm**: compose `client` into `default-roles-tukio`; enable the
  `termsAndConditions` required action; add a marketing-consent field to
  `register.ftl` mapped to a `marketing_consent` user attribute; provision
  `google` + `microsoft` IdP (client id/secret as secrets, Story 1.1 pattern).
- **Backend (the real work)**: replace Story 1.2b synchronous dual-write with a
  reactive `user_profile` create driven by a Keycloak registration event
  (event-listener SPI in `infra/keycloak/spi` → NATS, consumed by identity-svc →
  `user_profile` + outbox). Keep idempotency (inbox dedup) since KC events can
  redeliver.
- **Acquisition**: remove the `tk_acq` merge from the registration path; rely
  on Plausible + waitlist.
- **Migration (deprecate → remove)**: (1) point "S'inscrire" to the KC
  registration redirect; (2) confirm zero callers of
  `POST /v1/auth/customer/register`; (3) remove the endpoint, `SignUpForm`,
  `useRegisterCustomer`, and the `register-customer` contracts.
