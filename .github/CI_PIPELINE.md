# CI Pipeline — full reference

This document describes Tukio's CI/CD pipeline end to end: workflow
dependencies, job structure, performance budgets, and troubleshooting.

## Pipeline overview

```
   PR opened on develop / main
         │
         ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ ci.yml                                                            │
 │  setup → lint │ typecheck │ test (+coverage) │ build │ e2e-tests │
 │                                                                   │
 │ All jobs use Turborepo `--filter=...[origin/<base>]` to scope to  │
 │ affected workspaces only. Concurrency cancel-in-progress on PR.   │
 └──────────────────────────────────────────────────────────────────┘
         │
         │ (in parallel, gated by `paths:` filter)
         ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ lighthouse-ci.yml                                                 │
 │ matrix: { app: [public, seller, admin] }                          │
 │  → build affected app → start server → lhci autorun              │
 └──────────────────────────────────────────────────────────────────┘
         │
         │ merge to main
         ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ build-images.yml                                                  │
 │  detect-services (Turborepo dry-run vs HEAD^1)                    │
 │   → matrix build: 10 services, fail-fast:false                    │
 │   → docker buildx → push ghcr.io/<owner>/tukio/<svc>:<sha>+latest │
 │   → Trivy scan (CRITICAL/HIGH blocking, ignore-unfixed)           │
 └──────────────────────────────────────────────────────────────────┘
         │
         │ workflow_run success on main
         ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ deploy-staging.yml  (placeholder — Story 0.12 finalises)          │
 │  → ArgoCD sync tukio-staging → smoke test → Slack notify          │
 └──────────────────────────────────────────────────────────────────┘
         │
         │ git tag v*
         ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ deploy-production.yml  (placeholder + manual approval)            │
 │  → ArgoCD sync tukio-production → smoke test → rollback on fail   │
 └──────────────────────────────────────────────────────────────────┘

 ┌─── Nightly 02:00 UTC ────────────────────────────────────────────┐
 │ chaos-tests.yml — NATS + outbox chaos suite, Slack on failure    │
 └──────────────────────────────────────────────────────────────────┘
```

## Performance budgets

| Pipeline                                        | Target       | Note                                      |
| ----------------------------------------------- | ------------ | ----------------------------------------- |
| `ci.yml` on a single-app PR                     | **≤ 5 min**  | Driven by Turborepo affected + cache hits |
| `ci.yml + lighthouse-ci.yml` on a single-app PR | **≤ 8 min**  | Lighthouse is the long pole               |
| Full pipeline on merge to `main`                | **≤ 12 min** | Includes Docker buildx + Trivy            |
| `build-images.yml` per service                  | **≤ 6 min**  | `cache-from/to=gha,mode=max`              |
| `chaos-tests.yml` nightly                       | **≤ 45 min** | Bounded by `timeout-minutes: 45`          |

## Caching strategy

| Cache         | Key                                                               | Scope                                  |
| ------------- | ----------------------------------------------------------------- | -------------------------------------- |
| pnpm store    | `pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`        | All workflows                          |
| Turborepo     | `turbo-${{ runner.os }}-${{ github.ref_name }}-${{ github.sha }}` | `ci.yml` jobs share via `restore-keys` |
| Next.js build | `nextjs-${{ matrix.app }}-${{ runner.os }}-...`                   | `ci.yml#build`, `lighthouse-ci.yml`    |
| Docker layers | `type=gha,scope=${{ matrix.service }}`                            | `build-images.yml` per service         |

A Turborepo Remote Cache token (`TURBO_TOKEN` + `TURBO_TEAM`) is optional
but recommended — it gives intra-PR cache reuse across PRs on the same
service.

## Affected-detection mechanics

All workflows that say "affected" use Turborepo's package graph:

```sh
pnpm turbo run <task> --filter='...[origin/<base>]'
```

- `<base>` is `main` on push, `github.base_ref` on PR.
- `fetch-depth: 0` on `actions/checkout` is mandatory — without full git
  history, Turborepo falls back to running everything.
- `e2e-tests` and `build-images` additionally parse `turbo --dry-run=json`
  to extract just the `*-svc` / `gateway-api` packages (frontend changes
  don't trigger backend e2e or image rebuilds).

## Lint rules enforced

Twelve custom rules from `eslint-plugin-tukio` run in `ci.yml#lint`. See
[`tools/eslint-plugin-tukio/README.md`](../tools/eslint-plugin-tukio/README.md).
All are `error` except `tukio/require-correlation-id` (warn).

## Coverage thresholds

Granular thresholds live in [`codecov.yml`](../codecov.yml). Summary:

| Workspace family       | Project target | Patch target |
| ---------------------- | -------------- | ------------ |
| `packages/*`           | 80 %           | 90 %         |
| `apps/<svc>` (backend) | 70 %           | 70 %         |
| `apps/<frontend>`      | 60 %           | 80 % default |

Patch coverage failing the target blocks the PR via Codecov's status
check (configured in the Codecov GitHub App).

## Lighthouse assertions

Per-app configs live in `.lighthouserc/*.json`. The strictest is
`apps/public/` (SEO is RA1 — the operational risk #1):

- `categories.performance ≥ 0.9` (error)
- `categories.accessibility ≥ 0.9` (error)
- `categories.seo ≥ 0.95` (error)
- `largest-contentful-paint ≤ 2500 ms` (error — NFR5)
- `cumulative-layout-shift ≤ 0.1` (error — NFR5)

Connected apps (`seller`, `admin`) keep `accessibility ≥ 0.9`
as the only `error`; performance is `warn` because they're behind auth
and not SEO-critical.

## Troubleshooting

### Lighthouse fails with `LCP > 2.5s`

1. Check `apps/public/next.config.mjs` for `next/image` misconfiguration
   (missing `priority` on above-the-fold, `loader: 'default'` against
   Cloudflare Images).
2. Verify `next/font` is in use — system-font fallbacks regress LCP.
3. Re-run `lhci autorun` locally:
   ```sh
   pnpm --filter=public build && pnpm --filter=public start &
   pnpm dlx @lhci/cli@latest autorun --config=.lighthouserc/public.json
   ```

### Trivy blocks a CVE

1. Try `pnpm audit --fix` in the affected workspace.
2. If unfixable, add a justified entry to `.trivyignore` at the repo
   root with the CVE ID, the affected package, and a one-line rationale
   (`# CVE-2025-12345 — false positive on bundled type-only dep`).
3. Re-run `build-images.yml` via `workflow_dispatch` with the affected
   `service` input.

### E2E tests time out after 60 s

1. The CI runner may be slow; bump `Wait for Keycloak readiness` retries
   from 60 to 120 in `ci.yml` (each retry sleeps 2 s).
2. Verify Docker daemon is actually running on the runner — check the
   `Start test infra` step output for compose errors.
3. Locally reproduce with `pnpm docker:test:up:slow` and re-run
   `pnpm --filter=<svc> test:e2e`.

### Turborepo affected detection picks everything

1. `fetch-depth: 0` is missing from a `checkout` step — add it.
2. The base ref isn't reachable. PRs need `github.base_ref` to exist as
   a local branch — `actions/checkout@v4` fetches it automatically with
   `fetch-depth: 0`.
3. A `pnpm-lock.yaml`-only change invalidates _every_ workspace. This
   is expected. Cancel the PR's CI run if it's a no-op lockfile drift.

### `pnpm deploy` fails during Docker build

The `--legacy` flag is required for pnpm 10's new deploy implementation.
Verify the line in `apps/<svc>/Dockerfile`:

```dockerfile
RUN pnpm --filter=<svc> deploy --prod --legacy /deploy
```

Regenerate from the template with
`bash infra/scripts/gen-dockerfiles.sh`.

### `Codecov upload failed` warning

Coverage upload is `continue-on-error: true` — it never blocks CI. If
the warning persists:

1. Verify `CODECOV_TOKEN` is set in repo secrets.
2. Check the Codecov repo settings — the repo must be installed via the
   Codecov GitHub App (not the legacy token-only flow).

## Related docs

- `.agents/context/git-workflow.md` — branches, commit conventions, PR target.
- `.agents/context/testing.md` — Jest + Vitest + testcontainers + chaos.
- `.agents/context/infrastructure.md` — docker-compose, scripts.
- `tools/eslint-plugin-tukio/README.md` — custom lint rules.
- `_bmad-output/implementation-artifacts/0-11-ci-github-actions-pipeline.md` — story spec.
