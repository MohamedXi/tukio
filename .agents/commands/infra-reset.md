# /infra-reset

**Destructive nuke** of the local dev infrastructure. Wipes all volumes
(Postgres data, NATS streams, Meilisearch indexes, Redis cache),
rebuilds the stack from scratch, re-runs bootstrap. Used when DB / realm
state is corrupted or you want a guaranteed clean slate.

## Steps

```bash
pnpm docker:reset
```

Equivalent to:

```bash
pnpm docker:down:volumes && pnpm docker:up:wait && pnpm docker:bootstrap
```

Total time: **≈ 53 s** (Story 0.10 measurement).

## Pass criteria

- **`down:volumes`** removes all 4 named volumes
  (`tukio_postgres_data`, `tukio_nats_data`, `tukio_meilisearch_data`,
  `tukio_redis_data`) + the `tukio_dev_network` bridge.
- **`up:wait`** brings 6 fresh containers to `healthy`. Postgres init
  SQL runs (creates the 11 logical DBs) before Keycloak tries to
  connect.
- **`bootstrap`** re-runs the 3 idempotent scripts. On a fresh nuke,
  every line is `✅ created` (not `⏭️ already exists`).

## ⚠️ What this destroys

- **Postgres data** — all 10 Tukio service DBs + the Keycloak DB.
- **NATS JetStream streams** — all event history, durable consumers.
- **Meilisearch indexes** — every search index.
- **Redis** — all keys (sessions, locks, idempotency keys).
- **Keycloak realm state** — users, sessions, password hashes (but
  realm config + 4 clients + 5 roles + Conditional OTP get re-provisioned
  by bootstrap).
- **MailHog inbox** — every captured email (MailHog has no volume, just
  in-memory).

The `realm-export.json` file is NOT touched (it lives in Git and is
re-used by Story 0.9 testcontainers).

## When to use

- **`tukio_postgres_data` corruption** — e.g. a botched migration that
  `migration:revert` can't undo cleanly.
- **`keycloak` DB out of sync with realm script** — when adding a new
  client / role / flow and the existing realm doesn't have the prior
  baseline.
- **Switching branches** that have incompatible schemas (rare but real).
- **After updating Docker images** — when you've bumped a version in
  `docker-compose.dev.yml`.
- **Before a clean reproducibility test** — e.g. validating an
  onboarding doc with a fresh-clone scenario.

## When NOT to use

- **You just want to restart containers** — use `pnpm docker:down` (no
  `:volumes`) then `pnpm docker:up:wait`. Data survives.
- **You only need to re-seed categories** — use `pnpm seed:categories`.
- **You only need to re-provision the realm** — use
  `bash infra/scripts/bootstrap-keycloak-realm.sh`.
- **You're in a hurry** — the 53 s nuke is fast, but `pnpm docker:bootstrap`
  alone is 14 s on a re-run and usually achieves the same result for
  realm / seed drift.

## When it fails

- **`down:volumes` fails with `Volume in use`** → a service container
  is somehow still attached. Run `pnpm docker:down` first to stop
  everything, then retry.
- **`up:wait` times out on Keycloak** → check
  `pnpm docker:logs keycloak`. Common cause: the init SQL didn't run
  (e.g. the volume wasn't actually wiped). Verify with
  `docker volume ls | grep tukio_postgres` — should be missing right
  after `down:volumes` and only present after `up`.
- **`bootstrap` fails on `migration:run`** → identity-svc's migration
  rejected by the fresh DB. Read the stderr (Story 0.10 fixed
  the silent-swallow bug; you should see the actual error). Common
  cause: data-source.ts has two `DataSource` exports — keep only the
  default.

## CI vs dev

CI never runs `/infra-reset` — it uses
`docker-compose.test.yml --profile slow-services` which is volume-free
(tmpfs + anonymous volumes) and starts from zero on every run. The dev
stack is volume-persistent specifically because resetting on every
container restart would destroy the dev experience.

## See also

- `/infra-up` — daily startup (no destruction).
- `.agents/context/infrastructure.md` — full convention.
- `_bmad-output/implementation-artifacts/0-10-…md` — Story 0.10
  Completion Notes documenting the 53 s budget.
