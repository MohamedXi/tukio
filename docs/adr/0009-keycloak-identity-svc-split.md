# ADR-0009: Keycloak + identity-svc dual-layer identity

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `security`, `backend`

## Context

Tukio needs two distinct capabilities often conflated under "identity":

1. **Authentication + session management**: OIDC Authorization Code PKCE flow, JWT issuance, token
   refresh, MFA TOTP (admin), password reset, email verification — standard OIDC provider behavior.
2. **Business profile management**: user tier (B2C particulier / B2B pro), KYC status, Stripe
   Connect account link, locale preference, acquisition attribution, soft-delete (RGPD), profile
   metadata required for booking + review flows.

Forces in tension:

- **Reuse vs control**: Keycloak provides OIDC out of the box, but its data model (users, attributes)
  is not designed for business domain modeling. Storing `kycStatus`, `stripeConnectAccountId`, and
  `acquisitionSource` in Keycloak custom attributes creates coupling to Keycloak's internal model.
- **Operational risk**: if Keycloak is the only source of truth for business profile data, Keycloak
  downtime = complete business logic failure (even for read-only API calls that don't need auth).
- **Data ownership**: RGPD soft-delete (`deletedAt`) should be in the business DB, not Keycloak.
  Keycloak's user deletion is a different operation with different audit semantics.
- **Team productivity**: a NestJS `identity-svc` is faster to develop against than Keycloak's REST
  admin API for business profile CRUD operations.

## Decision

Two layers manage identity, each with a distinct responsibility:

**Layer 1 — Keycloak 25** (`auth.tukio.one`, `tukio-data` droplet):

- OIDC Authorization Code + PKCE for all 4 frontends.
- JWT issuance (RS256, 15-minute access token, 30-day refresh token).
- User credentials (hashed passwords), email, basic profile (firstName, lastName, preferred_username).
- MFA TOTP enforcement for `admin` client.
- Email verification + password reset flows (built-in Keycloak flows).
- Source of truth for: authentication state, session management, user credentials.

**Layer 2 — identity-svc** (port 4001, `tukio-apps` droplet):

- Business profile: `UserProfile` aggregate with `role`, `locale`, `kycStatus`,
  `stripeConnectAccountId`, `acquisitionSource`, `deletedAt`, etc.
- Mirrors Keycloak `sub` (UUID) as `keycloakUserId` — the foreign key between layers.
- RGPD soft-delete: `deleted_at` in `user_profiles` table; Keycloak user is separately deactivated.
- Source of truth for: business domain attributes, KYC status, Stripe link, RGPD metadata.

**Sync mechanism**:

- `identity-svc` subscribes to Keycloak webhooks (`user.created`, `user.updated`) via a Keycloak
  Event Listener extension — creates/updates the `UserProfile` aggregate on user lifecycle events.
- Drift reconciliation: a nightly cron job (`ReconcileKeycloakProfilesUseCase`) queries Keycloak
  admin API and syncs any diverged profiles (R8 mitigation).

## Consequences

### Positive

- **Auth reliability independent of business API**: Keycloak handles auth; if `identity-svc` is
  briefly down, tokens already issued remain valid (JWT is self-contained).
- **Clean business domain model**: `UserProfile` is a proper DDD aggregate in `identity-svc`
  `domain/model/` — no Keycloak attribute hacks, no `jsonAttributes['kycStatus']` parsing.
- **RGPD compliance**: soft-delete in `user_profiles` + Keycloak deactivation are two distinct,
  auditable operations — each can be triggered independently with its own audit log.
- **Testability**: `identity-svc` domain logic (profile creation, KYC state machine) is tested
  without a running Keycloak instance.
- **Future IdP swap**: if Keycloak is replaced (Auth0, Cognito), `identity-svc` business logic is
  unaffected — only the webhook adapter changes.

### Negative / Trade-offs

- **Two sources of truth** for user base data (email, name): Keycloak and `identity-svc` can drift if
  the webhook event is lost. Mitigated by the nightly reconciliation cron (R8).
- **Webhook complexity**: Keycloak Event Listener extension must be configured and maintained. In dev,
  the webhook is mocked via the `identity-svc` bootstrap script.
- **Double write on registration**: user creation writes to both Keycloak (via admin API) and
  `identity-svc` — the `identity-svc` must treat its write as idempotent (upsert on `keycloakUserId`).
- **Admin console shows only auth data**: Keycloak admin UI shows credentials, sessions, and basic
  profile — business profile data requires the tukio admin panel (Story 2.3).

### Neutral

- `gateway-api` validates the JWT (Keycloak-issued) and injects the `keycloakUserId` into
  `AsyncLocalStorage` for downstream services to use as the actor ID.

## Alternatives Considered

### Keycloak only (custom user attributes for business data)

Store `kycStatus`, `stripeAccountId` etc. in Keycloak custom user attributes. **Rejected**:

- Keycloak user attribute model is a flat `Map<String, String>` — no strong typing, no FK constraints.
- Business queries (e.g., "find all pending KYC profiles") require Keycloak admin API calls (slow,
  not indexed) instead of Postgres queries.
- Testing business domain logic requires a running Keycloak instance.

### identity-svc only (no Keycloak)

Build OIDC + JWT issuance in `identity-svc` from scratch. **Rejected**:

- OIDC is a complex specification — implementing it correctly (especially PKCE, token refresh,
  session management, MFA) is a 3-6 month engineering effort.
- Security risk of home-grown auth is unacceptable for a payments marketplace.
- Keycloak's features (email verification, password reset, social login V1+, MFA) are free and
  battle-tested.

## References

- [Source: Architecture §Identity layers — lines 234-241]
- [Source: Story 0.6 — identity-svc Pattern Pretre scaffold + UserProfile aggregate]
- [Source: Story 0.8 — @tukio/auth KeycloakJwtGuard + @tukio/auth-client PKCE flow]
- [Source: Story 1.1 — Keycloak realm provisioning (tukio realm, 4 clients, 5 roles)]
- [Source: Story 1.10 — identity-svc full Pretre implementation]
- [ADR-0001 — identity-svc follows Pattern Pretre Clean Architecture]
- [ADR-0008 — gateway-api validates Keycloak JWTs at the perimeter]

## Implementation Notes

- `keycloakUserId` (UUID, `sub` claim in JWT) is the foreign key in `user_profiles` table.
  `@Index({ unique: true })` on this column.
- `identity-svc` webhook endpoint: `POST /internal/keycloak-events` (not public — only reachable
  within the `tukio-apps` Docker bridge network from Keycloak via VPC).
- Keycloak `tukio` realm configured with: `tukio-public` (frontends PKCE), `tukio-admin` (admin
  panel with MFA), `tukio-gateway` (gateway-api service account), `tukio-internal` (service-to-service).
- In dev, `docker-compose.dev.yml` includes Keycloak with the `tukio-realm.json` import.
