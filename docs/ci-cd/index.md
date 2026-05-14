# Guides CI/CD — Tukio

Ces guides décrivent la configuration des outils externes consommés par le
pipeline CI/CD (Story 0.11). Chaque guide est autonome et peut être suivi
indépendamment, mais l'ordre ci-dessous correspond à la dépendance fonctionnelle.

## À lire avant

- [`AGENTS.md`](../../AGENTS.md) — convention monorepo et lien vers la story.
- [`.github/README.md`](../../.github/README.md) — récap des workflows + table des secrets.
- [`.github/CI_PIPELINE.md`](../../.github/CI_PIPELINE.md) — diagramme du pipeline + budgets perf.
- Story 0.11 : `_bmad-output/implementation-artifacts/0-11-ci-github-actions-pipeline.md`

## Ordre recommandé de setup

| Étape | Guide                                                                       | Durée  | Bloquant si absent                                            |
| ----- | --------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| 1     | [Codecov](./codecov.md)                                                     | 10 min | Coverage non bloquante (continue-on-error) — PR mergeable     |
| 2     | [Turborepo Remote Cache](./turborepo-remote-cache.md)                       | 10 min | Aucun — CI tourne sans, juste plus lente                      |
| 3     | [Lighthouse CI](./lighthouse-ci.md)                                         | 5 min  | Status checks Lighthouse manquants sur la PR                  |
| 4     | [Slack webhooks](./slack-webhooks.md)                                       | 15 min | Notifs deploy + chaos absentes — pas de notification          |
| 5     | [Branch protection](./branch-protection.md)                                 | 10 min | Merges directs possibles — VITAL                              |
| 6     | [Trivy / gestion des CVE](./trivy-cve-management.md) _(optionnel)_          | au cas par cas | Build images bloqué si CVE non patchable trouvée    |
| 7     | [ArgoCD](./argocd-deployment.md)                                            | Story 0.12 | Deploys staging/prod placeholders — pas de déploiement réel |

## Récap des secrets repo

Tous les secrets sont créés dans **GitHub → Settings → Secrets and variables → Actions → New repository secret**.

| Secret                        | Outil                | Story  | Guide                                                       |
| ----------------------------- | -------------------- | ------ | ----------------------------------------------------------- |
| `CODECOV_TOKEN`               | Codecov upload       | 0.11   | [codecov.md](./codecov.md)                                  |
| `TURBO_TOKEN`                 | Vercel Remote Cache  | 0.11   | [turborepo-remote-cache.md](./turborepo-remote-cache.md)    |
| `TURBO_TEAM`                  | Vercel Remote Cache  | 0.11   | [turborepo-remote-cache.md](./turborepo-remote-cache.md)    |
| `LHCI_GITHUB_APP_TOKEN`       | Lighthouse CI App    | 0.11   | [lighthouse-ci.md](./lighthouse-ci.md)                      |
| `SLACK_WEBHOOK_DEPLOYS`       | Slack staging        | 0.11   | [slack-webhooks.md](./slack-webhooks.md)                    |
| `SLACK_WEBHOOK_DEPLOYS_PROD`  | Slack prod           | 0.11   | [slack-webhooks.md](./slack-webhooks.md)                    |
| `SLACK_WEBHOOK_ALERTS`        | Slack chaos alerts   | 0.11   | [slack-webhooks.md](./slack-webhooks.md)                    |
| `ARGOCD_SERVER`               | ArgoCD endpoint      | 0.12   | [argocd-deployment.md](./argocd-deployment.md)              |
| `ARGOCD_STAGING_TOKEN`        | ArgoCD staging       | 0.12   | [argocd-deployment.md](./argocd-deployment.md)              |
| `ARGOCD_PRODUCTION_TOKEN`     | ArgoCD prod          | 0.12   | [argocd-deployment.md](./argocd-deployment.md)              |

## Checklist de vérification finale

Après tous les setups, sur la prochaine PR (re-run du workflow) :

- [ ] **CI success** check vert dans la PR (GitHub)
- [ ] **Codecov** commente la PR avec le delta de coverage
- [ ] **Lighthouse CI** poste 5 status checks (public-desktop/mobile + customer/seller/admin)
- [ ] **Turborepo Remote Cache** : log « Remote caching enabled » dans la step setup
- [ ] **Branch protection** bloque le merge si une check est rouge
- [ ] Au merge sur `develop` (puis main) : `build-images.yml` trigger → vérifier `ghcr.io/mohamedxi/tukio/identity-svc:<sha>` existe
- [ ] **Slack notif** arrive si tu trigger manuellement `deploy-staging.yml` (placeholder)
- [ ] **Trivy** ne bloque pas (ou les exceptions sont documentées dans `.trivyignore`)

## Maintenance et rotation

| Outil                   | Action de maintenance                            | Fréquence       |
| ----------------------- | ------------------------------------------------ | --------------- |
| Codecov                 | Vérifier le coverage trend dans le dashboard     | Hebdomadaire    |
| Turborepo               | Renouveler le token Vercel si expiré             | Tous les ans    |
| Lighthouse CI App       | Vérifier les Lighthouse scores trend             | Mensuel         |
| Slack webhooks          | Rotation si compromission                        | Annuel          |
| Branch protection rules | Audit + ajustement après chaque retro de Sprint  | Par Sprint      |
| Trivy `.trivyignore`    | Re-évaluer chaque entrée                         | Mensuel         |
| GHCR images             | Purger les anciennes images (>90 jours)          | Trimestriel     |

## Si tu rencontres un problème

1. Vérifier que le secret est bien créé et dans la bonne « scope » (repo secret, pas environment secret pour les workflows non-environment).
2. Re-run le workflow concerné via GitHub Actions UI → **Re-run all jobs**.
3. Vérifier les logs du workflow — chaque guide a une section « Troubleshooting ».
4. Si le problème persiste, ouvrir une issue avec le label `ci-cd` + lien vers le run failed.

## Voir aussi

- [`.agents/context/git-workflow.md`](../../.agents/context/git-workflow.md) — convention des branches et commits.
- [`.agents/context/testing.md`](../../.agents/context/testing.md) — Jest + Vitest + testcontainers.
- [`tools/eslint-plugin-tukio/README.md`](../../tools/eslint-plugin-tukio/README.md) — les 12 règles lint custom.
