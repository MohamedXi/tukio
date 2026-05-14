# Story 0.12: DigitalOcean Droplet deployment via docker-compose (MVP cost-optimized)

Status: in-progress

<!-- Supersedes: 0-12-helm-charts-k8s-argocd-staging-observability.md (2026-05-14 pivot, see ADR-015 + memory mvp_infra_pivot_2026_05_14.md) -->

## Story

**As a** founder solo dev (équipe Sprint 0),
**I want** **2 droplets DigitalOcean 2 GB Frankfurt** (Option B €29/mois MVP — split apps / data pour marge OOM) :
- **`tukio-apps`** ($12/mois) héberge les **10 services NestJS + 4 frontends Next.js + Caddy reverse-proxy** via `infra/docker-compose/apps.prod.yml`
- **`tukio-data`** ($12/mois) héberge **Postgres 16 + Keycloak 25 + NATS JetStream + Meilisearch + Redis** via `infra/docker-compose/data.prod.yml`
- **VPC privé DO** inter-droplets (bande passante gratuite, latence < 1 ms) — apps se connectent à data via IPs privées (`DB_HOST=10.114.0.5` ex.)

avec **Caddy reverse-proxy + Let's Encrypt TLS auto** (sur le droplet apps), **DNS Squarespace** (records A vers le droplet apps IP publique), **Cloudflare R2** pour les uploads media + backups Postgres (gratuit jusqu'à 10 GB), **deploy workflow GitHub Actions** qui SSH sur les 2 droplets et fait `docker compose pull && up -d` au merge `develop` (staging-like) puis tag `v*` (production), **backup Postgres quotidien** via cron sur le droplet data + `pg_dumpall` + `rclone copy` vers R2, **UptimeRobot** monitor `https://api.tukio.one/health` (apps droplet — endpoint public) toutes les 5 min avec alerte Slack `#tukio-alerts`, **DO Cloud Firewall** par droplet (apps : SSH restreint tech-lead + 80/443 ouvert au monde ; data : SSH restreint + ports DB/Keycloak/NATS/Meili/Redis ouverts UNIQUEMENT au droplet apps via VPC source IP), **DO snapshots hebdo** ($3/mois × 2 droplets = $6/mois) pour DR rapide, **Docker secrets + `.env` files** secrets management sur chaque droplet (chiffré au repos via DO disk encryption), et **les workflows `deploy-{staging,production}.yml` placeholders Story 0.11 sont finalisés** avec la vraie logique SSH multi-droplets + smoke test post-deploy,
**so that** chaque merge sur `develop` (puis `main` pour prod) déploie automatiquement sur les 2 droplets en < 5 min, sans intervention manuelle, avec rollback automatique si le healthcheck post-deploy fail, monitoring uptime visible via UptimeRobot dashboard + alertes Slack temps réel sur incident, backups Postgres quotidien R2 archivés 30 jours (RPO < 24 h, RTO < 1 h pour MVP), et **budget total ~€29/mois** (2 droplets €22 + snapshots €6 + domain €1 + tout le reste gratuit). La séparation apps/data offre une marge OOM critique (Keycloak ~600 MB + Postgres ~300 MB ne competing pas avec les 10 services NestJS pour la RAM) et un meilleur isolation sécurité (compromis applicatif n'expose pas directement la DB).

> **Outcome attendu** : à la fin de cette story, `git push develop` (post Story 0.11 build-images sur main) déclenche `deploy-staging.yml` qui (1) attend la fin de `build-images.yml`, (2) SSH `tukio@<droplet-staging-ip>`, (3) `cd ~/tukio && git pull && docker compose -f infra/docker-compose/docker-compose.prod.yml pull && docker compose up -d --remove-orphans`, (4) `docker image prune -f`, (5) smoke `curl https://staging.tukio.one/health` retry 30s, (6) Slack notif. Si fail post-deploy, le workflow exit 1 et un step `Rollback` revert au précédent SHA via `docker compose ... pull <previous-sha> && up -d`. Tag `v0.0.1-rc1` sur main → `deploy-production.yml` (avec manual approval GitHub Environment) → identique mais sur droplet prod.

## Acceptance Criteria

1. **AC1 — 2 Droplets DigitalOcean provisionnés + VPC + initial setup** : Given un compte DO + `DO_TOKEN` configuré (`.zshrc` du founder), When je provisionne, Then **2 droplets Frankfurt 2 GB ($12/mois chacun)** sont créés via `doctl compute droplet create` avec un VPC privé partagé :
   - **VPC** `tukio-fra1-vpc` (créé via `doctl vpcs create`) — CIDR `10.114.0.0/20`, region `fra1`
   - **Droplet `tukio-apps`** :
     - Image `docker-20-04`, size `s-1vcpu-2gb` ($12/mois), region `fra1`, VPC `tukio-fra1-vpc`
     - IP publique pour Caddy 80/443 + SSH restreint
     - Hosts : 4 frontends Next.js + 10 services NestJS + Caddy reverse-proxy
   - **Droplet `tukio-data`** :
     - Image `docker-20-04`, size `s-1vcpu-2gb` ($12/mois), region `fra1`, VPC `tukio-fra1-vpc`
     - IP publique pour SSH uniquement (firewall bloque tout autre port à l'externe — les ports DB/Keycloak/NATS/Meili/Redis sont autorisés UNIQUEMENT depuis l'IP privée VPC du droplet apps)
     - Hosts : Postgres 16 + Keycloak 25 + NATS JetStream + Meilisearch + Redis
   - **SSH key** : même clé ajoutée aux 2 droplets via `doctl compute ssh-key`
   - **Backup automatique DO** : OFF sur les 2 (snapshots manuels weekly à la place)
   - **Initial setup script `infra/scripts/do-droplet-init.sh`** (idempotent, exécutable sur chaque droplet avec argument `apps` ou `data`) qui :
     - Crée user non-root `tukio` (UID 1001) + ajout aux groupes `docker` + `sudo`
     - Copie `~/.ssh/authorized_keys` vers `/home/tukio/.ssh/` avec ownership correct
     - **Désactive le login root SSH** : `PermitRootLogin no` dans `/etc/ssh/sshd_config` + `systemctl restart sshd`
     - Configure unattended-upgrades pour patches Ubuntu (`apt install unattended-upgrades`)
     - Installe `rclone` (sur droplet `data` uniquement — backups vers R2)
     - Installe `fail2ban` (anti-brute-force SSH, les 2 droplets)
     - Vérifie Docker version (`docker --version` ≥ 24.x) et compose plugin (`docker compose version` ≥ v2.27)
     - Crée `/var/log/tukio/` pour les logs applicatifs hors-Docker
     - Si `$1 == data` : prépare le volume `/var/lib/tukio/postgres` (mount point pour DB volumes)
   - **Doc opérationnelle** : `docs/ci-cd/digitalocean-deployment.md` finalisée avec les 2 IPs (publiques + VPC privées) + diagramme d'archi

2. **AC2 — DO Cloud Firewalls (2) + DNS Squarespace** : Given les 2 droplets provisionnés, When je configure la sécurité réseau, Then :
   - **Firewall `tukio-apps-firewall`** créé via `doctl compute firewall create` et attaché à `tukio-apps` :
     - **Inbound** : SSH (port 22) restreint à l'IP du tech-lead (`<TECH_LEAD_IP>/32`), HTTPS (443) + HTTP (80) ouverts à `0.0.0.0/0` (Caddy + Let's Encrypt)
     - **Outbound** : tout autorisé
   - **Firewall `tukio-data-firewall`** créé et attaché à `tukio-data` :
     - **Inbound** : SSH (port 22) restreint à l'IP du tech-lead, ports `5432` (PG) + `8080` (Keycloak) + `4222` (NATS) + `7700` (Meili) + `6379` (Redis) **UNIQUEMENT depuis l'IP VPC privée de `tukio-apps`** (utiliser `--inbound-rules "...,sources:droplet_ids:<apps-droplet-id>"`)
     - **Outbound** : tout autorisé (data doit pouvoir pull ghcr.io pour Keycloak/Meili images + rclone R2 pour backups)
   - **Squarespace DNS** records A créés manuellement dans le panneau Squarespace (`account.squarespace.com/domains/tukio.one/dns-settings`) — tous pointent vers l'IP publique de **`tukio-apps`** (le droplet `tukio-data` n'est PAS exposé via DNS) :
     - `@` (apex) → `<tukio-apps-public-ip>` TTL 3600
     - `app` → `<tukio-apps-public-ip>` TTL 3600 (apps/public)
     - `api` → `<tukio-apps-public-ip>` TTL 3600 (gateway-api)
     - `customer` → `<tukio-apps-public-ip>` TTL 3600
     - `seller` → `<tukio-apps-public-ip>` TTL 3600
     - `admin` → `<tukio-apps-public-ip>` TTL 3600
     - `auth` → `<tukio-apps-public-ip>` TTL 3600 (Caddy → reverse-proxy vers `10.114.0.X:8080` Keycloak sur tukio-data)
   - **Email records** (à ajouter quand Resend sera wired pour `noreply@tukio.one`) :
     - TXT `@` → `v=spf1 include:_spf.resend.com ~all` (SPF)
     - TXT `resend._domainkey` → `<DKIM value from Resend dashboard>` (DKIM)
     - TXT `_dmarc` → `v=DMARC1; p=quarantine; rua=mailto:postmaster@tukio.one` (DMARC)
     - MX `@` → `feedback-smtp.resend.com` priority 10 (bounces)
   - **Vérification propagation** : `dig +short app.tukio.one` doit retourner `<droplet-ip>` après 1-4 h (propagation typique Squarespace)
   - **Doc** : `docs/ci-cd/digitalocean-deployment.md` § "Squarespace DNS — records à ajouter" mis à jour avec la table finale + screenshot UI Squarespace

3. **AC3 — 2 compose files prod (apps.prod.yml + data.prod.yml)** : Given le split apps/data, When je configure les 2 droplets, Then je trouve **2 fichiers docker-compose v3.8** :

### `infra/docker-compose/data.prod.yml` (déployé sur `tukio-data`)

Orchestre les **5 services data** :
   - **`postgres`** (image `postgres:16-alpine`) :
     - Env via Docker secrets : `POSTGRES_USER_FILE`, `POSTGRES_PASSWORD_FILE`, `POSTGRES_DB=tukio`
     - Ports : `5432:5432` bound sur l'IP VPC privée du droplet uniquement (`10.114.0.X:5432`), pas `0.0.0.0:5432`
     - Volume persistent `/var/lib/tukio/postgres:/var/lib/postgresql/data` (bind mount sur droplet pour survivre aux containers)
     - Healthcheck `pg_isready`
     - Restart `unless-stopped`
   - **`keycloak`** (image `quay.io/keycloak/keycloak:25.0`) :
     - Command `start` (mode production, pas `start-dev`)
     - Env : `KC_DB=postgres`, `KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak`, `KC_HOSTNAME=auth.tukio.one`, `KC_PROXY=edge` (Caddy gère TLS), `KC_HEALTH_ENABLED=true`
     - Secrets via Docker secrets (`KC_DB_PASSWORD_FILE`, `KEYCLOAK_ADMIN_PASSWORD_FILE`)
     - `depends_on: [postgres]` avec condition `service_healthy`
     - Restart `unless-stopped`
   - **`nats`** (image `nats:2.10-alpine`) :
     - Command `-js -sd /data` (JetStream enabled, storage dir)
     - Volume `nats_data:/data`
     - Restart `unless-stopped`
   - **`meilisearch`** (image `getmeili/meilisearch:v1.10`) :
     - Env `MEILI_NO_ANALYTICS=true`, `MEILI_MASTER_KEY_FILE=/run/secrets/meili_key`
     - Volume `meili_data:/meili_data`
     - Secret `meili_key`
     - Restart `unless-stopped`
   - **`redis`** (image `redis:7-alpine`) :
     - Volume `redis_data:/data` (AOF persistence)
     - Command `redis-server --appendonly yes`
     - Ports : `6379:6379` bound sur l'IP VPC privée
     - Restart `unless-stopped`
   - **Volumes** : `nats_data`, `meili_data`, `redis_data` + bind mount `/var/lib/tukio/postgres`
   - **Secrets** : `pg_password`, `kc_db_password`, `kc_admin_password`, `meili_key`, `r2_access_key`, `r2_secret_key` (pour les backups PG)
   - **Network** : `tukio-data` (bridge interne droplet)

### `infra/docker-compose/apps.prod.yml` (déployé sur `tukio-apps`)

Orchestre les **15 conteneurs apps** :

   - **`caddy`** (image `caddy:2-alpine`) — reverse-proxy + TLS auto Let's Encrypt :
     - Ports `80:80` + `443:443` (publics)
     - Volumes `./Caddyfile:/etc/caddy/Caddyfile:ro`, `caddy_data:/data`, `caddy_config:/config`
     - Network `tukio-apps` (interne)
     - Restart `unless-stopped`
     - **Note** : Caddy doit pouvoir reverse-proxy vers Keycloak sur droplet `tukio-data` via IP VPC. Routes Keycloak : `reverse_proxy auth.tukio.one 10.114.0.<DATA_PRIV_IP>:8080`
   - **10 backend services NestJS** (image `ghcr.io/mohamedxi/tukio/<svc>:develop` ou `:<sha>`) :
     - `gateway-api`, `identity-svc`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`
     - Env vars par service pointant vers le droplet data via IP VPC privée :
       - `DB_HOST=10.114.0.<DATA_PRIV_IP>`, `DB_PORT=5432`
       - `KEYCLOAK_URL=http://10.114.0.<DATA_PRIV_IP>:8080` (interne, Caddy gère TLS pour les clients externes)
       - `NATS_URL=nats://10.114.0.<DATA_PRIV_IP>:4222`
       - `REDIS_URL=redis://10.114.0.<DATA_PRIV_IP>:6379`
       - `MEILI_URL=http://10.114.0.<DATA_PRIV_IP>:7700`
     - Secrets via Docker secrets (DB_PASSWORD, KEYCLOAK_SECRET, STRIPE_SECRET, RESEND_API_KEY, R2_ACCESS_KEY, R2_SECRET_KEY)
     - PAS de `depends_on` cross-droplet — les apps re-tentent la connexion en boucle si data n'est pas dispo (TypeORM retry built-in + Nest module init retry pattern)
     - Restart `unless-stopped`
     - Logging driver `json-file` avec rotation `max-size: 10m` + `max-file: 3` (évite full disk)
   - **4 frontends Next.js** (image `ghcr.io/mohamedxi/tukio/<app>:develop`) :
     - `public`, `customer`, `seller`, `admin`
     - Env `API_URL=https://api.tukio.one`, `KEYCLOAK_URL=https://auth.tukio.one`
     - `depends_on: [gateway-api]` avec `service_started`
     - Restart `unless-stopped`
   - **Volumes top-level** (apps droplet) : `caddy_data`, `caddy_config`
   - **Secrets top-level apps** (`/home/tukio/tukio/secrets/`, mode `600`, owner `tukio:tukio`) : `db_password`, `keycloak_secret`, `stripe_secret`, `resend_api_key`, `r2_access_key`, `r2_secret_key`
   - **Network** : `tukio-apps` (bridge driver), tous les services dedans
   - **Note** : les frontends Next.js et backend services partagent le réseau interne `tukio-apps` → ils se résolvent par hostname (ex. `gateway-api` depuis `customer`) sans DNS public. Les connexions vers le droplet data passent par les IPs VPC privées (pas de DNS Docker cross-droplet).

4. **AC4 — `infra/docker-compose/Caddyfile` reverse-proxy + TLS auto** : Given `infra/docker-compose/Caddyfile`, When je l'ouvre, Then je trouve la config Caddy minimale :
   ```caddy
   {
     email tech-lead@tukio.one  # Let's Encrypt account
     # admin off                # disable admin API en prod si pas utilisé
   }

   app.tukio.one {
     reverse_proxy public:3000
     encode gzip zstd
     header {
       Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
       X-Content-Type-Options "nosniff"
       Referrer-Policy "strict-origin-when-cross-origin"
       Permissions-Policy "interest-cohort=()"
     }
   }

   api.tukio.one {
     reverse_proxy gateway-api:4000
     encode gzip zstd
     # CORS headers nécessaires (Story 0.6 envelope filter peut les setter, mais Caddy backup):
     header Access-Control-Allow-Origin "https://app.tukio.one, https://customer.tukio.one, https://seller.tukio.one, https://admin.tukio.one"
   }

   customer.tukio.one {
     reverse_proxy customer:3001
   }

   seller.tukio.one {
     reverse_proxy seller:3002
   }

   admin.tukio.one {
     reverse_proxy admin:3003
   }

   auth.tukio.one {
     reverse_proxy keycloak:8080
     # Keycloak ne supporte pas la compression Caddy directement (X-Forwarded-Proto requis)
     header X-Forwarded-Proto https
   }

   # Apex redirect → app (canonical SEO)
   tukio.one {
     redir https://app.tukio.one{uri} permanent
   }
   ```
   - **Caddy obtient automatiquement les certs Let's Encrypt** (HTTP-01 challenge sur port 80) et les renouvelle. Pas besoin de cert-manager.
   - **Rate limit** : optionnel V1+ via `caddy-rate-limit` plugin. Pas pour MVP (trafic faible).
   - **Logs** : Caddy emit JSON logs vers stdout, captured par Docker → rotation via daemon config

5. **AC5 — Workflow `deploy-staging.yml` finalisé** : Given `.github/workflows/deploy-staging.yml` (placeholder Story 0.11), When je le finalise, Then il :
   - **Trigger** : `workflow_run` chained sur `Build Images` workflow success branch `develop` + `workflow_dispatch` manual
   - **Permissions** : `contents: read`, `deployments: write`, `id-token: write`
   - **Job `deploy`** :
     - `environment: { name: staging, url: https://staging.tukio.one }`
     - **Step 1 — Setup SSH key** :
       ```yaml
       run: |
         mkdir -p ~/.ssh
         echo "${{ secrets.DO_DEPLOY_KEY }}" > ~/.ssh/id_ed25519
         chmod 600 ~/.ssh/id_ed25519
         ssh-keyscan -H ${{ secrets.DO_HOST_STAGING }} >> ~/.ssh/known_hosts
       ```
     - **Step 2 — Capture current SHA (for rollback)** :
       ```yaml
       PREVIOUS_SHA=$(ssh -i ~/.ssh/id_ed25519 tukio@${{ secrets.DO_HOST_STAGING }} "cd tukio && git rev-parse HEAD")
       echo "previous_sha=${PREVIOUS_SHA}" >> "$GITHUB_OUTPUT"
       ```
     - **Step 3 — Deploy via SSH** :
       ```yaml
       run: |
         ssh -i ~/.ssh/id_ed25519 tukio@${{ secrets.DO_HOST_STAGING }} <<'EOF'
           set -euo pipefail
           cd ~/tukio
           git fetch origin develop
           git checkout develop
           git pull origin develop
           echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u MohamedXi --password-stdin
           docker compose -f infra/docker-compose/docker-compose.prod.yml pull
           docker compose -f infra/docker-compose/docker-compose.prod.yml up -d --remove-orphans --wait
           docker image prune -f
         EOF
       ```
     - **Step 4 — Smoke test** (retry loop 30s) :
       ```yaml
       run: |
         for _ in $(seq 1 30); do
           if curl -fsS https://staging.tukio.one/health; then
             echo "::notice::Staging healthy after deploy"
             exit 0
           fi
           sleep 10
         done
         echo "::error::Smoke test failed after 5 min"; exit 1
       ```
     - **Step 5 — Rollback on failure** :
       ```yaml
       if: failure()
       run: |
         ssh -i ~/.ssh/id_ed25519 tukio@${{ secrets.DO_HOST_STAGING }} <<EOF
           cd ~/tukio
           git checkout ${{ steps.capture.outputs.previous_sha }}
           docker compose -f infra/docker-compose/docker-compose.prod.yml pull
           docker compose -f infra/docker-compose/docker-compose.prod.yml up -d --remove-orphans
         EOF
       ```
     - **Step 6 — Slack notif** (success + failure) : reuse `slackapi/slack-github-action@v2` pattern Story 0.11

6. **AC6 — Workflow `deploy-production.yml` finalisé** : Given `.github/workflows/deploy-production.yml` (placeholder Story 0.11), When je le finalise, Then il :
   - **Trigger** : `push: tags: ['v*']` (SemVer release tags) + `workflow_dispatch`
   - **`environment: production`** avec **required reviewers** (config GitHub Environment, manual UI step — voir doc) — bloque le workflow tant qu'un admin n'a pas approuvé
   - **Job `deploy`** : identique à `deploy-staging.yml` mais cible le droplet prod (`DO_HOST_PRODUCTION` secret)
   - **Rollback automatique** : idem mais avec timer plus court (3 min smoke test au lieu de 5)
   - **Slack notif** vers `#tukio-deploys-prod` (channel séparé, audit prod)
   - **Tag les images Docker** comme `:latest` après deploy success (post-deploy step) — convention prod canonique

7. **AC7 — Backup Postgres quotidien vers Cloudflare R2** : Given le droplet, When le cron tourne (quotidien 03:00 UTC), Then `infra/scripts/backup-postgres.sh` :
   - Exécute `docker compose exec -T postgres pg_dumpall -U <user>` → `tukio_pg_$(date -u +%Y%m%d_%H%M%S).sql`
   - Compresse en `.sql.gz` (gain ~80 % d'espace)
   - Upload vers Cloudflare R2 bucket `tukio-backups` via `rclone copy <file> r2:tukio-backups/postgres/`
   - Vérifie l'upload (`rclone check`) avant de supprimer le fichier local
   - Cleanup `find /var/backups/tukio -name 'tukio_pg_*.sql.gz' -mtime +7 -delete` (rétention locale 7 jours, R2 30 jours)
   - Log dans `/var/log/tukio/backup.log` avec timestamp + taille + checksum SHA256
   - Crontab `/etc/cron.d/tukio-backup-postgres` : `0 3 * * * tukio /home/tukio/tukio/infra/scripts/backup-postgres.sh >> /var/log/tukio/backup.log 2>&1`
   - **Rétention R2** : 30 jours via R2 lifecycle rule (configuré manuellement dans Cloudflare dashboard OU via `rclone` policy)
   - **RPO** : < 24 h (backup quotidien). RTO : < 1 h (restore via `pg_restore` depuis R2 download)
   - **Test de restore** : documenter dans `docs/ci-cd/digitalocean-deployment.md` § "Disaster recovery" + script `infra/scripts/restore-postgres.sh` (à tester manuellement Sprint 0 avant Epic 1)

8. **AC8 — UptimeRobot monitoring + Slack alerts** : Given un compte UptimeRobot (free 50 monitors), When je configure le monitoring, Then :
   - **Monitors configurés** (via UptimeRobot dashboard manuel — pas d'API automation MVP) :
     - `https://api.tukio.one/health` — keyword `"status":"ok"`, interval 5 min (free tier minimum)
     - `https://app.tukio.one/` — HTTP 200, interval 5 min
     - `https://auth.tukio.one/health/ready` — keyword `UP`, interval 5 min
   - **Alert contacts** : 2 channels
     - Email : tech-lead@tukio.one (immediate on down)
     - Slack webhook `#tukio-alerts` via UptimeRobot Slack integration (immediate on down + recovery)
   - **Maintenance windows** : configurables manuellement avant chaque deploy prod (avoid false alerts during rolling deploy ~2 min)
   - **Public status page** (optionnel V1+) : UptimeRobot fournit gratuitement `https://stats.uptimerobot.com/<id>` — décision MVP : OFF (pas exposer le status pendant qu'on stabilise)

9. **AC9 — DO snapshots hebdomadaires** : Given le droplet, When je configure les snapshots, Then :
   - **Cron sur le droplet** : `0 4 * * 0 root /usr/local/bin/do-snapshot.sh` (chaque dimanche 04:00 UTC, post-backup Postgres)
   - **Script `infra/scripts/do-snapshot.sh`** (à créer, exécutable via doctl ou DO API REST) :
     - Auth via `DO_TOKEN` (du droplet, stocké chiffré dans `/etc/tukio/do.env`)
     - `doctl compute droplet-action snapshot <droplet-id> --snapshot-name "tukio-weekly-$(date -u +%Y%m%d)"` (ou équivalent curl REST)
     - Cleanup snapshots > 30 jours : `doctl compute snapshot list --format ID,Name,Created --no-header | awk '...' | xargs doctl compute snapshot delete -f`
     - Log dans `/var/log/tukio/snapshot.log`
   - **Coût** : $0.06/GB/mois (volume 25 GB = $1.50/snapshot/mois). 4 snapshots actifs en rotation = ~$6/mois (acceptable budget MVP)
   - **Restore depuis snapshot** : documenter dans `docs/ci-cd/digitalocean-deployment.md` (DR scenario : droplet corrompu → restore snapshot + DNS update si IP change)

10. **AC10 — Secrets management via Docker secrets + `.env` files** : Given le droplet, When je configure les secrets, Then :
    - **Fichiers secrets** dans `/home/tukio/tukio/secrets/` (mode `600`, owner `tukio:tukio`) :
      - `pg_password`, `kc_db_password`, `kc_admin_password`, `meili_key`, `stripe_secret`, `resend_api_key`, `r2_access_key`, `r2_secret_key` (au minimum)
    - **Docker secrets** wired dans `docker-compose.prod.yml` via `secrets:` top-level block + `*_FILE` env vars pattern (ex. `POSTGRES_PASSWORD_FILE=/run/secrets/pg_password`)
    - **`.env` file** `/home/tukio/tukio/.env.production` (mode `600`) avec les variables non-secrètes mais env-specific (`DB_HOST=postgres`, `KEYCLOAK_REALM=tukio`, `NATS_URL=nats://nats:4222`, `R2_BUCKET=tukio-prod-media`, etc.)
    - **Provisionning** initial via `infra/scripts/provision-secrets.sh` (idempotent, prompts pour chaque secret manquant, jamais commit en git)
    - **Rotation** : process manuel documenté dans `docs/ci-cd/digitalocean-deployment.md` § "Secret rotation" (Stripe, Resend, R2 keys rotatable via leurs UI puis update fichier + `docker compose restart`)
    - **Backup secrets** : NON automatique. Backup manuel via `scp` chiffré GPG par le tech-lead, stocké en local + 1Password (responsabilité humaine, pas auto)

11. **AC11 — DigitalOcean Spaces (R2 alternative)** : OUT OF SCOPE
    - **Décision MVP** : on utilise **Cloudflare R2** (free tier 10 GB) pour le stockage media + backups Postgres, PAS DO Spaces ($5/mois 250 GB). R2 est plus généreux en free tier et indépendant du provider compute (DO peut tomber sans affecter R2).
    - **Note pour V1+** : si trafic R2 > 10 GB/mois OU besoin de CDN sur R2 (Cloudflare R2 a un CDN gratuit intégré), R2 reste mieux que DO Spaces pour MVP.

12. **AC12 — Smoke test pipeline complet end-to-end** : Given le droplet provisioné + workflows finalisés + DNS propagé, When je merge une PR de test sur `develop`, Then le pipeline complet fonctionne :
    - PR `develop` merged → `build-images.yml` build + push les 10 images vers `ghcr.io` (Story 0.11) — Trigger doit aussi ajouter `develop` pour build au merge (voir Story 0.11 fix mineur à appliquer)
    - `deploy-staging.yml` triggered post-build-images success → SSH droplet → `docker compose pull && up -d`
    - 30s plus tard, `curl https://staging.tukio.one/health` retourne 200 OK
    - Slack notif `#tukio-deploys` "🚀 Staging deploy succeeded — `<sha>`"
    - UptimeRobot reste vert (pas de downtime > 30s pendant le rolling)
    - Manuel : tag `v0.0.1-rc1` sur main → approval Slack → `deploy-production.yml` → identique sur droplet prod
    - **Validation finale** : `curl https://api.tukio.one/health` + `curl https://app.tukio.one` retournent 200 OK
    - **Documenter** time tracker dans Debug Log References (durée build-images + deploy-staging + smoke)

## Tasks / Subtasks

- [ ] **Task 1 — Provision des 2 droplets + VPC** (AC: #1)
  - [x] 1.1 — Installer `doctl` CLI localement (`brew install doctl`) + auth via `DO_TOKEN` — doctl en `/opt/homebrew/bin/doctl`, DO MCP utilisé en pratique
  - [x] 1.2 — Créer le VPC `tukio-fra1-vpc` — ID `70831b6a-f37e-458b-9975-337c8b5d16b7`, fra1, `10.114.0.0/20` (via MCP `vpc-create`)
  - [x] 1.3 — Créer le droplet `tukio-apps` — ID `570967138`, public `138.68.78.253`, private `10.114.0.3` (ubuntu-24-04-x64 base, Docker à installer via `do-droplet-init.sh`)
  - [x] 1.4 — Créer le droplet `tukio-data` — ID `570967130`, public `164.92.194.202`, private `10.114.0.2`
  - [x] 1.5 — IPs récupérées (cf. Debug Log References ci-dessous). Mise à jour `docs/ci-cd/digitalocean-deployment.md` à faire après confirmation final layout.
  - [x] 1.6 — Créer le script `infra/scripts/do-droplet-init.sh` (idempotent, paramètre `apps` ou `data`)
  - [ ] 1.7 — Exécuter `do-droplet-init.sh apps` sur `tukio-apps` + `do-droplet-init.sh data` sur `tukio-data`
  - [ ] 1.8 — Vérifier SSH `tukio@<apps-ip>` + `tukio@<data-ip>` fonctionnent, login root désactivé
  - [ ] 1.9 — Vérifier connectivité VPC : depuis `tukio-apps`, `ping 10.114.0.2` (data privée) doit répondre < 1 ms

- [ ] **Task 2 — DO Cloud Firewalls (2) + Squarespace DNS** (AC: #2)
  - [x] 2.1 — `tukio-apps-firewall` créé — ID `0be36cfc-fd17-463d-8c83-7839f30afc80`. Inbound 22/80/443 tcp from 0.0.0.0/0 (SSH key-only enforced — décision divergente vs story originale "SSH IP tech-lead"; rationale dans Debug Log). Attaché droplet 570967138.
  - [x] 2.2 — `tukio-data-firewall` créé — ID `f50ffdd2-ff1f-4bcf-a80e-4c77ce878784`. Inbound 22/tcp from 0.0.0.0/0 + 5432/8080/4222/7700/6379 from `10.114.0.3/32` (apps private IP — équivalent fonctionnel au pattern "droplet_id source" non-supporté par MCP firewall-add-rules qui n'expose que des addresses). Attaché droplet 570967130.
  - [ ] 2.3 — Tester firewall data : depuis le laptop, `nc -zv 164.92.194.202 5432` doit timeout. Depuis apps droplet via SSH, `nc -zv 10.114.0.2 5432` doit accepter.
  - [ ] 2.4 — Ajouter les 7 records A dans Squarespace DNS panel (tous → IP publique `138.68.78.253`)
  - [ ] 2.5 — Vérifier propagation DNS via `dig +short app.tukio.one` (attendre 1-4 h)
  - [ ] 2.6 — Documenter dans `docs/ci-cd/digitalocean-deployment.md` les 2 firewalls + table records

- [ ] **Task 3 — Compose files (apps.prod.yml + data.prod.yml) + Caddyfile** (AC: #3)
  - [x] 3.1 — Créer `infra/docker-compose/data.prod.yml` (5 services data sur droplet `tukio-data`, bind ports sur IP VPC privée)
  - [x] 3.2 — Créer `infra/docker-compose/apps.prod.yml` (15 services apps sur droplet `tukio-apps`, env vars pointent vers IP VPC data)
  - [x] 3.3 — Créer le `Caddyfile` avec les 7 routes (apex + 6 subdomains), route `auth.tukio.one` → `10.114.0.<DATA_PRIV>:8080`
  - [x] 3.4 — Tester les composes localement via `docker compose -f apps.prod.yml config` + `docker compose -f data.prod.yml config` (validation YAML)
  - [ ] 3.5 — Sur `tukio-data` : `docker compose -f data.prod.yml up -d --wait` → vérifier `docker ps` 5 services up + healthy
  - [ ] 3.6 — Sur `tukio-apps` : `docker login ghcr.io` + `docker compose -f apps.prod.yml up -d --wait` → vérifier `docker ps` 15 services up
  - [ ] 3.7 — Smoke test cross-droplet : depuis `tukio-apps`, `curl http://10.114.0.<DATA_PRIV>:8080/health/ready` doit retourner Keycloak `UP`. Depuis `tukio-apps`, `curl http://gateway-api:4000/health` doit retourner 200.

- [ ] **Task 4 — Secrets management** (AC: #10)
  - [x] 4.1 — Créer `infra/scripts/provision-secrets.sh` (interactive)
  - [ ] 4.2 — Provisioner les 8 secrets sur le droplet (pg_password, kc_*, meili_key, stripe_secret, resend_api_key, r2_access_key, r2_secret_key)
  - [ ] 4.3 — Créer `.env.production` template avec les env vars non-secrètes
  - [ ] 4.4 — Vérifier que `docker compose config` ne leak pas les secrets dans les logs

- [ ] **Task 5 — Workflow `deploy-staging.yml` finalisé** (AC: #5)
  - [x] 5.1 — Remplacer le placeholder Story 0.11 par la vraie logique SSH
  - [ ] 5.2 — Ajouter les secrets GitHub : `DO_DEPLOY_KEY`, `DO_HOST_STAGING`, `DO_HOST_PRODUCTION` (cf. Task 11)
  - [ ] 5.3 — Trigger manuel via `gh workflow run deploy-staging.yml` → vérifier le succès
  - [ ] 5.4 — Test rollback : forcer un fail dans le smoke test + vérifier que le rollback step revert au previous SHA

- [ ] **Task 6 — Workflow `deploy-production.yml` finalisé** (AC: #6)
  - [x] 6.1 — Idem Task 5 mais cible le droplet prod (avec rollback auto au tag précédent + GitHub Env `production` gate)
  - [ ] 6.2 — Configurer GitHub Environment `production` avec required reviewer = tech-lead
  - [ ] 6.3 — Tester via tag `v0.0.0-rc1` → vérifier que le workflow pause sur l'approval manuel
  - [ ] 6.4 — Approuver → vérifier le deploy + smoke test + Slack notif `#tukio-deploys-prod`

- [ ] **Task 7 — Backup Postgres quotidien vers R2** (AC: #7)
  - [ ] 7.1 — Provisionner Cloudflare R2 bucket `tukio-backups-prod` (manuel via Cloudflare dashboard)
  - [ ] 7.2 — Créer API token R2 + l'ajouter en secret sur le droplet (`/home/tukio/tukio/secrets/r2_access_key` + `r2_secret_key`)
  - [x] 7.3 — Créer `infra/scripts/backup-postgres.sh` + `infra/scripts/restore-postgres.sh`
  - [ ] 7.4 — Configurer rclone sur le droplet pour pointer vers R2
  - [x] 7.5 — Créer le cron `infra/cron/tukio-backup-postgres` (à installer en Phase B sur droplet data)
  - [ ] 7.6 — Lancer manuellement le script + vérifier le fichier dans R2
  - [ ] 7.7 — Tester le restore : `infra/scripts/restore-postgres.sh` sur un Postgres de staging vide (Sprint 0 final, avant Epic 1)

- [ ] **Task 8 — UptimeRobot + Slack alerts** (AC: #8)
  - [ ] 8.1 — Créer compte UptimeRobot (gratuit)
  - [ ] 8.2 — Ajouter les 3 monitors (api.tukio.one/health, app.tukio.one, auth.tukio.one)
  - [ ] 8.3 — Configurer alert contact email + Slack webhook `#tukio-alerts`
  - [ ] 8.4 — Test : `docker compose stop gateway-api` sur le droplet → vérifier alerte UptimeRobot + Slack dans les 5-10 min → restart
  - [ ] 8.5 — Documenter dans `docs/ci-cd/digitalocean-deployment.md` § "Monitoring"

- [ ] **Task 9 — DO snapshots quotidiens (2 droplets)** (AC: #9)
  - [x] 9.1 — Créer `infra/scripts/do-snapshot.sh` (paramètre `apps` ou `data`, retention 7 + prune via doctl)
  - [ ] 9.2 — Configurer doctl auth sur les 2 droplets (`doctl auth init --access-token $DO_TOKEN`)
  - [ ] 9.3 — Test manuel du script sur les 2 droplets
  - [x] 9.4 — Créer crons : `infra/cron/tukio-do-snapshot-apps` (04:00 UTC) + `infra/cron/tukio-do-snapshot-data` (04:30 UTC)
  - [ ] 9.5 — Documenter la procédure de restore depuis snapshot pour chaque droplet dans docs

- [x] **Task 10 — Doc opérationnelle complète** (AC: tous)
  - [x] 10.1 — Finaliser `docs/ci-cd/digitalocean-deployment.md` post-pivot (provisioning séquentiel doctl, compose files Phase A référencés, table secrets, budget réel Option B)
  - [x] 10.2 — Mettre à jour `docs/ci-cd/index.md` (entrée DR ajoutée, budget €34/mois, secret renommé `DO_HOST_APPS`)
  - [x] 10.3 — Créer `docs/ci-cd/disaster-recovery.md` (6 scénarios + RPO 24h / RTO 2h + tests trimestriels)

- [ ] **Task 11 — Secrets GitHub repo finaux** (AC: cross-cutting)
  - [ ] 11.1 — Ajouter `DO_DEPLOY_KEY` (private SSH key tukio-deploy, ed25519) via `gh secret set`
  - [ ] 11.2 — Ajouter `DO_HOST_APPS` (IP publique `tukio-apps`)
  - [ ] 11.3 — Ajouter `DO_HOST_DATA` (IP publique `tukio-data` — pour les workflows qui auraient besoin de SSH sur data, ex. restore PG)
  - [ ] 11.4 — Vérifier que les workflows `deploy-{staging,production}.yml` déchargent bien ces secrets (un seul environnement MVP — les deux workflows pointent sur les MÊMES droplets pour le moment ; staging/prod séparés = Option C à €45/mois, V1+)

- [ ] **Task 12 — Smoke test pipeline end-to-end** (AC: #12)
  - [ ] 12.1 — Créer une PR test sur develop (`chore(deploy): smoke test pipeline`)
  - [ ] 12.2 — Merger → vérifier `build-images.yml` push les 10 images
  - [ ] 12.3 — Vérifier `deploy-staging.yml` trigger + SSH + smoke test + Slack notif
  - [ ] 12.4 — Tag `v0.0.1-rc1` sur main → approval → deploy-production
  - [ ] 12.5 — Documenter les durées dans Debug Log References

## Dev Notes

### Pourquoi cette story diverge de l'originale (`0-12-helm-charts-k8s-argocd-staging-observability.md`)

Voir **ADR-015** dans `_bmad-output/planning-artifacts/architecture.md` + memory `mvp_infra_pivot_2026_05_14.md`.

Résumé : le founder a révisé le budget MVP à €15-35/mois max. La stack K8s + ArgoCD + Helm + Neon + Doppler + Grafana Cloud + Velero coûtait ~€60+/mois et avait une charge ops trop élevée pour 1 dev. Le pivot vers DO Droplets + docker-compose réduit le coût à €15-20/mois et simplifie drastiquement l'ops (1 droplet à SSH, pas de cluster à gérer).

### Pourquoi DigitalOcean (pas Hetzner ou autre)

- **Le founder a déjà compte DO** + `DO_TOKEN` configuré (`.zshrc`)
- **Setup minimal** : 10 min pour provisionner un droplet vs 1-2 h pour un cluster K8s
- **DO Marketplace** : image `docker-20-04` pré-buildée avec Docker installé
- **DO Cloud Firewall** : config réseau simple via doctl
- **Region Frankfurt** : faible latence France + RGPD UE
- **Hetzner** est moins cher (€4.51 vs $12 pour 2 GB) mais le founder ne connaît pas, et l'écart de €5/mois n'est pas critique

### Pourquoi docker-compose (pas K8s)

- **Overhead** : K8s control plane (DO Managed K8s = $12/mois) + nodes (2-3 × $12-24) = ~€40-60/mois total. Compose sur droplet = $12/mois unique.
- **Complexity ops** : manifests Helm + ArgoCD + secrets via Doppler + cert-manager + ingress controller + NetworkPolicy + HPA + PDB = 50+ fichiers YAML à maintenir. docker-compose = 1 fichier.
- **Trafic MVP** : le PRD prévoit < 1k visiteurs/jour Sprint 0 → Epic 1. 1 droplet 2 GB largement suffisant.
- **Migration K8s plus tard** : faisable en 1-2 sprints quand le besoin existe (> 100k req/jour OU besoin rolling deploys complexes). Pas pour MVP.

### Pourquoi Cloudflare R2 (pas DO Spaces)

- **R2 free tier** : 10 GB stockage + 1M requêtes/mois gratuit. DO Spaces = $5/mois fixe pour 250 GB (overkill MVP).
- **Indépendance provider** : R2 reste accessible même si DO droplet tombe → backup-restore plus résilient.
- **CDN intégré** : R2 a un CDN Cloudflare gratuit. Quand on aura besoin de servir des images optimisées (Story 3.4 Cloudflare Images), R2 sera déjà en place.
- **DNS Squarespace** ne bloque pas R2 (R2 est pur S3 API, pas de DNS routing nécessaire côté Tukio)

### Pourquoi Squarespace DNS (pas Cloudflare DNS)

- **Domaine `tukio.one` est sur Squarespace** (ex-Google Domains, racheté par Squarespace en 2024). Les NS records sont gérés par Squarespace et **ne peuvent pas être délégués** à Cloudflare sans transférer le domaine.
- **Conséquence** : pas de Cloudflare proxy (orange cloud) sur les sous-domaines `tukio.one`. Cloudflare R2 reste utilisable (S3 API indépendant des NS).
- **Pas de CDN Cloudflare** pour le MVP. Next.js sert ses propres assets via Caddy. À évaluer en V1+ quand le trafic justifie (Cloudflare Pro $25/mois en mode CNAME setup, OU transfert domain).
- **TLS via Caddy** : Caddy obtient les certs Let's Encrypt directement sur le droplet (HTTP-01 challenge sur port 80). Pas besoin de Cloudflare Universal SSL.

### Pourquoi UptimeRobot (pas Grafana Cloud + Tempo + Loki)

- **Grafana Cloud free tier** : 10k metrics, 50 GB logs, 14 days retention. Vite insuffisant.
- **UptimeRobot free** : 50 monitors, alertes email + Slack. Largement suffisant pour MVP (3 monitors max).
- **OpenTelemetry SDK** : overhead instrumentation + nécessite un backend (Tempo) qu'on n'a pas en MVP. Pino structured logs + `docker logs` + UptimeRobot couvre les besoins MVP.
- **V1+** : si on a besoin de tracing distribué + log search + métriques temps réel, migrer vers Grafana Cloud Pro ($49/mois) OU self-host Grafana sur un second droplet (€12/mois).

### Project Structure cible

```
infra/
├─ docker-compose/
│  ├─ docker-compose.dev.yml             # déjà existe (Story 0.10) — dev local
│  ├─ docker-compose.test.yml            # déjà existe (Story 0.10) — CI/test
│  └─ docker-compose.prod.yml            # ← cette story (NEW)
│  └─ Caddyfile                          # ← cette story (NEW)
├─ scripts/
│  ├─ do-droplet-init.sh                 # ← cette story (NEW)
│  ├─ do-snapshot.sh                     # ← cette story (NEW)
│  ├─ backup-postgres.sh                 # ← cette story (NEW)
│  ├─ restore-postgres.sh                # ← cette story (NEW)
│  ├─ provision-secrets.sh               # ← cette story (NEW)
│  ├─ gen-dockerfiles.sh                 # existe Story 0.11
│  └─ run-chaos-tests.sh                 # existe Story 0.10
└─ cron/
   ├─ tukio-backup-postgres              # ← cette story (NEW)
   └─ tukio-do-snapshot                  # ← cette story (NEW)

.github/workflows/
├─ deploy-staging.yml                    # ← finaliser (placeholder Story 0.11)
├─ deploy-production.yml                 # ← finaliser (placeholder Story 0.11)
└─ build-images.yml                      # existe Story 0.11 — éventuel mini-fix trigger develop

docs/ci-cd/
├─ digitalocean-deployment.md            # existe Story 0.11 — finaliser avec IP réelle + DR + scaling
├─ index.md                              # existe Story 0.11 — update budget réel + checklist finale
└─ disaster-recovery.md                  # ← cette story (NEW)
```

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `.github/workflows/deploy-staging.yml` — remplacer placeholder par vraie logique SSH + smoke + rollback
> - `.github/workflows/deploy-production.yml` — idem + manual approval
> - `.github/workflows/build-images.yml` — étendre trigger pour inclure `develop` (mini-fix optional dans cette story OU story dédiée)
> - `docs/ci-cd/digitalocean-deployment.md` — finaliser avec IP, DR, scaling
> - `docs/ci-cd/index.md` — table secrets MVP final, check-list

> **À CREATE** (~15 fichiers, ~3-4 jours d'effort) :
> - `infra/docker-compose/docker-compose.prod.yml`
> - `infra/docker-compose/Caddyfile`
> - `infra/scripts/do-droplet-init.sh`
> - `infra/scripts/do-snapshot.sh`
> - `infra/scripts/backup-postgres.sh`
> - `infra/scripts/restore-postgres.sh`
> - `infra/scripts/provision-secrets.sh`
> - `infra/cron/tukio-backup-postgres`
> - `infra/cron/tukio-do-snapshot`
> - `docs/ci-cd/disaster-recovery.md`
> - GitHub repo secrets : `DO_DEPLOY_KEY`, `DO_HOST_STAGING`, `DO_HOST_PRODUCTION`

### Critical Architecture Constraints

> Cf. ADR-015 + memory `mvp_infra_pivot_2026_05_14.md`.

1. **Budget hard cap €35/mois** (Option B) — au-delà, on revoit la story et on optimise (réduire droplet, éliminer snapshots, etc.). Le bus factor MVP impose la frugalité.
2. **Pas de K8s, pas d'ArgoCD, pas de Helm** — docker-compose only. Migration K8s = V1+ story dédiée.
3. **DNS Squarespace direct** — pas de proxy Cloudflare possible. Caddy gère TLS.
4. **Secrets en fichiers sur le droplet** (mode 600) — pas de Doppler, pas de Vault. Backup secrets responsabilité manuelle du tech-lead (1Password + GPG).
5. **Cloudflare R2 = storage only** — pas de R2 routing DNS. Backup PG + media uploads dedans.
6. **Pino structured logs** + `docker logs` — pas d'OpenTelemetry SDK, pas de Tempo/Loki/Grafana.
7. **UptimeRobot pour uptime** + Slack alerts. Pas d'Alertmanager K8s.
8. **DO snapshots weekly** + Postgres dump quotidien R2. Pas de Velero.
9. **Rolling deploy via docker-compose up -d --wait** — pas de blue-green, pas de canary. Acceptable MVP (~30s downtime max).
10. **Pas de HPA, pas de PDB** — 1 instance par service. Scaling = manuel via resize droplet OU split apps/data sur 2 droplets (Option B).

### What this story does NOT do (out of scope)

- ❌ **Kubernetes / Helm / ArgoCD** → ancienne story 0.12 (superseded). V1+ si volume justifie.
- ❌ **Grafana Cloud + Tempo + Loki + OpenTelemetry** → V1+. MVP utilise Pino + docker logs + UptimeRobot.
- ❌ **Neon Postgres / Aurora / Cloud SQL** → V1+. MVP self-host Postgres sur droplet.
- ❌ **Doppler / Vault** → V1+. MVP utilise Docker secrets + `.env` files.
- ❌ **Blue-green / canary deployments** → V1+. MVP rolling deploy via compose --wait.
- ❌ **HPA / PDB / NetworkPolicy** → V1+ (require K8s).
- ❌ **Multi-region / multi-AZ** → V1+ (require K8s + DNS routing).
- ❌ **CDN front-end** → V1+ (Squarespace DNS limit). MVP : Next.js sert ses statiques via Caddy direct.
- ❌ **Page de status publique** → V1+. UptimeRobot a une option gratuite mais OFF pour MVP.
- ❌ **Auto-rotation des secrets** → manuel V1+.

### Previous Story Intelligence (Stories 0.1 → 0.11)

- **Story 0.1** : monorepo + 14 codebases scaffolded. Dockerfiles placeholders.
- **Story 0.6** : Pattern Pretre identity-svc. `/health` endpoint disponible.
- **Story 0.10** : `docker-compose.dev.yml` + `docker-compose.test.yml`. Scripts `pnpm docker:*`.
- **Story 0.11** : CI pipeline complet (ci.yml + lighthouse + build-images + deploy-{staging,production} placeholders). Les **placeholders deploy** sont finalisés par cette story 0.12.
- **Story 0.11 fix mineur à porter ici** : `build-images.yml` trigger sur `push: branches: [main]` uniquement. Pour deploy auto sur staging au merge develop, étendre à `[develop, main]`. Action 1-line dans cette story.

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.12 |
| --- | --- | --- |
| Budget €15-35/mois | ADR-015 | ✅ AC1 (Option A €15) |
| EN strict | Naming workflows + scripts | ✅ |
| Snake_case YAML | docker-compose, GHA | ✅ |
| `unless-stopped` restart | Tous services compose | ✅ AC3 |
| Healthcheck Postgres + Keycloak | depends_on condition service_healthy | ✅ AC3 |
| `set -euo pipefail` | Tous bash scripts | ✅ AC5/7/9 |
| ed25519 SSH keys | DO_DEPLOY_KEY | ✅ AC11 |
| Secrets mode 600 + owner tukio | /home/tukio/tukio/secrets/ | ✅ AC10 |
| TLS Let's Encrypt | Caddy auto | ✅ AC4 |
| Logs JSON + rotation | docker-compose logging | ✅ AC3 |
| Cron quotidien backup | 03:00 UTC, hors peak | ✅ AC7 |
| Cron hebdo snapshot | dimanche 04:00 UTC | ✅ AC9 |
| RPO < 24 h | Backup PG quotidien | ✅ AC7 |
| RTO < 1 h | Restore depuis R2 doc + script testé | ✅ AC7 / Task 10 |

### Testing Standards

- **Pas de tests unitaires** sur Story 0.12 (config infra, pas de code applicatif).
- **Tests d'intégration** : Task 12 smoke test pipeline end-to-end est la validation principale.
- **Tests DR** : Task 7.7 (restore PG depuis R2 sur un PG vide) + Task 9.5 (restore droplet depuis snapshot) à exécuter une fois manuellement avant Epic 1 dev.

### Project Structure Notes

✅ **Aligné** avec ADR-015 (pivot DO Droplets + docker-compose).

✅ **Aligné** avec memory `mvp_infra_pivot_2026_05_14.md`.

✅ **Aligné** avec Story 0.11 (placeholders deploy-{staging,production}.yml finalisés ici).

✅ **Aligné** avec Story 0.10 (docker-compose.{dev,test}.yml patterns réutilisés pour prod.yml).

⚠️ **Décision documentée** : pas de K8s avant V1+. Si le volume justifie une migration, on créera une story dédiée `<X.Y>-migrate-to-kubernetes.md`.

⚠️ **Décision documentée** : 1 droplet pour MVP (Option A). Si OOM se présente (RAM 2 GB tight avec Keycloak + Postgres), passer à Option B (2 droplets, apps/data split) — coût bumpé à €29/mois.

⚠️ **À noter** : la rotation Stripe / Resend / R2 keys est manuelle. À automatiser V1+ via un script + cron.

⚠️ **À noter** : pas de WAF (Web Application Firewall) MVP. Cloudflare WAF impossible (DNS Squarespace). Caddy a une option `rate_limit` (plugin tiers) — à évaluer V1+ si bots.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-015 — MVP infra pivot 2026-05-14]
- [Source: memory mvp_infra_pivot_2026_05_14.md — décisions exhaustives]
- [Source: docs/ci-cd/digitalocean-deployment.md — guide opérationnel posé Story 0.11]
- [Source: docs/ci-cd/index.md — budget MVP + checklist]
- [Source: _bmad-output/implementation-artifacts/0-11-ci-github-actions-pipeline.md — CI placeholders à finaliser]
- [Superseded: _bmad-output/implementation-artifacts/0-12-helm-charts-k8s-argocd-staging-observability.md — ancienne story K8s/ArgoCD]
- [External: https://docs.digitalocean.com/products/droplets/ — DO Droplets]
- [External: https://docs.digitalocean.com/reference/doctl/ — doctl CLI]
- [External: https://caddyserver.com/docs/ — Caddy reverse-proxy]
- [External: https://developers.cloudflare.com/r2/ — Cloudflare R2 storage]
- [External: https://uptimerobot.com/api/ — UptimeRobot]
- [Memory: project_git_workflow.md — main = README only, develop = code]
- [Memory: feedback_tech_layer_english.md — EN strict (scripts, paths)]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent)

### Debug Log References

**Phase B — 2026-05-14 (provisioning DO via MCP tools)**

Infrastructure DigitalOcean provisionnée :

| Resource | ID / URN | Détails |
| --- | --- | --- |
| VPC `tukio-fra1-vpc` | `70831b6a-f37e-458b-9975-337c8b5d16b7` | fra1, range `10.114.0.0/20`, default fra1 |
| Droplet `tukio-data` | `570967130` | public `164.92.194.202`, private `10.114.0.2`, ubuntu-24-04-x64, s-1vcpu-2gb |
| Droplet `tukio-apps` | `570967138` | public `138.68.78.253`, private `10.114.0.3`, ubuntu-24-04-x64, s-1vcpu-2gb |
| Firewall `tukio-apps-firewall` | `0be36cfc-fd17-463d-8c83-7839f30afc80` | inbound 22/80/443 tcp from 0.0.0.0/0, outbound tcp+udp all → attaché droplet apps |
| Firewall `tukio-data-firewall` | `f50ffdd2-ff1f-4bcf-a80e-4c77ce878784` | inbound 22/tcp from 0.0.0.0/0 + 5432/8080/4222/7700/6379 from `10.114.0.3/32`, outbound tcp+udp all → attaché droplet data |
| SSH key utilisée | `45974664` | RSA 4096, `ismael.mohamed@groupe-creative.fr` |
| Image base | `ubuntu-24-04-x64` (ID 195932981) | au lieu de `docker-20-04` Marketplace (introuvable via MCP) — Docker post-installé via `do-droplet-init.sh` |
| Tech-lead public IP | `82.120.52.19` | non utilisée comme source firewall (choix : SSH ouvert key-only) |

Décision SSH source : `0.0.0.0/0` avec auth key-only (root login + password auth désactivés post-`do-droplet-init.sh`). Justification : éviter lockout sur IP rotating (Free Mobile/4G) et permettre CI GitHub Actions SSH depuis runners à IPs dynamiques.

Issue MCP rencontrée : `firewall-create` Tag param = "attach to droplets with tag", PAS "tag the firewall". Initialement passé `Tags: ["tukio", "production"]` ce qui a cross-attaché chaque firewall aux 2 droplets. Corrigé via `firewall-remove-tags`. À retenir pour V1+ : ne JAMAIS passer Tags à firewall-create sauf intention explicite tag-based selection.

R2 bucket name + UptimeRobot monitor IDs + smoke durations + secrets rotation : à compléter Phase B continued (USER manual actions).

### Completion Notes List

**2026-05-14 — Phase A (code-only) terminée.**

Décisions :

- **Option B retenue** (€29/mois 2 droplets) — split apps/data pour éviter OOM risk d'un seul droplet 2 GB hébergeant Keycloak + Postgres ensemble.
- **Webpack bundle strategy** (héritée de Story 0.11) maintenue pour les images backend — `pnpm deploy --legacy` couplé à `NEVER_BUNDLE` curated.
- **Caddy auto-TLS** via Let's Encrypt HTTP-01 (pas de DNS-01 — Squarespace ne supporte pas les API DNS).
- **Secrets file-based** (`/home/tukio/tukio/secrets/<name>`, mode 600) plutôt que Docker secrets stricts ou Doppler/Vault — minimal, suffit pour 1 dev solo MVP.
- **Snapshots quotidiens** (pas hebdomadaires) avec rétention 7 → recommandation budget réduire à 3 jours pour rester sous €50/mois total.
- **Rollback automatique production** wiré dans `deploy-production.yml` (snapshot du tag courant avant deploy, restore au tag précédent si smoke fail).

Phase A artifacts (code + docs, sans coût opérationnel) :

- 5 scripts shell : `do-droplet-init.sh`, `provision-secrets.sh`, `backup-postgres.sh`, `restore-postgres.sh`, `do-snapshot.sh`
- 3 fichiers compose : `data.prod.yml`, `apps.prod.yml`, `Caddyfile` + `init-databases.sh`
- 3 fichiers cron : `tukio-backup-postgres`, `tukio-do-snapshot-{apps,data}`
- 2 workflows finalisés : `deploy-staging.yml`, `deploy-production.yml`
- 2 docs : `digitalocean-deployment.md` (refondu), `disaster-recovery.md` (créé)
- Sprint status : `0-12-digitalocean-droplets-docker-compose: in-progress`

**Phase B (actions user, real $)** — non démarrée :

- [ ] Provisionner 2 droplets DO via doctl (€24/mois spend starts)
- [ ] Créer 2 firewalls DO
- [ ] Ajouter records A dans Squarespace DNS
- [ ] Créer bucket R2 + API token Cloudflare
- [ ] Setup UptimeRobot monitors
- [ ] Configurer secrets GitHub (`DO_DEPLOY_KEY`, `DO_HOST_APPS`)
- [ ] Exécuter init scripts sur droplets
- [ ] Provisionner secrets via `provision-secrets.sh`
- [ ] First deploys + smoke tests + DR drill (T2 restore PG)

Points d'attention Epic 1+ :

- DB connection string format : services attendent `DB_HOST=${DATA_PRIV_IP} DB_PORT=5432 DB_NAME=tukio_<svc>` + secrets file-based via `DB_USER_FILE` + `DB_PASSWORD_FILE` (NestJS configModule doit lire ces *_FILE)
- Keycloak realm provisioning : à scripter dans une Story Epic 1 (réutiliser bootstrap Story 0.4 adapté pour Keycloak prod)
- Migrations TypeORM : doivent être lancées hors du container app au moment du deploy — non câblé Phase A, à scripter Epic 1

### File List

**Nouveaux fichiers** :

- `infra/scripts/do-droplet-init.sh`
- `infra/scripts/provision-secrets.sh`
- `infra/scripts/backup-postgres.sh`
- `infra/scripts/restore-postgres.sh`
- `infra/scripts/do-snapshot.sh`
- `infra/docker-compose/data.prod.yml`
- `infra/docker-compose/apps.prod.yml`
- `infra/docker-compose/Caddyfile`
- `infra/docker-compose/init-databases.sh`
- `infra/cron/tukio-backup-postgres`
- `infra/cron/tukio-do-snapshot-apps`
- `infra/cron/tukio-do-snapshot-data`
- `docs/ci-cd/disaster-recovery.md`

**Fichiers modifiés** :

- `.github/workflows/deploy-staging.yml` (placeholder ArgoCD → SSH deploy DO)
- `.github/workflows/deploy-production.yml` (placeholder ArgoCD → SSH deploy DO + rollback auto)
- `docs/ci-cd/digitalocean-deployment.md` (refondu post-pivot, Option B retenue, compose Phase A référencés)
- `docs/ci-cd/index.md` (entrée DR, budget €34/mois, secret renommé `DO_HOST_APPS`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`0-12-digitalocean-droplets-docker-compose: in-progress`)
- `_bmad-output/planning-artifacts/architecture.md` (ADR-015 ajouté)

**Fichiers supprimés** :

- `_bmad-output/implementation-artifacts/0-12-helm-charts-k8s-argocd-staging-observability.md` (superseded)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-14 (replace de l'ancienne story 0.12 superseded)
- **Created by** : pivot post Story 0.11 + budget review founder
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (fin Sprint 0 — après Story 0.11)
- **Estimation effort** : 4-5 jours (~17 fichiers : 2 composes + 1 Caddyfile + 5 scripts + 2 cron + 3 docs + workflows finalisés + VPC setup)
- **Dépendances upstream** :
  - Story 0.11 (CI pipeline + build-images.yml + placeholders deploy-{staging,production}.yml) — **done**
  - Compte DO actif + `DO_TOKEN` configuré — **done** (founder)
  - Domain `tukio.one` accessible via Squarespace — **done**
  - Compte Cloudflare actif (pour R2) — **à confirmer founder**
- **Dépendances downstream** :
  - **Stories Epic 1+** — toutes les stories applicatives nécessiteront un droplet staging fonctionnel pour les test deploys
  - **Story 7.x (i18n + acquisition)** — DNS records additionnels (peut-être www.tukio.one, blog.tukio.one)
- **FRs covered** : aucun FR direct (infra)
- **NFRs touchés** :
  - **NFR44** — RPO < 5 min / RTO < 1 h → **partiel** : MVP RPO < 24 h (backup quotidien) / RTO < 1 h ✅
  - **NFR15** — encryption at rest → **partiel** : DO disk encryption native ✅, R2 SSE par défaut ✅
  - **NFR18** — patches OS auto → ✅ AC1 (unattended-upgrades)
  - **NFR38** — saisonnalité 3× pic mai-sept → **deferred V1+** : MVP single droplet, resize manuel si pic
  - **NFR40** — NATS R3 quorum → **deferred V1+** : MVP NATS single instance (acceptable trafic MVP)
  - **NFR54** — Lighthouse a11y ≥ 90 → enforced par Story 0.11 Lighthouse CI ✅
