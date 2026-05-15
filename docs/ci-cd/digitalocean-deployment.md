# DigitalOcean deployment — Configuration et setup (Story 0.12)

> ✅ **Statut** : guide opérationnel post-pivot (Story 0.12 — `0-12-digitalocean-droplets-docker-compose.md`). Les workflows `deploy-staging.yml` et `deploy-production.yml` font SSH + `docker compose pull && up -d` sur le droplet `tukio-apps`.

**Plateforme** : [DigitalOcean](https://www.digitalocean.com/) — Droplets + VPC privé + Cloudflare R2 (storage backups + media).

**Pivot architectural** (ADR-015, mai 2026) : abandon du plan original Hetzner + K8s + ArgoCD + Neon + Grafana Cloud. Adopté pour MVP : **2 DO Droplets + docker-compose** (Option B). Beaucoup moins cher (€29/mois vs €120+/mois), plus simple à exploiter pour 1 dev solo, suffit largement pour le volume MVP cible (< 1k visiteurs/jour).

**Budget cible MVP** : **€29/mois** (Option B retenue — 2 droplets séparant `apps` et `data`).

**Workflows consommateurs (Story 0.12)** :

- `deploy-staging.yml` — déclenché au succès de `Build Images` sur `develop` → SSH `tukio@tukio-apps` → `docker compose pull && up -d` → smoke test → notif Slack.
- `deploy-production.yml` — déclenché au push d'un tag `v*` → manual approval GitHub Environment `production` → SSH → pull/up → smoke → **rollback automatique** au tag précédent si smoke fail → notif Slack.

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

## Architecture retenue (Option B — €29/mois)

```
                Squarespace DNS (records A → IP publique apps)
                              │
                ┌─────────────┴──────────────┐
                ▼                            ▼
         app/customer/seller/admin     api/auth.tukio.one
                              │
                              ▼
              ┌──────────────────────────────────┐
              │  Droplet tukio-apps (2 GB, $12)  │
              │  Frankfurt — public 80/443       │
              │                                  │
              │  infra/docker-compose/apps.prod.yml │
              │    ├─ Caddy (TLS + reverse-proxy) │
              │    ├─ 10 services NestJS          │
              │    └─ 4 frontends Next.js         │
              └────────────┬─────────────────────┘
                           │  VPC privé (10.114.0.0/24, $0)
                           ▼
              ┌──────────────────────────────────┐
              │  Droplet tukio-data (2 GB, $12)  │
              │  Frankfurt — VPC only, pas de    │
              │  ports publics                   │
              │                                  │
              │  infra/docker-compose/data.prod.yml │
              │    ├─ Postgres 16 (1 DB/svc)     │
              │    ├─ Keycloak 25                │
              │    ├─ NATS JetStream 2.10        │
              │    ├─ Meilisearch v1.10          │
              │    └─ Redis 7                    │
              └────────────┬─────────────────────┘
                           │
                           ▼
                Cloudflare R2 (10 GB free)
                  → backups Postgres quotidiens
                  → media uploads pros (signed URLs)
```

> 📝 **Pourquoi Option B (et pas A)** : un droplet 2 GB unique est tight — Keycloak + Postgres consomment ~1 GB chacun, donc risque OOM-kill sous charge. Split sur 2 droplets isole le plan de données et permet de scaler indépendamment. Coût supplémentaire : +€12/mois, justifié.

---

## Architecture initiale envisagée (Option A — €15/mois, REJETÉE)

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

## Pré-requis (Story 0.12 Phase B)

1. **Compte DigitalOcean** activé, méthode de paiement (€24/mois pour 2 droplets).
2. **`DO_TOKEN`** dans `~/.zshrc` ou env shell (déjà fait — variable utilisée par `doctl`).
3. **Domain `tukio.one`** géré chez Squarespace (déjà acheté).
4. **SSH key dédiée CI** générée (cf. § « Secrets GitHub »).
5. **Compte Cloudflare** + bucket R2 `tukio-backups-prod` + bucket `tukio-prod-media` créés.
6. **Compte UptimeRobot** (free tier 50 monitors) pour uptime checks.

---

## Provisioning séquentiel (Phase B)

### 1. Créer les 2 droplets + VPC

```sh
# 1.1 — Créer le VPC privé (région FRA1)
doctl vpcs create --name tukio-vpc --region fra1 --ip-range 10.114.0.0/24
VPC_UUID=$(doctl vpcs list --format ID,Name --no-header | awk '$2=="tukio-vpc" {print $1}')

# 1.2 — Récupérer le fingerprint de la SSH key
SSH_FP=$(doctl compute ssh-key list --format FingerPrint --no-header | head -1)

# 1.3 — Créer tukio-apps
doctl compute droplet create tukio-apps \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --region fra1 \
  --vpc-uuid "$VPC_UUID" \
  --ssh-keys "$SSH_FP" \
  --enable-monitoring \
  --enable-ipv6 \
  --wait

# 1.4 — Créer tukio-data (mêmes flags)
doctl compute droplet create tukio-data \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --region fra1 \
  --vpc-uuid "$VPC_UUID" \
  --ssh-keys "$SSH_FP" \
  --enable-monitoring \
  --enable-ipv6 \
  --wait

# 1.5 — Récupérer les IPs (public + privée VPC)
doctl compute droplet list --format Name,PublicIPv4,PrivateIPv4
```

> Note les `PrivateIPv4` des deux droplets — la **VPC private IP de `tukio-data`** est la valeur à mettre dans `DATA_PRIV_IP` de `/home/tukio/tukio/.env.production` sur `tukio-apps`.

### 2. Initialiser chaque droplet (script idempotent)

```sh
# 2.1 — Pousser le repo sur les droplets (en root one-shot)
APPS_IP=$(doctl compute droplet get tukio-apps --format PublicIPv4 --no-header)
DATA_IP=$(doctl compute droplet get tukio-data --format PublicIPv4 --no-header)

# 2.2 — Init apps droplet
scp -o StrictHostKeyChecking=no infra/scripts/do-droplet-init.sh root@${APPS_IP}:/tmp/
ssh root@${APPS_IP} 'bash /tmp/do-droplet-init.sh apps'

# 2.3 — Init data droplet
scp -o StrictHostKeyChecking=no infra/scripts/do-droplet-init.sh root@${DATA_IP}:/tmp/
ssh root@${DATA_IP} 'bash /tmp/do-droplet-init.sh data'
```

Le script `do-droplet-init.sh` (cf. `infra/scripts/`) :

- Crée user `tukio` (UID 1001), ajoute aux groupes docker + sudo
- Désactive `PermitRootLogin` + `PasswordAuthentication`
- Installe `unattended-upgrades`, `fail2ban`, `rclone` (data only), `doctl`
- Configure `/etc/cron.d/tukio-*` (backups + snapshots — installés au step 8)
- Crée `/home/tukio/tukio/secrets/` (mode 700, owner tukio:tukio)

### 3. DO Cloud Firewall (2 firewalls)

```sh
APPS_ID=$(doctl compute droplet get tukio-apps --format ID --no-header)
DATA_ID=$(doctl compute droplet get tukio-data --format ID --no-header)

# 3.1 — Firewall apps : SSH (ton IP), 80/443 public
MY_IP="$(curl -s ifconfig.me)/32"
doctl compute firewall create \
  --name tukio-fw-apps \
  --inbound-rules "protocol:tcp,ports:22,sources:addresses:${MY_IP} protocol:tcp,ports:80,sources:addresses:0.0.0.0/0 protocol:tcp,ports:443,sources:addresses:0.0.0.0/0" \
  --outbound-rules "protocol:tcp,ports:all,destinations:addresses:0.0.0.0/0 protocol:udp,ports:all,destinations:addresses:0.0.0.0/0 protocol:icmp,destinations:addresses:0.0.0.0/0" \
  --droplet-ids "$APPS_ID"

# 3.2 — Firewall data : SSH (ton IP), 5432/6379/4222/7700/8080 SEULEMENT depuis tukio-apps (VPC IP)
APPS_PRIV=$(doctl compute droplet get tukio-apps --format PrivateIPv4 --no-header)
doctl compute firewall create \
  --name tukio-fw-data \
  --inbound-rules "protocol:tcp,ports:22,sources:addresses:${MY_IP} protocol:tcp,ports:5432,sources:addresses:${APPS_PRIV}/32 protocol:tcp,ports:6379,sources:addresses:${APPS_PRIV}/32 protocol:tcp,ports:4222,sources:addresses:${APPS_PRIV}/32 protocol:tcp,ports:7700,sources:addresses:${APPS_PRIV}/32 protocol:tcp,ports:8080,sources:addresses:${APPS_PRIV}/32" \
  --outbound-rules "protocol:tcp,ports:all,destinations:addresses:0.0.0.0/0 protocol:udp,ports:all,destinations:addresses:0.0.0.0/0" \
  --droplet-ids "$DATA_ID"
```

> 🔒 **Defense in depth** : le compose `data.prod.yml` bind tous les ports sur `${DATA_PRIV_IP}` (VPC private IP) — pas sur `0.0.0.0`. Donc même si le firewall était mal configuré, les services data ne seraient pas exposés publiquement.

### 4. Squarespace DNS — records à ajouter

`tukio.one` est géré par **Squarespace Domains** (ex-Google Domains). Pour ajouter les records DNS :

1. Connecte-toi à https://account.squarespace.com/domains
2. Sélectionne `tukio.one`
3. **DNS Settings** (ou **Advanced DNS**)
4. **Custom Records** → ajoute chaque ligne ci-dessous

Topology Story 0.14 (ADR-016) : 3 frontends + 1 API + 1 auth + apex unifié.

| Type    | Host (Subdomain) | Value (Data)     | TTL  | Notes                                        |
| ------- | ---------------- | ---------------- | ---- | -------------------------------------------- |
| A       | `@` (apex)       | `<droplet-ip>`   | 3600 | tukio.one — visiteurs + customers B2C        |
| A       | `seller`         | `<droplet-ip>`   | 3600 | seller.tukio.one — pros B2B                  |
| A       | `admin`          | `<droplet-ip>`   | 3600 | admin.tukio.one — staff console              |
| A       | `api`            | `<droplet-ip>`   | 3600 | api.tukio.one — gateway-api                  |
| A       | `auth`           | `<droplet-ip>`   | 3600 | auth.tukio.one — Keycloak                    |
| A       | `app`            | `<droplet-ip>`   | 3600 | (legacy ADR-013) → 301 redirect vers apex via Caddy. Garder ~6 mois pour rétro-compat. |

> 🗑️ **Records retirés Story 0.14** : `customer.tukio.one` (apex tunnel B2C unifié — plus de subdomain customer). À supprimer manuellement dans Squarespace DNS panel post-deploy. Le record `app.tukio.one` est conservé pour rétro-compat 6 mois (redirect 301 → apex via Caddy).

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
dig +short tukio.one
# attendu : <droplet-ip>
```

ou https://www.whatsmydns.net pour vérifier la propagation globale.

> 💡 **Pourquoi pas Cloudflare DNS** : Squarespace gère les NS records de `tukio.one` et ne permet pas leur délégation à Cloudflare. Si tu veux le CDN Cloudflare gratuit (proxy + DDoS), il faudrait transférer le domaine vers un autre registrar (Cloudflare Registrar, Namecheap…) ce qui n'est pas une priorité MVP.

### 5. Cloner le repo sur chaque droplet

```sh
# Sur chaque droplet (apps + data), en tant que user tukio :
ssh tukio@${APPS_IP}
git clone https://github.com/MohamedXi/tukio.git tukio
cd tukio

# Login GHCR pour pull les images (PAT classic avec read:packages)
echo $GHCR_PAT | docker login ghcr.io -u MohamedXi --password-stdin

# Idem sur tukio-data
ssh tukio@${DATA_IP}
git clone https://github.com/MohamedXi/tukio.git tukio
```

### 6. Provisionner les secrets (interactif)

Sur chaque droplet, lancer le script de provisioning des secrets :

```sh
# Sur tukio-data
ssh tukio@${DATA_IP}
cd /home/tukio/tukio
./infra/scripts/provision-secrets.sh data
# Te demande : pg_user, pg_password, kc_admin_password, meili_key, r2_*

# Sur tukio-apps
ssh tukio@${APPS_IP}
cd /home/tukio/tukio
./infra/scripts/provision-secrets.sh apps
# Te demande : pg_user, pg_password, meili_key, stripe_secret, resend_api_key, r2_*
```

Le script :

- Écrit chaque secret dans `/home/tukio/tukio/secrets/<name>` (mode 600, tukio:tukio)
- Idempotent : ne re-prompte pas si le fichier existe déjà (sauf `--rotate <name>`)
- Refuse les valeurs vides

> ⚠️ **Mêmes valeurs sur les deux droplets** pour `pg_user`, `pg_password`, `meili_key`, `r2_*` — les services apps doivent matcher la config data.

### 6.bis. Créer `.env.production` sur tukio-apps

```sh
# Sur tukio-apps en tant que tukio
DATA_PRIV=$(ssh -o StrictHostKeyChecking=no tukio@${DATA_IP} "ip -4 addr show dev eth1 | awk '/inet/ {print \$2}' | cut -d/ -f1")
# Adapte le nom d'interface (eth1 ou ens5) selon DO

cat > /home/tukio/tukio/.env.production <<EOF
DATA_PRIV_IP=${DATA_PRIV}
IMAGE_TAG=develop
R2_BUCKET=tukio-prod-media
R2_ENDPOINT=https://<your-r2-account-id>.r2.cloudflarestorage.com
EOF
chmod 600 /home/tukio/tukio/.env.production
```

### 7. Compose files de production

Les compose files **sont déjà dans le repo** (Story 0.12 Phase A) :

- `infra/docker-compose/data.prod.yml` — Postgres + Keycloak + NATS + Meili + Redis
- `infra/docker-compose/apps.prod.yml` — Caddy + 10 services + 4 frontends
- `infra/docker-compose/Caddyfile` — reverse-proxy + TLS auto Let's Encrypt
- `infra/docker-compose/init-databases.sh` — crée 1 DB par service + Keycloak au premier boot Postgres

### 7.bis. Référence historique : compose squelette d'origine (PRE-Phase A)

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

Topology Story 0.14 (ADR-016) : apex unifié + 2 subdomains B2B/admin + API + auth + redirect legacy.

```caddy
tukio.one {
  reverse_proxy public:3000
}

app.tukio.one {
  redir https://tukio.one{uri} permanent  # legacy ADR-013 → 6 mois rétro-compat
}

api.tukio.one {
  reverse_proxy gateway-api:4000
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
# 8.1 — Démarrer la couche data
ssh tukio@${DATA_IP}
cd /home/tukio/tukio
docker compose -f infra/docker-compose/data.prod.yml up -d --wait
docker compose -f infra/docker-compose/data.prod.yml ps
# Attendre 30-60s que Keycloak finisse de bootstrap son DB

# 8.2 — Démarrer la couche apps
ssh tukio@${APPS_IP}
cd /home/tukio/tukio
export $(grep -v '^#' .env.production | xargs)
docker compose -f infra/docker-compose/apps.prod.yml pull
docker compose -f infra/docker-compose/apps.prod.yml up -d --wait
docker compose -f infra/docker-compose/apps.prod.yml ps

# 8.3 — Vérifier la TLS auto Caddy
curl -I https://api.tukio.one/health
curl -I https://tukio.one
curl -I https://auth.tukio.one
```

### 9. Workflows de déploiement (finalisés)

Les workflows `deploy-staging.yml` et `deploy-production.yml` (Story 0.12 Phase A) implémentent le pattern SSH + docker compose. Comportement :

| Workflow              | Trigger                                                     | Image tag       | Rollback                    | Environment GitHub      |
| --------------------- | ----------------------------------------------------------- | --------------- | --------------------------- | ----------------------- |
| `deploy-staging.yml`  | `Build Images` succès sur `develop` ou `workflow_dispatch`  | `sha-XXXXXXX`   | ❌ (staging = jetable)      | `staging` (no approval) |
| `deploy-production.yml` | push tag `v*` ou `workflow_dispatch` (input `tag`)        | `vX.Y.Z`        | ✅ auto vers `previous_tag` | `production` (approval) |

Chaque workflow :

1. Vérifie que `DO_HOST_APPS` + `DO_DEPLOY_KEY` sont configurés (fail-fast si absents).
2. Configure une SSH key éphémère + `ssh-keyscan` du host.
3. Snapshot le tag courant depuis `.env.production` (production uniquement, pour rollback).
4. Lance `docker compose pull && up -d --remove-orphans` via SSH.
5. Smoke-teste `${HEALTH_URL}` 30× × 10s.
6. **Rollback automatique** (production) : si smoke fail, restaure `previous_tag` et redéploie.
7. Cleanup SSH key + notification Slack succès/échec.

---

## Secrets GitHub à provisionner (Story 0.12 Phase B)

| Secret                       | Description                                                       | Comment générer                                                |
| ---------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `DO_DEPLOY_KEY`              | Private SSH key utilisée par GitHub Actions                       | `ssh-keygen -t ed25519 -C github-actions-tukio -f tukio_deploy` |
| `DO_HOST_APPS`               | IP publique du droplet `tukio-apps`                               | `doctl compute droplet get tukio-apps --format PublicIPv4 --no-header` |
| `SLACK_WEBHOOK_DEPLOYS`      | Webhook Slack pour notifs deploys staging                         | Slack app → Incoming Webhooks → channel `#deploys`             |
| `SLACK_WEBHOOK_DEPLOYS_PROD` | Webhook Slack pour notifs deploys production                      | Idem, channel `#deploys-prod`                                  |

**Repo variables (optionnel)** :

| Variable                | Default                          | Override use case                       |
| ----------------------- | -------------------------------- | --------------------------------------- |
| `STAGING_HEALTH_URL`    | `https://api.tukio.one/health`   | Si endpoint health bouge                |
| `PRODUCTION_HEALTH_URL` | `https://api.tukio.one/health`   | Idem prod                               |

Générer + déposer la SSH key dédiée CI :

```sh
ssh-keygen -t ed25519 -C "github-actions-tukio" -f ~/.ssh/tukio_deploy -N ""

# Pousser la public key dans authorized_keys du user tukio (sur les 2 droplets)
ssh-copy-id -i ~/.ssh/tukio_deploy.pub tukio@${APPS_IP}
ssh-copy-id -i ~/.ssh/tukio_deploy.pub tukio@${DATA_IP}

# Provisionner les secrets GitHub
gh secret set DO_DEPLOY_KEY < ~/.ssh/tukio_deploy
gh secret set DO_HOST_APPS --body "${APPS_IP}"
gh secret set SLACK_WEBHOOK_DEPLOYS --body "<webhook-url-#deploys>"
gh secret set SLACK_WEBHOOK_DEPLOYS_PROD --body "<webhook-url-#deploys-prod>"
```

---

## Backups + monitoring (Phase A — déjà scriptés)

### Backups Postgres → Cloudflare R2

Script : `infra/scripts/backup-postgres.sh` (déposé Phase A) — dump GZ via `pg_dump` par DB, upload `rclone` vers R2, retention 7 daily / 4 weekly / 6 monthly.

Cron : `infra/cron/tukio-backup-postgres` (03:15 UTC quotidien, sur `tukio-data`).

```sh
# Installation sur tukio-data (à faire Phase B)
ssh tukio@${DATA_IP}
sudo install -m 644 /home/tukio/tukio/infra/cron/tukio-backup-postgres /etc/cron.d/
sudo mkdir -p /var/log/tukio && sudo chown tukio:tukio /var/log/tukio
sudo systemctl restart cron

# Configurer rclone remote `r2:` (interactif)
rclone config
# > New remote: r2 / s3 / Cloudflare / endpoint: https://<account>.r2.cloudflarestorage.com

# Test à la main
/home/tukio/tukio/infra/scripts/backup-postgres.sh
```

### Restauration Postgres depuis R2

Script : `infra/scripts/restore-postgres.sh`. Cf. `disaster-recovery.md` pour les runbooks détaillés.

```sh
# Exemple : restaurer tukio_catalog au 2026-05-13
ssh tukio@${DATA_IP}
cd /home/tukio/tukio
./infra/scripts/restore-postgres.sh tukio_catalog 2026-05-13
```

### DO snapshots quotidiens

Scripts : `infra/scripts/do-snapshot.sh` + crons `tukio-do-snapshot-{apps,data}`.

- `tukio-apps` snapshot à 04:00 UTC quotidien
- `tukio-data` snapshot à 04:30 UTC quotidien
- Rétention : 7 snapshots par droplet (les plus anciens sont supprimés via `doctl`)

```sh
# Installation sur chaque droplet
ssh tukio@${APPS_IP}
sudo install -m 644 /home/tukio/tukio/infra/cron/tukio-do-snapshot-apps /etc/cron.d/
sudo mkdir -p /var/log/tukio && sudo chown tukio:tukio /var/log/tukio
sudo systemctl restart cron

ssh tukio@${DATA_IP}
sudo install -m 644 /home/tukio/tukio/infra/cron/tukio-do-snapshot-data /etc/cron.d/
sudo systemctl restart cron

# Configurer doctl avec DO_TOKEN
doctl auth init --access-token "$DO_TOKEN"
```

**Coût snapshots** : DO facture $0.06/GB/mois au-delà du 1er snapshot inclus. 25 GB × 7 snapshots × 2 droplets ≈ 350 GB × $0.06 = **$21/mois**. Ajusté dans le récap budgétaire ci-dessous.

> 💡 **Optimisation budget** : si €29 + $21 dépasse l'enveloppe, réduire la rétention de snapshots à 3 (suffit pour 72h DR window) — ramène à ~$9/mois supplémentaires.

### Uptime monitoring — UptimeRobot

50 monitors gratuits, alertes Slack/email. À configurer Phase B (URLs `tukio.one`, `api.tukio.one/health`, `auth.tukio.one`).

### Logs

- `docker compose logs -f --tail=200` ad-hoc
- json-file driver configuré (`max-size: 10m`, `max-file: 3`) → rotation auto par container

### Métriques (V1+)

Pas de Grafana Cloud pour MVP (budget). Si besoin opérationnel : `docker stats` + healthcheck endpoints services + UptimeRobot.

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

## Coût récapitulatif (réel Option B)

| Composant                        | Mensuel  | Notes                                      |
| -------------------------------- | -------- | ------------------------------------------ |
| 2 × Droplet 2GB Frankfurt        | $24      | $12 chacun                                 |
| VPC FRA1                         | $0       | Inclus                                     |
| Snapshots (7×2 ≈ 350 GB)         | $21      | $0.06/GB/mois — réductible à $9 (3 retention) |
| Bandwidth                        | $0       | 2 TB inclus / droplet                      |
| Domain `tukio.one` (annuel/12)   | ~$1      | Squarespace                                |
| Cloudflare R2                    | $0       | 10 GB storage + 1M reads gratuits          |
| GHCR (containers)                | $0       | Public repo + GitHub free tier             |
| UptimeRobot                      | $0       | 50 monitors free                           |
| Resend (transactional email)     | $0       | 3k emails/mois free tier                   |
| **Total Option B**               | **~$46/mois (€43)** | Avec snapshots 7d         |
| **Total Option B (snap 3d)**     | **~$34/mois (€32)** | Plus proche du budget €50  |

⚠️ **Au-dessus du budget €30 si on garde snapshots 7 jours**. Décision : snapshots rétention 3 jours pour MVP, étendre à 7 quand traffic justifie.

---

## Disaster recovery

Voir [`disaster-recovery.md`](./disaster-recovery.md) pour les runbooks complets :

- **Scénario 1** — service unique down (rollback image via `deploy-production.yml`)
- **Scénario 2** — droplet `tukio-apps` mort (provisionner replacement + restore snapshot)
- **Scénario 3** — droplet `tukio-data` mort (provisionner replacement + restore PG depuis R2)
- **Scénario 4** — perte de données Postgres (restore-postgres.sh ciblé DB)
- **Scénario 5** — clé secret compromise (rotation via `provision-secrets.sh --rotate <name>`)

RPO target : **24h** (backups quotidiens). RTO target : **2h** (snapshot restore + smoke).

---

## Documentation officielle

- DigitalOcean Droplets : https://docs.digitalocean.com/products/droplets/
- DO Spaces : https://docs.digitalocean.com/products/spaces/
- doctl CLI : https://docs.digitalocean.com/reference/doctl/
- Caddy : https://caddyserver.com/docs/
- Docker Compose : https://docs.docker.com/compose/

## Voir aussi

- [`trivy-cve-management.md`](./trivy-cve-management.md) — étape précédente (Story 0.11).
- [`disaster-recovery.md`](./disaster-recovery.md) — runbooks DR détaillés.
- [`index.md`](./index.md) — retour à l'index.
- Story 0.12 : `_bmad-output/implementation-artifacts/0-12-digitalocean-droplets-docker-compose.md`.
- ADR-015 : `_bmad-output/planning-artifacts/architecture.md` (pivot Hetzner+K8s → DO+compose).
