# Runbook — Keycloak Realm Bootstrap

**Story 1.1** · Dernière mise à jour : 2026-05-16

## Prérequis

| Outil | Requis | Notes |
|---|---|---|
| Docker + Docker Compose | Oui | `pnpm docker:up:wait` doit passer |
| `bash` + `curl` + `jq` + `python3` + `envsubst` | Oui | Disponibles sur macOS et Ubuntu |
| `shellcheck` | CI uniquement | `brew install shellcheck` |
| Accès SSH au droplet `tukio-data` | Staging uniquement | clé `~/.ssh/id_ed25519` autorisée + `DO_HOST_DATA` exporté |

## Provisionnement local

```sh
pnpm docker:up:wait            # démarre Keycloak + Postgres + NATS...
pnpm keycloak:themes:build     # package les thèmes en dist/tukio-keycloak-themes.jar
pnpm keycloak:bootstrap        # provisionne le realm tukio (idempotent)
pnpm keycloak:smoke            # vérifie les 8 ACs smoke
```

Le script est **idempotent** : le relancer ne crée pas de doublons.

## Provisionnement staging (Story 1.1b — DO droplet `tukio-data`)

Le bootstrap s'exécute **directement sur le droplet `tukio-data`**, jamais depuis ta machine. Les secrets sont lus depuis `/home/tukio/tukio/secrets/` (provisionnés via `provision-secrets.sh data`).

### 0. Prérequis sur le droplet (one-time setup)

Sur la machine locale :

```sh
# Snapshot Postgres avant migration KC25 → KC26+Phasetwo (mitigation rollback)
ssh tukio@$DO_HOST_DATA 'bash ~/tukio/infra/scripts/backup-postgres.sh'

# Copier les fichiers de config (themes + realm-config + scripts) sur le droplet
rsync -av --delete \
  infra/keycloak/ \
  tukio@$DO_HOST_DATA:~/tukio/keycloak/

rsync -av \
  infra/scripts/bootstrap-keycloak-realm.sh \
  infra/scripts/smoke-test-keycloak-realm.sh \
  infra/scripts/provision-secrets.sh \
  tukio@$DO_HOST_DATA:~/tukio/infra/scripts/

# Copier le data.prod.yml mis à jour (Phasetwo image + ports + volumes)
scp infra/docker-compose/data.prod.yml tukio@$DO_HOST_DATA:~/tukio/
```

### 1. Provisionner les nouveaux secrets Story 1.1

Sur le droplet :

```sh
ssh tukio@$DO_HOST_DATA
cd ~/tukio
bash infra/scripts/provision-secrets.sh data
# Saisir : kc_client_secret_tukio_api, kc_client_secret_smoke_test, kc_webhook_secret
# Les autres secrets existants sont skippés.
```

### 2. Restart Keycloak avec l'image Phasetwo

```sh
cd ~/tukio
export KC_DB_USERNAME=$(cat /home/tukio/tukio/secrets/kc_db_username)
export KC_DB_PASSWORD=$(cat /home/tukio/tukio/secrets/kc_db_password)
export KC_ADMIN_USERNAME=admin
export KC_ADMIN_PASSWORD=$(cat /home/tukio/tukio/secrets/kc_admin_password)

# Pull la nouvelle image Phasetwo (~150 MB)
docker compose -f data.prod.yml pull keycloak

# Stop + recreate Keycloak — Liquibase auto-migre la DB master au 1er boot
docker compose -f data.prod.yml up -d --wait keycloak
# ⏳ start_period: 90s, durée totale ~2-3 min selon CPU

# Vérifier que Keycloak est UP avec la nouvelle version
docker exec tukio_keycloak /opt/keycloak/bin/kc.sh --version
# Doit afficher Keycloak 26.x
```

### 3. Bootstrap le realm `tukio`

```sh
cd ~/tukio
bash infra/scripts/bootstrap-keycloak-realm.sh --env=staging
# 5 rôles + 5 clients + MFA flow + custom claims + Phasetwo webhook + realm export
# ~30-60s. Idempotent — réexécuter ne crée pas de doublons.
```

### 4. Smoke tests

```sh
bash infra/scripts/smoke-test-keycloak-realm.sh --env=staging
# 7/7 (T8 Phasetwo Orgs skipped si endpoint inaccessible publiquement)
```

### 5. Vérification finale (depuis ta machine)

```sh
curl -fsS https://auth.tukio.one/realms/tukio/.well-known/openid-configuration | jq .issuer
# → "https://auth.tukio.one/realms/tukio"
```

### Rollback en cas de problème

```sh
# Sur le droplet
cd ~/tukio
git checkout HEAD~1 -- data.prod.yml   # ou édite l'image vers quay.io/keycloak/keycloak:25.0
docker compose -f data.prod.yml up -d keycloak

# Restore Postgres si nécessaire
bash infra/scripts/restore-postgres.sh /home/tukio/backups/pg_latest.dump
```

## Déploiement production

**Bloqué volontairement au MVP.** Le script exit 1 avec le message :
> `production env requires manual approval — see docs/runbook/keycloak-realm-bootstrap.md §Production`

Pour activer la production : supprimer le bloc `production) exit 1` dans
`infra/scripts/bootstrap-keycloak-realm.sh` après validation manuelle par Ismael.

## Exporter le realm

```sh
pnpm keycloak:export
# → infra/keycloak/realm-export/tukio.realm.json (champs sensibles strippés)
```

Committer l'export après chaque modification du realm. Le CI nightly détecte le drift.

## Ajouter un utilisateur admin manuellement

```sh
# via kcadm (depuis le container keycloak)
docker compose -f infra/docker-compose/docker-compose.dev.yml exec keycloak \
  /opt/keycloak/bin/kcadm.sh create users -r tukio \
    -s username=ismael@tukio.one \
    -s email=ismael@tukio.one \
    -s enabled=true \
    -s emailVerified=true \
    -s firstName=Ismael \
    -s lastName=Mohamed

# Assigner le rôle admin-super
docker compose ... exec keycloak \
  /opt/keycloak/bin/kcadm.sh add-roles -r tukio --uusername ismael@tukio.one \
    --rolename admin-super

# Définir un mot de passe temporaire
docker compose ... exec keycloak \
  /opt/keycloak/bin/kcadm.sh set-password -r tukio --username ismael@tukio.one -p 'TempPass123!'
```

## Rotation des secrets client

Les secrets client (`tukio-api`, `tukio-smoke-test`) sont préservés par le script bootstrap sauf si
`FORCE_CLIENT_SECRET=1` est passé :

```sh
FORCE_CLIENT_SECRET=1 pnpm keycloak:bootstrap
```

En staging, rotate via `bash infra/scripts/provision-secrets.sh data --rotate kc_client_secret_tukio_api` puis relancer le bootstrap.

## Troubleshooting

| Symptôme | Cause probable | Résolution |
|---|---|---|
| `Keycloak not ready after 60s` | Container pas encore up | `pnpm docker:up:wait` + réessayer |
| `invalid_grant` sur login | Realm pas bootstrappé | `pnpm keycloak:bootstrap` |
| Theme not applied | Volume mount manquant | Vérifier `docker-compose.dev.yml` volumes keycloak |
| Phasetwo Webhooks 404 | Image non-Phasetwo | Vérifier image `quay.io/phasetwo/phasetwo-keycloak` |
| `Secrets dir not found` | Script lancé en local au lieu du droplet | SSH vers `tukio@$DO_HOST_DATA` puis `cd ~/tukio` |
| TOTP non enforcé sur admin | Flow binding raté | Re-exécuter bootstrap + vérifier `authenticationFlowBindingOverrides` |

## Plan B — Event Listener SPI Java (si Phasetwo Webhooks insuffisant)

Voir `infra/keycloak/spi/README.md` pour les instructions de développement du SPI custom.
