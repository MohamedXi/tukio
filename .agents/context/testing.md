# Testing

Test pyramid per service: **unit (domain + usecases) → integration (testcontainers) → e2e (real infra)**.
Frontends use **Vitest + Testing Library** for component / hook tests.
Chaos tests are a separate `*.chaos-spec.ts` suite per service.

## Test runners

| Workspace                | Runner   | Config                         |
| ------------------------ | -------- | ------------------------------ |
| `apps/<frontend>/`       | Vitest 4 | `vitest.config.ts` per app     |
| `apps/<service>/` (unit) | Jest     | `jest.config.ts`               |
| `apps/<service>/` (e2e)  | Jest     | `test/jest-e2e.json`           |
| `packages/<lib>/`        | Vitest 4 | `vitest.config.ts` per package |

## Backend service test layout

Per Pretre, tests mirror the source structure:

```
apps/<svc>/
├── src/
│   ├── domain/<file>.spec.ts            unit (colocated)
│   ├── usecases/<file>.usecase.spec.ts  unit (colocated)
│   └── infrastructure/<file>.spec.ts    integration tests when reasonable
└── test/
    ├── jest-e2e.json                    Jest config (different moduleNameMapper)
    ├── *.e2e-spec.ts                    e2e — full app boot + supertest
    ├── chaos/*.chaos-spec.ts            chaos suite (run via /chaos)
    └── __mocks__/                       module mocks (jwks-rsa, etc.)
```

### Unit tests (domain + usecases)

- **No I/O, no NestJS, no DB.** Pure TypeScript + jest.
- **Test names** describe the behaviour (`it('throws InvalidEmailException when local part is empty')`).
- **Factories** under `test/factories/` or co-located when reasonable.

```ts
// apps/identity-svc/src/usecases/get-user-profile.usecase.spec.ts
describe('GetUserProfileUseCase', () => {
  it('returns the profile when found', async () => {
    const repo: IUserProfileRepository = {
      findById: jest.fn().mockResolvedValue(makeUserProfile()) /* ... */,
    };
    const useCase = new GetUserProfileUseCase(repo);
    const result = await useCase.execute('uuid-1');
    expect(result.id).toBe('uuid-1');
  });

  it('throws UserNotFoundException when not found', async () => {
    const repo: IUserProfileRepository = { findById: jest.fn().mockResolvedValue(null) /* ... */ };
    const useCase = new GetUserProfileUseCase(repo);
    await expect(useCase.execute('absent')).rejects.toBeInstanceOf(UserNotFoundException);
  });
});
```

### E2E tests (`test/*.e2e-spec.ts`)

- **Boot the full Nest app** via `buildTestApp()` helper.
- **Supertest** against the running app.
- **Mock external HTTP** (Keycloak JWKS, Stripe API) via `nock` —
  setup in `beforeAll`, cleanup in `afterAll`.
- **Mock the DB** with `testcontainers` (`@tukio/testing`) for true
  integration, or with `pg-mem` for speed when full SQL coverage isn't
  needed.
- **Use `runInBand`** when chaos tests + concurrency are involved
  (Jest default for e2e).

```ts
describe('GET /v1/users/:id', () => {
  let app: INestApplication;

  beforeAll(async () => {
    setupJwksMock(); // nock-based JWKS for Keycloak validation
    app = await buildTestApp({
      /* test config */
    });
  });

  afterAll(async () => {
    nock.cleanAll();
    await app.close();
  });

  it('returns 401 enveloped when no auth header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/users/uuid-1');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      method: 'GET',
      code: 401,
      error: { tukioCode: 'AUTH-NOT-AUTHENTICATED-002' },
      meta: { correlationId: expect.any(String), locale: 'fr' },
    });
  });
});
```

### testcontainers helpers (`@tukio/testing`)

Story 0.9 ships helpers that boot real images for full-fidelity
integration tests:

```ts
import {
  startPostgresContainer,
  startNatsContainer,
  startKeycloakContainer,
  startMeilisearchContainer,
  startRedisContainer,
} from '@tukio/testing';

beforeAll(async () => {
  const pg = await startPostgresContainer({ dbName: 'test_identity' });
  // ...
});
```

Image versions are **aligned with `docker-compose.dev.yml`** (Story 0.10
parity). `startKeycloakContainer` can import a realm:

```ts
const kc = await startKeycloakContainer({
  realm: 'tukio',
  importJsonPath: 'infra/scripts/keycloak/realm-export.json',
});
```

## Frontend tests (Vitest + Testing Library)

- **Component tests** co-located: `Button.spec.tsx` next to `Button.tsx`.
- **Mock-server tests** via MSW for hooks that call the API.
- **`@testing-library/react`** semantics (`screen.getByRole`,
  `userEvent.click`) — avoid `container.querySelector`.
- **Accessibility** — assert `aria-*` and `:focus-visible` via
  `expect(...).toHaveFocus()` when behaviour matters.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

it('shows a Spinner when loading', () => {
  render(<Button loading>Submit</Button>);
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // Spinner
});

it('forwards the click event', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>OK</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(onClick).toHaveBeenCalledOnce();
});
```

## Chaos tests

- Live under `apps/<svc>/test/chaos/*.chaos-spec.ts`.
- Filtered by Jest's `--testPathPattern=chaos` or Vitest's
  `--testNamePattern=@chaos`.
- Cover: NATS disconnect mid-publish, consumer crash mid-process, PG
  LISTEN/NOTIFY connection loss, JetStream redelivery, outbox DLQ.
- Run via `pnpm chaos:test` which boots
  `docker-compose.test.yml --profile slow-services` and runs every
  service's chaos suite. Cleanup via `trap` even on Ctrl-C.

## Coverage

- **Targets**: domain ≥ 95 %, usecases ≥ 95 %, infrastructure ≥ 80 %
  (verified via `pnpm --filter=<svc> test:cov`).
- **Frontend**: branches ≥ 80 % (Story 0.9 baseline; Story 0.11 CI
  enforces).
- **No `// istanbul ignore`** — refactor instead.

## CI parity

Local quality gates before commit (`.agents/commands/check.md`):

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

Full pipeline before merge (`.agents/commands/ship.md`):

```bash
pnpm lint && pnpm typecheck && pnpm test:cov && pnpm build && pnpm format:check
# + chaos tests if the service has them
```

## Hard rules

- ✅ Tests live alongside source (`*.spec.ts`) for unit, in `test/`
  per-service for e2e + chaos.
- ✅ Mock external HTTP with `nock` (backend) or MSW (frontend).
- ✅ Reset mocks between tests; never leak state across files.
- ✅ Use `runInBand` for e2e suites that touch real PG / Keycloak / NATS.
- ❌ **No snapshot tests** for component DOM — they rot. Test behaviour
  (`getByRole`, fire event, assert state) instead.
- ❌ **No global mocks** that bypass DI — set up modules with test-only
  overrides (`TestingModule.overrideProvider(...)`).
- ❌ **No flaky-test allowlist.** A flaky test gets fixed or deleted —
  never `it.skip` quietly.
- ❌ **No live API calls in tests**, even in dev. Always mock or
  testcontainers.
