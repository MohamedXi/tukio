# Keycloak SPI — Tukio

Ce dossier est **vide au MVP** (2026-05-16).

## Pourquoi vide ?

Story 1.1 utilise **Phasetwo Webhooks Extension** (incluse dans `quay.io/phasetwo/phasetwo-keycloak`)
pour le bridge `LOGIN_ERROR → identity-svc`. Zéro code Java custom nécessaire.

API webhook Phasetwo : `POST /realms/tukio/webhooks`  
Doc : https://github.com/p2-inc/keycloak-events

## Plan B (V1+)

Si Phasetwo Webhooks Extension est supprimée ou insuffisante, implémenter un
Keycloak Event Listener SPI Java ici :

```
spi/
└── tukio-event-listener/
    ├── pom.xml
    └── src/main/java/one/tukio/keycloak/
        ├── TukioEventListenerProvider.java
        ├── TukioEventListenerProviderFactory.java
        └── resources/META-INF/services/
            └── org.keycloak.events.EventListenerProviderFactory
```

Le SPI POSTe vers `IDENTITY_SVC_WEBHOOK_URL` avec HMAC-SHA256 signature
(header `X-Tukio-Signature`).

## Références

- Story 1.1 AC5 — Brute-Force Detection + webhook bridge
- Story 1.10 — identity-svc consumer du webhook LOGIN_ERROR
