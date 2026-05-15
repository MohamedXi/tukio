# ADR-0011: @tukio/contracts shared package as single source of truth

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`, `frontend`

## Context

A monorepo with 4 Next.js frontends + 10 NestJS services faces a classic type divergence problem:
each time a DTO or event schema is defined independently in a service, it becomes a drift vector.
Frontend may depend on `booking.status === "PENDING"` while `booking-svc` emits `"pending"` — a
silent runtime bug that only appears in the UI.

Forces:

- **Type safety across boundaries**: HTTP response DTOs must match what `gateway-api` sends and what
  Next.js components consume. NATS event payloads must match what the emitting service writes and
  what consumer services parse.
- **Single source of truth**: any change to an event schema must propagate to all consumers — this
  is only enforceable if the schema lives in one place.
- **No code generation overhead**: tools like Protobuf or OpenAPI codegen add a compilation step and
  tooling complexity that slows iteration speed in a small team.
- **Versioning**: events have versioned subjects (`.v1`, `.v2`) — the schema file is the version
  artifact; no separate schema registry needed.

## Decision

A shared workspace package `@tukio/contracts` (in `packages/contracts/`) is the single source of
truth for all cross-boundary types:

- **REST envelope types**: `DataEnvelope<T>`, `ErrorEnvelope`, `PaginationMeta` — used by `gateway-api`
  interceptor and Next.js `@tukio/api-client` consumers.
- **NATS event schemas**: `*.v1.ts` files in `src/events/<domain>/` — Zod-parsed on both producer
  and consumer side.
- **Shared DTOs**: request/response body shapes for `gateway-api` endpoints.
- **Shared types**: `Locale`, `Currency`, `Money`, `Actor`, `DomainEvent`, `AcquisitionContext`.

**Import convention** (enforced by `tukio/no-barrel-import-contracts` lint rule):

```typescript
// ✅ subpath imports only
import { DataEnvelope } from '@tukio/contracts/envelope';
import { BookingRequestedV1 } from '@tukio/contracts/events/booking/booking-requested.v1';
import type { AcquisitionContext } from '@tukio/contracts/types/Acquisition';

// ❌ barrel import rejected by lint
import { DataEnvelope, BookingRequestedV1 } from '@tukio/contracts';
```

## Consequences

### Positive

- **Type safety at compile time**: a DTO change in `@tukio/contracts` immediately breaks TypeScript
  in all consumers — discovered at `pnpm typecheck` before reaching CI.
- **Zero schema drift**: there is one `BookingRequestedV1` type — no backend version and frontend
  version to keep in sync.
- **Subpath imports → tree-shaking**: `optimizePackageImports` in Next.js config ensures only the
  needed types are bundled, not the entire contracts package.
- **Event versioning via file**: `booking-requested.v1.ts` → `booking-requested.v2.ts` — the old
  version is kept for backward-compatible consumers during the rollover period.
- **Zod validation on both sides**: the same Zod schema validates event payloads on the producer
  (before writing to outbox) and the consumer (before processing) — double safety net.

### Negative / Trade-offs

- **All consumers must update together** on a breaking schema change. Mitigated by event versioning
  (`.v1`, `.v2`) — new version is deployed alongside old until all consumers migrate.
- **Package must be rebuilt** when types change (in the monorepo, TypeScript sources are shared
  directly without a build step — `exports` point to `./src/*.ts`). CI compiles all consuming
  workspaces to catch breakage.
- **Barrel import restriction** requires developers to use precise subpath imports — adds minor friction
  but is enforced by lint (rejected PRs, not just warnings).

### Neutral

- `@tukio/contracts` has `"type": "module"` with `exports` pointing to `.ts` source files — this
  works under the bundler module resolution of Next.js and Vitest. NestJS services use webpack
  bundling (Story 0.6 decision) which resolves TypeScript sources correctly.

## Alternatives Considered

### Types defined per service, duplicated in Next.js

Each NestJS service defines its own response types; Next.js components define their own request
types. **Rejected**: silent drift between backend DTO and frontend type is a guaranteed category of
bug in a solo team. Observed in the tukio prototype — a `BookingStatus` enum had 3 different values
across 3 files before the monorepo was restructured.

### OpenAPI / Swagger codegen

`gateway-api` exposes a Swagger spec; a codegen step produces TypeScript clients for Next.js.
**Considered** but rejected for MVP: codegen adds a build step that must be committed or CI-generated.
The generated code is boilerplate; type drift is still possible if codegen is not run. The
`@tukio/contracts` approach is simpler for the monorepo context.

### gRPC + Protobuf

Define all inter-service contracts in `.proto` files. **Deferred to V2+**: requires gRPC client
libraries in Next.js frontends (unusual), Protobuf compilation step, and `grpc-gateway` for REST
clients. Overkill for MVP scale. Can be introduced for specific high-throughput internal services.

## References

- [Source: Architecture §@tukio/contracts — line 156]
- [Source: Story 0.2 — @tukio/contracts initial scaffold (envelope + event schemas + DTOs)]
- [Source: Story 0.11 — `tukio/no-barrel-import-contracts` lint rule]
- [ADR-0014 — REST envelope types defined in @tukio/contracts/envelope]
- [ADR-0002 — NATS event schemas versioned in @tukio/contracts/events/]

## Implementation Notes

- New shared type → new file in `packages/contracts/src/types/` + subpath export in
  `package.json` `exports` + re-export in `src/types/index.ts`.
- New NATS event → `packages/contracts/src/events/<domain>/<event>.v<n>.ts` with Zod schema +
  TypeScript type export + subpath export in `package.json`.
- Schema compatibility check: `pnpm --filter=@tukio/contracts check:compat` runs
  `scripts/check-schema-compat.mjs` to detect breaking changes between versions (AJV + JSON diff).
- `tsd` is not a dependency (replaced by inline `AssertEqual<A, B>` pattern) — see Story 0.9 note.
