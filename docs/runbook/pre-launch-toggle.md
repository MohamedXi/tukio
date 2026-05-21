# Pre-launch toggle (Story 0.15)

Operational guide for the `NEXT_PUBLIC_COMING_SOON_MODE` env var that gates
`apps/public` and `apps/seller` behind a coming-soon landing during the
pre-launch phase.

## How the toggle is wired (post code-review)

`apps.prod.yml` declares the container env var:
```yaml
NEXT_PUBLIC_COMING_SOON_MODE: ${COMING_SOON_MODE:-true}
```

The right-hand `${COMING_SOON_MODE:-true}` is a **shell substitution**:
docker compose reads the host shell's `COMING_SOON_MODE` variable, defaulting
to `true` when unset. The left-hand `NEXT_PUBLIC_COMING_SOON_MODE` is the env
var name set inside the container (the name Next.js middleware reads via
`process.env.NEXT_PUBLIC_COMING_SOON_MODE`).

**Why the toggle works at restart (no rebuild needed):** the middleware reads
`process.env.NEXT_PUBLIC_COMING_SOON_MODE` at module-load time (when the
standalone Next.js server starts inside the container). Restarting the
container with a new env value re-evaluates the module → new `IS_FLAG_ON`
value. The "`NEXT_PUBLIC_*` are inlined at build time" rule applies to the
**client bundle** (browser-shipped JS), not server-side middleware. Story 0.15
only references the flag in middleware (server-side), so a restart is enough.

(If a future story references the flag from a Client Component, that
reference WILL be inlined at build time — at that point the build pipeline
would need a `--build-arg` plumbing through the Dockerfile + CI workflow.
Out of scope for Story 0.15.)

Parsing is strict: only the literal string `'true'` enables the gate
(`'1'`, `'TRUE'`, booleans, whitespace, missing → OFF).

## 1 — Activate (pre-launch — already in place)

The pre-launch posture is the YAML default, so nothing to do for a fresh
deploy. To explicitly set the gate ON during a manual deploy:

```bash
ssh tukio@<DO_HOST_APPS>
cd /home/tukio/tukio

# Option A — explicit shell export before docker compose
export COMING_SOON_MODE=true
docker compose -f infra/docker-compose/apps.prod.yml pull
docker compose -f infra/docker-compose/apps.prod.yml up -d public seller

# Option B — verify the YAML default is in effect (preferred for CI deploys)
docker compose -f infra/docker-compose/apps.prod.yml pull
COMING_SOON_MODE=true docker compose -f infra/docker-compose/apps.prod.yml up -d public seller

# Verify (marker text comes from the placeholders Story 0.17 will replace).
curl -fsS https://tukio.one/fr/ | grep -i "bientôt"
curl -fsS https://seller.tukio.one/fr/seller/onboarding/identity | grep -i "bientôt"
```

The CI deploy workflow (`.github/workflows/deploy-production.yml`) can
pass `COMING_SOON_MODE` via a workflow input or a repo-level GitHub
Actions variable. The shell var must be `COMING_SOON_MODE` (short name),
matching the `${COMING_SOON_MODE:-true}` substitution in the YAML.

## 2 — Deactivate (launch day)

```bash
ssh tukio@<DO_HOST_APPS>
cd /home/tukio/tukio

export COMING_SOON_MODE=false
docker compose -f infra/docker-compose/apps.prod.yml up -d public seller

# Post-deploy verification — Story 1.2d sign-up must work again.
curl -fsS https://tukio.one/fr/auth/sign-up | grep -i "sign up\|inscription"
# Story 1.3d v2 conversion wizard (needs valid Keycloak JWT cookie).
curl -fsS https://seller.tukio.one/fr/seller/onboarding/identity \
  -H 'cookie: tukio-access-token=<valid-jwt>' | grep -i "identit[eé]"
```

For permanent deactivation, change the YAML default from `:-true` to
`:-false` in `infra/docker-compose/apps.prod.yml` and commit:

```yaml
NEXT_PUBLIC_COMING_SOON_MODE: ${COMING_SOON_MODE:-false}
```

Then the gate stays OFF on every fresh deploy without operator action.

## 3 — Cleanup PR (optional, post-launch)

Once the platform is publicly live and the gate has been off for a few
weeks, a maintainer can delete the flag entirely. Files to remove or edit:

**Code (apps):**
- `apps/public/src/middleware/coming-soon-gate.ts`
- `apps/public/src/middleware/coming-soon-gate-decision.ts`
- `apps/public/src/middleware/__tests__/coming-soon-gate-decision.spec.ts`
- `apps/seller/src/middleware/coming-soon-gate.ts`
- `apps/seller/src/middleware/coming-soon-gate-decision.ts`
- `apps/seller/src/middleware/coming-soon-gate-decision.spec.ts`
- The `comingSoonGateMiddleware` import + call in `apps/{public,seller}/src/middleware.ts`
- `apps/public/e2e/coming-soon-gate.spec.ts`
- `apps/seller/e2e/coming-soon-gate.spec.ts`

**Env / infra:**
- `NEXT_PUBLIC_COMING_SOON_MODE` lines in `apps/{public,seller}/.env.example`
- `NEXT_PUBLIC_COMING_SOON_MODE` header line in `apps/{public,seller}/.env.local`
- The `NEXT_PUBLIC_COMING_SOON_MODE` env entries in
  `infra/docker-compose/apps.prod.yml` (`public` + `seller` services)
- `COMING_SOON_MODE` references in any deploy workflow input/variable

**Layouts (Story 0.15 hardening to be evaluated for retention):**
- `setRequestLocale(locale)` call in `apps/public/src/app/[locale]/layout.tsx`
  + matching `setRequestLocale` import — this is **canonical next-intl
  practice** for static rendering / non-middleware rewrites and is **safe
  to keep**. If retained, drop the Story 0.15 comment block; if removed,
  the middleware-driven flow continues to work for all current routes.
- Same for `apps/seller/src/app/[locale]/layout.tsx`.

**Documentation:**
- "Pre-launch mode" sections in `apps/{public,seller}/README.md`
- AGENTS.md hard rule bullet referencing the toggle
- This runbook

**Placeholder pages — deliberately kept:**
The 9 placeholder pages (`apps/public/src/app/[locale]/{coming-soon,
a-propos, confidentialite, contact, devenir-pro, mentions-legales}/` +
`apps/seller/src/app/[locale]/seller-coming-soon/`) will be replaced by
Stories 0.17/0.18/0.19 with the real content. By cleanup PR time they
are already the real pages.

## 4 — Troubleshooting

- **Flag has no effect** — confirm the env var resolves to the literal
  string `'true'` (case-sensitive). `true` boolean, `'1'`, `'TRUE'`,
  trailing whitespace all parse as OFF by design. Run inside the container:
  `docker compose exec public sh -c 'echo "$NEXT_PUBLIC_COMING_SOON_MODE"'`.
- **YAML default wins despite `COMING_SOON_MODE=false`** — make sure the
  shell export happened in the SAME shell that runs `docker compose`. SSH
  multiplexing or sub-shells can drop exports. Use `COMING_SOON_MODE=false
  docker compose ...` (inline) instead of `export ... ; docker compose ...`.
- **Infinite rewrite loop** — the `coming-soon` (apex) or
  `seller-coming-soon` (seller) route was removed from the whitelist in
  `coming-soon-gate-decision.ts`. Re-add it.
- **Epic 1+ sign-up broken with flag OFF** — the gate is returning a
  response even when off. Verify
  `apps/public/src/middleware/coming-soon-gate.ts:IS_FLAG_ON` and the
  vitest spec `coming-soon-gate-decision.spec.ts` case 1 (flag OFF + any
  path → pass).
- **Acquisition cookie missing during pre-launch** — intentional: the
  gate runs before `acquisitionCookieMiddleware`. Visitors who land on
  the pre-launch site receive their UTM cookies through the landing form
  (Story 0.20).
- **404 on `/robots.txt` or `/sitemap.xml` with flag ON** — the
  `apps/{public,seller}/src/app/{robots,sitemap}.ts` stubs were not
  shipped. They live at the top of the `src/app/` tree (not under
  `[locale]/`).

## 5 — Rollback

If a deactivation deploy breaks something:

```bash
ssh tukio@<DO_HOST_APPS>
cd /home/tukio/tukio
COMING_SOON_MODE=true docker compose -f infra/docker-compose/apps.prod.yml up -d public seller
```

Rollback to coming-soon mode is < 5 minutes. There is no DB migration, no
durable state — the gate is purely an env var + middleware rewrite. The
container restart re-loads middleware with the new env value.
