# Runbook — Keycloak Realm Recovery

**Story 1.1** · Dernière mise à jour : 2026-05-16

**RPO** : 1 commit (dernier `tukio.realm.json` commité)
**RTO** : ~5 minutes (local) / ~15 minutes (staging)

## Restore depuis realm-export JSON

```sh
# 1. Démarrer Keycloak
pnpm docker:up:wait

# 2. Importer le dernier realm-export connu
docker compose -f infra/docker-compose/docker-compose.dev.yml exec -T keycloak \
  /opt/keycloak/bin/kcadm.sh create realms \
  -f /opt/keycloak/data/import/tukio.realm.json

# 3. Vérifier le restore
pnpm keycloak:smoke
```

Le realm-export est monté en volume read-only dans `/opt/keycloak/data/import/`.

## Restore complet (realm détruit)

Si le realm `tukio` n'existe plus :

```sh
# Option A — bootstrap depuis zéro (recommandé)
pnpm keycloak:bootstrap

# Option B — importer le realm-export (clients + rôles inclus si export partial-export)
docker compose ... exec keycloak \
  /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://localhost:8080 --realm master \
    --user admin --password admin

docker compose ... exec keycloak \
  /opt/keycloak/bin/kcadm.sh create realms \
    -f /opt/keycloak/data/import/tukio.realm.json
```

## Validation post-restore

```sh
pnpm keycloak:smoke
# → 8/8 tests doivent passer
```

En cas d'échec sur le Test 7 (thèmes), rebuilder et redéployer :

```sh
pnpm keycloak:themes:build
# Redémarrer Keycloak pour recharger les thèmes
docker compose -f infra/docker-compose/docker-compose.dev.yml restart keycloak
```

## Staging — recovery depuis Phasetwo SaaS

En staging, Phasetwo SaaS gère la haute disponibilité Keycloak.
En cas de perte de configuration :

```sh
DOPPLER_TOKEN=<token> pnpm keycloak:bootstrap:staging
```

Phasetwo SaaS dispose d'une API de backup/restore dans le portail admin.
Contact support : https://phasetwo.io/docs/support
