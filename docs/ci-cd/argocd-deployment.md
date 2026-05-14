# ArgoCD — Configuration et setup (Story 0.12)

> ⚠️ **Statut** : ce guide concerne **Story 0.12** (Helm charts + K8s + ArgoCD + observability), pas Story 0.11. Les workflows `deploy-staging.yml` et `deploy-production.yml` créés en Story 0.11 sont des **placeholders** qui dégradent gracieusement quand les secrets ArgoCD sont absents.

**Outil** : [ArgoCD](https://argo-cd.readthedocs.io/) — GitOps continuous delivery pour Kubernetes.

**Workflows consommateurs** :

- `deploy-staging.yml` — sync `tukio-staging` au merge `main` après `build-images.yml` success.
- `deploy-production.yml` — sync `tukio-production` sur tag `v*` avec manual approval GitHub Environment.

**Statut bloquant Story 0.11** : 🟢 **Non bloquant** — workflows skip silencieusement si `ARGOCD_*_TOKEN` absent.

---

## Pourquoi (Story 0.12)

Sans ArgoCD :

- Les 10 images Docker buildées dans `ghcr.io` ne sont pas auto-déployées sur le cluster K8s.
- Pas de drift detection (le cluster peut diverger des manifests Git).
- Rollback manuel via `kubectl` → friction + risque erreur humaine.

Avec ArgoCD :

- **GitOps** : le cluster reflète exactement les manifests dans `infra/k8s/`.
- **Auto-sync** : push sur `main` → ArgoCD pull → applique sur le cluster.
- **Self-healing** : `kubectl delete pod` n'a aucun effet — ArgoCD re-crée.
- **Rollback en 1 click** dans l'UI ArgoCD.

---

## Architecture cible (Story 0.12)

```
                                  GitHub repo
                                       │
                                       │ (manifest changes)
                                       ▼
                                  ┌─────────┐
                                  │ ArgoCD  │
                                  │ (poll)  │
                                  └────┬────┘
                                       │ sync
                       ┌───────────────┼───────────────┐
                       │               │               │
                  ┌────▼─────┐    ┌────▼─────┐    ┌────▼─────┐
                  │ Hetzner  │    │ Hetzner  │    │ Hetzner  │
                  │ k8s prod │    │ k8s stag │    │ ArgoCD ns│
                  │ tukio-*  │    │ tukio-*  │    │ argocd-* │
                  └──────────┘    └──────────┘    └──────────┘
```

ArgoCD est installé sur un cluster dédié (ou sur le staging cluster avec un namespace isolé).

---

## Pré-requis (Story 0.12)

1. **Cluster Kubernetes** opérationnel (Hetzner Cloud K3s recommandé, 3 nodes minimum).
2. **DNS** : `argocd.tukio.one`, `staging.tukio.one`, `tukio.one` pointant vers Cloudflare → Cluster.
3. **TLS** : cert-manager + Let's Encrypt sur le cluster.
4. **GHCR pull secret** sur le cluster : `kubectl create secret docker-registry ghcr-pull --docker-server=ghcr.io --docker-username=<github-user> --docker-password=<PAT>`.
5. **Helm charts** dans `infra/helm/` (Story 0.12).

---

## Étapes (Story 0.12)

### 1. Installer ArgoCD sur le cluster

```sh
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Attendre que tous les pods soient `Running` :

```sh
kubectl get pods -n argocd
```

### 2. Exposer ArgoCD

Via Ingress + cert-manager (recommandé) :

```yaml
# infra/k8s/argocd-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server
  namespace: argocd
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-passthrough: "true"
    nginx.ingress.kubernetes.io/backend-protocol: HTTPS
spec:
  ingressClassName: nginx
  tls:
  - hosts: [argocd.tukio.one]
    secretName: argocd-tls
  rules:
  - host: argocd.tukio.one
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 443
```

### 3. Récupérer le mot de passe admin initial

```sh
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

Connexion : https://argocd.tukio.one — user `admin`, ce mot de passe.

**Action immédiate** : changer le mot de passe via UI ou :

```sh
argocd account update-password
```

### 4. Créer un compte service `ci`

ArgoCD a une notion de comptes locaux + RBAC.

```sh
argocd login argocd.tukio.one
argocd account list

# Créer le compte (édition du configmap argocd-cm) :
kubectl edit configmap argocd-cm -n argocd
```

Ajouter :

```yaml
data:
  accounts.ci: apiKey
```

Puis :

```sh
# Générer un token API pour le compte ci
argocd account generate-token --account ci
# → outputs un JWT
```

### 5. RBAC : permissions du compte `ci`

```sh
kubectl edit configmap argocd-rbac-cm -n argocd
```

Ajouter :

```yaml
data:
  policy.csv: |
    p, role:ci, applications, sync, tukio-staging, allow
    p, role:ci, applications, sync, tukio-production, allow
    p, role:ci, applications, action/*, *, allow
    g, ci, role:ci
```

### 6. Configurer les Applications ArgoCD

Une `Application` par environnement.

#### `argo-staging-app.yaml`

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tukio-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/MohamedXi/tukio.git
    targetRevision: develop
    path: infra/helm/tukio
    helm:
      valueFiles:
      - values-staging.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: tukio-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

#### `argo-production-app.yaml`

Idem mais :

```yaml
spec:
  source:
    targetRevision: main  # tags v* via auto-resolution
    helm:
      valueFiles:
      - values-production.yaml
  destination:
    namespace: tukio-production
  syncPolicy:
    automated: {}  # NO automated — sync manuel pour prod
```

Apply :

```sh
kubectl apply -f infra/k8s/argo-staging-app.yaml
kubectl apply -f infra/k8s/argo-production-app.yaml
```

### 7. Ajouter les secrets GitHub

GitHub → repo → Settings → Secrets and variables → Actions :

| Secret                        | Value                                         |
| ----------------------------- | --------------------------------------------- |
| `ARGOCD_SERVER`               | `argocd.tukio.one`                            |
| `ARGOCD_STAGING_TOKEN`        | JWT du compte `ci` (step 4)                   |
| `ARGOCD_PRODUCTION_TOKEN`     | JWT du compte `ci-prod` (idem step 4-5 prod)  |

### 8. Vérifier le pipeline

Trigger manuellement :

```sh
gh workflow run deploy-staging.yml
```

Logs du job ArgoCD sync :

```
::notice::Placeholder mode — Story 0.12 wires the real ArgoCD sync.
```

→ si le secret est config, la step `Trigger ArgoCD sync` curl POST `/api/v1/applications/tukio-staging/sync`.

---

## GitHub Environment `production`

Pour le manual approval avant déploiement prod :

1. GitHub → repo → Settings → Environments → **New environment** : `production`
2. **Required reviewers** : tech-lead + admins (1 approval requis)
3. **Wait timer** : 0 min (ou 5 min pour buffer)
4. **Deployment branches** : `main` only (pas de deploy depuis feature branches)
5. **Environment secrets** (optionnel — sinon hérité du repo) :
   - `ARGOCD_PRODUCTION_TOKEN`

Le workflow `deploy-production.yml` a déjà `environment: production` — il pause automatiquement et attend l'approval avant de tourner.

---

## Rollback prod

Le workflow contient un placeholder :

```yaml
- name: Rollback on failure (placeholder — Story 0.12 implements the body)
  if: failure() && env.ARGOCD_PRODUCTION_TOKEN != ''
  run: |
    echo "::warning::Rollback placeholder — Story 0.12 implements the rollback request body."
    exit 0
```

L'API ArgoCD `/rollback` requiert un JSON body :

```json
{
  "id": 12  // history-id de la version précédente
}
```

Pour récupérer le history-id :

```sh
argocd app history tukio-production
# ID  DATE                  REVISION
# 13  2026-05-14T10:23:00Z  feat: ...
# 12  2026-05-13T15:10:00Z  fix: ...
```

L'implémentation Story 0.12 doit :

1. `curl GET /api/v1/applications/tukio-production` → `.status.history` → identifier la version pré-deploy.
2. `curl POST /rollback` avec ce `id`.

---

## Monitoring + observability (Story 0.12)

À installer en parallèle :

- **Prometheus** + Grafana (cluster-side).
- **Sentry** (app-side, déjà câblé en Story 0.6).
- ArgoCD a son propre dashboard métriques + alertes via Prometheus.

Alertes Slack/PagerDuty quand un sync ArgoCD fail (`syncResult.status: Failed`).

---

## Troubleshooting (Story 0.12)

### `argocd app sync` retourne 401

- Token expiré (par défaut 24h en JWT) → régénérer avec `argocd account generate-token`.
- Account pas dans le RBAC → vérifier `argocd-rbac-cm`.

### Sync échoue avec « image not found »

- L'image n'a pas été pushée par `build-images.yml` → vérifier `ghcr.io/mohamedxi/tukio/<svc>:<sha>` existe.
- Le pull secret `ghcr-pull` n'est pas dans le namespace → re-créer.

### Sync fait infinitement « out of sync »

- L'Application a `selfHeal: true` mais une drift impossible à résoudre (ex. ressource managée par un autre Operator).
- Désactiver `selfHeal` temporairement et investiguer.

---

## Documentation officielle (Story 0.12)

- ArgoCD : https://argo-cd.readthedocs.io/
- ArgoCD GitHub : https://github.com/argoproj/argo-cd
- Hetzner K3s : https://community.hetzner.com/tutorials/install-kubernetes-cluster
- Helm charts pattern : https://helm.sh/docs/chart_template_guide/

## Voir aussi

- [`trivy-cve-management.md`](./trivy-cve-management.md) — étape précédente.
- [`index.md`](./index.md) — retour à l'index.
- Story 0.12 : `_bmad-output/implementation-artifacts/0-12-helm-charts-k8s-argocd-staging-observability.md`
