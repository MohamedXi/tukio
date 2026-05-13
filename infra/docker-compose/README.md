# Tukio — Docker Compose dev stack

> Local dev infrastructure for the Tukio monorepo (Story 0.10).

## What's in the stack

| Service       | Image                            | Host port      | Purpose                                            |
| ------------- | -------------------------------- | -------------- | -------------------------------------------------- |
| `postgres`    | `postgres:16-alpine`             | `5432`         | 10 logical Tukio DBs + `keycloak`                  |
| `nats`        | `nats:2.10-alpine`               | `4222`, `8222` | JetStream + HTTP monitoring                        |
| `keycloak`    | `quay.io/keycloak/keycloak:25.0` | `8080`         | OIDC for `tukio-web` / `tukio-admin` / `tukio-api` |
| `meilisearch` | `getmeili/meilisearch:v1.13`     | `7700`         | Per-locale search index (Story 3.7)                |
| `redis`       | `redis:7-alpine`                 | `6379`         | Rate limiting, caches, idempotency, locks          |
| `mailhog`     | `mailhog/mailhog:v1.0.1`         | `1025`, `8025` | SMTP sink + Web UI (stand-in for Resend in dev)    |

NestJS services run on the **host** via `pnpm dev` (Turborepo HMR). They reach
the stack through `localhost`. Volumes are named so data survives across
`docker compose down`/`up`; nuke everything with `pnpm docker:down:volumes`.

---

## Quick Start (≈ 5 minutes)

### Prerequisites

- Docker Desktop 4.x+ (Mac/Windows) or Docker Engine 24+ (Linux)
- Node.js 22 LTS (`nvm use 22`)
- pnpm 10+ (`npm install -g pnpm`)

### Install

```bash
git clone <repo> && cd tukio
pnpm install              # ≈ 1 min
pnpm docker:up:wait       # ≈ 30-45 s (Keycloak dominates the boot)
pnpm docker:bootstrap     # ≈ 10 s (realm + DBs + seed)
pnpm dev                  # Turborepo runs the 14 codebases
```

### URLs

| Surface          | URL                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------ |
| Frontends        | `http://localhost:3000` (public), `3001` (customer), `3002` (seller), `3003` (admin) |
| Backend services | `http://localhost:4000` (gateway) → `4009` (media)                                   |
| Keycloak admin   | `http://localhost:8080` — `admin` / `admin`                                          |
| Keycloak realm   | `http://localhost:8080/admin/master/console/#/tukio`                                 |
| MailHog UI       | `http://localhost:8025`                                                              |
| MailHog API      | `http://localhost:8025/api/v2/messages`                                              |
| NATS monitoring  | `http://localhost:8222`                                                              |
| Meilisearch      | `http://localhost:7700`                                                              |
| Postgres         | `localhost:5432` — `tukio` / `tukio_dev_password`                                    |

### Useful commands

```bash
pnpm docker:up                 # background up, no health wait
pnpm docker:up:wait            # up + block until all healthchecks pass
pnpm docker:down               # stop containers, keep volumes
pnpm docker:down:volumes       # stop containers AND wipe volumes
pnpm docker:logs               # follow logs for all services
pnpm docker:logs keycloak      # follow logs for one service
pnpm docker:reset              # nuke + recreate + bootstrap (≈ 90 s)
pnpm docker:bootstrap          # re-run DB + realm + seed (idempotent)
pnpm docker:test:up            # CI-tuned stack (no Keycloak by default)
pnpm docker:test:up:slow       # CI-tuned stack including Keycloak
pnpm docker:test:down          # tear down the CI-tuned stack
pnpm seed:categories           # re-run only the catalog seed
pnpm chaos:test                # run all chaos suites against test stack
```

---

## What `pnpm docker:bootstrap` does

The orchestrator script runs three idempotent steps:

1. **`infra/scripts/bootstrap-databases.sh`** — creates 11 logical Postgres
   databases (`keycloak`, `tukio_identity`, `tukio_catalog`, …, `tukio_meta`)
   and runs TypeORM migrations for every service whose `migrations/`
   directory exists. Safe to re-run.
2. **`infra/scripts/bootstrap-keycloak-realm.sh`** — provisions the `tukio`
   realm, 5 realm roles (`client`, `pro`, `admin-support`, `admin-modo`,
   `admin-super`), 4 OIDC clients (`tukio-web`, `tukio-admin`, `tukio-api`,
   `tukio-mobile`), and elevates the browser flow's Conditional OTP to
   `REQUIRED` (FR9 + NFR12 — admin TOTP). Safe to re-run.
3. **`infra/scripts/seed-categories.ts`** — seeds the two pilot MVP
   categories (`tents-marquees`, `event-furniture`) with sub-categories,
   FR/EN translations, and per-sub-category `service_types`. Skips cleanly
   if the catalog schema is not yet provisioned (Story 3.1 owns the schema).

Every script is idempotent: re-running the bootstrap is a no-op once the
state is in place. Use this when iterating on the realm config or seed
data, or after a `pnpm docker:reset`.

---

## Re-exporting the realm

After modifying the realm via `bootstrap-keycloak-realm.sh` or the admin
console, re-export the JSON so testcontainers (Story 0.9) and CI can
import the same config:

```bash
bash infra/scripts/export-keycloak-realm.sh
git add infra/scripts/keycloak/realm-export.json
git commit -m "chore(infra): re-export keycloak realm-export.json"
```

The helper calls Keycloak's admin REST `partial-export` endpoint (with
`exportClients=true&exportGroupsAndRoles=true`) and pretty-prints the
result, so diffs stay readable. The file is **versioned in Git** — it
is the source of truth consumed by `startKeycloakContainer({ importJsonPath })`
in `@tukio/testing`.

---

## Troubleshooting

| Symptom                                          | Fix                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `Cannot connect to the Docker daemon`            | Start Docker Desktop / `systemctl start docker`                             |
| `port is already allocated`                      | `pnpm docker:down` then `lsof -i :<port>` to find the conflict              |
| Keycloak healthcheck never goes green            | Allow up to 60 s — Keycloak boot is slow. Check `pnpm docker:logs keycloak` |
| Postgres `role "tukio" does not exist`           | You skipped `pnpm docker:up:wait`. Run `pnpm docker:reset`                  |
| `seed-categories.ts` says "table does not exist" | Expected before Story 3.1 lands. Skipped cleanly; safe to ignore.           |
| Disk full after many resets                      | `docker system prune -f --volumes`                                          |
| `tsx: command not found`                         | `pnpm install` at repo root (root devDeps include `tsx` + `pg`)             |

---

## CI variant: `docker-compose.test.yml`

The CI stack lives in `docker-compose.test.yml`. Differences vs. the dev stack:

- **Postgres `tmpfs`** mount (512 MB in RAM) — ~3-5× faster I/O
- **Anonymous volumes** for NATS / Meilisearch — wiped on every `down -v`
- **Random host ports** (`5433`, `4223`, `8081`, `7701`, `6380`) so it can
  coexist with `docker-compose.dev.yml`
- **Tighter healthchecks** (interval 2 s, retries 5) for fail-fast CI
- **No MailHog** — notification-svc tests mock SMTP at the application layer
- **Keycloak is profile-gated** (`--profile slow-services`) because of its
  ~20-30 s boot. CI workflows opt-in only when they exercise OIDC flows.

Use `pnpm docker:test:up` (fast, no Keycloak) or `pnpm docker:test:up:slow`
(with Keycloak). Tear down with `pnpm docker:test:down`.

---

## Out of scope for Story 0.10

- Docker images for the NestJS services themselves → Story 0.12 (K8s + Helm)
- Stripe local CLI / Stripe sandbox → Story 4.5
- Cloudflare R2 mock (MinIO) → Story 3.4
- Meilisearch index initialization → Story 3.7
- Pre-seeded Keycloak users (admin/customer/pro demo) → Stories Epic 1+
- Production-grade `docker-compose.prod.yml` → handled by Helm in prod

---

## See also

- `infra/docker-compose/docker-compose.dev.yml` — the dev stack manifest
- `infra/docker-compose/docker-compose.test.yml` — the CI stack manifest
- `infra/scripts/` — the four bootstrap / chaos scripts + `realm-export.json`
- `_bmad-output/implementation-artifacts/0-10-docker-compose-dev-local-bootstrap-scripts.md` — story spec
