# Runbook — Keycloak Realm Bootstrap

**Story 1.1** · Dernière mise à jour : 2026-05-16

## Prérequis

| Outil | Requis | Notes |
|---|---|---|
| Docker + Docker Compose | Oui | `pnpm docker:up:wait` doit passer |
| `bash` + `curl` + `jq` + `python3` + `envsubst` | Oui | Disponibles sur macOS et Ubuntu |
| `shellcheck` | CI uniquement | `brew install shellcheck` |
| Doppler CLI | Staging uniquement | `brew install dopplerhq/cli/doppler` |

## Provisionnement local

```sh
pnpm docker:up:wait            # démarre Keycloak + Postgres + NATS...
pnpm keycloak:themes:build     # package les thèmes en dist/tukio-keycloak-themes.jar
pnpm keycloak:bootstrap        # provisionne le realm tukio (idempotent)
pnpm keycloak:smoke            # vérifie les 8 ACs smoke
```

Le script est **idempotent** : le relancer ne crée pas de doublons.

## Provisionnement staging

```sh
doppler login                  # s'authentifier une fois
DOPPLER_TOKEN=<token> pnpm keycloak:bootstrap:staging
```

Les secrets Keycloak staging sont lus depuis Doppler projet `tukio` config `staging` :
- `KEYCLOAK_ADMIN_USERNAME`, `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_CLIENT_SECRET_TUKIO_API`
- `KEYCLOAK_WEBHOOK_SECRET`
- `KEYCLOAK_URL` → `https://auth.staging.tukio.one`

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

En staging, mettre à jour le secret Doppler **avant** de relancer le bootstrap.

## Troubleshooting

| Symptôme | Cause probable | Résolution |
|---|---|---|
| `Keycloak not ready after 60s` | Container pas encore up | `pnpm docker:up:wait` + réessayer |
| `invalid_grant` sur login | Realm pas bootstrappé | `pnpm keycloak:bootstrap` |
| Theme not applied | Volume mount manquant | Vérifier `docker-compose.dev.yml` volumes keycloak |
| Phasetwo Webhooks 404 | Image non-Phasetwo | Vérifier image `quay.io/phasetwo/phasetwo-keycloak` |
| `Doppler CLI required` | Doppler non installé | `brew install dopplerhq/cli/doppler && doppler login` |
| TOTP non enforcé sur admin | Flow binding raté | Re-exécuter bootstrap + vérifier `authenticationFlowBindingOverrides` |

## Plan B — Event Listener SPI Java (si Phasetwo Webhooks insuffisant)

Voir `infra/keycloak/spi/README.md` pour les instructions de développement du SPI custom.
