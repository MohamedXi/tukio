# @tukio/testing

Backend-only testcontainers helpers, chaos helpers, fixture builders, and custom Vitest matchers for Tukio NestJS services.

> **Docker required.** Tests using testcontainers need a running Docker daemon (Docker Desktop on Mac, `dockerd` on Linux). CI runs in `dind` or with a Docker socket mount.

## What's inside

- **`testcontainers/`** — 5 helpers: `startPostgresContainer`, `startNatsContainer`, `startRedisContainer`, `startKeycloakContainer`, `startMeilisearchContainer` — plus `getOrCreate(key, factory)` pool to share across tests + `cleanupAllContainers()` for `globalTeardown`.
- **`chaos/`** — `disconnectNatsForDuration` (R12 NATS partition), `pauseDbForDuration` (R13 DB blip), `injectFailureBetweenEvents` (R11 saga partial failure).
- **`fixtures/`** — `buildUser`/`buildPro`/`buildClient`/`buildAdminModo`/`buildAdminSuper`, `buildListing`, `buildBooking` + 4 status variants, `buildOrder`/`buildOrderWithLineItems`, `buildPaymentIntent`/`buildRefund`, `buildReview`/`buildReviewWithBreakdown`. All use `@faker-js/faker` (`fr` locale) so values look realistic.
- **`matchers/`** — `toMatchSuccessEnvelope`, `toMatchErrorEnvelope`, `toBeUuid`, `toBeIsoDate`. Register via `vitest.config.ts setupFiles`.

## Vitest setup (per service)

```ts
// apps/identity-svc/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['@tukio/testing/matchers'],
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
```

```ts
// apps/identity-svc/test/global-setup.ts
import {
  startPostgresContainer,
  startKeycloakContainer,
  cleanupAllContainers,
  getOrCreate,
} from '@tukio/testing/testcontainers';

export async function setup() {
  await getOrCreate('postgres-tukio', () => startPostgresContainer({ database: 'tukio_test' }));
  await getOrCreate('keycloak-tukio', () =>
    startKeycloakContainer({ realm: 'tukio', importJsonPath: './test/fixtures/test-realm.json' }),
  );
}

export async function teardown() {
  await cleanupAllContainers();
}
```

```ts
// apps/identity-svc/test/user.integration-spec.ts
import { describe, it, expect } from 'vitest';
import { getOrCreate, startPostgresContainer } from '@tukio/testing/testcontainers';
import { buildUser } from '@tukio/testing/fixtures/user';

describe('UserRepository', () => {
  it('persists a user and reads it back', async () => {
    const pg = await getOrCreate('postgres-tukio', () => startPostgresContainer());
    const fixture = buildUser({ role: 'pro' });
    expect(fixture.id).toBeUuid();
    expect(fixture.createdAt.toISOString()).toBeIsoDate();
  });
});
```

## Custom matchers

```ts
expect(httpResponse.body).toMatchSuccessEnvelope({ data: { id: 'abc' } });
expect(httpResponse.body).toMatchErrorEnvelope({
  tukioCode: 'USER-NOT-FOUND-001',
  httpStatus: 404,
});
expect(user.id).toBeUuid();
expect(user.createdAt).toBeIsoDate();
```

## Chaos helpers

```ts
import { startNatsContainer } from '@tukio/testing/testcontainers';
import { disconnectNatsForDuration } from '@tukio/testing/chaos/nats-disconnect';

it('outbox relay reconnects after NATS partition', async () => {
  const nats = await startNatsContainer({ jetstream: true });
  await disconnectNatsForDuration(nats, 3_000);
  // Assert messages eventually delivered.
});
```

## See also

- Story 0.7 NATS chaos test (now uses `@tukio/testing/chaos/nats-disconnect`)
- Story 0.8 user.e2e-spec real Keycloak via `startKeycloakContainer` (deferred — see below)

## Deferred from Story 0.9 → AC17

The migration of Story 0.7 chaos test (`it.skip` → real `startNatsContainer`) and Story 0.8 e2e spec (nock JWKS mock → real Keycloak testcontainer) was deferred to a follow-up branch because:

1. Both migrations require Docker daemon in CI (Story 0.11 setup).
2. Real Keycloak boot is ~15s — the existing nock-based tests run in <1s and serve the daily CI well.

The infrastructure is in place: `startNatsContainer`, `startKeycloakContainer`, `getOrCreate` pool. A "@nightly" tag separating fast (mock) tests from slow (testcontainer) tests will land in Story 0.11.
