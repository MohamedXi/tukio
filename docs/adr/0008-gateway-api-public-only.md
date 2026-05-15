# ADR-0008: gateway-api as the sole public entry point

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `security`, `backend`

## Context

With 10 microservices, each exposing an HTTP API, there are two deployment topologies:

1. **All services exposed publicly**: each service is reachable directly from the internet. Clients
   call `identity-svc:4001`, `catalog-svc:4002`, etc. directly.
2. **Single public gateway**: one service (or API gateway product) receives all public traffic and
   proxies to downstream services on an internal network.

Forces:

- **Attack surface**: each publicly exposed service is an attack surface that must handle JWT
  validation, rate limiting, CORS, and TLS termination independently.
- **Auth consistency**: JWT validation must happen at exactly one place — duplicating it in 10
  services risks inconsistency (one service on an old JWKS, another validating the wrong audience).
- **Cross-cutting concerns**: CORS headers, request tracing (`correlationId`), envelope formatting,
  and Slack alerts on 5xx must be applied uniformly — easier in one place than 10.
- **Operational simplicity**: exposing only one service simplifies firewall rules (DO Cloud Firewall
  on `tukio-apps` — ADR-0015), TLS termination (Caddy handles TLS at port 443, proxies to
  `gateway-api:4000`), and rate limiting configuration.

## Decision

`gateway-api` (port 4000) is the **sole publicly reachable HTTP entry point**. All other services
are network-internal only (reachable within the `tukio-apps` Docker bridge network from
`gateway-api`).

Responsibilities of `gateway-api`:

- **JWT validation** via `KeycloakJwtGuard` (`@tukio/auth`) — validates signature, expiry, audience.
  All protected routes require a valid JWT. Public routes (e.g., `GET /listings/search`) are
  explicitly whitelisted with `@Public()` decorator.
- **CORS** — configured in `main.ts` with allowed origins `*.tukio.one`.
- **Envelope formatting** — `ResponseEnvelopeInterceptor` wraps all responses in
  `{ method, code, data, pagination?, meta }` (ADR-0014).
- **Request correlation** — `correlationId` is set in `AsyncLocalStorage` at the entry point and
  propagated to all downstream calls via HTTP headers.
- **Rate limiting** — `ThrottlerModule` at gateway level (V1+, deferred).
- **Downstream HTTP calls** — `gateway-api` calls downstream services via internal HTTP
  (using `@tukio/api-client` typed wrappers) and assembles composite responses when needed.

All 10 microservices bind to `0.0.0.0` inside the Docker network but are **not published to
host ports** (no `ports:` entry in `apps.prod.yml`) — they are only reachable by container hostname
within the `tukio-apps` Docker bridge network.

## Consequences

### Positive

- **One security perimeter**: JWT validation, CORS, rate limiting — configured once in `gateway-api`.
  A JWKS rotation only requires a cache flush in `gateway-api`, not 10 service updates.
- **Simple firewall rules**: only port 443 (Caddy) is exposed publicly. The `tukio-apps` Docker
  network is an internal network — no service-to-service traffic escapes to the public internet.
- **Consistent envelope**: all public API responses share the same `{ method, code, data, … }`
  shape (ADR-0014) — enforced in one NestJS interceptor, not 10.
- **Tracing**: `correlationId` injected at the gateway perimeter flows through all downstream logs.
- **Independent testability**: downstream services can be tested without JWT complexity — just
  internal HTTP calls.

### Negative / Trade-offs

- **gateway-api is a SPOF**: if it crashes, all public API traffic stops. Mitigated by
  `restart: unless-stopped` in docker-compose and UptimeRobot alerts (Story 0.12).
- **Latency**: every public request makes at least one extra HTTP hop (Caddy → gateway-api →
  downstream service). Under normal LAN/VPC conditions this adds < 2ms — acceptable.
- **gateway-api scope creep risk**: the temptation to add business logic to `gateway-api` (instead
  of delegating to domain services) must be resisted. `gateway-api` is a proxy + auth guard only —
  no domain logic.
- **No mTLS between gateway-api and downstream services** (MVP): services communicate via plain HTTP
  on the Docker bridge network. mTLS is a V1+ concern when services scale across multiple hosts.

### Neutral

- `gateway-api` shares `tukio_identity` DB for auth metadata lookups (documented coupling — see
  ADR-0003 notes). This is intentional and bounded.

## Alternatives Considered

### All services publicly exposed

Each service handles its own JWT validation and CORS. **Rejected**: 10 separate security surfaces,
10 places to update JWKS configuration, inconsistent CORS headers (one service on an old config
after a deploy), no single point to add rate limiting or correlation tracing.

### Managed API Gateway (Kong, AWS API Gateway, Tyk)

Production-grade API gateway products. **Rejected for MVP**:

- Kong (self-hosted): requires a Postgres instance + Kong control plane + Kong data plane — €15-30
  additional/month, significant ops overhead.
- AWS API Gateway: vendor lock-in, egress cost, latency from DO to AWS.
- Tyk Cloud: pricing starts at €50+/month.

All are over-engineered for MVP traffic (< 1k req/day). `gateway-api` as a NestJS service provides
all needed functionality at zero additional cost.

### BFF (Backend for Frontend) pattern per app

One gateway per frontend (public-bff, customer-bff, seller-bff, admin-bff). **Deferred to V1+**: adds
operational complexity (4 gateways to maintain). Current MVP traffic does not justify the additional
deployment units. Can be introduced when each app's traffic pattern diverges significantly.

## References

- [Source: Architecture §gateway-api — line 2247]
- [Source: Story 0.6 — KeycloakJwtGuard + @tukio/auth package]
- [Source: Story 0.8 — JWT validation + CORS in gateway-api main.ts]
- [Source: Story 0.12 / ADR-0015 — Caddy terminates TLS, proxies to gateway-api:4000]
- [ADR-0014 — Response envelope applied by gateway-api interceptor]
- [ADR-0009 — Keycloak issues JWTs; gateway-api validates them]

## Implementation Notes

- `@Public()` decorator marks routes that bypass `KeycloakJwtGuard` (e.g., search, listing detail).
- Downstream service URLs are resolved from env: `IDENTITY_SVC_URL=http://identity-svc:4001`,
  `CATALOG_SVC_URL=http://catalog-svc:4002`, etc. (Docker container hostnames within the bridge network).
- `gateway-api` uses `HttpModule` (axios) for downstream calls — not gRPC (MVP simplicity).
- `@tukio/api-client` provides typed wrappers for all downstream service calls, ensuring type safety
  across the gateway boundary.
