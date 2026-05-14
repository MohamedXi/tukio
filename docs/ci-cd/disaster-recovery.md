# Disaster recovery — Runbooks (Story 0.12)

Procédures opérationnelles pour restaurer le service après incident. Tous les runbooks supposent l'architecture **Option B** (2 droplets DO : `tukio-apps` + `tukio-data`) telle que décrite dans [`digitalocean-deployment.md`](./digitalocean-deployment.md).

**Objectifs cible** :

- **RPO** (Recovery Point Objective) — perte de données acceptable : **24h** (backups quotidiens R2)
- **RTO** (Recovery Time Objective) — temps de remise en service : **2h**

**Pré-requis pour exécuter les runbooks** :

- Accès `doctl` configuré (`DO_TOKEN` dans env)
- SSH key admin (la même que celle utilisée pour `do-droplet-init.sh`)
- Accès au repo + permissions GHCR
- Slack `#deploys-prod` pour notifier les incidents

---

## Scénario 1 — Service unique en panne (regression image)

**Symptôme** : un service backend renvoie 500/timeout après un déploiement, ou l'image contient un bug bloquant.

**Diagnostic** : `docker compose ps`, `docker compose logs <svc> --tail=200`.

### Procédure (~5 min)

```sh
# Option A — Rollback automatique via le workflow production
# (déjà câblé dans deploy-production.yml — si le smoke test fail post-deploy,
# le rollback se déclenche tout seul).

# Option B — Rollback manuel
ssh tukio@${APPS_IP}
cd /home/tukio/tukio

# Trouver le tag précédent
docker images ghcr.io/mohamedxi/tukio/<svc> --format '{{.Tag}}\t{{.CreatedAt}}' | head -5

# Restaurer le tag
PREV_TAG=v1.2.2  # ou sha-abc1234
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${PREV_TAG}|" .env.production
export IMAGE_TAG=${PREV_TAG}
docker compose -f infra/docker-compose/apps.prod.yml pull <svc>
docker compose -f infra/docker-compose/apps.prod.yml up -d <svc>

# Smoke
curl https://api.tukio.one/health
```

**Validation** : status 200 sur `/health`, logs propres pendant 5 min.

**Notification** : Slack `#deploys-prod` + post-mortem GitHub Issue label `incident`.

---

## Scénario 2 — Droplet `tukio-apps` mort

**Symptôme** : `app.tukio.one` / `api.tukio.one` injoignables, doctl `droplet get tukio-apps` retourne off/destroyed/inaccessible.

**Diagnostic** : `doctl compute droplet get tukio-apps`, console DO web UI, ping VPC depuis `tukio-data`.

### Procédure (~45 min)

**Étape 1 — Restaurer depuis snapshot DO (le plus rapide)** :

```sh
# 1.1 — Lister les snapshots disponibles
doctl compute snapshot list --resource droplet --format ID,Name,CreatedAt \
  | grep tukio-apps

# 1.2 — Créer un nouveau droplet depuis le snapshot le plus récent
SNAP_ID=<id-du-snapshot>
doctl compute droplet create tukio-apps-new \
  --image "$SNAP_ID" \
  --size s-1vcpu-2gb \
  --region fra1 \
  --vpc-uuid <tukio-vpc-uuid> \
  --ssh-keys <ssh-key-fingerprint> \
  --enable-monitoring \
  --wait

# 1.3 — Récupérer la nouvelle IP publique
NEW_APPS_IP=$(doctl compute droplet get tukio-apps-new --format PublicIPv4 --no-header)
```

**Étape 2 — Repointer le DNS Squarespace** :

1. Connecte-toi à https://account.squarespace.com/domains → `tukio.one` → Custom Records
2. Modifier les records A (`app`, `api`, `customer`, `seller`, `admin`, `auth`, `@`) → `NEW_APPS_IP`
3. TTL était à 3600s (1h) — propagation 5-60 min selon resolver

**Étape 3 — Mettre à jour le firewall** :

```sh
# Le firewall tukio-fw-apps doit cibler le nouveau droplet
OLD_FW_ID=$(doctl compute firewall list --format ID,Name --no-header | awk '$2=="tukio-fw-apps" {print $1}')
NEW_DROPLET_ID=$(doctl compute droplet get tukio-apps-new --format ID --no-header)

doctl compute firewall add-droplets $OLD_FW_ID --droplet-ids $NEW_DROPLET_ID
# Retirer l'ancien droplet du firewall (si encore listé)
```

**Étape 4 — Mettre à jour `DATA_PRIV_IP` côté apps** (si IP VPC du droplet data a changé — peu probable car data n'est pas remplacé) :

```sh
ssh tukio@${NEW_APPS_IP}
# Vérifier .env.production déjà restauré depuis snapshot
grep DATA_PRIV_IP /home/tukio/tukio/.env.production
# Si vide ou stale : corriger manuellement
```

**Étape 5 — Redémarrer le stack apps** :

```sh
ssh tukio@${NEW_APPS_IP}
cd /home/tukio/tukio
export $(grep -v '^#' .env.production | xargs)
docker login ghcr.io -u MohamedXi --password-stdin <<< $GHCR_PAT
docker compose -f infra/docker-compose/apps.prod.yml pull
docker compose -f infra/docker-compose/apps.prod.yml up -d --wait
```

**Étape 6 — Mettre à jour `DO_HOST_APPS` GitHub secret** :

```sh
gh secret set DO_HOST_APPS --body "${NEW_APPS_IP}"
```

**Étape 7 — Renommer le droplet + supprimer l'ancien** :

```sh
doctl compute droplet-action rename $NEW_DROPLET_ID --droplet-name tukio-apps
# Si l'ancien droplet est encore listé "stuck"
doctl compute droplet delete tukio-apps --force  # ATTENTION : double-vérifier l'ID
```

**Validation** : `curl https://api.tukio.one/health` retourne 200 ; `curl https://app.tukio.one` charge la home.

---

## Scénario 3 — Droplet `tukio-data` mort

**Symptôme** : tous les services backend renvoient 500 (impossible de se connecter à Postgres/Keycloak/etc.).

**Diagnostic** : `doctl compute droplet get tukio-data`, SSH dans `tukio-apps` puis `nc -zv $DATA_PRIV_IP 5432`.

### Procédure (~90 min — RTO le plus long)

**Étape 1 — Restaurer depuis snapshot DO** :

Procédure identique à Scénario 2 étape 1, en remplaçant `apps` par `data`. Les volumes Postgres (bind mount `/var/lib/tukio/postgres`) sont **inclus** dans le snapshot — pas besoin de restauration R2 si le snapshot est récent (< 24h).

```sh
SNAP_ID=$(doctl compute snapshot list --resource droplet --format ID,Name --no-header \
  | grep tukio-data | tail -1 | awk '{print $1}')

doctl compute droplet create tukio-data-new \
  --image "$SNAP_ID" \
  --size s-1vcpu-2gb \
  --region fra1 \
  --vpc-uuid <tukio-vpc-uuid> \
  --ssh-keys <ssh-key-fingerprint> \
  --wait

NEW_DATA_PRIV=$(doctl compute droplet get tukio-data-new --format PrivateIPv4 --no-header)
```

**Étape 2 — Mettre à jour la firewall data** :

```sh
APPS_PRIV=$(doctl compute droplet get tukio-apps --format PrivateIPv4 --no-header)
NEW_DATA_ID=$(doctl compute droplet get tukio-data-new --format ID --no-header)
FW_ID=$(doctl compute firewall list --format ID,Name --no-header | awk '$2=="tukio-fw-data" {print $1}')

doctl compute firewall add-droplets $FW_ID --droplet-ids $NEW_DATA_ID
```

**Étape 3 — Mettre à jour `DATA_PRIV_IP` sur tukio-apps** :

```sh
ssh tukio@${APPS_IP}
sed -i "s|^DATA_PRIV_IP=.*|DATA_PRIV_IP=${NEW_DATA_PRIV}|" /home/tukio/tukio/.env.production
cd /home/tukio/tukio
docker compose -f infra/docker-compose/apps.prod.yml up -d --force-recreate
```

**Étape 4 — Si snapshot stale (> 24h), restaurer Postgres depuis R2** :

```sh
ssh tukio@${NEW_DATA_PRIV}  # via tukio-apps puisque pas d'accès public
cd /home/tukio/tukio
docker compose -f infra/docker-compose/data.prod.yml up -d postgres
sleep 10

# Restaurer chaque DB
for db in tukio_identity tukio_catalog tukio_booking tukio_order tukio_payment \
          tukio_messaging tukio_review tukio_notification tukio_media keycloak; do
  ./infra/scripts/restore-postgres.sh $db $(date -d 'yesterday' +%Y-%m-%d) --force
done

# Redémarrer Keycloak + les autres services data
docker compose -f infra/docker-compose/data.prod.yml up -d
```

**Étape 5 — Renommer et supprimer l'ancien droplet** :

Identique scénario 2 étape 7.

**Validation** : `pg_isready` depuis `tukio-apps` ; `/health` retourne 200 ; login Keycloak fonctionne.

---

## Scénario 4 — Perte/corruption d'une DB Postgres unique

**Symptôme** : un service backend lance des erreurs SQL persistantes ; une migration foireuse a tronqué une table.

**Diagnostic** : `docker compose logs <svc>`, requêtes SQL ad-hoc dans le container postgres.

### Procédure (~15 min)

```sh
ssh tukio@${DATA_IP}
cd /home/tukio/tukio

# 1. Arrêter le(s) service(s) consumer(s) de cette DB pour stopper les writes
ssh tukio@${APPS_IP} 'docker compose -f /home/tukio/tukio/infra/docker-compose/apps.prod.yml stop <svc>'

# 2. Restaurer depuis R2 (date du dernier backup connu sain)
./infra/scripts/restore-postgres.sh tukio_catalog 2026-05-13
# Tape "tukio_catalog" pour confirmer

# 3. Redémarrer le service
ssh tukio@${APPS_IP} 'docker compose -f /home/tukio/tukio/infra/docker-compose/apps.prod.yml start <svc>'
```

**Validation** : row counts post-restore plausibles ; service applicatif healthy.

**Note migrations** : si la corruption vient d'une migration TypeORM, **roll back la migration** (`pnpm --filter=<svc> migration:revert`) avant de redéployer, ou pinner une image antérieure à la migration.

---

## Scénario 5 — Secret compromis (rotation d'urgence)

**Symptôme** : suspicion de fuite d'un secret (Stripe key, Resend API key, password Postgres exposé en logs…).

### Procédure (~20 min)

**Étape 1 — Révoquer immédiatement le secret côté fournisseur** :

- Stripe : Dashboard → Developers → API keys → roll secret key
- Resend : Dashboard → API keys → revoke
- Keycloak admin : `kcadm.sh set-password ...`
- Postgres : `ALTER USER ... PASSWORD '...'` dans `psql` direct sur le droplet data

**Étape 2 — Rotation côté droplets** :

```sh
# Sur les 2 droplets concernés
ssh tukio@${APPS_IP}
cd /home/tukio/tukio
./infra/scripts/provision-secrets.sh apps --rotate stripe_secret

ssh tukio@${DATA_IP}
cd /home/tukio/tukio
./infra/scripts/provision-secrets.sh data --rotate pg_password
```

**Étape 3 — Restart des services consommateurs** :

```sh
# Postgres password : recrée TOUS les services (sinon connexions stale persistent)
ssh tukio@${DATA_IP}
docker compose -f infra/docker-compose/data.prod.yml up -d --force-recreate

ssh tukio@${APPS_IP}
docker compose -f infra/docker-compose/apps.prod.yml up -d --force-recreate
```

**Étape 4 — Audit** :

- Vérifier qu'aucun log Docker ne contient le secret en clair
- Si commit Git fautif : `git filter-repo` + force-push + invalider toutes les copies caches
- Post-mortem GitHub Issue + ajout d'un test linter pour prévenir la rechute

---

## Scénario 6 — DNS Squarespace inaccessible / domaine expiré

**Symptôme** : `dig app.tukio.one` ne résout plus ; courriel Squarespace de fin d'abonnement.

### Procédure

- **Renouveler immédiatement** le domaine dans Squarespace (autoriser auto-renewal)
- En attendant la propagation DNS : exposer temporairement sur l'IP directe du droplet (HTTP only, sans TLS valide)
- **Backup plan long terme** : transférer le domaine vers Cloudflare Registrar (NS records délégables, CDN + DDoS gratuit en prime)

---

## Tests DR (à exécuter trimestriellement)

- [ ] **T1** — Rollback automatique : déployer volontairement une image cassée sur staging, vérifier que `deploy-production.yml` rollback effectivement
- [ ] **T2** — Restore PG ciblé : restaurer `tukio_catalog` d'avant-hier sur staging, vérifier données + row count
- [ ] **T3** — Restore snapshot complet : créer un droplet `tukio-apps-test` depuis snapshot J-1, vérifier que tout démarre
- [ ] **T4** — Rotation secret end-to-end : rotation `stripe_secret`, services redémarrent et continuent à fonctionner

Chaque test : noter le temps écoulé pour valider les RPO/RTO cibles. Si dérive > 50 %, rééxaminer la procédure.

---

## Voir aussi

- [`digitalocean-deployment.md`](./digitalocean-deployment.md) — provisioning + déploiement initial
- [`index.md`](./index.md) — index CI/CD
- Story 0.12 : `_bmad-output/implementation-artifacts/0-12-digitalocean-droplets-docker-compose.md`
