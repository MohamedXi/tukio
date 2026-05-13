# /ship

Full pre-merge pipeline. **Run this before opening or merging a PR.**
`/check` is the minimum gate; `/ship` is everything CI runs on a real
PR plus a few local-only sanity probes.

## Steps

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:cov                  # coverage thresholds
pnpm format:check
pnpm build                     # turbo run build (every workspace)
# E2E (per affected service)
pnpm --filter=<svc> test:e2e
# Chaos (if @tukio/messaging or service messaging touched)
pnpm chaos:test
```

## Pass criteria

- **All `/check` gates** green (lint, typecheck, test, format).
- **`pnpm test:cov`**: per-workspace coverage thresholds met
  (configured in each `jest.config.ts` / `vitest.config.ts`). Targets:
  - Domain ≥ 95 %
  - Use cases ≥ 95 %
  - Infrastructure ≥ 80 %
  - Frontend branches ≥ 80 %
- **`pnpm build`** green (Turborepo runs `build` script for every
  workspace; uses cache, so re-runs are fast).
- **`pnpm --filter=<svc> test:e2e`** green when the affected service
  has e2e tests and you touched HTTP / NATS surfaces.
- **`pnpm chaos:test`** green when you touched `@tukio/messaging`,
  `apps/<svc>/src/infrastructure/messaging/`, or any chaos suite.

## What it does NOT do

- **`gh pr create`** — open the PR yourself with the right title +
  body (see `.agents/context/git-workflow.md`).
- **Merge** — wait for CI + reviewer approval.
- **Deploy** — deploys happen via ArgoCD GitOps (Story 0.12+).
- **`pnpm audit`** — separate workflow, run on dep bumps via
  `/bump` (planned skill).

## When to use

- Before opening a PR (target: `develop`).
- Before merging a PR (final gate after CI greenlights).
- After resolving all `/bmad-code-review` patches.
- Before any release tag.

## When it fails

Apply the same fixes as `/check` (see that file). Additional cases:

- **Coverage gap** — add a focused test that covers the missing lines
  / branches. `vitest --coverage` / `jest --coverage` produces an HTML
  report (`coverage/index.html` per workspace) showing exact uncovered
  lines. **Do not lower the threshold.** Do not extend the
  `coverageExclude` list without surfacing it to the user.
- **Build error** — most often:
  - Circular import (TS will say so, or Turbo will deadlock — read the
    Turbo error log).
  - Wrong path alias / subpath export missing in
    `packages/<pkg>/package.json#exports`.
  - Missing `tsconfig.json` reference in a fresh workspace.
- **E2E flake** — reproduce locally first, then fix the race condition
  (don't add a retry / `setTimeout`). If unfixable today, surface as a
  finding and decide whether to skip (with explicit reason + follow-up
  story) or block the PR.
- **Chaos flake** — usually a real bug in the outbox / inbox / dedup
  layer. Reproduce with `--testNamePattern=@chaos --runInBand`.

## CI parity

Story 0.11 CI workflows will reproduce the same pipeline:

- **`ci.yml`** runs `lint + typecheck + test:cov + build` on every PR
  to `develop`, parallelised via Turborepo remote cache.
- **`e2e.yml`** runs `pnpm --filter=<svc> test:e2e` against the CI
  Docker Compose stack on every PR that touches `apps/<svc>/`.
- **`chaos.yml`** (nightly) runs `pnpm chaos:test` on `develop`'s HEAD.

## Tip — fast iteration loop

When iterating, you don't need to run the full `/ship` on every save:

```bash
# Watch tests for the workspace you're touching
pnpm --filter=<workspace> test:watch

# Periodic full gate
pnpm --filter=<workspace> lint && typecheck
```

Run the full `/ship` at the end, before commit + PR.
