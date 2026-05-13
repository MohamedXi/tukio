# /check

Per-change local validation. **Run this before every commit and before
declaring any task "done".** It's the minimum gate — `/ship` is the
full pipeline.

## Steps

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

Or focused on one workspace:

```bash
pnpm --filter=<workspace> lint
pnpm --filter=<workspace> typecheck
pnpm --filter=<workspace> test
```

## Pass criteria

- **`pnpm lint`**: exit 0, **`--max-warnings 0`** across every
  workspace. Tukio-custom rules (`tukio/event-naming`,
  `tukio/no-direct-event-publish`, `tukio/no-barrel-import-*`,
  `boundaries/element-types`) all must pass.
- **`pnpm typecheck`**: exit 0, no diagnostics. TS strict +
  `noUncheckedIndexedAccess` enforced.
- **`pnpm test`**: all unit + colocated tests green. **No `it.skip`**,
  **no `.only`** committed.
- **`pnpm format:check`**: exit 0 (Prettier wants no changes). Run
  `pnpm format` to fix.

## What it does NOT do

- **E2E tests** (`pnpm --filter=<svc> test:e2e`) — run for the affected
  service before commit if you touched HTTP or NATS surfaces.
- **Chaos tests** (`pnpm chaos:test`) — run if you touched
  `@tukio/messaging` or `apps/<svc>/src/infrastructure/messaging/`.
- **Build** (`pnpm build`) — run via `/ship` before merge.
- **Coverage thresholds** — run `pnpm --filter=<svc> test:cov` when
  refining tests.
- **`npm audit` / `pnpm audit`** — run during dep bumps.

## When to use

- Before every commit. Lint-staged + Husky already run a subset (lint
  - format on staged files) — typecheck and tests are on you.
- Before opening a PR (target: `develop`).
- Before declaring "done" on any story task / subtask.
- After resolving a code-review patch.

## When it fails

- **Lint error** — refactor to satisfy the rule. Never inline
  `// eslint-disable-next-line` (forbidden by hard rule).
- **Type error** — fix the type. Never `// @ts-ignore` / `@ts-expect-error`.
- **Test failure** — fix the broken test or the broken code. A flaky
  test gets reproduced and fixed (never `it.skip` it).
- **Format diff** — run `pnpm format`.
- **`tukio/event-naming`** — fix the NATS subject to
  `<domain>.<entity>.<verb>.v<n>`.
- **`tukio/no-barrel-import-{contracts,ui}`** — change to subpath
  import.
- **`tukio/no-direct-event-publish`** — route the event through
  `OutboxPublisher`.
- **`boundaries/element-types`** — fix the cross-layer import (e.g.
  domain importing infrastructure).

## CI parity

The Story 0.11 CI workflow (`.github/workflows/ci.yml` — not yet
created) will run the same four commands on every PR. `/check` locally
matches CI 1:1, so a green `/check` should yield a green CI.
