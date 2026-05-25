# ADR-0019: Abandon PhasetTwo Keycloak Distribution — Use Standard Keycloak 26

- **Status**: Accepted
- **Date**: 2026-05-25
- **Deciders**: Ismael (founder)
- **Tags**: `architecture`, `security`, `ops`

## Context

The project adopted the PhasetTwo open-source Keycloak distribution (`quay.io/phasetwo/phasetwo-keycloak`) in Story 1.1 for its bundled extensions (Organizations SPI, webhooks, magic links). Keycloak 25/26 was the underlying version.

During Story 1.4c (PKCE login flow implementation), a blocking bug was discovered: **PhasetTwo's `keycloak-orgs` SPI overrides the Cookie authenticator and raises `AuthenticationFlowException` on fresh PKCE `authorize` requests**, even when no organization context is involved. This prevented the standard PKCE Authorization Code flow from working at all in the local dev environment, blocking all Story 1.4c/d development and testing.

Additionally, **PhasetTwo no longer publishes predictable stable tags** — `:latest` tracks an unversioned rolling release, causing non-reproducible builds and making production deployments unreliable.

Story 1.13 (self-registration provisioning) was designed around PhasetTwo webhooks to receive `REGISTER` events from Keycloak and provision user profiles reactively. Abandoning PhasetTwo requires re-scoping Story 1.13.

## Decision

Switch from `quay.io/phasetwo/phasetwo-keycloak:latest` to the official **`quay.io/keycloak/keycloak:26.2`** image for all environments (dev, staging, prod). PhasetTwo extensions (Organizations, webhooks, magic links) are abandoned. Story 1.13 is re-scoped to use the Phasetwo Webhook SPI replacement (see Implementation Notes).

## Consequences

### Positive

- PKCE Authorization Code flow works correctly with standard Keycloak 26.2.
- Pinned image tag (`26.2`) — reproducible builds, predictable upgrades.
- Reduced complexity: no third-party SPI that overrides core authenticators.
- Keycloak 26.x is LTS — well-documented, stable security patches.

### Negative / Trade-offs

- **Story 1.13 re-scope**: The webhook-based user provisioning (`REGISTER` event → `identity-svc`) must be reimplemented without PhasetTwo webhooks. Alternative: Keycloak Admin Events polling, or a lightweight SPI event listener (Java) deployed as a custom provider JAR. Effort: ~2-3j additional for Story 1.13.
- **Organizations SPI lost**: PhasetTwo Organizations extension (multi-tenant org management) is no longer available. This feature was not yet used in any implemented story (was speculative for V2+). Impact: none for MVP.
- **Magic Links SPI lost**: PhasetTwo magic-link authentication is no longer available. Not yet scheduled. Impact: none for MVP.
- **Realm export compatibility**: The `tukio.realm.json` export was generated from a PhasetTwo instance. Standard Keycloak 26.2 ignores unknown fields gracefully on import, but the export must be re-generated from a standard 26.2 instance before production use.

### Neutral

- The Keycloak Admin REST API and Keycloak-js client SDK remain unchanged.
- Social IdPs (Google, Microsoft — Story 1.13) work identically on standard Keycloak.
- Custom `tukio` login theme (`login.ftl`, `register.ftl`) is unaffected.

## Alternatives Considered

### Fix the PhasetTwo PKCE Bug (Keep PhasetTwo)

Investigated: the `keycloak-orgs` SPI unconditionally registers itself on the Cookie authenticator in the browser flow. Workaround requires forking the flow and disabling the org authenticator — complex, fragile, version-locked. Rejected: maintenance burden outweighs PhasetTwo benefits for MVP scope.

### Pin PhasetTwo to a Specific Tag

PhasetTwo does not publish versioned stable tags aligned to Keycloak versions in a predictable cadence. The only available tags were `:latest` and date-stamped nightlies. Rejected: insufficient stability guarantee for production.

### Use Keycloak SPI Java Extension for Webhooks

Write a minimal custom event listener SPI that POSTs to `identity-svc` on `REGISTER`. This is the replacement strategy for Story 1.13 (see below). Accepted as consequence.

## References

- [Story 1.1 — Keycloak realm provisioning (used PhasetTwo)]
- [Story 1.13 — Self-registration provisioning (re-scoped by this ADR)]
- [Story 1.4c — PKCE login flow (blocked by PhasetTwo PKCE bug, fixed by this ADR)]
- [ADR-0009 — Keycloak + identity-svc split]

## Implementation Notes

**Story 1.13 re-scope**: Replace PhasetTwo webhook listener with a **Keycloak SPI event listener** (`EventListenerProvider` implementation) compiled as a JAR and mounted into the Keycloak container via `providers/` volume. The listener POSTs `REGISTER` events to `identity-svc /internal/keycloak-events` (HMAC-signed, existing endpoint spec unchanged). Build pipeline: `mvn package -f infra/keycloak/providers/pom.xml` + Docker multi-stage. Estimated effort: +2j on Story 1.13.

**Realm export**: After switching to standard Keycloak 26.2, run `pnpm docker:bootstrap` and then `docker exec tukio_keycloak /opt/keycloak/bin/kc.sh export --realm tukio --dir /tmp/export --users skip` to regenerate `tukio.realm.json` without PhasetTwo-specific fields.
