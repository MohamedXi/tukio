# DigitalOcean deployment — Configuration et setup (Story 0.12)

> ⚠️ **Statut** : ce guide concerne **Story 0.12** (déploiement DO Droplets + docker-compose), pas Story 0.11. Les workflows `deploy-staging.yml` et `deploy-production.yml` sont des **placeholders** qui dégradent gracieusement quand les secrets DO sont absents.

**Plateforme** : [DigitalOcean](https://www.digitalocean.com/) — VPS (Droplets) + Spaces (S3-compat) + Managed Databases.

**Pivot architectural** : on est parti initialement sur Hetzner + K8s + ArgoCD (cf. Story 0.12 originale + ADR). Décision révisée en mai 2026 pour MVP : **DO Droplets + docker-compose** — beaucoup moins cher, plus simple à exploiter, suffit largement pour le volume de trafic MVP.

**Budget cible MVP** : **€15-35/mois** (1-2 droplets, tout self-host).

**Workflows consommateurs (Story 0.12)** :

- `deploy-staging.yml` — SSH + `docker compose pull && docker compose up -d` sur le droplet staging au merge `main`.
- `deploy-production.yml` — idem prod sur tag `v*` avec manual approval GitHub Environment.

---

## Pourquoi DigitalOcean (et pas Hetzner ou K8s)

**Comparaison rapide** :

| Critère | DO Droplet 2GB | Hetzner CX21 2GB | DO K8s | Hetzner K3s |
| --- | --- | --- | --- | --- |
| Prix mensuel | $12 | €4.51 | $12 control + $12-24 nodes | €4.51 × N nodes |
| Setup | 10 min | 10 min | 1-2 heures | 1-2 heures |
| CDN intégré | Spaces $5/mois | Cloudflare gratuit | Spaces | Cloudflare gratuit |
| Snapshots | $0.06/GB | $0.01/GB | n/a | n/a |
| Support | Excellent | Bon | Excellent | Bon |
| Région UE | Frankfurt, Amsterdam | Falkenstein, Helsinki | Frankfurt, Amsterdam | Falkenstein, Helsinki |

**Pourquoi DO** :

- Tu connais déjà DO → courbe d'apprentissage zéro.
- Spaces (CDN+S3) intégré si on en a besoin (sinon Cloudflare R2 gratuit).
- Marketplace pré-built images (Docker, Node).
- Token GitHub Actions facile à provisionner.

**Pourquoi pas K8s pour MVP** :

- Overhead opérationnel (manifests Helm, secrets, ingress, cert-manager…) trop lourd pour 1 dev.
- Coût ~3-5× supérieur (control plane + nodes + load balancer).
- docker-compose suffit pour 10 services + 4 datastores < 1 GB de trafic/mois.

**Migration K8s plus tard** : faisable en 1-2 sprints quand le besoin existe (1 service > 5 instances, ou rolling deploys critiques).

---

## Architecture cible (Option A — €15/mois)

```
                  Squarespace DNS (records A, gratuit)
                              │
                ┌─────────────┴──────────────┐
                │                            │
                ▼                            ▼
       app.tukio.one (Next.js)      api.tukio.one (NestJS gateway)
                │                            │
                └────────────┬───────────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │  DO Droplet 2GB ($12)    │
                │  Frankfurt / Amsterdam   │
                │                          │
                │  docker-compose.prod.yml │
                │   ├─ 4 apps Next.js      │
                │   ├─ 10 services NestJS  │
                │   ├─ PostgreSQL 16       │
                │   ├─ Keycloak 25         │
                │   ├─ NATS JetStream      │
                │   ├─ Meilisearch         │
                │   ├─ Redis               │
                │   └─ Caddy (reverse-proxy │
                │      + TLS auto)         │
                │                          │
                │  Volume: 50 GB ($0.10/GB)│
                └──────────────────────────┘
                             │
                             │ (storage uniquement, pas de DNS)
                             ▼
                  Cloudflare R2 (free 10GB)
                  → media uploads Pro
                  → backups Postgres
```

> 📝 **Note DNS** : Le domaine `tukio.one` est hébergé chez **Squarespace** (ex-Google Domains). Les nameservers (NS) sont gérés par Squarespace et **ne peuvent pas être migrés** vers Cloudflare. Conséquence :
>
> - **DNS** = Squarespace (records A/CNAME à ajouter dans le panneau Squarespace).
> - **CDN proxy Cloudflare** (mode "orange cloud") = **indisponible** sans contrôle des NS.
> - **Cloudflare R2** = **utilisable** indépendamment des DNS (storage S3-compat 10 GB gratuit).
> - **TLS** = géré par Caddy directement sur le droplet (Let's Encrypt auto).
>
> Pour le MVP, **aucun CDN front-end n'est nécessaire** — Next.js sert ses propres assets statiques avec headers de cache. À évaluer en V1+ quand le trafic justifie un CDN (>1k visiteurs/jour) — options : Squarespace Domains supporte Cloudflare Pro ($25/mois) en mode CNAME, ou pivot vers un autre registrar.

⚠️ **Limite** : 1 droplet 2 GB est tight. Keycloak + Postgres consomment ~1 GB chacun. Risque OOM. **Option B à €25/mois** (split apps / data sur 2 droplets) est plus safe.

---

## Architecture alternative (Option B — €25/mois)

```
        Droplet apps (2GB, $12)         Droplet data (2GB, $12)
        ┌────────────────────┐          ┌──────────────────────┐
        │ 4 apps Next.js     │          │ PostgreSQL 16        │
        │ 10 services NestJS │ ←──VPC──→ │ Keycloak 25          │
        │ Caddy reverse-proxy│          │ NATS JetStream       │
        └────────────────────┘          │ Meilisearch          │
                                        │ Redis                │
                                        └──────────────────────┘
```

VPC privé inter-droplets → pas de bande passante facturée.

---

## Pré-requis (Story 0.12)

1. **Compte DigitalOcean** activé, méthode de paiement.
2. **Domain `.one`** acheté (Cloudflare, Namecheap, OVH… ~€10-20/an).
3. **SSH key** générée et ajoutée à ton compte DO (clé Ed25519 recommandée).
4. **GitHub repo secrets** prêts à être ajoutés (cf. § « Secrets » plus bas).

---

## Étapes (Story 0.12)

### 1. Créer le droplet DO

```sh
# Via doctl CLI (recommandé) — installer brew install doctl
doctl auth init

# Création droplet
doctl compute droplet create tukio-prod \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --region fra1 \
  --vpc-uuid <vpc-uuid> \
  --ssh-keys <ssh-key-fingerprint> \
  --wait

# Récupérer l'IP
doctl compute droplet list
```

Ou via l'UI : https://cloud.digitalocean.com/droplets/new → Frankfurt (FRA1) → image Docker 20.04 → 2GB / 1 CPU → ajouter ta SSH key.

### 2. Initial setup du droplet

```sh
ssh root@<droplet-ip>

# Créer un user non-root
adduser tukio
usermod -aG docker tukio
usermod -aG sudo tukio
mkdir -p /home/tukio/.ssh
cp /root/.ssh/authorized_keys /home/tukio/.ssh/
chown -R tukio:tukio /home/tukio/.ssh

# Désactiver le login root SSH
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Firewall (DO firewall plus simple, voir step 3)
exit
```

### 3. DO Cloud Firewall

```sh
doctl compute firewall create \
  --name tukio-firewall \
  --inbound-rules "protocol:tcp,ports:22,sources:addresses:<your-ip>/32 protocol:tcp,ports:80,sources:addresses:0.0.0.0/0 protocol:tcp,ports:443,sources:addresses:0.0.0.0/0" \
  --outbound-rules "protocol:tcp,ports:all,destinations:addresses:0.0.0.0/0 protocol:udp,ports:all,destinations:addresses:0.0.0.0/0" \
  --droplet-ids <droplet-id>
```

Restreint SSH à ton IP, ouvre 80/443 au monde.

### 4. Squarespace DNS — records à ajouter

`tukio.one` est géré par **Squarespace Domains** (ex-Google Domains). Pour ajouter les records DNS :

1. Connecte-toi à https://account.squarespace.com/domains
2. Sélectionne `tukio.one`
3. **DNS Settings** (ou **Advanced DNS**)
4. **Custom Records** → ajoute chaque ligne ci-dessous

| Type    | Host (Subdomain) | Value (Data)     | TTL  |
| ------- | ---------------- | ---------------- | ---- |
| A       | `app`            | `<droplet-ip>`   | 3600 |
| A       | `api`            | `<droplet-ip>`   | 3600 |
| A       | `customer`       | `<droplet-ip>`   | 3600 |
| A       | `seller`         | `<droplet-ip>`   | 3600 |
| A       | `admin`          | `<droplet-ip>`   | 3600 |
| A       | `auth`           | `<droplet-ip>`   | 3600 |
| A       | `@` (apex)       | `<droplet-ip>`   | 3600 |

Pour Option B (staging séparé) :

| Type    | Host       | Value                    | TTL  |
| ------- | ---------- | ------------------------ | ---- |
| A       | `staging`  | `<droplet-staging-ip>`   | 3600 |

**Email** (à ajouter quand Resend sera configuré pour `noreply@tukio.one`) :

| Type    | Host       | Value                                                            | Notes              |
| ------- | ---------- | ---------------------------------------------------------------- | ------------------ |
| TXT     | `@`        | `v=spf1 include:_spf.resend.com ~all`                            | SPF                |
| TXT     | `resend._domainkey` | `<DKIM value depuis Resend dashboard>`                  | DKIM               |
| TXT     | `_dmarc`   | `v=DMARC1; p=quarantine; rua=mailto:postmaster@tukio.one`        | DMARC              |
| MX      | `@`        | `feedback-smtp.resend.com` (priority 10)                         | Bounces            |

⚠️ **Propagation DNS** : 1-4 heures typiquement, jusqu'à 48 h dans le pire cas. Tester avec :

```sh
dig +short app.tukio.one
# attendu : <droplet-ip>
```

ou https://www.whatsmydns.net pour vérifier la propagation globale.

> 💡 **Pourquoi pas Cloudflare DNS** : Squarespace gère les NS records de `tukio.one` et ne permet pas leur délégation à Cloudflare. Si tu veux le CDN Cloudflare gratuit (proxy + DDoS), il faudrait transférer le domaine vers un autre registrar (Cloudflare Registrar, Namecheap…) ce qui n'est pas une priorité MVP.

### 5. Cloner le repo sur le droplet

```sh
ssh tukio@<droplet-ip>

# Clone via deploy key (read-only)
git clone https://github.com/MohamedXi/tukio.git
cd tukio

# Login GHCR pour pull les images
echo $GHCR_TOKEN | docker login ghcr.io -u MohamedXi --password-stdin
```

### 6. Créer `docker-compose.prod.yml` (Story 0.12)

Squelette à créer dans `infra/docker-compose/docker-compose.prod.yml` :

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ['80:80', '443:443']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [tukio]

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER_FILE: /run/secrets/pg_user
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets: [pg_user, pg_password]
    networks: [tukio]

  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    restart: unless-stopped
    command: ['start']
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_HOSTNAME: auth.tukio.one
      KC_PROXY: edge
    depends_on: [postgres]
    networks: [tukio]

  nats:
    image: nats:2.10-alpine
    restart: unless-stopped
    command: ['-js', '-sd', '/data']
    volumes: [nats_data:/data]
    networks: [tukio]

  meilisearch:
    image: getmeili/meilisearch:v1.10
    restart: unless-stopped
    environment:
      MEILI_NO_ANALYTICS: 'true'
      MEILI_MASTER_KEY_FILE: /run/secrets/meili_key
    volumes: [meili_data:/meili_data]
    secrets: [meili_key]
    networks: [tukio]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes: [redis_data:/data]
    networks: [tukio]

  gateway-api:
    image: ghcr.io/mohamedxi/tukio/gateway-api:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      # ... env vars
    depends_on: [postgres, keycloak, nats]
    networks: [tukio]

  # ... 9 autres services *-svc identiques

  public:
    image: ghcr.io/mohamedxi/tukio/public:latest
    restart: unless-stopped
    networks: [tukio]
  # ... 3 autres apps Next.js

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
  nats_data:
  meili_data:
  redis_data:

secrets:
  pg_user:
    file: ./secrets/pg_user
  pg_password:
    file: ./secrets/pg_password
  meili_key:
    file: ./secrets/meili_key

networks:
  tukio:
    driver: bridge
```

### 7. Caddyfile (reverse-proxy + TLS auto)

```caddy
app.tukio.one {
  reverse_proxy public:3000
}

api.tukio.one {
  reverse_proxy gateway-api:4000
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
}
```

Caddy obtient les certs Let's Encrypt automatiquement + renouvelle. Pas besoin de cert-manager.

### 8. Premier déploiement manuel

```sh
ssh tukio@<droplet-ip>
cd tukio
docker compose -f infra/docker-compose/docker-compose.prod.yml up -d

# Vérifier
docker compose ps
curl https://api.tukio.one/health
```

### 9. Workflow `deploy-staging.yml` (à finaliser Story 0.12)

Réécrire le workflow placeholder pour SSH + docker compose :

```yaml
name: Deploy — staging

on:
  workflow_run:
    workflows: ['Build Images']
    types: [completed]
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.tukio.one
    steps:
      - name: Setup SSH key
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DO_DEPLOY_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H ${{ secrets.DO_HOST_STAGING }} >> ~/.ssh/known_hosts

      - name: Deploy via SSH
        run: |
          ssh -i ~/.ssh/id_ed25519 tukio@${{ secrets.DO_HOST_STAGING }} <<'EOF'
            cd tukio
            git pull origin main
            docker compose -f infra/docker-compose/docker-compose.prod.yml pull
            docker compose -f infra/docker-compose/docker-compose.prod.yml up -d --remove-orphans
            docker image prune -f
          EOF

      - name: Smoke test
        run: |
          for _ in $(seq 1 30); do
            curl -fsS https://staging.tukio.one/health && exit 0
            sleep 10
          done
          echo "::error::Smoke test failed"; exit 1
```

---

## Secrets GitHub à provisionner (Story 0.12)

| Secret              | Valeur                                                    |
| ------------------- | --------------------------------------------------------- |
| `DO_DEPLOY_KEY`     | Contenu de la SSH private key (`~/.ssh/id_ed25519`)       |
| `DO_HOST_STAGING`   | IP ou hostname du droplet staging                         |
| `DO_HOST_PRODUCTION`| IP ou hostname du droplet production                      |

Générer une SSH key dédiée CI :

```sh
ssh-keygen -t ed25519 -C "github-actions-tukio" -f ~/.ssh/tukio_deploy -N ""
# Copier la public key sur le droplet
ssh-copy-id -i ~/.ssh/tukio_deploy.pub tukio@<droplet-ip>
# Ajouter la private key comme secret GitHub
cat ~/.ssh/tukio_deploy | gh secret set DO_DEPLOY_KEY
```

---

## Backups + monitoring

### Backups Postgres

Cron quotidien dans `infra/scripts/backup-postgres.sh` :

```sh
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date -u +%Y%m%d)
docker compose exec postgres pg_dumpall -U postgres > /backups/pg_${DATE}.sql
# Upload to Cloudflare R2 (free 10GB)
rclone copy /backups/pg_${DATE}.sql r2:tukio-backups/postgres/
# Cleanup > 30 jours
find /backups -name 'pg_*.sql' -mtime +30 -delete
```

Cron via systemd timer ou crontab :

```cron
0 3 * * * /home/tukio/tukio/infra/scripts/backup-postgres.sh
```

### Monitoring basic (gratuit)

- **Uptime** : [UptimeRobot](https://uptimerobot.com/) — 50 monitors gratuits, alerte Slack/email.
- **Logs** : `docker compose logs -f` + redirection vers fichier rotaté (logrotate).
- **Métriques** : `docker stats` + Grafana Cloud free tier (10k metrics) — optionnel V1+.

### DO snapshots

Snapshot du droplet hebdomadaire :

```sh
doctl compute droplet-action snapshot <droplet-id> --snapshot-name "tukio-weekly-$(date +%Y%m%d)"
```

Coût : $0.06/GB/mois — 50GB droplet = $3/mois pour 1 snapshot persistant.

---

## Scaling (V1+ — quand le besoin existe)

| Signal | Action |
| --- | --- |
| RAM > 80 % constant | Resize droplet vers 4 GB ($24/mois) |
| CPU > 80 % constant | Resize droplet vers 2 vCPU ($18/mois) |
| Trafic > 100k req/jour | Split apps / data en 2 droplets (Option B) |
| Besoin de rolling deploy | Migrate to DO Managed Kubernetes |
| Besoin haute dispo | Ajouter Load Balancer DO ($12/mois) + 2 droplets |

---

## Troubleshooting

### Container OOM-killed

```sh
docker compose ps -a  # tu vois les containers Exited
journalctl -u docker | grep -i "killed"
docker stats --no-stream
```

Solutions :

1. Limiter la RAM de Keycloak/Postgres dans le compose (`mem_limit: 512m`).
2. Resize droplet vers 4 GB.
3. Split sur 2 droplets (Option B).

### TLS / Let's Encrypt rate limit

Caddy obtient un cert par hostname. Rate limit Let's Encrypt : 50 certs/semaine.

Si tu hit la limite (rare en MVP) :

```sh
# Use staging Let's Encrypt en attendant
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### Disk full sur le droplet

```sh
docker system prune -af --volumes
journalctl --vacuum-time=7d
```

### Deploy step SSH timeout

- Vérifier `DO_HOST_STAGING` est bien l'IP (pas le hostname si DNS pas propagé).
- Vérifier la firewall DO autorise GitHub Actions IPs (officiellement publiées : https://api.github.com/meta).
- Augmenter `ConnectTimeout=60` dans la commande SSH du workflow.

---

## Coût récapitulatif

| Composant | Mensuel |
| --- | --- |
| Droplet 2GB Frankfurt | $12 |
| Snapshot hebdo (50GB) | $3 |
| Domain `.one` (annuel) | ~$1 |
| Cloudflare (DNS+CDN+R2) | Free |
| GHCR | Free |
| UptimeRobot | Free |
| **Total Option A** | **~$16/mois (€15)** |

| Composant | Mensuel Option B |
| --- | --- |
| 2 droplets 2GB | $24 |
| Snapshots | $6 |
| Domain | ~$1 |
| **Total Option B** | **~$31/mois (€29)** |

---

## Documentation officielle

- DigitalOcean Droplets : https://docs.digitalocean.com/products/droplets/
- DO Spaces : https://docs.digitalocean.com/products/spaces/
- doctl CLI : https://docs.digitalocean.com/reference/doctl/
- Caddy : https://caddyserver.com/docs/
- Docker Compose : https://docs.docker.com/compose/

## Voir aussi

- [`trivy-cve-management.md`](./trivy-cve-management.md) — étape précédente.
- [`index.md`](./index.md) — retour à l'index.
- Story 0.12 : `_bmad-output/implementation-artifacts/0-12-helm-charts-k8s-argocd-staging-observability.md` _(à renommer en `0-12-digitalocean-deployment-docker-compose.md` lors du re-spec)_.
