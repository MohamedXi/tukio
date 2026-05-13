# Git workflow

## Branch model

- **`main`** — README-only. **Never push code to `main`.** It carries the
  README + ADR-pointer state visible to landing-page traffic and the
  GitHub repo description.
- **`develop`** — integration branch. Every story PR targets `develop`.
  CI gates run here.
- **`feature/story-<X.Y>-<short-slug>`** — per-story working branch.
  Example: `feature/story-0.10-docker-compose-dev-bootstrap`,
  `feature/story-1.2-customer-b2c-registration`.
- **`hotfix/<short-slug>`** — emergency fix on prod. Rare; documented
  in the corresponding story or ad-hoc ADR.

## Story → PR loop

1. Pick the next `ready-for-dev` story from `sprint-status.yaml` (or run
   `/bmad-dev-story` which picks for you).
2. Create the feature branch from `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/story-<X.Y>-<slug>
   ```
3. Implement following the story spec. Each subtask ends with `[x]` in
   the story file when verified.
4. Run `/check` before each commit.
5. Move story status to `review` and run `/bmad-code-review` (3-layer
   adversarial review).
6. Apply patches. Move story status to `done`.
7. Open a PR via `gh pr create` targeting `develop`. Body includes:
   - Story reference (`Story 0.10`)
   - Summary of changes
   - Test plan checklist
8. CI must be green before merge.
9. Squash-merge to `develop`. Delete the feature branch.

## Conventional Commits

Enforced by **commitlint** (`commitlint.config.cjs`, `@commitlint/config-conventional`).
Format:

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer(s)>
```

Allowed types: `feat | fix | docs | chore | refactor | test | perf | ci | build | style`.

Examples:

```
feat(infra): docker-compose dev stack + bootstrap scripts — Story 0.10

A 6-service stack (PG/NATS/Keycloak/Meilisearch/Redis/MailHog) plus 5
idempotent bootstrap scripts + 10 service .env.example rewrites + a fix
to identity-svc's data-source.ts duplicate export.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

```
fix(identity-svc): align EnvSchema dev defaults with Story 0.10 shared user
```

```
chore(sprint-status): Story 0.10 → done (post code review)
```

### Scope conventions

- **`infra`** — `infra/**`, `package.json` scripts, docker
- **`<service-name>`** — `apps/<service>/**` (e.g. `identity-svc`, `gateway-api`)
- **`<frontend-name>`** — `apps/<frontend>/**` (`public`, `customer`, `seller`, `admin`)
- **`@tukio/<package>`** — `packages/<package>/**`
- **`tools`** — `tools/**`
- **`docs`** — `docs/**`
- **`bmad`** — `_bmad-output/**` (story files, sprint-status)
- **`agents`** — `.agents/**` or `AGENTS.md` / `CLAUDE.md`
- (no scope) — root-level or cross-cutting changes

## Husky + lint-staged

`.husky/pre-commit` runs `lint-staged` which:

- Runs `prettier --write` on staged files (`.{ts,tsx,js,jsx,mjs,cjs,json,md,yaml,yml,css,scss}`).
- Runs `eslint --fix` on staged `.{ts,tsx,js,jsx,mjs,cjs}`.

`.husky/commit-msg` runs `commitlint --edit $1`.

**Never bypass hooks** (`--no-verify`, `--no-gpg-sign`) without explicit
user authorisation. If a hook fails, fix the underlying issue.

## Co-authoring with AI

Every AI-assisted commit gets a `Co-Authored-By` footer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

This is the recognised GitHub trailer format. Required by team
convention.

## Commit hygiene

- **One logical change per commit.** Story 0.10 was 4 commits (initial
  feat, fix, code-review-patches, sprint-status update) — not 1 mega
  commit.
- **Never amend a public commit** (one already pushed or on a shared
  branch). Create a new commit instead.
- **Never force-push** to `develop`, `main`, or a PR branch under review
  without authorisation.
- **Always include the story ID** in the commit subject or body so
  `git log` is traceable to `sprint-status.yaml`.

## Pull requests

Use `gh pr create`:

```bash
gh pr create --base develop --title "feat(infra): docker-compose dev stack (Story 0.10)" \
  --body "$(cat <<'EOF'
## Summary

- 6-service Docker Compose dev stack + CI variant
- 5 idempotent bootstrap scripts
- 10 service .env.example rewrites

## Test plan

- [x] pnpm docker:up:wait → all 6 healthy
- [x] pnpm docker:bootstrap → 11 DBs + Keycloak realm + seed (idempotent)
- [x] pnpm --filter=identity-svc test:e2e → 13/13 pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

PR titles follow the same convention as commit subjects (one
Conventional Commit summary). The PR body includes a `Test plan`
checklist.

## Hard rules

- ✅ Every change is on a `feature/story-<X.Y>-<slug>` branch.
- ✅ PRs target `develop`, never `main`.
- ✅ Conventional Commits enforced by commitlint.
- ✅ Husky pre-commit + commit-msg hooks always run.
- ✅ AI commits include `Co-Authored-By`.
- ❌ Never `git commit --amend` a pushed commit.
- ❌ Never `git push --force` to `develop`, `main`, or shared PR branches.
- ❌ Never bypass hooks (`--no-verify`) without explicit user authorisation.
- ❌ Never push to `main` — README only. Story merges go to `develop`,
  release process promotes README updates separately.
