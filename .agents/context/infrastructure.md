# Infrastructure

Dev / test infrastructure was provisioned by **Story 0.10** (commits
`d79f8ec`, `57673c3`, `1c80014`, `eb8b9eb`). This file is the agent-facing
summary; the full README lives at
`infra/docker-compose/README.md`.

## Dev stack (`pnpm docker:up:wait`)

`infra/docker-compose/docker-compose.dev.yml` defines 6 services, all
healthchecked, named volumes for persistence. Boot time ≈ 22 s fresh /
17 s warm.

| Service       | Image                            | Host port      | Purpose                                 |
| ------------- | -------------------------------- | -------------- | --------------------------------------- |
| `postgres`    | `postgres:16-alpine`             | `5432`         | 11 logical DBs pre-created via init SQL |
| `nats`        | `nats:2.10-alpine`               | `4222`, `8222` | JetStream + HTTP monitoring             |
| `keycloak`    | `quay.io/keycloak/keycloak:25.0` | `8080`         | OIDC; mgmt port 9000 internal-only      |
| `meilisearch` | `getmeili/meilisearch:v1.13`     | `7700`         | Per-locale search index (Story 3.7)     |
| `redis`       | `redis:7-alpine`                 | `6379`         | Rate limiting, locks, idempotency       |
| `mailhog`     | `mailhog/mailhog:v1.0.1`         | `1025`, `8025` | SMTP sink + Web UI (Resend stand-in)    |

### Postgres init SQL

`infra/docker-compose/postgres-init/01-create-tukio-databases.sql` runs
on first Postgres init (entrypoint `/docker-entrypoint-initdb.d/`) and
creates all 10 Tukio service DBs + the Keycloak DB **before** Keycloak
tries to connect.

- Pattern: `SELECT 'CREATE DATABASE ' || quote_ident(d) FROM unnest(...) WHERE NOT EXISTS (...) \gexec`.
- Idempotent — safe to replay if the entrypoint ever re-runs.
- `tukio_meta` is `POSTGRES_DB`, created by the entrypoint itself.

### Keycloak quirks

- **Health endpoint is on port 9000** (Quarkus management interface), not
  `8080`. Not exposed to the host. Healthcheck probes via
  `bash /dev/tcp/localhost/9000`.
- **Admin env vars**: Keycloak 25 reads `KEYCLOAK_ADMIN`+`KEYCLOAK_ADMIN_PASSWORD`,
  Keycloak 26+ reads `KC_BOOTSTRAP_ADMIN_USERNAME`+`KC_BOOTSTRAP_ADMIN_PASSWORD`.
  Both are set for forward compat.
- **Boot time**: 15-25 s, dominates the dev stack startup.

## Bootstrap (`pnpm docker:bootstrap`)

Runs 3 idempotent scripts in sequence:

```bash
bash infra/scripts/bootstrap-databases.sh   \
  && bash infra/scripts/bootstrap-keycloak-realm.sh \
  && pnpm seed:categories
```

### `bootstrap-databases.sh`

- Verifies Postgres is up; uses host `psql` if available, else falls
  back to `docker exec tukio_postgres psql` (no `brew install libpq`
  required).
- Verifies 11 DBs exist (created by init SQL).
- `GRANT ALL PRIVILEGES` on each.
- Runs `pnpm --filter=<svc> migration:run` for each service that has a
  `migrations/` folder. Captures stderr; reports failure count.
- `STRICT_MIGRATIONS=1` makes migration failures fatal (for CI).

### `bootstrap-keycloak-realm.sh`

- Verifies Keycloak reachable via `.well-known/openid-configuration`.
- Authenticates kcadm as admin.
- Idempotent provisioning:
  - Realm `tukio` (create or update full config — bilingual `fr`/`en`,
    password policy `length(12) and notUsername and notEmail and
specialChars(1) and upperCase(1) and digits(1)`, brute-force
    protection, access token lifespan 15 min).
  - 5 realm roles: `client`, `pro`, `admin-support`, `admin-modo`,
    `admin-super`.
  - 4 OIDC clients: `tukio-web` (public PKCE S256), `tukio-admin`
    (public PKCE S256), `tukio-api` (confidential M2M — secret
    preserved on re-run unless `FORCE_CLIENT_SECRET=1`),
    `tukio-mobile` (public, V2 prep).
  - Conditional OTP execution in the browser flow → REQUIRED (FR9 +
    NFR12 partial — full per-client scoping lands in Story 1.7).
- Asserts exactly one matching `Conditional OTP` execution before
  elevating, refuses to elevate on multi-match.

### `seed-categories.ts`

- Connects to `tukio_catalog`. Probes 4 required tables + the
  `service_types` column. If schema missing (Story 3.1 territory), exits
  cleanly with a skip message.
- Seeds 2 pilot MVP categories (`tents-marquees` + `event-furniture`)
  with 9 sub-categories total + FR/EN translations + per-sub-cat
  `service_types`.
- Idempotent (`INSERT … ON CONFLICT DO NOTHING/UPDATE`).

## Realm export (`bash infra/scripts/export-keycloak-realm.sh`)

Regenerates `infra/scripts/keycloak/realm-export.json` from a running
Keycloak via admin REST API `partial-export?exportClients=true&exportGroupsAndRoles=true`
(the `kcadm get realms/{name}` path **does NOT embed clients/roles** —
gotcha). Validates JSON, writes to tmpfile, then `mv` onto target.
Prefers `jq`, falls back to `python3 -m json.tool`.

The export is committed to Git and consumed by `@tukio/testing`
testcontainers helpers (`startKeycloakContainer({ importJsonPath: ... })`).

## CI variant (`pnpm docker:test:up`)

`infra/docker-compose/docker-compose.test.yml` — same 6 services minus
MailHog, with:

- `tmpfs:512m` on Postgres → ~3-5× faster I/O.
- Anonymous volumes for NATS / Meilisearch → wiped on every `down -v`.
- Random host ports (`5433`, `4223`, `8081`, `7701`, `6380`) — can
  coexist with the dev stack on the same machine.
- Tighter healthchecks (interval 2 s, retries 5).
- Keycloak gated behind `--profile slow-services` (CI workflows opt-in
  only for OIDC integration tests).
- `pnpm docker:test:up` → fast (no KC); `pnpm docker:test:up:slow` → with KC.

## Chaos tests (`pnpm chaos:test`)

`infra/scripts/run-chaos-tests.sh` boots
`docker-compose.test.yml --profile slow-services`, runs
`@tukio/messaging` chaos suite + `identity-svc` chaos suite, then tears
down (`trap` on EXIT/INT/TERM).

## Production / staging (Story 0.12)

Out of scope for Story 0.10. Story 0.12 introduces:

- **Helm charts** per service under `infra/helm/<svc>/`.
- **K8s cluster** (1 cluster MVP, multiple namespaces).
- **ArgoCD** for GitOps.
- **OpenTelemetry + Prometheus + Tempo** for observability.
- **Phasetwo-managed Keycloak** instead of self-hosted (the
  `realm-export.json` is the source of truth for the realm config —
  Phasetwo imports it on first provisioning).

## Pnpm scripts (root `package.json`)

| Script                | Effect                                                          |
| --------------------- | --------------------------------------------------------------- |
| `docker:up`           | Background up, no health wait                                   |
| `docker:up:wait`      | Up + block until all healthchecks pass                          |
| `docker:down`         | Stop containers, keep volumes                                   |
| `docker:down:volumes` | Stop containers AND wipe volumes ⚠️                             |
| `docker:logs`         | Follow logs for all services (`pnpm docker:logs <svc>` for one) |
| `docker:reset`        | `down:volumes && up:wait && bootstrap` — nuclear reset (~53 s)  |
| `docker:bootstrap`    | DBs + realm + seed (idempotent, ~22 s 1st run, ~14 s re-run)    |
| `docker:test:up`      | CI-tuned stack (no Keycloak)                                    |
| `docker:test:up:slow` | CI-tuned stack WITH Keycloak                                    |
| `docker:test:down`    | Tear down CI-tuned stack (+ Keycloak profile)                   |
| `seed:categories`     | Re-run only the catalog seed                                    |
| `chaos:test`          | Run all chaos suites against the test stack                     |

## Hard rules

- ✅ Run `pnpm docker:up:wait && pnpm docker:bootstrap` before `pnpm dev`.
- ✅ Edit `infra/docker-compose/*.yml` only after running
  `docker compose -f ... config -q` (YAML validity check).
- ✅ Bootstrap scripts MUST be idempotent. Test by running 2× back-to-back.
- ✅ Image versions are explicitly pinned (no floating `:latest` except
  the explicitly-pinned `mailhog/mailhog:v1.0.1`).
- ✅ Re-export `realm-export.json` after any realm change, commit it.
- ❌ Never commit `.env.local` — only `.env.example` is checked in.
- ❌ Never store secrets in compose env (`KC_DB_PASSWORD=...`) for
  staging/prod — use Doppler / sealed-secrets in Story 0.12.
- ❌ Never run `docker:reset` in CI without `--profile slow-services` —
  Keycloak-dependent tests will see the realm wiped.
