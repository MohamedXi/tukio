# Sprint 0 Completion — tukio.one

**Status**: ✅ COMPLETE — all 13 Sprint 0 stories implemented  
**Date**: 2026-05-15  
**Epic**: Epic 0 — Sprint 0 Foundation (MVP)

---

## Delivery summary

| # | Story | Status | Key output |
|---|-------|--------|------------|
| 0.1 | Bootstrap monorepo Turborepo + 14 codebases scaffold | ✅ done | pnpm monorepo, 4 Next.js apps, 10 NestJS services, 8 packages |
| 0.2 | @tukio/contracts — envelope + NATS events + DTOs | ✅ done | REST envelope types, versioned event schemas, Zod DTOs |
| 0.3 | Design system Tailwind v4 + @tukio/ui | ✅ done | Tailwind v4 CSS-first theme, token system |
| 0.4 | 17 atomic components @tukio/ui/components | ✅ done | Button, Input, Badge, Card, Avatar, … |
| 0.5 | 12 composite patterns @tukio/ui/patterns | ✅ done | ListingCard, SearchBar, BookingWidget, … |
| 0.6 | Pattern Pretre scaffolding identity-svc | ✅ done | Clean Architecture template, identity-svc canonical reference |
| 0.7 | @tukio/messaging NATS JetStream + outbox | ✅ done | OutboxRelayService, InboxDedup, NatsJetStreamModule |
| 0.8 | @tukio/auth + @tukio/auth-client | ✅ done | KeycloakJwtGuard, PKCE flow, cookie Domain=.tukio.one |
| 0.9 | @tukio/api-client + @tukio/i18n-client + @tukio/testing | ✅ done | Typed REST client, next-intl helpers, testcontainers |
| 0.10 | Docker Compose dev local + bootstrap scripts | ✅ done | docker-compose.dev.yml, bootstrap-databases.sh, seed-categories |
| 0.11 | CI GitHub Actions pipeline | ✅ done | ci.yml, lighthouse.yml, build-images.yml, deploy placeholders |
| 0.12 | DO Droplets + docker-compose production infra | ✅ done | 2 droplets, Caddy, deploy-staging/production, backups, crons |
| 0.13 | 15 ADRs + Next.js multi-zones + acquisition schema | ✅ done | docs/adr/, rewrites, migration, acquisitionCookieMiddleware |

**Total estimated effort**: ~47-65 j-h dev

---

## Prerequisites before starting Epic 1 development

### Infra (DO Droplets — Phase B operational steps)

- [ ] Execute `infra/scripts/do-droplet-init.sh apps` on `tukio-apps` droplet
- [ ] Execute `infra/scripts/do-droplet-init.sh data` on `tukio-data` droplet
- [ ] Provision secrets: `infra/scripts/provision-secrets.sh apps` + `provision-secrets.sh data`
- [ ] Configure rclone for R2 on `tukio-data` droplet
- [ ] Add DNS records in Squarespace panel (7 records A → `138.68.78.253`)
- [ ] Create R2 bucket `tukio-backups-prod` in Cloudflare dashboard
- [ ] Configure GitHub Secrets: `DO_DEPLOY_KEY`, `DO_HOST_APPS`
- [ ] First manual deploy: `docker compose -f data.prod.yml up -d --wait` on data droplet
- [ ] First manual deploy: `docker compose -f apps.prod.yml up -d` on apps droplet
- [ ] Smoke test: `curl https://api.tukio.one/health` → 200 OK
- [ ] Setup UptimeRobot monitors (3 endpoints)
- [ ] Verify weekly DO snapshots + daily Postgres backup crons are installed

### Code validation

- [ ] `pnpm install` — ensure lockfile is current
- [ ] `pnpm lint && pnpm typecheck && pnpm test` — full regression suite green
- [ ] `pnpm --filter=identity-svc migration:run` — acquisition columns applied to dev DB
- [ ] `pnpm --filter=public dev` → navigate `http://localhost:3000/fr/?utm_source=google` → verify `tukio-acquisition` cookie set in DevTools

### Design sprint (parallel, 5-7 days)

Per `implementation_readiness_2026_05_09.md` design backlog:
- 4 new MVP screens (booking request flow, pro dashboard, KYC upload, admin moderation detail)
- Audit 5 Cloud Design bundle screens for Tukio adaptation
- 7 Resend email templates FR + EN

---

## Pending decisions (D1-D4 from `implementation_readiness_2026_05_09.md`)

These decisions are still open and must be resolved before the affected Epic stories:

| Decision | Affects | When |
|----------|---------|------|
| D1 — Stripe Connect Express vs Standard | Story 2.1 | Before Epic 2 dev |
| D2 — Keycloak Phasetwo extension scope | Story 1.1 | Before Epic 1 dev |
| D3 — Media upload: direct-to-R2 vs gateway proxy | Story 3.4 | Before Epic 3 dev |
| D4 — Booking cancellation fee structure | Story 4.5 | Before Epic 4 dev |

---

## Key architectural decisions formalized (ADRs)

15 ADRs now available in `docs/adr/` — consult before any cross-cutting change:

- **ADR-0001**: Pattern Pretre Clean Architecture → all NestJS services must follow it
- **ADR-0007**: Outbox pattern → never call `nats.publish()` directly from use cases
- **ADR-0013**: 4 Next.js apps multi-zones → admin is isolated, no rewrite from public
- **ADR-0015**: DO Droplets + docker-compose → no K8s until volume justifies it

---

## Next steps

1. Run `/bmad-create-story` → auto-discover **Story 1.1** (Provision Keycloak realm tukio + 4 clients + 5 roles + Phasetwo MVP)
2. Complete Phase B infra operational steps (checklist above)
3. Run the design sprint (parallel)
4. Resolve D1-D4 pending decisions

**Sprint 0 is the foundation. Epic 1 builds the identity backbone on top of it.**
