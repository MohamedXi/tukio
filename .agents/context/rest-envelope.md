# REST envelope (ADR-014)

**Every** HTTP response from `gateway-api` (and any backend HTTP handler)
wraps the payload in a canonical envelope. Source of truth:
`packages/contracts/src/envelope/`.

## Shape

```ts
// Success
interface SuccessEnvelope<TData> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  code: number; // HTTP status, e.g. 200
  data: TData | TData[] | null; // single resource, collection, or null (404 bag)
  pagination?: Pagination; // ONLY on collection responses
  meta: Meta;
}

// Error
interface ErrorEnvelope {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  code: number; // HTTP status, e.g. 401
  error: ErrorBody;
  meta: Meta;
}

interface ErrorBody {
  type: string; // URI: 'https://tukio.one/errors/<slug>'
  title: string; // Short human title (EN)
  detail: string; // Long human description (EN by default)
  instance: string; // request path: '/v1/users/abc'
  tukioCode: string; // 'AUTH-NOT-AUTHENTICATED-002' — see naming below
  issues?: ValidationIssue[]; // ONLY for ValidationException (Zod errors)
}

interface ValidationIssue {
  path: string; // 'body.email' or 'query.limit'
  code: string; // Zod issue code
  message: string;
}

interface Meta {
  timestamp: string; // ISO 8601
  correlationId: string; // UUID — propagated across services
  locale: 'fr' | 'en';
  version?: string; // app version, optional
  deprecation?: string; // RFC 8594 deprecation header value
  requestId?: string; // request tracing ID, distinct from correlationId
}

interface Pagination {
  page: number; // 1-indexed
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

## Imports

```ts
import type {
  SuccessEnvelope,
  ErrorEnvelope,
  Meta,
  Pagination,
  ErrorBody,
  ValidationIssue,
} from '@tukio/contracts/envelope';
```

## How responses are built

Two paths, both producing the same shape:

### 1. Auto-wrap via `EnvelopeInterceptor` (most cases)

A NestJS interceptor (registered globally per service) inspects the
controller's return value and wraps it in `SuccessEnvelope`. The
controller can return the raw aggregate / DTO; the interceptor handles
`method`, `code`, `meta`.

```ts
@Get(':id')
async getById(@Param('id', new ParseUUIDPipe()) id: string): Promise<UserProfile> {
  return this.useCase.execute(id);
}

// Wire output (HTTP 200):
// { method: 'GET', code: 200, data: { id: '...', email: '...', ... }, meta: { ... } }
```

### 2. Build the envelope explicitly (collections + special cases)

For collections you must add `pagination`. For 204 No Content, return
`{ data: null }`. The interceptor lets you opt-out if the controller
already returns a `SuccessEnvelope<T>`.

```ts
@Get()
async list(@Query() query: ListUsersDto): Promise<SuccessEnvelope<UserProfile>> {
  const { items, page, pageSize, totalItems } = await this.useCase.execute(query);
  return {
    method: 'GET',
    code: 200,
    data: items,
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize), hasNextPage: page * pageSize < totalItems, hasPreviousPage: page > 1 },
    meta: this.metaBuilder.build(/* ... */),
  };
}
```

## Errors via `EnvelopeExceptionFilter`

Every service registers a global `EnvelopeExceptionFilter` (in
`infrastructure/exception/`). It catches:

1. **`DomainException`** subclasses (`@tukio/contracts/exceptions/domain`)
   — produces `ErrorEnvelope` with the exception's `tukioCode`, `title`,
   `detail`, and `code` (HTTP status).
2. **`ValidationException`** from Zod — produces `ErrorEnvelope` with
   `tukioCode: 'VALIDATION-INVALID-INPUT-001'` and a populated `issues[]`
   array mapping Zod issues to `ValidationIssue`.
3. **`HttpException`** (NestJS native) — wrapped to envelope shape with
   `tukioCode: 'HTTP-<STATUS>-<NNN>'`.
4. **Anything else (`Error`)** — produces a generic
   `tukioCode: 'INTERNAL-UNHANDLED-001'` with `code: 500` and a sanitised
   `detail` (no stack trace leaked to client).

The filter uses **duck-typing** for `DomainException` (`isDomainLike()`)
to avoid a hard dependency on `@tukio/contracts/exceptions` from
`@tukio/auth` (which lives in its own package and would otherwise have a
circular dep).

## `tukioCode` naming

Pattern: `<DOMAIN>-<CASE>-<NNN>` (UPPER-KEBAB-3DIGIT).

| Family             | Examples                                                |
| ------------------ | ------------------------------------------------------- |
| Authentication     | `AUTH-NOT-AUTHENTICATED-002`, `AUTH-INVALID-TOKEN-003`  |
| Authorisation      | `AUTH-INSUFFICIENT-ROLE-001`, `AUTH-MFA-REQUIRED-001`   |
| Validation         | `VALIDATION-INVALID-INPUT-001`                          |
| Resource lifecycle | `USER-NOT-FOUND-001`, `LISTING-ALREADY-PUBLISHED-002`   |
| Business rule      | `BOOKING-SLOT-TAKEN-001`, `PAYMENT-AMOUNT-MISMATCH-001` |
| Generic HTTP wrap  | `HTTP-404-001`, `HTTP-405-001`                          |
| Internal           | `INTERNAL-UNHANDLED-001`, `INTERNAL-DB-CONNECT-001`     |

The pattern is **stable per HTTP error contract** — never reuse a code for
a different meaning. Bump the `NNN` suffix when introducing a refinement
that consumers might branch on.

## `meta.correlationId` propagation

- **HTTP**: `gateway-api` reads `X-Correlation-Id` from the request (or
  generates a UUID v7) and propagates it to:
  - downstream NATS calls (as a header in JetStream message metadata),
  - `meta.correlationId` in the response.
- **NATS event consumers**: read the header, log it on every Pino entry,
  and propagate to outgoing events / HTTP calls.
- **Frontend**: should NOT generate `correlationId` — let the gateway do it,
  and surface it in error toasts / dev tools for support cases.

## `meta.locale`

- `gateway-api` resolves the locale from the URL prefix (`/{locale}/...`)
  or `Accept-Language` header (default `'fr'`).
- Backend templates (Resend emails, error `title`/`detail` for end-user
  errors) dispatch on `meta.locale`.
- Internal logs / metrics never depend on `locale` — they're language-free.

## Anti-patterns to refuse

- **Returning a raw DTO without the envelope.** Either let the
  interceptor wrap it, or return an explicit `SuccessEnvelope`.
- **Throwing `new Error('...')` from a use case.** Throw the right
  `DomainException` subclass with a stable `tukioCode`.
- **Skipping `meta.correlationId`.** Required on every envelope.
- **Putting the French version of `title`/`detail` in `tukioCode`.** The
  code is a stable EN identifier; locale-specific text goes in `title` /
  `detail` after locale dispatch.
- **`pagination` on a single-resource response.** It's collection-only.
- **Leaking a stack trace into `error.detail` in prod.** The filter must
  sanitise.
