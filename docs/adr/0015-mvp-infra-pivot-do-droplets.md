# ADR-0015: MVP infrastructure pivot — DO Droplets + docker-compose (over K8s + Vercel)

- **Status**: ✅ Accepted
- **Date**: 2026-05-14
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `ops`

## Context

The original Sprint 0 infrastructure plan (Story 0.12 initial spec, superseded) called for:

- **Hetzner K8s** (3-node cluster) + **ArgoCD** + **Helm** charts per service
- **Vercel** for 4 Next.js frontend deployments (multi-zones)
- **Neon Postgres** (managed, serverless)
- **Doppler** for secret management
- **Grafana Cloud** + OpenTelemetry SDK for observability

Estimated cost: **€60-80+/month** for MVP traffic.

On 2026-05-14, the founder reviewed the infrastructure plan against the MVP budget and team size:

- **Budget constraint**: the MVP hard cap is €35/month (two droplets, one domain, R2 free tier).
  The original stack exceeded this by 2×.
- **Ops overhead**: K8s control plane, ArgoCD sync loops, Helm value files, cert-manager, ingress
  controller, NetworkPolicy, HPA, PDB — this is 50+ infrastructure YAML files to maintain for a
  1-developer team.
- **MVP traffic**: PRD forecasts < 1,000 visitors/day at launch. A 2 GB droplet running
  docker-compose handles this load with headroom.
- **Time-to-first-deploy**: K8s setup (cluster provisioning + Helm charts + ArgoCD + cert-manager +
  Doppler sync) was estimated at 2-3 weeks. The docker-compose alternative: 2-3 days.

## Decision

Replace the K8s + Vercel + managed services stack with **2 DigitalOcean Droplets + docker-compose +
Caddy** for the MVP:

| Component | Previous (superseded) | New (ADR-0015) |
|-----------|----------------------|----------------|
| Compute | Hetzner K8s 3-node (~€40/mo) | 2× DO Droplets 2 GB Frankfurt (~€22/mo) |
| Frontend deploy | Vercel (multi-zones, free tier) | Docker images on `tukio-apps` droplet |
| Postgres | Neon managed (~€15/mo) | Self-hosted Postgres 16 on `tukio-data` |
| Secrets | Doppler (~€10/mo) | Docker secrets + `.env` files on droplet |
| Observability | Grafana Cloud (~€10/mo) | Pino JSON logs + UptimeRobot (free) |
| Routing | Nginx ingress + cert-manager | Caddy 2 (auto-TLS via Let's Encrypt) |
| CI/CD | ArgoCD + Helm | GitHub Actions SSH deploy |
| DR | Velero snapshots | DO weekly snapshots + daily Postgres → R2 |

**Total new cost**: ~€29/month (Option B: 2 droplets €22 + DO weekly snapshots €6 + domain €1).
**Savings**: ~€50-60/month vs original plan.

**Architecture** (Story 0.12):

- **`tukio-apps` droplet** (€12/mo, 2 GB, Frankfurt): 4 Next.js containers + 10 NestJS containers +
  Caddy reverse-proxy. Public IP exposed only on ports 80/443.
- **`tukio-data` droplet** (€12/mo, 2 GB, Frankfurt): Postgres 16 + Keycloak 25 + NATS JetStream +
  Meilisearch + Redis. VPC-internal only — DO Cloud Firewall blocks all public DB ports.
- **VPC**: `tukio-fra1-vpc` (10.114.0.0/20) — zero-cost private network between the two droplets.
- **Caddy**: auto-TLS via Let's Encrypt HTTP-01, reverse-proxies subdomains to containers.
- **R2**: Cloudflare R2 (free 10 GB tier) for media uploads and Postgres daily backups.
- **GitHub Actions**: SSH-based deploy (`docker compose pull && up -d`) on `develop` merge (staging)
  and `v*` tag (production).

**Migration path to K8s** (V1+): when traffic exceeds single-droplet capacity (estimated > 10k
req/day sustained) or when rolling deploys / canary releases are needed, migrate services to a
managed K8s cluster (DO Kubernetes or Hetzner K8s). The Docker images produced by CI are already
K8s-deployable — only Helm charts + ingress config need to be added.

## Consequences

### Positive

- **Budget-compliant**: €29/month vs €80+/month original. Savings of ~€50/month = ~€600/year.
- **Ops simplicity**: one SSH + `docker compose up` to deploy. No Helm, no ArgoCD, no cert-manager.
  A junior developer can understand the full deployment in 30 minutes.
- **Fast first deploy**: from zero to staging in 2-3 days vs 2-3 weeks.
- **Separation of concerns** (apps vs data droplets): if the apps droplet is compromised, the data
  droplet is not directly accessible (VPC + firewall). OOM on the apps droplet doesn't kill Postgres.
- **Caddy auto-TLS**: Let's Encrypt renewal is automatic — no cert-manager operator to maintain.

### Negative / Trade-offs

- **No zero-downtime rolling deploys**: `docker compose up -d --remove-orphans` causes ~2-5s
  downtime per service during redeploy (containers restart sequentially). Acceptable for MVP
  (deploy frequency: ~1-2/day). UptimeRobot 5-min interval won't flag this.
- **Single-host per tier**: if `tukio-apps` droplet crashes, all apps are down until Docker restarts
  containers (`restart: unless-stopped`). No pod-level health-check-based rescheduling like K8s.
  RPO: ~30s (DO restart + healthcheck). RTO: ~2 min (Docker pull + compose up).
- **`docker-compose.prod.yml` is the single infra file**: adding a new service requires editing
  `apps.prod.yml` + a redeploy. No K8s HPA for auto-scaling — resize droplet manually if needed.
- **No canary deployments**: all users get the new version simultaneously. Feature flags (V1+ via
  a simple `flag` table in Postgres) are the rollout mechanism.

### Neutral

- The pivot from Vercel (multi-zones) to docker-compose does not change the Next.js rewrite
  configuration — `apps/public/next.config.ts` still defines rewrites that work in both
  environments. The difference is that Caddy handles subdomain routing in production instead of
  Vercel edge routing.
- `admin.tukio.one` isolation is preserved: Caddy routes this subdomain to the `admin:3003` container,
  with strict `Cache-Control: no-store` headers and a separate Keycloak TOTP policy (Story 1.7).

## Alternatives Considered

### Fly.io

PaaS with global CDN, auto-scaling, no cold starts. **Rejected**: vendor lock-in on the compute
platform; pricing unclear for 14 containers at MVP scale; less control over networking and firewall
rules than DO droplets.

### Railway / Render

Similar PaaS. **Rejected**: €15-25/month for a handful of services; limited control over inter-service
networking; no VPC isolation between app and data tiers.

### DigitalOcean App Platform

DO's managed PaaS. **Rejected**: ~€5-12 per service per month for basic containers = €60-120/month
for 14 services. Significantly over budget.

### Retaining Hetzner K8s

Continue with the original plan at reduced scope. **Rejected**: even a minimal Hetzner K8s cluster
(1 control plane + 2 workers) costs ~€25/month + cert-manager + ArgoCD overhead, with 3-5× more
ops complexity than docker-compose. The budget savings are insufficient given the ops cost.

## References

- [Memory: mvp_infra_pivot_2026_05_14.md — founder decision context]
- [Source: Story 0.12 — full DO Droplets + docker-compose implementation]
- [Source: infra/docker-compose/apps.prod.yml — apps stack]
- [Source: infra/docker-compose/data.prod.yml — data stack]
- [Source: infra/docker-compose/Caddyfile — routing + TLS]
- [Source: .github/workflows/deploy-staging.yml + deploy-production.yml]
- [ADR-0005 — Meilisearch self-hosted on tukio-data droplet]
- [ADR-0009 — Keycloak 25 self-hosted on tukio-data droplet]
- [ADR-0013 — Caddy replaces Vercel for subdomain routing]

## Implementation Notes

- **Droplet IDs**: `tukio-apps` = 570967138, `tukio-data` = 570967130. VPC private IPs:
  apps = `10.114.0.3`, data = `10.114.0.2`.
- **DO Cloud Firewalls**: `tukio-apps-firewall` (SSH + 80/443 public), `tukio-data-firewall`
  (SSH public + data ports restricted to apps VPC IP `10.114.0.3/32`).
- **Secrets**: provisioned via `infra/scripts/provision-secrets.sh` on each droplet. Files at
  `/home/tukio/tukio/secrets/<name>` (mode 600). Docker secrets bind-mount them into containers.
- **Backup + DR**: daily Postgres dump → R2 (03:00 UTC cron), weekly DO snapshot (Sunday 04:00 UTC).
  Documented in `docs/ci-cd/disaster-recovery.md`.
- **Migration to K8s** trigger: when `prom-client` metrics show sustained CPU > 80% or memory > 90%
  on either droplet for 7 consecutive days, open a `migrate-to-kubernetes` story.
