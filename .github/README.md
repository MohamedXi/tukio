# `.github/` — CI/CD pipeline

This folder hosts Tukio's CI/CD pipeline (Story 0.11). See
[`CI_PIPELINE.md`](./CI_PIPELINE.md) for the full diagram, jobs, and
troubleshooting guide.

## Workflows

| File                                                                   | Trigger                                  | Purpose                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| [`workflows/ci.yml`](./workflows/ci.yml)                               | PR + push `main`/`develop`               | Lint + typecheck + unit & integration tests + build, all `affected`-scoped + coverage |
| [`workflows/lighthouse-ci.yml`](./workflows/lighthouse-ci.yml)         | PR touching frontend / `packages/ui`     | CWV + a11y assertions per frontend app (NFR5/54)                                      |
| [`workflows/build-images.yml`](./workflows/build-images.yml)           | Push `main` on backend service / package | Multi-stage Docker build, push to `ghcr.io`, Trivy scan (CRITICAL/HIGH blocking)      |
| [`workflows/deploy-staging.yml`](./workflows/deploy-staging.yml)       | `Build Images` success on `main`         | (Placeholder) ArgoCD sync `tukio-staging` — Story 0.12 finalises                      |
| [`workflows/deploy-production.yml`](./workflows/deploy-production.yml) | Tag `v*` + manual approval               | (Placeholder) ArgoCD sync `tukio-production` — Story 0.12 finalises                   |
| [`workflows/chaos-tests.yml`](./workflows/chaos-tests.yml)             | Nightly `02:00 UTC` + manual             | NATS / outbox chaos suite against `docker-compose.test.yml`                           |

## Dependabot

[`dependabot.yml`](./dependabot.yml) opens weekly PRs against `develop` for
npm, GitHub Actions, and Docker base images. Updates are **grouped**
(minor + patch combined per ecosystem; `@nestjs/*`, `typeorm/pg`, etc.
sub-grouped).

`main` carries the README only — PRs always target `develop`.

## Required secrets

The pipeline degrades gracefully when secrets are absent (placeholder
workflows skip their network steps), but the full pipeline needs:

| Secret                       | Used by                            | Source                                 |
| ---------------------------- | ---------------------------------- | -------------------------------------- |
| `CODECOV_TOKEN`              | `ci.yml` (coverage upload)         | Codecov repo settings                  |
| `TURBO_TOKEN` + `TURBO_TEAM` | All workflows (remote cache)       | Vercel Turborepo Remote Cache          |
| `GITHUB_TOKEN`               | `build-images.yml` (ghcr.io login) | Native — no action required            |
| `LHCI_GITHUB_APP_TOKEN`      | `lighthouse-ci.yml` (PR status)    | Lighthouse CI GitHub App install       |
| `ARGOCD_SERVER`              | Deploy workflows                   | Provisioned in Story 0.12              |
| `ARGOCD_STAGING_TOKEN`       | `deploy-staging.yml`               | Provisioned in Story 0.12              |
| `ARGOCD_PRODUCTION_TOKEN`    | `deploy-production.yml`            | Provisioned in Story 0.12              |
| `SLACK_WEBHOOK_DEPLOYS`      | `deploy-staging.yml`               | `#tukio-deploys` incoming webhook      |
| `SLACK_WEBHOOK_DEPLOYS_PROD` | `deploy-production.yml`            | `#tukio-deploys-prod` incoming webhook |
| `SLACK_WEBHOOK_ALERTS`       | `chaos-tests.yml`                  | `#tukio-alerts` incoming webhook       |

## Branch protection (`main`)

Apply these rules manually in **GitHub → Settings → Branches**. (The
GitHub REST API requires admin rights and is not automated here.)

- **Require status checks before merging — required:**
  - `CI success` (aggregator from `ci.yml`)
  - `Lighthouse — public` / `customer` / `seller` / `admin`
- **Require a pull request before merging:** 1 approving review
  (Dependabot bots count as auto-approvers via repo CODEOWNERS)
- **Dismiss stale pull request approvals when new commits are pushed**
- **Require linear history** (squash- or rebase-merge only — no merge
  commits)
- **Require conversation resolution before merging**
- **Restrict who can push to matching branches:** `@tukio/leads`
- **Require signed commits:** _planned for V1+ once GPG keys are
  provisioned_

`develop` carries the same rules with one approving review relaxed to
allow trusted bot merges.

## Adding a new service to the pipeline

1. Add it to the `apps/` directory with a `package.json` that declares
   `build`, `lint`, `typecheck`, `test`, `test:e2e`, and an optional
   `test:cov` script. The service must follow Pattern Pretre
   (`.agents/context/pretre-pattern.md`).
2. Run `bash infra/scripts/gen-dockerfiles.sh` after editing the
   `SERVICES` map in that script with the new service + port. This
   regenerates `apps/<svc>/Dockerfile`.
3. Add the service to the matrix in `.github/workflows/build-images.yml`
   (`ALL` array in the `detect-services` job + the implicit matrix from
   the `detect-services.outputs.services` JSON list — the script already
   handles affected detection).
4. Add a Codecov flag in `codecov.yml` (`flags.<svc>.paths`) if the
   service needs its own coverage band.
5. Update the table at the top of [`CI_PIPELINE.md`](./CI_PIPELINE.md).
6. Open a PR — the CI will run lint/typecheck/test/build for the new
   service, and `build-images.yml` will push its image on merge.

## Setup guides per tool

End-to-end setup guides for each external dependency live in
[`docs/ci-cd/`](../docs/ci-cd/index.md) (FR — operational documentation):

- [`codecov.md`](../docs/ci-cd/codecov.md) — Codecov GitHub App + token
- [`turborepo-remote-cache.md`](../docs/ci-cd/turborepo-remote-cache.md) — Vercel cache backend
- [`lighthouse-ci.md`](../docs/ci-cd/lighthouse-ci.md) — Lighthouse CI GitHub App
- [`slack-webhooks.md`](../docs/ci-cd/slack-webhooks.md) — 3 Slack incoming webhooks
- [`branch-protection.md`](../docs/ci-cd/branch-protection.md) — `main` + `develop` rules
- [`trivy-cve-management.md`](../docs/ci-cd/trivy-cve-management.md) — CVE exceptions workflow
- [`argocd-deployment.md`](../docs/ci-cd/argocd-deployment.md) — Story 0.12 placeholder

Start with [`docs/ci-cd/index.md`](../docs/ci-cd/index.md) for the
recommended setup order and a final-verification checklist.

## See also

- [`CI_PIPELINE.md`](./CI_PIPELINE.md) — full pipeline diagram &
  troubleshooting.
- `.agents/context/git-workflow.md` — branch naming, PR target, Husky.
- `tools/eslint-plugin-tukio/README.md` — the twelve custom lint rules
  enforced by CI.
- `codecov.yml` — per-workspace coverage thresholds.
- `_bmad-output/implementation-artifacts/0-11-ci-github-actions-pipeline.md`
  — the originating story.
