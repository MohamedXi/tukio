# Runbook — Suppression Resend Audiences au lancement (Story 0.20)

Ce runbook décrit les 5 étapes pour nettoyer l'intégration Resend Audiences pré-lancement
et migrer la liste waitlist vers Brevo (Epic 16.2 V1+) au moment de l'ouverture officielle.

## Section 1 — Export liste waitlist Resend → CSV

Avant de supprimer quoi que ce soit, exporter la liste.

```bash
# Via Resend Dashboard
# Audiences → tukio-pre-launch-waitlist → "Export contacts" → CSV download

# Ou via Resend REST API
curl -H "Authorization: Bearer $RESEND_API_KEY" \
  "https://api.resend.com/audiences/$RESEND_PRE_LAUNCH_AUDIENCE_ID/contacts" \
  -o waitlist-export.json
```

Vérifier que le CSV/JSON contient les custom fields : `role`, `locale`, `acquisitionSource`.

## Section 2 — Import dans Brevo (Epic 16.2)

```bash
# Via Brevo Dashboard
# Contacts → Importer → Upload CSV
# Mapper : email / firstName / lastName / role (attribut custom ROLE) / locale (LOCALE)

# Ou via Brevo API (Contacts Import v3)
curl -X POST "https://api.brevo.com/v3/contacts/import" \
  -H "api-key: $BREVO_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "fileBody": "<csv-content>",
    "listIds": [<YOUR_BREVO_LIST_ID>]
  }'
```

## Section 3 — Email de lancement vers la waitlist

```bash
# Option A : via Resend transactional one-shot avant suppression audience
# (pendant que la liste existe encore)
curl -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST "https://api.resend.com/emails" \
  -d '{
    "from": "Tukio <noreply@tukio.one>",
    "to": ["audience_id:'"$RESEND_PRE_LAUNCH_AUDIENCE_ID"'"],
    "subject": "Tukio est lancé ! Découvrez la plateforme",
    "html": "<p>...</p>"
  }'

# Option B : via Brevo broadcast campaign post-import (recommandé pour tracking ouvertures/clics)
```

## Section 4 — Cleanup PR (supprimer Route Handlers + hooks)

**⚠️ Avant de supprimer un fichier ci-dessous, exécuter :**

```bash
# Vérifier qu'AUCUN autre module ne consomme le fichier en dehors de la stack pre-launch
grep -r "parseAcquisitionCookie\|createResendContact\|computePosition\|logSignup\|logContact" \
  apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v "features/pre-launch/"
```

Si la commande retourne des matches en dehors de `features/pre-launch/`, **ne pas supprimer** ce fichier (autre code en dépend). Le cookie `tk_acq` lui-même reste géré par Story 0.13 (`apps/public/src/middleware/acquisition-cookie.ts`) — ne pas toucher.

Créer une PR `chore/cleanup-pre-launch-resend-0.20` qui supprime :

```
# FICHIERS À SUPPRIMER
apps/public/src/app/api/pre-launch/signup/route.ts
apps/public/src/app/api/pre-launch/contact/route.ts
apps/public/src/app/api/pre-launch/__tests__/signup.route.spec.ts
apps/public/src/app/api/pre-launch/__tests__/contact.route.spec.ts
apps/public/src/features/pre-launch/email-templates/ContactEmail.tsx
apps/public/src/features/pre-launch/services/resend-client.ts
apps/public/src/features/pre-launch/services/rate-limit-client.ts
apps/public/src/features/pre-launch/services/parse-acquisition-cookie.ts
apps/public/src/features/pre-launch/services/compute-position.ts
apps/public/src/features/pre-launch/services/log-signup.ts
apps/public/src/features/pre-launch/services/log-contact.ts
packages/api-client/src/hooks/pre-launch/ (dossier entier)

# MISES À JOUR
apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx
  → remplacer useSubmitPreLaunchSignup par un no-op ou retirer le form
apps/public/src/features/public-pages/components/ContactFormClient.tsx
  → remplacer useSubmitPreLaunchContact par le vrai endpoint /api/contact/ post-launch

# ENV VARS À RETIRER de .env.* prod (via infra/secrets management)
RESEND_PRE_LAUNCH_AUDIENCE_ID
# Garder RESEND_API_KEY + RESEND_FROM_ADDRESS + CONTACT_INBOX pour usage post-launch
# Retirer UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN si Redis non utilisé ailleurs
```

## Section 5 — Désactiver l'Audience Resend après migration Brevo

```bash
# Vérifier que tous les contacts ont bien été importés en Brevo AVANT suppression.
# Une fois confirmé :

# Via Resend Dashboard
# Audiences → tukio-pre-launch-waitlist → Settings → Delete Audience (action irréversible)

# Ou via Resend API (ATTENTION : irréversible)
curl -X DELETE \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  "https://api.resend.com/audiences/$RESEND_PRE_LAUNCH_AUDIENCE_ID"
```

> ⚠️ Toujours exporter + vérifier l'import Brevo AVANT de supprimer l'audience Resend.
