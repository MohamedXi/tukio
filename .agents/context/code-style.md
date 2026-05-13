# Code style

## TypeScript

- **Strict everywhere.** `tsconfig.base.json` enables `strict: true` +
  `noUncheckedIndexedAccess: true` + `noImplicitOverride: true` +
  `noFallthroughCasesInSwitch: true`. Every workspace inherits.
- **Never `any`.** If you reach for `any`, model the shape with `unknown`
  - a Zod parse, or a union, or generics.
- **Never `// @ts-ignore`** or `// @ts-expect-error`. Fix the type.
- **No `as` cast** unless narrowing a `unknown` result from a parsed
  schema or library boundary.
- **`isolatedModules: true`** — `export type { … }` for type re-exports.
- **`bundler` module resolution** for packages, **`nodenext`** for the
  CLI entrypoints (TypeORM data-source).
- ESM source files use `.js` import extensions (`from './foo.js'`) so the
  same source compiles for both bundler and Node ESM consumers.

## Naming

| Kind                                    | Convention                                                              | Example                                       |
| --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| Files (TS source)                       | `kebab-case.ts`                                                         | `user-profile.aggregate.ts`                   |
| React components (file + symbol)        | `PascalCase`                                                            | `Button.tsx` exports `Button`                 |
| TypeScript types / interfaces / classes | `PascalCase`                                                            | `UserProfile`, `IUserProfileRepository`       |
| Functions, variables, methods           | `camelCase`                                                             | `getUserById`, `keycloakUserId`               |
| Booleans                                | `is*` / `has*` / `can*`                                                 | `isAuthenticated`, `hasMfaEnabled`            |
| Constants (module-level immutables)     | `UPPER_SNAKE_CASE`                                                      | `MAX_RETRIES`, `STREAM_PREFIX`                |
| Enums (when unavoidable)                | `PascalCase` + `PascalCase` members                                     | `Role.AdminSuper`                             |
| Domain ports (interfaces)               | `I<Name>` prefix                                                        | `IUserProfileRepository`, `IEventPublisher`   |
| Use-case files                          | `<verb>-<noun>.usecase.ts`                                              | `get-user-profile.usecase.ts`                 |
| Aggregates                              | `<name>.aggregate.ts`                                                   | `user-profile.aggregate.ts`                   |
| Value objects                           | `<name>.value-object.ts`                                                | `email.value-object.ts`                       |
| Domain exceptions                       | `<name>.exception.ts`                                                   | `invalid-email.exception.ts`                  |
| TypeORM entities                        | `<name>.entity.ts`                                                      | `user-profile.entity.ts`                      |
| TypeORM repositories                    | `<name>.repository.ts` (impl of port)                                   | `typeorm-user-profile.repository.ts`          |
| TypeORM migrations                      | `<timestamp>-<Name>.ts`                                                 | `1715200000000-CreateUserProfilesBaseline.ts` |
| Tests (unit, colocated with source)     | `<source>.spec.ts`                                                      | `get-user-profile.usecase.spec.ts`            |
| E2E tests (per-app `test/`)             | `<feature>.e2e-spec.ts`                                                 | `user.e2e-spec.ts`                            |
| NATS event schemas                      | `<event-name>.v<n>.ts`                                                  | `user-registered.v1.ts`                       |
| NATS event subjects                     | `<domain>.<entity>.<verb>.v<n>` (lowercase, dot, kebab inside segments) | `identity.user.registered.v1`                 |
| Database tables                         | `snake_case`                                                            | `user_profiles`, `category_translations`      |
| Database columns                        | `snake_case`                                                            | `keycloak_user_id`, `created_at`              |
| Database indexes                        | `idx_<table>_<col>`                                                     | `idx_outbox_pending`                          |
| URL paths (frontend + backend)          | `kebab-case`, English                                                   | `/services/wedding-marquees`                  |
| Environment variables                   | `UPPER_SNAKE_CASE`                                                      | `DB_HOST`, `KEYCLOAK_URL`                     |

## Language

- **All code is in English** — files, components, types, props, hooks,
  variables, JSDoc, comments, tests, commit messages, devtools labels.
- **User-visible UI strings live in `messages/{fr,en}.json`** and are
  retrieved through `next-intl`. **Never** hardcode user-facing text in a
  component. See `.agents/context/i18n.md`.
- **URL paths are EN-canonical.** The French slug for SEO hreflang lives
  in `*_translations` tables (`category_translations.slug`). The
  acquisition doc `K-05` rule (FR slugs in URLs) is **overridden** by
  this convention.
- **Database identifiers are English.** `service_types`, `sub_categories`,
  not `types_de_service`, `sous_categories`.
- **NATS event names are English** in `<domain>.<entity>.<verb>.v<n>`
  shape (`identity.user.registered.v1`, NOT
  `identite.utilisateur.cree.v1`).
- **French business terms map to English identifiers** via
  `.agents/context/glossary.md`. When introducing a new French term, add
  it to the glossary **before** using it in code.
- **Commit messages** in English (Conventional Commits enforced by
  commitlint). PR titles and bodies in English.

## File / folder layout

- **Backend services** follow Pattern Pretre under `apps/<svc>/src/`. See
  `.agents/context/pretre-pattern.md`.
- **Frontend apps** follow Next.js App Router under `apps/<app>/src/app/`.
  Per-app components stay app-local; reusable atoms live in
  `@tukio/ui/components/`, composites in `@tukio/ui/patterns/`.
- **Co-locate tests with source** for unit specs (`<source>.spec.ts`).
  Backend e2e specs live in `apps/<svc>/test/` and use the dedicated
  `test/jest-e2e.json` config.

## Comments & JSDoc

- **No useless comments.** No paraphrasing the code, no JSDoc on
  self-explanatory props, no section dividers (`// ── Handlers ──`), no
  `{/* Header */}`-style JSX comments. A comment must add information the
  code can't carry.
- **JSDoc is reserved for non-trivial public APIs** — exported functions
  whose behaviour isn't obvious from the signature, exported types whose
  semantics differ from a literal read.
- **TODO / FIXME / HACK** comments must include either an owner (`@ismael`)
  or a story reference (`Story 1.7`) so they don't rot.
- **Inline `eslint-disable` is forbidden.** Refactor instead, or scope the
  rule in `eslint.config.mjs` with a focused override block.

## Logic / UI separation (frontend)

- Pages and components **render**; state, derived values, and handlers
  belong in a `useXxx` hook colocated with them.
- Server Components by default. Add `'use client'` only when the
  component genuinely needs interactivity (state, effects, event handlers).
- Data fetching uses Server Components + `fetch` for SSR; client-side
  state with TanStack Query (planned) goes through `@tukio/api-client`.

## Hook discipline (frontend)

- **No reflex `useCallback` / `useMemo` / `useRef`.** Add them only for
  measured perf wins or hook-dependency identity stability.
- **Never** start a render branch with side effects. Effects belong in
  `useEffect` / `useLayoutEffect` / Server Component.

## Imports

- **Subpath imports for `@tukio/*` packages.** Barrel imports of named
  values are forbidden by `tukio/no-barrel-import-contracts` and
  `tukio/no-barrel-import-ui`.

  ```ts
  // ✅
  import { Button } from '@tukio/ui/components/Button';
  import { CreateListingSchema } from '@tukio/contracts/dtos/catalog';
  import { OutboxPublisher } from '@tukio/messaging';

  // ❌
  import { Button } from '@tukio/ui';
  import { CreateListingSchema } from '@tukio/contracts';
  ```

- **App-local imports** use the path aliases declared in each
  `tsconfig.json` (`@/...` for `src/...`).
- **Relative imports** stay within the immediate vicinity (parent folder
  max). Anything further → use a path alias.
- **Never `import 'pg'` (or any I/O lib) from `apps/<svc>/src/domain/`.**
  Forbidden list in `eslint.config.mjs#FORBIDDEN_IN_DOMAIN`.

## Error handling

- **Domain errors extend `DomainException`** (`@tukio/contracts/exceptions/domain`).
  Use specific subclasses (`InvalidEmailException`, `UserNotFoundException`)
  with stable `tukioCode` constants (`AUTH-NOT-AUTHENTICATED-002`).
- **The `EnvelopeExceptionFilter`** catches `DomainException` and emits a
  `ErrorEnvelope`. See `.agents/context/rest-envelope.md`.
- **Never throw raw `Error`** from a domain layer. Never let an
  infrastructure exception (`QueryFailedError`, `KeycloakAdminError`)
  leak into a use case — wrap it in a `DomainException` at the
  infrastructure boundary.
- **Frontend errors** surface through Error Boundaries (Story Epic 1+).

## Validation

- **Zod is the only validation lib.** DTOs live in `@tukio/contracts/dtos/`.
- **Validate at every boundary**: HTTP body (NestJS `ZodValidationPipe`),
  NATS event consumers (parse the payload), env vars (`env.schema.ts` per
  service).

## Observability

- **Structured logs** only. Pino with JSON output. Include `service`,
  `version`, `correlationId`, `actor.id` if available.
- **Metrics** via `prom-client` registered at module-level (Story 0.6
  pattern). Never instantiate counters in a class constructor.
