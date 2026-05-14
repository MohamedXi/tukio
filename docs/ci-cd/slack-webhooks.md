# Slack webhooks — Configuration et setup

**Outil** : [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks) — notifications déclenchées par les workflows GitHub Actions.

**Workflows consommateurs** :

- `chaos-tests.yml` → `#tukio-alerts` (fail nocturne)
- `deploy-staging.yml` → `#tukio-deploys` (success / fail)
- `deploy-production.yml` → `#tukio-deploys-prod` (success / fail / rollback)

**Statut bloquant** : 🟢 **Non bloquant** — workflows dégradent gracieusement sans webhook (`if: env.SLACK_WEBHOOK_X != ''` skip silencieux).

---

## Pourquoi

Sans Slack :

- Chaos suite nocturne fail → personne n'est notifié → bug latent pendant des jours.
- Deploy fail → faute de notif, le tech-lead découvre l'incident en production.
- Pas de canal central pour observer le rythme des déploiements.

Avec Slack :

- Notif immédiate (push iOS/Android) sur fail nocturne.
- Trace publique des deploys → audit + responsabilité partagée.
- Possibilité d'ajouter des bots (PR review, alertes Sentry, etc.) sur les mêmes canaux.

---

## Étapes

### 1. Préparer le workspace Slack

Si tu n'as pas encore de workspace Slack :

1. https://slack.com/get-started → **Create a new workspace**
2. Nom : `Tukio` ou ton équipe
3. Invite les membres pertinents

Si tu as déjà un workspace : continue à l'étape 2.

### 2. Créer les 3 canaux

Dans Slack :

1. Sidebar gauche → **Channels** → **+** → **Create a channel**
2. Crée 3 canaux :
   - `#tukio-deploys` — privé ou public selon ton équipe
   - `#tukio-deploys-prod` — privé recommandé (notifie les events prod)
   - `#tukio-alerts` — privé recommandé (incidents)

Pour chaque canal, ajoute les personnes qui doivent recevoir les notifs (typiquement : tech-lead + on-call).

### 3. Créer une Slack App

Une seule app suffit pour les 3 webhooks.

1. https://api.slack.com/apps → **Create New App**
2. **From scratch**
3. **App Name** : `Tukio CI`
4. **Pick a workspace** : ton workspace Slack
5. **Create App**

### 4. Activer Incoming Webhooks

1. Dans l'app, sidebar gauche → **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** → **On**

### 5. Ajouter 3 webhooks (1 par canal)

Pour chacun des 3 canaux, répéter :

1. En bas de la page Incoming Webhooks → **Add New Webhook to Workspace**
2. **Where should Tukio CI post?** → sélectionne le canal (`#tukio-deploys`, etc.)
3. **Allow**
4. Tu es redirigé vers la liste des webhooks
5. **Copy** l'URL (format : `https://hooks.slack.com/services/T.../B.../...`)

Répète pour les 2 autres canaux.

### 6. Ajouter les 3 secrets au repo GitHub

GitHub → `MohamedXi/tukio` → Settings → Secrets and variables → Actions → **New repository secret** (×3) :

| Secret                        | Webhook URL pour                |
| ----------------------------- | ------------------------------- |
| `SLACK_WEBHOOK_DEPLOYS`       | `#tukio-deploys`                |
| `SLACK_WEBHOOK_DEPLOYS_PROD`  | `#tukio-deploys-prod`           |
| `SLACK_WEBHOOK_ALERTS`        | `#tukio-alerts`                 |

### 7. Test rapide

```sh
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test webhook Tukio depuis le terminal"}' \
  'https://hooks.slack.com/services/T.../B.../...'
```

Si le message apparaît dans le canal, le webhook fonctionne.

---

## Format des notifs

### `deploy-staging.yml` → `#tukio-deploys`

**Succès** :

```
🚀 Staging deploy succeeded — `<sha>`
```

**Échec** :

```
❌ Staging deploy FAILED — `<sha>` — see <run-url>
```

### `deploy-production.yml` → `#tukio-deploys-prod`

**Succès** :

```
🚀 Production deploy succeeded — `<tag>`
```

**Échec** :

```
❌ Production deploy FAILED — `<tag>` — rollback placeholder triggered. See <run-url>
```

### `chaos-tests.yml` → `#tukio-alerts`

**Échec uniquement** (nightly success est silencieux) :

```
🔥 Nightly chaos suite FAILED — see <run-url>
```

---

## Personnaliser les messages

Les payloads sont définis dans chaque workflow. Exemple `deploy-staging.yml` :

```yaml
- name: Notify Slack — success
  if: success() && env.SLACK_WEBHOOK_DEPLOYS != ''
  uses: slackapi/slack-github-action@v2
  with:
    webhook: ${{ env.SLACK_WEBHOOK_DEPLOYS }}
    webhook-type: incoming-webhook
    payload: |
      {
        "text": ":rocket: Staging deploy succeeded — `${{ github.sha }}`"
      }
```

Pour enrichir (blocks, attachments, mentions) :

```yaml
payload: |
  {
    "blocks": [
      {
        "type": "header",
        "text": { "type": "plain_text", "text": "🚀 Staging deploy succeeded" }
      },
      {
        "type": "section",
        "fields": [
          { "type": "mrkdwn", "text": "*Commit:* ${{ github.sha }}" },
          { "type": "mrkdwn", "text": "*Author:* ${{ github.actor }}" }
        ]
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "View run" },
            "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          }
        ]
      }
    ]
  }
```

Mentions d'utilisateurs :

```json
"text": "<@U01234ABCDE> staging deploy needs attention"
```

User IDs trouvables dans Slack → click sur la personne → **Copy member ID**.

Mention de canal pour notif sonore :

```json
"text": "<!channel> production deploy FAILED — investigate now"
```

---

## Rotation des webhooks

Si une URL webhook est compromise (leak dans logs, commit accidentel) :

1. https://api.slack.com/apps → ton app `Tukio CI`
2. **Incoming Webhooks**
3. À côté de l'URL compromise → **Disable**
4. **Add New Webhook to Workspace** → recréer pour le même canal
5. Mettre à jour le secret GitHub correspondant

L'ancienne URL est immédiatement invalidée.

---

## Workflow `if:` scoping pattern

Les guards des notifs Slack utilisent un pattern précis pour éviter le bug d'env-scoping détecté lors du code-review :

```yaml
# Au niveau workflow — déclaré AVANT les jobs
env:
  SLACK_WEBHOOK_ALERTS: ${{ secrets.SLACK_WEBHOOK_ALERTS }}

jobs:
  chaos:
    steps:
      # ...
      - name: Notify Slack on failure
        if: failure() && env.SLACK_WEBHOOK_ALERTS != ''
        uses: slackapi/slack-github-action@v2
        with:
          webhook: ${{ env.SLACK_WEBHOOK_ALERTS }}
```

**À NE PAS FAIRE** (bug original — la step `env:` est évaluée APRÈS le `if:`, donc `env.X` est vide) :

```yaml
- name: Notify Slack on failure
  if: failure() && env.SLACK_WEBHOOK_ALERTS != ''  # ← toujours faux
  env:
    SLACK_WEBHOOK_ALERTS: ${{ secrets.SLACK_WEBHOOK_ALERTS }}
```

---

## Troubleshooting

### `Notify Slack on failure` step skip alors que la CI a échoué

- Vérifier que le secret est bien dans repo secrets (pas environment secret pour les workflows qui ne sont pas attachés à un environment).
- Vérifier que `env.X` est déclaré au niveau **workflow** (pas seulement step).
- Vérifier que la step utilise `if: failure() && env.X != ''` (et pas `if: failure() && secrets.X != ''` — `secrets` context n'est pas accessible dans `if:`).

### Webhook returns 404

- L'URL webhook a été révoquée → recréer (voir Rotation).
- Le canal a été archivé → l'URL devient invalide → recréer pour un nouveau canal.

### Webhook returns 400 « invalid_payload »

- Le JSON du payload est mal-formé → tester avec `curl` d'abord.
- Slack a deprecated certains attachments — migrer vers Block Kit (https://api.slack.com/block-kit).

### Pas de notif iOS/Android malgré webhook OK

- Vérifier les **notification preferences** du canal côté Slack (Preferences → Notifications).
- Vérifier que Slack n'est pas en **Do Not Disturb**.
- Pour les alertes critiques, utiliser `<!channel>` ou `<!here>` dans le payload pour forcer la notif sonore.

### Message Slack tronqué

Slack a une limite de **40 000 caractères** par message. Pour des stack traces longues :

1. Truncate dans le workflow : `${{ steps.foo.outputs.log }} | head -c 30000`
2. OU : upload vers Slack en tant que **file attachment** (autre API).
3. OU : ne pas inclure le log, juste un lien vers GitHub Actions run.

---

## Documentation officielle

- Incoming Webhooks : https://api.slack.com/messaging/webhooks
- Block Kit Builder : https://app.slack.com/block-kit-builder
- `slackapi/slack-github-action` : https://github.com/slackapi/slack-github-action

## Voir aussi

- [`branch-protection.md`](./branch-protection.md) — étape suivante.
- [`argocd-deployment.md`](./argocd-deployment.md) — Story 0.12, consommera aussi les webhooks.
