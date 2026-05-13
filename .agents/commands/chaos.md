# /chaos

Run the chaos test suite — resilience tests for the outbox / inbox /
NATS layer. Boots the CI-tuned Docker Compose stack with Keycloak
profile enabled, runs every service's chaos specs, tears the stack
down on exit.

## Steps

```bash
pnpm chaos:test
```

Which runs `infra/scripts/run-chaos-tests.sh`. Equivalent to:

```bash
# Internally:
docker compose -f infra/docker-compose/docker-compose.test.yml --profile slow-services up -d --wait

# Then for each chaos target:
pnpm --filter='@tukio/messaging' run test --testNamePattern=@chaos
pnpm --filter=identity-svc        run test --testPathPattern=chaos

# Then tear down (via trap on EXIT/INT/TERM):
docker compose -f infra/docker-compose/docker-compose.test.yml --profile slow-services down -v --remove-orphans
```

## Pass criteria

- **Stack `up -d --wait`** completes with all services (`tukio_test_postgres`,
  `tukio_test_nats`, `tukio_test_redis`, `tukio_test_meilisearch`,
  `tukio_test_keycloak`) `healthy`.
- **Each chaos suite** exits 0.
- **Cleanup** runs even on `Ctrl-C` (trap on `EXIT INT TERM` —
  Story 0.10 H1 fix).

## What the chaos suites cover

- **`@tukio/messaging`** chaos:
  - Producer crashes between `repo.save()` and `outboxPublisher.publish()`
    → outbox row exists, eventually published (no event lost).
  - PG LISTEN/NOTIFY connection drops mid-watch → relay reconnects,
    replays pending rows.
  - JetStream redelivers when consumer fails to ack → inbox dedup
    prevents duplicate side effect.
  - DLQ overflow surfaces an alertable error (not silent drop).

- **`identity-svc`** chaos:
  - Concurrent registrations of the same email → only one succeeds,
    others get `USER-EMAIL-ALREADY-TAKEN-001`.
  - JWKS endpoint flake → JWT validation falls back to cached keys.
  - Keycloak admin token expires mid-bootstrap → script refreshes
    automatically (when applicable).

New services that emit / consume events MUST add at least one
chaos spec per `.agents/context/messaging.md`.

## When to use

- Before opening a PR that touches `@tukio/messaging`,
  `apps/<svc>/src/infrastructure/messaging/`, or any `test/chaos/`
  suite.
- After making a change to outbox / inbox / NATS subscription logic.
- Nightly in CI (Story 0.11 — `chaos.yml` workflow).
- As part of `/ship` when the PR scope warrants it (you decide based on
  the diff).

## When NOT to use

- Before every commit — chaos is slow (~2-5 min including Keycloak boot).
- For changes that don't touch messaging — pure UI / DB schema changes
  don't need chaos.

## When it fails

- **Stack fails to start** → same diagnostic as `/infra-up` (port
  conflict, Docker daemon down, Keycloak boot timeout). Run
  `docker compose -f infra/docker-compose/docker-compose.test.yml ps`
  to see container states.
- **`@tukio/messaging` chaos failures** → real bug in outbox / inbox /
  relay. Reproduce locally with `--runInBand --testNamePattern='<name>'`
  for a single spec to isolate.
- **`identity-svc` chaos failures** → similar; check if the test relies
  on a JWKS / Keycloak state that's drifted (the realm export is the
  source of truth — re-export if you changed the realm bootstrap).
- **Cleanup didn't run** (e.g. test killed via SIGKILL) → manually
  `pnpm docker:test:down` to remove leftover containers and volumes.

## CI gate

Story 0.11 introduces `chaos.yml` running nightly on `develop` HEAD.
Failures here are P1 — the messaging layer's correctness underpins
every cross-service workflow.

## Tip — running a single chaos spec

When debugging a flake:

```bash
# Boot the stack manually
pnpm docker:test:up:slow

# Run one spec
pnpm --filter=identity-svc test --testPathPattern='chaos/<name>' --runInBand

# Tear down
pnpm docker:test:down
```

This skips the auto-cleanup of `pnpm chaos:test`, so you can inspect
state between runs.

## See also

- `.agents/context/messaging.md` — outbox / inbox / chaos spec layout.
- `.agents/context/testing.md` — full test pyramid.
- `infra/scripts/run-chaos-tests.sh` — orchestrator source.
- `_bmad-output/implementation-artifacts/0-10-…md` — H1 fix preserving
  stderr + `trap cleanup EXIT INT TERM`.
