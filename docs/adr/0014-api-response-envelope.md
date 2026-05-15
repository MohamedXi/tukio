# ADR-0014: Canonical REST response envelope

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`

## Context

A REST API serving 4 frontend apps needs a predictable response shape. Without a canonical envelope:

- Success responses have ad-hoc shapes: `{ id, name }`, `{ data: { id, name } }`, `[{ id }]`
- Error responses have no standard field names — frontend must handle different error shapes per endpoint
- Metadata (pagination cursor, correlationId, locale, server time) has no standard home
- Frontend HTTP clients must handle `2xx` with and without a `data` key

Forces:

- **Predictability**: every HTTP response from `gateway-api` must be parseable with the same logic.
- **Error observability**: every error response must carry a machine-readable `tukioCode`
  (`AUTH-NOT-AUTHENTICATED-002`) usable for frontend-side routing decisions (e.g., redirect to login
  on `AUTH-NOT-AUTHENTICATED-002`) and for backend alerting.
- **Pagination support**: list endpoints return cursor-based pagination metadata — this must be in a
  consistent location in the response, not bolted onto different fields per endpoint.
- **Audit metadata**: `correlationId` (for log correlation), `locale` (for i18n error messages),
  `timestamp` (for debugging time-skew issues) must be in every response.
- **Type safety**: the envelope shape must be typed in `@tukio/contracts` so the frontend
  `@tukio/api-client` can parse it generically.

## Decision

All HTTP responses from `gateway-api` wrap in the canonical envelope:

```typescript
// Success
interface DataEnvelope<T> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  code:   number;          // HTTP status code (200, 201, 204…)
  data:   T;               // response payload
  pagination?: {
    cursor:    string | null;
    hasMore:   boolean;
    totalCount?: number;
  };
  meta: {
    correlationId: string;     // UUID, set by gateway-api on request entry
    locale:        'fr' | 'en';
    timestamp:     string;     // ISO 8601
    version:       string;     // API version tag
  };
}

// Error
interface ErrorEnvelope {
  method:    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  code:      number;       // HTTP status code (400, 401, 403, 404, 422, 500…)
  error: {
    tukioCode: string;     // e.g. 'AUTH-NOT-AUTHENTICATED-002' — stable, machine-readable
    message:   string;     // human-readable, locale-aware
    details?:  unknown;    // validation details (Zod errors, etc.)
  };
  meta: { correlationId: string; locale: string; timestamp: string; version: string };
}
```

**Implementation** (automatic — no controller boilerplate):

- `ResponseEnvelopeInterceptor` in `gateway-api` wraps all successful responses in `DataEnvelope<T>`.
- `EnvelopeExceptionFilter` in `gateway-api` catches `DomainException` (and its subclasses) and
  returns `ErrorEnvelope` with the appropriate HTTP status code and `tukioCode`.
- Both are registered globally in `gateway-api/main.ts`.

**`tukioCode` convention**: `<DOMAIN>-<CATEGORY>-<NNN>` — e.g., `CATALOG-NOT-FOUND-001`,
`BOOKING-CONFLICT-002`. Stable across API versions — frontend can `switch` on `tukioCode` safely.

**Exceptions**: WebSocket, server-sent events (SSE), and health check endpoints (`/health`) are
excluded from the envelope — they return raw responses.

## Consequences

### Positive

- **Uniform parsing in Next.js**: `@tukio/api-client` has one generic `parseEnvelope<T>()` function.
  No per-endpoint response shape handling.
- **Stable `tukioCode` for frontend routing**: `AUTH-NOT-AUTHENTICATED-002` always means "redirect
  to login". Frontend can switch on stable codes rather than HTTP status codes + message strings.
- **Automatic wrapping**: controllers return their DTO directly (no manual envelope wrapping).
  The interceptor + filter handle the envelope — zero controller boilerplate.
- **Pagination metadata in a predictable location**: `response.pagination.cursor` always present on
  list endpoints — frontend paging logic is generic.
- **`correlationId` enables log tracing**: `gateway-api` logs every request with `correlationId`;
  the same ID is in the response meta — engineers can grep Pino logs for a specific failed request.

### Negative / Trade-offs

- **Slightly larger response payload**: every response carries `meta` (4 fields) even for simple
  single-resource GETs — adds ~100 bytes per response. Negligible at MVP scale.
- **`tukioCode` maintenance**: stable codes must be defined and documented in `@tukio/contracts/exceptions/`.
  A breaking code change requires a frontend deploy to handle the new code. Mitigated by the
  `Superseded` convention — old codes are kept as aliases.
- **`EnvelopeExceptionFilter` must catch everything**: unhandled exceptions from downstream services
  must be caught and wrapped in `ErrorEnvelope`. A raw NestJS `InternalServerErrorException` that
  bypasses the filter would break frontend parsing. Filter order matters.

### Neutral

- The HTTP status code and the `code` field in the envelope are always the same value — no `200` with
  `code: 404` in the envelope. This is intentional: the envelope does not replace HTTP semantics.

## Alternatives Considered

### RFC 7807 (Problem Details for HTTP APIs)

IETF standard for error responses. **Considered for errors**: RFC 7807 standardizes error payloads
(`type`, `title`, `status`, `detail`, `instance`). **Not adopted**: tukio needs a stable machine-readable
`tukioCode` that RFC 7807's `type` URI doesn't cleanly provide. Also, RFC 7807 is error-only —
success responses would still need a separate envelope convention.

### No envelope (raw DTOs)

`GET /users/1` returns `{ id, email, firstName }` directly. `POST /bookings` returns `{ bookingId }`.
**Rejected**: every response shape is unique, `@tukio/api-client` needs per-endpoint parsing logic,
pagination has no standard location, and errors have no standard shape for the frontend to handle.

### GraphQL

Single endpoint, typed queries, errors in `{ data, errors }`. **Deferred to V2+**: GraphQL adds
significant server-side complexity (schema stitching across 10 services, subscriptions for real-time
booking updates) and requires a different client library (Apollo). REST is simpler to develop and
test at MVP scale.

## References

- [Source: Architecture §API Response Format — lines 1252-1505]
- [Source: Story 0.2 — DataEnvelope + ErrorEnvelope types in @tukio/contracts/envelope]
- [Source: Story 0.6 — ResponseEnvelopeInterceptor + EnvelopeExceptionFilter in identity-svc (canonical)]
- [ADR-0011 — @tukio/contracts/envelope is the single source of truth for envelope types]
- [ADR-0008 — gateway-api is the only place the envelope is applied]

## Implementation Notes

- `ResponseEnvelopeInterceptor` uses `tap()` from `rxjs` to intercept the response stream.
  The HTTP method is extracted from `ExecutionContext.switchToHttp().getRequest().method`.
- `EnvelopeExceptionFilter` catches `DomainException` (maps to specific 4xx codes via `tukioCode`
  prefix) and all other `Error` instances (maps to 500).
- `tukioCode` stability contract: once a `tukioCode` is documented in `@tukio/contracts/exceptions/`,
  it is never changed — only deprecated and superseded by a new code.
- `tukio/no-bypass-envelope` lint rule (Story 0.11) rejects `@Res()` decorator usage in controllers
  (which bypasses the interceptor/filter) — prevents accidental raw responses.
