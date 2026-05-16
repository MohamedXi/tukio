# gateway-api — Public BFF for the Tukio marketplace

`gateway-api` is the **public REST gateway** for tukio.one. It sits in front of
the internal microservices (identity-svc, catalog-svc, booking-svc, …) and is
the only service exposed to the public internet.

## Pattern Pretre — BFF flavour

This service follows Pattern Pretre (Clean Architecture — `.agents/context/pretre-pattern.md`)
with one twist : as a Backend-for-Frontend, gateway-api **does not own
aggregates or persistence**. Its domain layer describes the contracts of the
downstream services it forwards to.

```
src/
├─ main.ts                                  Fastify + interceptor + filter + cookies + correlation
├─ app.module.ts                            DI root — TukioAuthModule + ThrottlerModule + HttpModule
├─ domain/
│  ├─ exception/                            DomainException sub-classes (envelope filter targets)
│  └─ ports/
│     ├─ tokens.ts                          DI Symbol tokens (LOGGER, IDENTITY_SVC_CLIENT…)
│     ├─ config.port.ts                     IConfigService — env getters
│     ├─ logger.port.ts                     ILogger port
│     ├─ identity-svc.port.ts               IIdentitySvcClient interface
│     └─ identity-svc.errors.ts             Library-level errors thrown by the port impl
├─ usecases/
│  └─ register-customer.forwarder.ts        Validation + downstream call + error mapping
└─ infrastructure/
   ├─ config/                               Zod-validated env + NestConfig wiring
   ├─ logger/                               Pino adapter
   ├─ external/identity-svc/                axios + axios-retry + HMAC signing
   ├─ http/
   │  ├─ controllers/                       HealthController, AuthCustomerController
   │  ├─ filters/                           EnvelopeExceptionFilter (DomainException, ZodError, 429)
   │  ├─ interceptors/                      ResponseEnvelopeInterceptor (ADR-014)
   │  ├─ envelope/                          Envelope build helpers
   │  ├─ utils/                              merge-acquisition (first-touch wins)
   │  ├─ decorators/                        @Cookies()
   │  └─ dtos/                              nestjs-zod DTO wrappers
   └─ usecases-proxy/                       Pretre UseCaseProxy wiring (global)
```

The boundaries are enforced by `eslint-plugin-boundaries` (see `eslint.config.mjs`).
`domain/` may not import `@nestjs/*`, `axios`, `ioredis`, or any I/O lib.

## Endpoints

| Method | Path                         | Story | Notes                                                                                       |
| ------ | ---------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| GET    | `/health`                    | 0.6   | Liveness — `@Public()`                                                                      |
| GET    | `/ready`                     | 0.6   | Readiness — `@Public()`                                                                     |
| POST   | `/v1/auth/customer/register` | 1.2c  | Public B2C registration — `@Public()` + `@Throttle({ default: { limit: 5, ttl: 60_000 } })` |

Every response is wrapped in the canonical REST envelope
(`{ method, code, data | error, pagination?, meta }` — ADR-014).

## Cross-cutting concerns

- **Auth**. `TukioAuthModule` (from `@tukio/auth`) installs `KeycloakJwtGuard`
  globally — every route requires a valid Bearer token unless decorated with
  `@Public()`. JWKS keys are cached for 10 minutes.
- **Rate limiting**. `@nestjs/throttler` with Upstash Redis storage
  (`@nest-lab/throttler-storage-redis`). One named scope `default` (60/min/IP);
  sensitive routes opt in to a stricter limit via per-handler `@Throttle`
  overrides (5/min/IP for register, login, password-reset, payments — NFR10).
- **Correlation**. `@tukio/messaging/correlation/middleware` extracts the
  `X-Tukio-Correlation-Id` inbound header (or mints a fresh uuid), pins it to
  `request.correlationId`, and runs the rest of the request in
  `AsyncLocalStorage` so any code in the request tree can fetch it via
  `correlationContext.getCorrelationId()`.
- **Cookies**. `@fastify/cookie` is registered in `main.ts`. Param decorator
  `@Cookies('name')` returns the cookie value (or `undefined`).
- **HMAC signing for `/internal/*` calls**. When the gateway forwards a
  request to a backend `/internal/*` endpoint (Story 1.2b
  `InternalServiceGuard`), it signs the canonical
  `${timestamp}.${METHOD}.${path}.${sha256(body)}` string with HMAC-SHA256 over
  `TUKIO_INTERNAL_SERVICE_SECRET` and sends three headers:
  `X-Internal-Service-Token`, `X-Internal-Service-Timestamp`,
  `X-Internal-Service-Body-Sha256`.

## Local dev

```bash
pnpm docker:up:wait                       # postgres + keycloak + nats + redis up
pnpm --filter=identity-svc start:dev      # in another shell — required for /v1/auth/customer/register
pnpm --filter=gateway-api start:dev       # serves on :4000

# Smoke test the register endpoint
curl -X POST http://localhost:4000/v1/auth/customer/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"StrongPass-2026!","firstName":"A","lastName":"B","locale":"fr","acceptTerms":true,"acceptMarketing":false}'
```

## Testing

```bash
pnpm --filter=gateway-api test            # unit specs (jest, in-package config)
pnpm --filter=gateway-api test:e2e        # supertest/fastify-inject E2E specs with mock IIdentitySvcClient
pnpm --filter=gateway-api lint            # eslint incl. boundaries plugin
pnpm --filter=gateway-api typecheck       # tsc --noEmit
```

E2E specs in `test/` build a `Test.createTestingModule` app with the
`IIdentitySvcClient` replaced by a Jest mock — no Postgres / Keycloak / Redis
required (throttler falls back to in-memory storage).

## References

- Story 1.2c — `_bmad-output/implementation-artifacts/1-2c-gateway-api-pretre-forwarder.md`
- Pattern Pretre — `.agents/context/pretre-pattern.md`
- REST envelope (ADR-014) — `.agents/context/rest-envelope.md`
- Architecture API security — `_bmad-output/planning-artifacts/architecture.md` §API Security
