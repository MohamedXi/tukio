# Runbook — Phasetwo Orgs Extension (V2 Enterprise SSO B2B)

**Statut MVP** : provisionné, non exposé publiquement  
**Activation** : V2 — Epic 15 (Story 15.1 — SAML SSO B2B Enterprise)

## APIs provisionnées (non utilisées MVP)

| Endpoint | Description |
|---|---|
| `GET /realms/tukio/orgs` | Liste les organisations (vide MVP `[]`) |
| `POST /realms/tukio/orgs` | Créer une organisation (V2) |
| `GET /realms/tukio/webhooks` | Liste les webhooks Phasetwo (utilisé AC5) |
| `GET /realms/tukio/magic-link` | Magic link (V2 admin invite) |

## Activation V2 (Epic 15)

1. Whitelist `/realms/tukio/orgs` et `/realms/tukio/portal` dans `gateway-api` (Epic 15+)
2. Créer les organisations B2B via `POST /realms/tukio/orgs` pour chaque client enterprise
3. Lier les utilisateurs B2B aux organisations
4. Configurer le SAML SSO par organisation

## Documentation Phasetwo

- API Orgs : https://phasetwo.io/docs/api
- Orgs extension source : https://github.com/p2-inc/keycloak-orgs
- Magic Links : https://phasetwo.io/docs/magic-link

## Notes d'implémentation

Story 1.1 a provisionné le realm `tukio` avec Phasetwo bundle qui expose ces APIs.
Aucune configuration supplémentaire n'est nécessaire pour l'activation V2 — les APIs
sont déjà disponibles via l'image Docker open-source.

En staging (Phasetwo SaaS), les mêmes APIs sont disponibles avec haute disponibilité
et support Phasetwo Enterprise.
