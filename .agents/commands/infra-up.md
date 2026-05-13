# /infra-up

Daily startup of the local dev infrastructure. Boots the 6-service
docker-compose stack, then provisions DBs + Keycloak realm + seed.

## Steps

```bash
pnpm docker:up:wait      # boots PG + NATS + Keycloak + Meilisearch + Redis + MailHog (~22s)
pnpm docker:bootstrap    # 11 DBs + Keycloak realm + seed (~22s 1st run, ~14s re-run)
```

Or, in one line:

```bash
pnpm docker:up:wait && pnpm docker:bootstrap
```

## Pass criteria

- **`pnpm docker:up:wait`** exit 0 with all 6 containers reporting
  `healthy`:
  - `tukio_postgres`, `tukio_nats`, `tukio_keycloak`, `tukio_meilisearch`,
    `tukio_redis`, `tukio_mailhog`.
- **`pnpm docker:bootstrap`** exit 0 with all three sub-scripts green:
  - `bootstrap-databases.sh` → 11 DBs verified + per-service migrations
    applied (`identity-svc` migrations run today; other services
    print `⏭️ no migrations yet, skipped` until their stories land).
  - `bootstrap-keycloak-realm.sh` → realm `tukio` + 5 roles + 4 OIDC
    clients (PKCE S256) + Conditional OTP elevated.
  - `seed-categories.ts` → 2 pilot categories seeded, OR clean skip if
    `tukio_catalog` schema not yet provisioned (Story 3.1 territory).

## Health verification

```bash
# Containers
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep tukio

# Endpoints
curl -fsS http://localhost:8025                                          # MailHog UI
curl -fsS http://localhost:8080/realms/master/.well-known/openid-configuration  # Keycloak
curl -fsS http://localhost:8222/healthz                                  # NATS monitoring
curl -fsS http://localhost:7700/health                                   # Meilisearch
docker exec tukio_postgres pg_isready -U tukio                            # Postgres
docker exec tukio_redis redis-cli ping                                    # Redis
```

All should return 2xx / OK / PONG.

## When to use

- Start of every dev day.
- After a `pnpm docker:down` (volumes kept; just restart).
- After a Docker Desktop restart (containers exited).

## When it fails

- **`Cannot connect to the Docker daemon`** → start Docker Desktop /
  `systemctl start docker`.
- **`port is already allocated`** → `pnpm docker:down` then
  `lsof -i :<port>` to find the conflict. Common offenders: a stray
  local Postgres on `5432`, another project's Keycloak on `8080`.
- **Keycloak unhealthy after 60 s** → check `pnpm docker:logs keycloak`.
  Common cause: `keycloak` DB missing → run `/infra-reset` instead.
- **`bootstrap-databases.sh` reports `pnpm filter does not match a
workspace`** → a service was added to the `SERVICES` array but its
  workspace is missing. Either remove it from the array or scaffold the
  workspace.
- **`bootstrap-keycloak-realm.sh` reports `Invalid user credentials
[invalid_grant]`** → wrong admin password or Keycloak hasn't fully
  finished booting. Wait 10s and retry. If it persists, run `/infra-reset`.
- **`seed-categories.ts` reports `tsx: command not found`** → run
  `pnpm install` at the repo root (tsx is a root devDep added in
  Story 0.10).
- **`port 5432 in use` from another project** → either stop the other
  project's PG, or modify `docker-compose.dev.yml` to map a different
  host port (`5433:5432`) — but that ripples through every service's
  `.env.example` and tests.

## What it does NOT do

- **Start the apps** — run `pnpm dev` separately. The infra stack only
  carries the backing services (PG, NATS, Keycloak, etc.).
- **Reset state** — see `/infra-reset` for a destructive nuke.
- **Run tests** — see `/check`.

## See also

- `infra/docker-compose/README.md` — full Quick Start + Troubleshooting.
- `.agents/context/infrastructure.md` — convention + Keycloak quirks.
- `_bmad-output/implementation-artifacts/0-10-docker-compose-dev-local-bootstrap-scripts.md`
  — story that built the current infra.
