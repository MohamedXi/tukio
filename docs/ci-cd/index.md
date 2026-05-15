# Guides CI/CD — Tukio

Ces guides décrivent la configuration des outils externes consommés par le
pipeline CI/CD (Story 0.11). Chaque guide est autonome et peut être suivi
indépendamment, mais l'ordre ci-dessous correspond à la dépendance fonctionnelle.

## À lire avant

- [`AGENTS.md`](../../AGENTS.md) — convention monorepo et lien vers la story.
- [`.github/README.md`](../../.github/README.md) — récap des workflows + table des secrets.
- [`.github/CI_PIPELINE.md`](../../.github/CI_PIPELINE.md) — diagramme du pipeline + budgets perf.
- Story 0.11 : `_bmad-output/implementation-artifacts/0-11-ci-github-actions-pipeline.md`

## Ordre recommandé de setup (MVP — €15-50/mois)

| Étape | Guide                                                                       | Durée  | Bloquant si absent                                            |
| ----- | --------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| 1     | [Lighthouse CI](./lighthouse-ci.md)                                         | 5 min  | Status checks Lighthouse manquants sur la PR                  |
| 2     | [Slack webhooks](./slack-webhooks.md)                                       | 15 min | Notifs deploy + chaos absentes — pas de notification          |
| 3     | [Branch protection](./branch-protection.md)                                 | 10 min | Merges directs possibles — VITAL                              |
| 4     | [Trivy / gestion des CVE](./trivy-cve-management.md) _(optionnel)_          | au cas par cas | Build images bloqué si CVE non patchable trouvée    |
| 5     | [DigitalOcean deployment](./digitalocean-deployment.md)                     | Story 0.12 — ~3h | Pas de déploiement réel — workflows en attente des secrets DO |
| 6     | [Disaster recovery](./disaster-recovery.md)                                 | Story 0.12 — référence ops | Runbooks DR à exécuter quand incident |

## Outils différés (V1+ — coût)

| Guide                                                       | Raison                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| [Codecov](./codecov.md)                                     | Free tier privé 250 uploads/mois insuffisant — coverage en GHA artifact pour MVP |
| [Turborepo Remote Cache](./turborepo-remote-cache.md)       | Vercel free tier 1 user — GHA cache local suffit MVP            |

## Récap des secrets repo (MVP)

Tous les secrets sont créés dans **GitHub → Settings → Secrets and variables → Actions → New repository secret**.

| Secret                        | Outil                  | Story  | Guide                                                       |
| ----------------------------- | ---------------------- | ------ | ----------------------------------------------------------- |
| `LHCI_GITHUB_APP_TOKEN`       | Lighthouse CI App      | 0.11   | [lighthouse-ci.md](./lighthouse-ci.md)                      |
| `SLACK_WEBHOOK_DEPLOYS`       | Slack staging          | 0.11   | [slack-webhooks.md](./slack-webhooks.md)                    |
| `SLACK_WEBHOOK_DEPLOYS_PROD`  | Slack prod             | 0.11   | [slack-webhooks.md](./slack-webhooks.md)                    |
| `SLACK_WEBHOOK_ALERTS`        | Slack chaos alerts     | 0.11   | [slack-webhooks.md](./slack-webhooks.md)                    |
| `DO_DEPLOY_KEY`               | SSH key DO droplet     | 0.12   | [digitalocean-deployment.md](./digitalocean-deployment.md)  |
| `DO_HOST_APPS`                | IP publique droplet `tukio-apps` | 0.12 | [digitalocean-deployment.md](./digitalocean-deployment.md)  |

## Budget MVP cible

Le pipeline + l'infra Tukio MVP doit tenir sous **€50/mois total**. Le détail :

| Poste                                   | Coût MVP                  | Détail                                                |
| --------------------------------------- | ------------------------- | ----------------------------------------------------- |
| **Hébergement** (DO Droplets Option B)  | €24/mois                  | 2 droplets (`tukio-apps` + `tukio-data`), 2 GB chacun |
| **Snapshots DO** (rétention 3j)         | ~€9/mois                  | 2 droplets × 3 snapshots × 25 GB × $0.06              |
| **Domain `tukio.one`** (Squarespace)    | ~€1/mois                  | facturé annuel (DNS gratuit dans le pricing domain)   |
| **GitHub Actions** (CI)                 | gratuit                   | 2000 min/mois free tier                               |
| **GHCR** (Docker images)                | gratuit                   | repos privés free tier                                |
| **Cloudflare R2** (storage)             | gratuit                   | 10 GB free — utilisé pour backups Postgres + R2 media |
| **Resend** (transactional email)        | gratuit                   | 3000 emails/mois free tier                            |
| **Stripe Connect**                      | commission only           | pas de frais mensuels                                 |
| **Slack workspace** (free)              | gratuit                   | webhooks illimités                                    |
| **Lighthouse CI App**                   | gratuit                   | illimité                                              |
| **Trivy** + **Dependabot**              | gratuit                   | OSS / GitHub native                                   |
| **Total estimé**                        | **€34/mois**              | Sous l'enveloppe €50/mois cible                       |

**Outils différés** (cf. table ci-dessus) :

- Codecov SaaS — coverage stockée en GHA artifact 14j, suffit MVP
- Vercel Turbo Cache — GHA cache local suffit MVP
- Meilisearch Cloud ($30/mois) — self-hosté sur droplet
- DO Managed Kubernetes — docker-compose suffit MVP

## Checklist de vérification finale

Après tous les setups, sur la prochaine PR (re-run du workflow) :

- [ ] **CI success** check vert dans la PR (GitHub)
- [ ] **Coverage artifact** uploadé (vérifier dans l'onglet **Artifacts** du run)
- [ ] **Lighthouse CI** poste 5 status checks (public-desktop/mobile + customer/seller/admin)
- [ ] **Branch protection** bloque le merge si une check est rouge
- [ ] Au merge sur `develop` (puis main) : `build-images.yml` trigger → vérifier `ghcr.io/mohamedxi/tukio/identity-svc:<sha>` existe
- [ ] **Slack notif** arrive si tu trigger manuellement `deploy-staging.yml` (placeholder)
- [ ] **Trivy** ne bloque pas (ou les exceptions sont documentées dans `.trivyignore`)

## Maintenance et rotation

| Outil                   | Action de maintenance                            | Fréquence       |
| ----------------------- | ------------------------------------------------ | --------------- |
| Lighthouse CI App       | Vérifier les Lighthouse scores trend             | Mensuel         |
| Slack webhooks          | Rotation si compromission                        | Annuel          |
| Branch protection rules | Audit + ajustement après chaque retro de Sprint  | Par Sprint      |
| Trivy `.trivyignore`    | Re-évaluer chaque entrée                         | Mensuel         |
| GHCR images             | Purger les anciennes images (>90 jours)          | Trimestriel     |
| DO droplet              | Snapshot + check kernel updates                  | Mensuel         |

## Si tu rencontres un problème

1. Vérifier que le secret est bien créé et dans la bonne « scope » (repo secret, pas environment secret pour les workflows non-environment).
2. Re-run le workflow concerné via GitHub Actions UI → **Re-run all jobs**.
3. Vérifier les logs du workflow — chaque guide a une section « Troubleshooting ».
4. Si le problème persiste, ouvrir une issue avec le label `ci-cd` + lien vers le run failed.

## Voir aussi

- [`.agents/context/git-workflow.md`](../../.agents/context/git-workflow.md) — convention des branches et commits.
- [`.agents/context/testing.md`](../../.agents/context/testing.md) — Jest + Vitest + testcontainers.
- [`tools/eslint-plugin-tukio/README.md`](../../tools/eslint-plugin-tukio/README.md) — les 12 règles lint custom.
