# Story 0.12: Helm charts K8s + ArgoCD staging deployment + observability stack

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** DevOps / tech lead (équipe Sprint 0),
**I want** **3 Helm charts** pour les unités de déploiement MVP (`core-api` regroupant gateway + identity + catalog + booking + order + payment, `workers` regroupant messaging + review + notification + media, `nats-cluster` avec NATS JetStream R3 replicas) avec `values-{dev,staging,production}.yaml` par chart, **ArgoCD GitOps** configuré avec 2 Applications (`tukio-staging`, `tukio-production`) qui sync depuis `infra/k8s/argocd/applications/`, **NetworkPolicy strict deny-all + whitelist** par namespace, **HPA + PDB** sur tous les Deployments (NFR84), **Terraform Hetzner** qui provisionne le cluster K8s + namespaces + ArgoCD bootstrap, **Stack observability complète** (OpenTelemetry SDK auto-instrumented dans les 10 services + Prometheus scraping `/metrics` + Tempo pour traces + Loki pour logs structurés Pino + Grafana Cloud dashboards + Alertmanager → Slack `#tukio-alerts`), **Neon Postgres** wired avec WAL archiving (RPO < 5 min, RTO < 1 h — NFR44), **Cloudflare R2 buckets** server-side encryption (NFR15) + versioning 15 jours, **secrets** via Doppler Operator K8s,
**so that** chaque merge sur `main` déploie automatiquement en staging Hetzner avec zero-downtime (rolling updates + healthchecks), monitoring complet visible dans Grafana Cloud (saga booking-payment trace bout-en-bout via correlationId Story 0.7, lag NATS dashboard, latency p95 par endpoint, error rate 5xx, CWV `apps/public`), alertes Slack temps réel sur saga > 5 min (R11), NATS lag > 1000 (R12), outbox pending > 100 (R13), 5xx > 1 % sur 5 min, et Story 0.11 (`deploy-staging.yml` + `deploy-production.yml` placeholders) finalise son trigger ArgoCD réel via webhook.

> **Outcome attendu** : à la fin de cette story, `git push main` (post-Story 0.11 build-images) déclenche `deploy-staging.yml` workflow qui call `argocd app sync tukio-staging` → ArgoCD pull les nouvelles images Docker depuis `ghcr.io` et update les 10 Deployments en rolling. < 5 minutes plus tard, `https://staging.tukio.one/health` retourne 200, Grafana Cloud dashboard "Tukio Staging Overview" montre p95 latency < 200ms, error rate 0 %, NATS lag 0 msg. Un `pnpm test:smoke:staging` (Story Epic 1+) passe les parcours critiques. Tag `v0.0.1-rc1` sur main → approval Slack manuel → `argocd app sync tukio-production` (avec rollback automatique si healthcheck post-deploy fail dans 5 min).

## Acceptance Criteria

1. **AC1 — `infra/k8s/helm-charts/` 3 charts complets** : Given `infra/k8s/helm-charts/`, When je l'ouvre, Then je trouve **exactement 3 charts** avec structure Helm standard :
   ```
   infra/k8s/helm-charts/
   ├─ core-api/                                      # gateway + identity + catalog + booking + order + payment (6 services)
   │  ├─ Chart.yaml                                  # apiVersion: v2, name: core-api, version: 0.1.0, appVersion: "0.0.1"
   │  ├─ values.yaml                                 # defaults communs aux 3 envs
   │  ├─ values-dev.yaml                             # overrides dev (1 replica, no HPA, low resources)
   │  ├─ values-staging.yaml                         # overrides staging (2 replicas, HPA min=2 max=5, prod-like resources)
   │  ├─ values-production.yaml                      # overrides prod (3 replicas, HPA min=3 max=20, full resources)
   │  ├─ templates/
   │  │  ├─ _helpers.tpl                             # template helpers (labels communs, fullname pattern)
   │  │  ├─ namespace.yaml                           # tukio-staging / tukio-production namespace
   │  │  ├─ <service>/                               # × 6 services (gateway-api, identity-svc, catalog-svc, booking-svc, order-svc, payment-svc)
   │  │  │  ├─ deployment.yaml                       # Deployment avec replicas, resources, env vars, healthchecks
   │  │  │  ├─ service.yaml                          # ClusterIP service exposant /health /ready /metrics
   │  │  │  ├─ hpa.yaml                              # HorizontalPodAutoscaler CPU 70% + RPS-based (NFR38)
   │  │  │  ├─ pdb.yaml                              # PodDisruptionBudget minAvailable: 1 (NFR84)
   │  │  │  ├─ networkpolicy.yaml                    # deny-all + whitelist explicite par service
   │  │  │  ├─ servicemonitor.yaml                   # Prometheus ServiceMonitor (scrape /metrics)
   │  │  │  └─ secret.yaml                           # Doppler ExternalSecret reference (rendered par Doppler Operator)
   │  │  └─ ingress.yaml                             # Ingress public uniquement pour gateway-api (cohérent ADR-008)
   │  └─ README.md
   ├─ workers/                                       # messaging + review + notification + media (4 services)
   │  ├─ Chart.yaml, values.yaml, values-{dev,staging,production}.yaml
   │  ├─ templates/
   │  │  ├─ _helpers.tpl, namespace.yaml
   │  │  ├─ <service>/{deployment,service,hpa,pdb,networkpolicy,servicemonitor,secret}.yaml × 4 services
   │  │  └─ NB : pas d'Ingress (workers ne sont jamais exposés public)
   │  └─ README.md
   └─ nats-cluster/                                  # NATS JetStream R3 replicas
      ├─ Chart.yaml (dépend de chart upstream `nats` v8.x du repo bitnami ou nats-io officiel)
      ├─ values.yaml, values-{dev,staging,production}.yaml
      ├─ templates/
      │  ├─ namespace.yaml (tukio-nats)
      │  ├─ statefulset.yaml                         # NATS StatefulSet 3 replicas (R3 NFR40), persistent volumes
      │  ├─ service.yaml                             # ClusterIP exposing :4222 (clients), :8222 (monitoring)
      │  ├─ networkpolicy.yaml                       # whitelist: services backend cross-namespace
      │  ├─ pdb.yaml                                 # minAvailable: 2/3 (R3 quorum maintenu)
      │  ├─ servicemonitor.yaml                      # scrape NATS prometheus exporter :8222/metrics
      │  └─ dlq-stream.yaml                          # CronJob OneShot qui crée le DLQ stream `tukio.dlq` au boot
      └─ README.md
   ```

2. **AC2 — `Chart.yaml` + `values.yaml` patterns Helm cohérents** : Given chaque `Chart.yaml`, When je l'ouvre, Then :
   - `apiVersion: v2`, `name: <chart>`, `version: 0.1.0` (SemVer chart, bump indépendant du `appVersion`), `appVersion: "0.0.1"` (matche `git tag` Tukio), `description: "Tukio.one <chart> deployment"`, `type: application`
   - **`values.yaml` defaults** comportent les sections :
     - `image: { registry: 'ghcr.io/<org>', repository: 'tukio/<service>', tag: 'latest', pullPolicy: 'Always' }` (override par service via `values-<env>.yaml` pour pin SHA)
     - `replicas: 2` (default staging-equivalent), override par env
     - `resources: { requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '1000m', memory: '512Mi' } }` (defaults conservateurs, override par env)
     - `env: []` (env vars communes, append par env values)
     - `healthcheck: { path: '/health', initialDelaySeconds: 10, periodSeconds: 10, timeoutSeconds: 5, failureThreshold: 3 }`
     - `readiness: { path: '/ready', initialDelaySeconds: 5, periodSeconds: 5, timeoutSeconds: 5, failureThreshold: 3 }`
     - `metrics: { enabled: true, path: '/metrics', port: 9090 }` (Prometheus scrape config)
     - `hpa: { enabled: true, minReplicas: 2, maxReplicas: 10, targetCPUUtilizationPercentage: 70, targetRPS: 100 }`
     - `pdb: { enabled: true, minAvailable: 1 }`
     - `networkPolicy: { enabled: true, ingressNamespaces: ['tukio-staging'], denyAll: true }`
     - `serviceAccount: { create: true, name: '<service>-sa' }` (pour IAM/RBAC future V1+)
     - `secrets: { dopplerProject: 'tukio', dopplerConfig: 'staging', externalSecretName: '<service>-doppler' }`
   - **`values-dev.yaml`** (rare — dev est sur Docker Compose, mais utile pour tests cluster minikube/kind) : 1 replica, pas de HPA, resources minimal `cpu: 50m memory: 128Mi`
   - **`values-staging.yaml`** : `image.tag: '{{ .Chart.AppVersion }}'` (sync Chart.AppVersion), 2 replicas, HPA min=2 max=5, resources mid (cpu: 200m, memory: 384Mi)
   - **`values-production.yaml`** : 3 replicas, HPA min=3 max=20 (saisonnalité NFR38 `3× pic mai-sept`), resources prod (cpu: 500m, memory: 768Mi), `pullPolicy: 'IfNotPresent'` (immutable tags par SHA)

3. **AC3 — Deployment template avec healthchecks + env vars + resources + labels standardisés** : Given `templates/<service>/deployment.yaml`, When je l'ouvre, Then je trouve un template Helm complet :
   - `apiVersion: apps/v1`, `kind: Deployment`, `metadata.name: {{ .Release.Name }}-<service>`
   - **Labels standardisés** (pour Prometheus scrape + Grafana filtrage + ArgoCD tracking) : `app.kubernetes.io/name: <service>`, `app.kubernetes.io/instance: {{ .Release.Name }}`, `app.kubernetes.io/version: {{ .Chart.AppVersion }}`, `app.kubernetes.io/component: backend`, `app.kubernetes.io/part-of: tukio`, `tukio.one/service: <service>`, `tukio.one/deployment-unit: core-api` (ou `workers`, `nats`)
   - **Spec.template** :
     - `metadata.annotations.prometheus.io/scrape: "true"`, `prometheus.io/path: "/metrics"`, `prometheus.io/port: "9090"` (alternative aux ServiceMonitor pour scrape simple)
     - `spec.containers[0]` :
       - `image: "{{ .Values.image.registry }}/{{ .Values.image.repository }}-<service>:{{ .Values.image.tag }}"`
       - `imagePullPolicy: {{ .Values.image.pullPolicy }}`
       - `ports: [{ containerPort: 4001, name: http }, { containerPort: 9090, name: metrics }]` (port adapté par service)
       - `env` : merge `.Values.env.global` + `.Values.env.<service>` + secrets ExternalSecret refs (KEYCLOAK_URL, NATS_URL, DB_HOST=neon.tech, etc.)
       - **`livenessProbe`** : HTTP GET `/health` avec config `.Values.healthcheck`
       - **`readinessProbe`** : HTTP GET `/ready` avec config `.Values.readiness`
       - **`startupProbe`** (recommandé NestJS qui boot 5-10s) : HTTP GET `/health`, `failureThreshold: 30`, `periodSeconds: 5` (laisse 150s au boot avant d'être considéré dead)
       - **`resources`** : depuis `.Values.resources`
       - **`securityContext`** : `runAsNonRoot: true`, `runAsUser: 1001`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false` (conformité hardening K8s)
     - **`affinity`** : `podAntiAffinity` soft preference pour répartir les replicas sur différents nodes (HA)

4. **AC4 — `infra/k8s/argocd/applications/` 2 Applications (staging + production)** : Given `infra/k8s/argocd/applications/`, When je l'ouvre, Then je trouve **2 Applications ArgoCD** :
   - **`tukio-staging.yaml`** :
     ```yaml
     apiVersion: argoproj.io/v1alpha1
     kind: Application
     metadata:
       name: tukio-staging
       namespace: argocd
       finalizers: ['resources-finalizer.argocd.argoproj.io']
     spec:
       project: default
       sources:
         - repoURL: https://github.com/<org>/tukio
           targetRevision: main
           path: infra/k8s/helm-charts/core-api
           helm:
             valueFiles: ['values-staging.yaml']
         - repoURL: https://github.com/<org>/tukio
           targetRevision: main
           path: infra/k8s/helm-charts/workers
           helm: { valueFiles: ['values-staging.yaml'] }
         - repoURL: https://github.com/<org>/tukio
           targetRevision: main
           path: infra/k8s/helm-charts/nats-cluster
           helm: { valueFiles: ['values-staging.yaml'] }
       destination:
         server: https://kubernetes.default.svc
         namespace: tukio-staging
       syncPolicy:
         automated:
           prune: true
           selfHeal: true
         syncOptions:
           - CreateNamespace=true
           - PrunePropagationPolicy=foreground
           - PruneLast=true
         retry:
           limit: 5
           backoff: { duration: 5s, factor: 2, maxDuration: 3m }
     ```
   - **`tukio-production.yaml`** : idem mais `targetRevision: main` reste mais **`syncPolicy.automated: false`** (sync manuel uniquement), `valueFiles: ['values-production.yaml']`, `destination.namespace: tukio-production`
   - **NB** : ArgoCD Multi-source apps (3 sources Helm dans 1 Application) supporté depuis v2.6+
   - **Webhook GitHub** : ArgoCD écoute le webhook GitHub `push main` → trigger immédiat sync staging (sans attendre poll 3 min)
   - **AppProject `tukio`** : créer un AppProject dédié avec restrictions namespace + repo whitelist (security best practice ArgoCD)

5. **AC5 — Terraform Hetzner Cluster + ArgoCD bootstrap** : Given `infra/terraform/`, When je l'ouvre, Then je trouve la config Terraform qui provisionne :
   - **Hetzner Cloud K8s** : 1 cluster K8s `tukio-staging` (3 nodes type `cx21` 2vCPU/4GB pour MVP, scaling V1+) via provider `hetznerhcloud/hcloud` ou `hetznercloud/hcloud-cli` selon ce qui supporte cluster managé
   - **Cilium ou Flannel CNI** : networking cluster (cohérent NetworkPolicy)
   - **Ingress NGINX** : install via Helm chart `ingress-nginx/ingress-nginx`
   - **cert-manager** : install pour Let's Encrypt automatique (Story Epic 1+ wire HTTPS sur les apps publiques)
   - **ArgoCD bootstrap** : install via Helm chart `argo/argo-cd` v7.x latest, expose via Ingress sur `argocd.staging.tukio.one`, admin password généré + stocké dans Doppler
   - **Doppler Operator** : install via Helm chart `doppler/doppler-kubernetes-operator` pour ExternalSecrets sync
   - **Prometheus stack** : install via `prometheus-community/kube-prometheus-stack` (inclut Prometheus + Alertmanager + Grafana, Grafana est désactivé car Grafana Cloud)
   - **Loki agent** : install via `grafana/loki` chart en mode SimpleScalable, push vers Grafana Cloud Loki endpoint via remoteWrite
   - **OpenTelemetry Collector** : install via `open-telemetry/opentelemetry-collector` chart, reçoit traces des services NestJS (port 4318 OTLP HTTP), forward vers Grafana Cloud Tempo
   - **Sources Terraform** :
     - `infra/terraform/main.tf` (provider Hetzner + variables)
     - `infra/terraform/cluster.tf` (cluster + nodes + CNI)
     - `infra/terraform/argocd.tf` (Helm release ArgoCD + bootstrap Application)
     - `infra/terraform/observability.tf` (Prometheus + Loki + OTel collector + Grafana Cloud secrets via Doppler)
     - `infra/terraform/network.tf` (LoadBalancer + DNS records)
     - `infra/terraform/variables.tf`
     - `infra/terraform/outputs.tf` (kubeconfig, ArgoCD URL, etc.)
     - `infra/terraform/README.md` (setup Hetzner API token + Doppler login + `terraform init/plan/apply`)
   - **State backend** : Terraform Cloud ou S3-compatible (Cloudflare R2) pour state shared (V1+ team)

6. **AC6 — Stack observability OpenTelemetry câblée dans les 10 services** : Given `apps/<service>/src/main.ts` + nouveau `apps/<service>/src/infrastructure/observability/`, When je vérifie l'auto-instrumentation, Then :
   - **`@tukio/observability` lib partagée** créée dans `packages/observability/` (nouveau package — non listé Architecture mais nécessaire pour DRY) :
     - `tracing.ts` : init OpenTelemetry SDK avec auto-instrumentations NestJS + HTTP + PG + NATS, exporter OTLP HTTP vers `OTEL_EXPORTER_OTLP_ENDPOINT` env var (= OTel Collector cluster)
     - `metrics.ts` : init Prometheus exporter via `prom-client` (déjà utilisé Story 0.7 OutboxRelayService), expose `/metrics` endpoint (cohérent NFR84)
     - `correlation-attribute.ts` : helper qui ajoute `correlation_id` attribute sur tous les spans (depuis `correlationContext` Story 0.7)
     - `index.ts` : export `setupObservability(app: NestApplication)` qui wire tout en 1 appel
   - **Branchement dans `main.ts` de chaque service** :
     ```ts
     import { setupObservability } from '@tukio/observability';
     async function bootstrap() {
       const app = await NestFactory.create(...);
       await setupObservability(app, { serviceName: 'identity-svc' });
       // ... reste du bootstrap
     }
     ```
   - **Métriques custom Tukio** déjà exposées via `prom-client` (Stories 0.7 OutboxRelayService + Story 0.8 JwksCacheService) — Story 0.12 les agrège dans le `/metrics` endpoint global
   - **Traces propagées via correlationId** : OTel ajoute `correlation_id` attribute sur chaque span (cohérent Story 0.7 AsyncLocalStorage)
   - **Sampling** : 100 % en staging, 10 % en production (réduit cost Grafana Cloud Tempo) — config via env var `OTEL_TRACES_SAMPLER_ARG`

7. **AC7 — Loki agent push logs structurés Pino** : Given chaque service backend, When il log via Pino (Story 0.6), Then les logs JSON sont collectés par Loki agent + indexés par labels `service`, `environment`, `correlation_id`, `level` :
   - **Pino transport** : ajouter `pino-loki` ou pattern stdout → Loki agent (DaemonSet K8s qui collect les logs containers stdout par défaut, transformation via Promtail config)
   - **Promtail config** : extraire labels structurés depuis JSON (`level`, `service`, `version`, `correlationId`) via JSON parsing pipeline stage
   - **PII redaction côté Pino** (déjà Story 0.6 `pino-logger.service.ts` avec `redact` paths) — vérifier toujours actif en prod
   - **Rétention** : 30 jours hot (Grafana Cloud Loki standard tier), 90 jours cold (S3-compatible R2 — Architecture ligne 1022)

8. **AC8 — Grafana Cloud dashboards (3 dashboards minimum)** : Given Grafana Cloud account configuré (manuel — Doppler stocke les API keys), When j'ouvre Grafana, Then 3 dashboards Tukio standards sont importés via Terraform (`grafana_dashboard` resource) :
   - **`Tukio Overview`** : RPS par service, latency p50/p95/p99 par endpoint, error rate 5xx, NATS lag, outbox pending lag, saga duration p95 (R11), DB connections active
   - **`Saga Booking-Payment Trace`** (Story 4.13 V1 raffine) : timeline visuelle correlationId → spans booking-svc → order-svc → payment-svc, alerte si > 5 min
   - **`Apps Public CWV`** : LCP/INP/CLS par page (consommé depuis `web-vitals` API frontend via Plausible custom events Story 7.4 OU via Grafana Faro V1+) — placeholder MVP avec données Lighthouse CI
   - **JSON dashboards versionnés** dans `infra/k8s/grafana-dashboards/{tukio-overview,saga-booking-payment,apps-public-cwv}.json` (export Grafana UI + commit Git)

9. **AC9 — Alertmanager rules + Slack `#tukio-alerts`** : Given `infra/k8s/observability/alertmanager-rules.yaml`, When je l'ouvre, Then je trouve les **6 alertes critiques** (cohérent Architecture ligne 1028-1035) :
   - **Saga > 5 min** (R11 critique) : query `histogram_quantile(0.95, tukio_booking_svc_saga_duration_seconds_bucket) > 300` → Slack channel `#tukio-alerts` avec lien Grafana trace
   - **NATS lag > 1000 msg** (R12) : query `tukio_nats_consumer_lag_messages > 1000` for 1min → Slack
   - **Outbox pending > 100 msg / > 1 min** (R13) : query `tukio_outbox_pending_lag_messages > 100` for 1min → Slack
   - **Gateway-api availability < 99.5 %** (NFR39) : query `up{service="gateway-api"} avg over 5min < 0.995` → Slack + escalation Email
   - **5xx > 1 % sur 5 min** : query `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01` → Slack
   - **Lighthouse CWV régression > 10 %** (RA1 SEO) : alerte basée sur métrique custom poussée par CI Lighthouse (Story 0.11) → Slack
   - **Slack webhook URL** stockée dans Doppler `tukio/observability/slack_webhook`
   - **Alertmanager grouping** : group by `alertname` + `service` (évite spam si plusieurs replicas du même service alertent)

10. **AC10 — Neon Postgres connecté + WAL archiving** : Given Terraform + Doppler, When je provisionne Neon, Then :
    - **Compte Neon** créé (manuel — Doppler stocke API key)
    - **Project `tukio-staging`** + **`tukio-production`** créés via Neon API (Terraform `neondatabase/neon` provider si disponible, sinon manuel + documenté)
    - **10 databases logiques** créées par environnement : `tukio_identity`, `tukio_catalog`, `tukio_booking`, etc. + `keycloak` (cohérent Story 0.10)
    - **Branching** : `tukio-production-main` branche principal, `tukio-staging-main` branche staging, branches éphémères PR (V1+ feature branching pour QA preview)
    - **WAL archiving** : Neon natif (PITR Point-In-Time Recovery 30 jours staging, 7 jours production — ajustable selon cost) — RPO < 5 min ✅, RTO < 1 h ✅ (NFR44)
    - **Connection strings** stockés dans Doppler `tukio/<env>/database/<service>_url`, sync via Doppler Operator vers ExternalSecrets
    - **Connection pooling** Neon `pgbouncer-mode` activé pour limiter connexions concurrentes (NFR scaling V1+)
    - **Backup test** : runbook documenté `docs/runbook/disaster-recovery.md` (créé Story 0.13) qui décrit la procédure de restore en < 1 h

11. **AC11 — Cloudflare R2 buckets + server-side encryption + versioning** : Given Terraform Cloudflare provider, When je provisionne R2, Then :
    - **Buckets R2** créés (Terraform `cloudflare/cloudflare` provider) :
      - `tukio-media-staging` + `tukio-media-production` (photos services, KYC pros — NFR15 chiffrement at-rest)
      - `tukio-invoices-staging` + `tukio-invoices-production` (factures PDF, conservation 10 ans NFR LCEN)
      - `tukio-loki-cold-storage` (S3-compatible storage Loki cold logs — Architecture ligne 1022)
    - **Server-side encryption** activée par bucket (R2 native AES-256) — NFR15 ✅
    - **Versioning** : 15 jours sur `tukio-media-*` (rollback accident) — Architecture ligne 1040
    - **Bucket policies** : restrict access via R2 access keys (stockées Doppler), pas de public access par défaut. Signed URLs Cloudflare pour photos services public (cohérent Architecture ligne 1519)
    - **Cloudflare Images** (séparé de R2, transformations) : compte créé via Terraform, custom domain `images.tukio.one` configuré

12. **AC12 — Doppler Operator K8s pour secrets management** : Given Doppler Operator installé via Terraform Helm release, When un service a besoin d'un secret (`KEYCLOAK_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `NEON_DB_PASSWORD`, etc.), Then :
    - **Doppler projects** : `tukio/staging`, `tukio/production` (manuel setup Doppler UI — Doppler tokens en bootstrap Terraform var)
    - **ExternalSecret K8s resources** créées dans templates Helm : pour chaque service, 1 ExternalSecret qui référence le projet Doppler + config + secret name
    - **Sync interval** : 60s (Doppler Operator polls Doppler API et update K8s Secrets)
    - **Rotation manuelle** au MVP (Doppler UI), automatique V2+ (NFR sécurité — Architecture ligne 692)
    - **Audit trail** : Doppler natif log toutes les modifications de secrets (compliance)

13. **AC13 — `deploy-staging.yml` + `deploy-production.yml` Story 0.11 finalisés** : Given Story 0.11 a posé les placeholders, When je les update, Then :
    - **`deploy-staging.yml`** :
      - Trigger `workflow_run: { workflows: [Build Images], types: [completed], branches: [main] }`
      - Job : utilise `argocd app sync tukio-staging` via `argocd CLI` ou direct API call avec `ARGOCD_STAGING_TOKEN` secret
      - **Wait for sync completion** : `argocd app wait tukio-staging --health --timeout 600` (10 min max)
      - **Smoke test post-deploy** : `curl -f https://staging.tukio.one/health` (3 retries, 10s spacing) — fail le job si KO
      - **Slack notification** : success → `#tukio-deploys`, failure → `#tukio-alerts`
    - **`deploy-production.yml`** :
      - Trigger `on: push: { tags: ['v*'] }` (tag SemVer prod)
      - **Approval manuel** : `environment: production` GitHub Environment requiert approval 1 reviewer
      - Job : `argocd app sync tukio-production` avec `ARGOCD_PRODUCTION_TOKEN`
      - **Healthcheck post-deploy strict** : 3 endpoints (`/health`, `/ready`, `/v1/users/test-uuid` retourne 401 enveloppé) sur 5 min consecutive
      - **Rollback automatique** si healthcheck fail dans 5 min : `argocd app rollback tukio-production`
      - **Slack `#tukio-deploys-prod`** + **PagerDuty incident** auto-créé si rollback (V1+)

14. **AC14 — Healthchecks `/health` `/ready` `/metrics` exposés par tous les services** : Given chaque service backend, When je curl ses endpoints, Then :
    - **`/health`** (liveness probe) : retourne 200 toujours (sauf si crash complet) — Story 0.6 HealthController déjà implémenté
    - **`/ready`** (readiness probe) : check DB UP + NATS UP + Keycloak JWKS reachable + outbox-relay healthy + (Story 0.7 OutboxRelayService.isHealthy()) → 200 OK ou 503
    - **`/metrics`** (Prometheus scrape) : nouveau endpoint Story 0.12 ajouté dans chaque service (via `@tukio/observability/metrics.ts`) → exposes counter/gauge/histogram custom Tukio + system metrics auto-instrumented
    - **NetworkPolicy** : `/metrics` accessible UNIQUEMENT depuis namespace `tukio-monitoring` (où Prometheus tourne) — pas exposé public
    - Tests : `kubectl exec -it deploy/identity-svc -- curl http://localhost:9090/metrics` retourne format Prometheus exposition

15. **AC15 — Documentation runbooks + onboarding DevOps** : Given `infra/k8s/README.md` + `docs/runbook/`, When je les ouvre, Then je trouve :
    - **`infra/k8s/README.md`** : architecture K8s schema texte (3 namespaces × 3 deployment units + ingress + monitoring), commandes utiles (`kubectl get pods -n tukio-staging`, `argocd app sync tukio-staging`, `helm upgrade --install ...`)
    - **Runbooks essentiels** dans `docs/runbook/` :
      - `disaster-recovery.md` : procédure restore Neon PITR + Cloudflare R2 versioning + cluster K8s rebuild si total loss (NFR44)
      - `on-call.md` : escalation Slack → email tech lead → PagerDuty (V1+), playbook par alerte critique
      - `saga-replay.md` (placeholder, finalisé Story 4.13 + Story 10.3)
      - `stripe-dispute-handling.md` (placeholder, finalisé Story 4.12 + Story 10.1)
      - `rgpd-erase-request.md` (placeholder, finalisé Story 1.9)

## Tasks / Subtasks

- [ ] **Task 1 — Créer la structure `infra/k8s/`** (AC: #1)
  - [ ] 1.1 — `mkdir -p infra/k8s/{helm-charts/{core-api,workers,nats-cluster}/{templates,...},argocd/applications,observability,grafana-dashboards}`
  - [ ] 1.2 — Initialiser les 3 charts via `helm create` (chacun) + cleanup template defaults
  - [ ] 1.3 — Créer `_helpers.tpl` partagé (extract Tukio-standard labels)

- [ ] **Task 2 — Implémenter `core-api` chart (6 services)** (AC: #1, #2, #3)
  - [ ] 2.1 — `Chart.yaml` + `values.yaml` defaults + `values-{dev,staging,production}.yaml` (cf. AC2 spec exhaustive)
  - [ ] 2.2 — Pour chaque des 6 services (gateway-api, identity-svc, catalog-svc, booking-svc, order-svc, payment-svc), créer dans `templates/<service>/` :
    - `deployment.yaml` (avec healthchecks + securityContext + affinity)
    - `service.yaml` (ClusterIP)
    - `hpa.yaml` (CPU 70 % + RPS-based)
    - `pdb.yaml` (minAvailable: 1)
    - `networkpolicy.yaml` (deny-all + whitelist)
    - `servicemonitor.yaml` (Prometheus scrape)
    - `secret.yaml` (Doppler ExternalSecret reference)
  - [ ] 2.3 — `templates/ingress.yaml` UNIQUEMENT pour `gateway-api` (cohérent ADR-008)
  - [ ] 2.4 — Validation : `helm template core-api ./infra/k8s/helm-charts/core-api -f values-staging.yaml` → renders without error

- [ ] **Task 3 — Implémenter `workers` chart (4 services)** (AC: #1, #2, #3)
  - [ ] 3.1 — Idem core-api mais pour 4 services (messaging-svc, review-svc, notification-svc, media-svc)
  - [ ] 3.2 — Pas d'Ingress (workers jamais exposés public)

- [ ] **Task 4 — Implémenter `nats-cluster` chart** (AC: #1)
  - [ ] 4.1 — `Chart.yaml` avec dependency NATS upstream chart (`nats/nats` v8.x latest)
  - [ ] 4.2 — `values-{dev,staging,production}.yaml` :
    - dev : 1 replica
    - staging : 3 replicas (R3)
    - production : 3 replicas + persistent volumes 10Gi
  - [ ] 4.3 — `templates/dlq-stream.yaml` : Job OneShot qui crée le DLQ stream `tukio.dlq` au boot du chart
  - [ ] 4.4 — `helm dependency update` puis `helm template` validation

- [ ] **Task 5 — Créer ArgoCD Applications** (AC: #4)
  - [ ] 5.1 — `infra/k8s/argocd/applications/tukio-staging.yaml` (multi-source 3 charts, syncPolicy automated)
  - [ ] 5.2 — `infra/k8s/argocd/applications/tukio-production.yaml` (manuel sync, restrictif)
  - [ ] 5.3 — `infra/k8s/argocd/projects/tukio.yaml` : AppProject avec namespace + repo whitelist
  - [ ] 5.4 — Webhook GitHub configuré (manuel UI ou Terraform — voir Task 6)

- [ ] **Task 6 — Terraform Hetzner + cluster bootstrap** (AC: #5)
  - [ ] 6.1 — `infra/terraform/main.tf` + `variables.tf` + `outputs.tf` (config provider Hetzner)
  - [ ] 6.2 — `infra/terraform/cluster.tf` : provisionne K8s cluster + 3 nodes type cx21 + Cilium CNI
  - [ ] 6.3 — `infra/terraform/argocd.tf` : Helm release ArgoCD v7.x + bootstrap Application sync
  - [ ] 6.4 — `infra/terraform/observability.tf` : Helm releases Prometheus stack + Loki agent + OTel Collector + Grafana Cloud secrets refs
  - [ ] 6.5 — `infra/terraform/network.tf` : LoadBalancer + DNS records (`staging.tukio.one`, `argocd.staging.tukio.one`)
  - [ ] 6.6 — `infra/terraform/r2.tf` : Cloudflare R2 buckets + encryption + versioning
  - [ ] 6.7 — `infra/terraform/README.md` : setup Hetzner API token + Doppler login + `terraform init/plan/apply`
  - [ ] 6.8 — Smoke test : `terraform plan` valide la config (sans apply réel — coûts)

- [ ] **Task 7 — `@tukio/observability` lib partagée** (AC: #6, #14)
  - [ ] 7.1 — Créer `packages/observability/` (nouveau package — non listé Architecture ligne 105 mais nécessaire) avec Pattern subpath exports cohérent Stories 0.2-0.9
  - [ ] 7.2 — `tracing.ts` : init OpenTelemetry SDK + auto-instrumentations NestJS/HTTP/PG/NATS + OTLP exporter
  - [ ] 7.3 — `metrics.ts` : init Prometheus exporter + expose `/metrics` endpoint via NestJS handler
  - [ ] 7.4 — `correlation-attribute.ts` : helper qui ajoute `correlation_id` attribute sur tous les spans
  - [ ] 7.5 — `setupObservability(app, { serviceName })` factory — wire tout en 1 appel
  - [ ] 7.6 — Brancher dans `apps/identity-svc/src/main.ts` (Story 0.6 update) + futurs services
  - [ ] 7.7 — Tests `__tests__/setup.spec.ts` : vérifier que `/metrics` endpoint répond + traces exportées vers OTLP mock

- [ ] **Task 8 — Loki logs structurés Pino** (AC: #7)
  - [ ] 8.1 — Vérifier que `pino-logger.service.ts` (Story 0.6) est toujours actif + format JSON structuré
  - [ ] 8.2 — Promtail config (`infra/k8s/observability/promtail-config.yaml`) : pipeline JSON parsing pour extraire labels
  - [ ] 8.3 — Helm release Promtail via Terraform Task 6.4
  - [ ] 8.4 — Vérification post-deploy : Grafana Cloud Loki query `{service="identity-svc"} | json` retourne logs structurés

- [ ] **Task 9 — Grafana Cloud dashboards** (AC: #8)
  - [ ] 9.1 — Setup Grafana Cloud account (manuel — stack `tukio-staging`)
  - [ ] 9.2 — API key Doppler-stockée
  - [ ] 9.3 — Créer 3 dashboards JSON dans `infra/k8s/grafana-dashboards/` (commencer par template Tukio Overview, raffiner manuellement Grafana UI)
  - [ ] 9.4 — Provisionner via Terraform `grafana_dashboard` resource (provider `grafana/grafana`)

- [ ] **Task 10 — Alertmanager rules + Slack** (AC: #9)
  - [ ] 10.1 — `infra/k8s/observability/alertmanager-rules.yaml` : 6 alertes critiques (cf. AC9)
  - [ ] 10.2 — Doppler `tukio/observability/slack_webhook` setup
  - [ ] 10.3 — Test alerte fake : trigger metric `tukio_outbox_pending_lag_messages > 100` via PromQL push → vérifier Slack message arrive

- [ ] **Task 11 — Neon Postgres connecté + WAL archiving** (AC: #10)
  - [ ] 11.1 — Setup Neon account (manuel — Doppler API key)
  - [ ] 11.2 — Créer projects `tukio-staging` + `tukio-production` via API ou UI
  - [ ] 11.3 — Provisionner les 11 databases (10 Tukio + Keycloak) + connection strings dans Doppler
  - [ ] 11.4 — Configurer WAL archiving + PITR 30j staging / 7j production
  - [ ] 11.5 — Vérifier `pnpm --filter=identity-svc migration:run` fonctionne contre Neon staging via env var override `DB_HOST=<neon-host>`

- [ ] **Task 12 — Cloudflare R2 buckets** (AC: #11)
  - [ ] 12.1 — Setup Cloudflare account (manuel) + R2 enabled
  - [ ] 12.2 — Terraform Task 6.6 provisionne 5 buckets (media staging+prod, invoices staging+prod, loki cold storage)
  - [ ] 12.3 — Server-side encryption + versioning 15j sur media buckets
  - [ ] 12.4 — Test : `aws s3 ls --endpoint-url=https://<account>.r2.cloudflarestorage.com s3://tukio-media-staging` retourne bucket vide

- [ ] **Task 13 — Doppler Operator K8s** (AC: #12)
  - [ ] 13.1 — Helm release Doppler Operator via Terraform Task 6.x
  - [ ] 13.2 — ExternalSecret resources templates dans Helm charts (Task 2-4)
  - [ ] 13.3 — Test : modifier un secret dans Doppler UI → vérifier K8s Secret update dans 60s

- [ ] **Task 14 — Finaliser `deploy-staging.yml` + `deploy-production.yml` Story 0.11** (AC: #13)
  - [ ] 14.1 — Update `.github/workflows/deploy-staging.yml` : `argocd CLI install` + `argocd app sync tukio-staging` + wait + smoke test + Slack
  - [ ] 14.2 — Update `.github/workflows/deploy-production.yml` : approval `environment: production` + sync + healthcheck strict 5min + rollback auto
  - [ ] 14.3 — Documenter secrets requis : `ARGOCD_STAGING_TOKEN`, `ARGOCD_PRODUCTION_TOKEN`, `SLACK_WEBHOOK_URL`, `STAGING_BASE_URL`, `PRODUCTION_BASE_URL`

- [ ] **Task 15 — Documentation runbooks + onboarding** (AC: #15)
  - [ ] 15.1 — `infra/k8s/README.md` (architecture K8s + commandes utiles)
  - [ ] 15.2 — `docs/runbook/disaster-recovery.md` (Neon PITR + R2 versioning + cluster rebuild)
  - [ ] 15.3 — `docs/runbook/on-call.md` (playbook escalation + alertes)
  - [ ] 15.4 — `docs/runbook/{saga-replay,stripe-dispute-handling,rgpd-erase-request}.md` placeholders avec TODO Story X

- [ ] **Task 16 — Smoke test deploy staging end-to-end** (AC: tous)
  - [ ] 16.1 — Push test commit sur main → vérifier `build-images.yml` (Story 0.11) build + push
  - [ ] 16.2 — Vérifier `deploy-staging.yml` triggered → ArgoCD sync OK
  - [ ] 16.3 — `curl https://staging.tukio.one/health` retourne 200
  - [ ] 16.4 — Grafana Cloud "Tukio Overview" dashboard montre RPS + latency live
  - [ ] 16.5 — Trigger fake alerte (NATS lag) → vérifier Slack message arrive
  - [ ] 16.6 — Commit `feat(infra): K8s + ArgoCD + observability stack complet` — Story 0.12 done

## Dev Notes

### Pourquoi cette story est la 12ᵉ — contexte stratégique

> **Sources canoniques** : Architecture lignes 130 (stack observability), 983-989 (Hetzner + Neon), 1006-1042 (deployment + observability + alertes), 2046-2053 (infra structure), PRD NFR15/44/80-84.

Stories 0.1-0.11 ont posé tout le code + le pipeline CI. **Story 0.12 ferme la boucle production** : sans elle, on a du code testé qui ne tourne nulle part en prod. C'est aussi le pré-requis pour **Stories Epic 1+ déployées** (sans staging Hetzner réel, on ne peut pas valider les flows end-to-end auth + booking + payment).

**C'est aussi le moment où le pricing devient réel** : Hetzner ~50-100€/mois, Neon free tier suffit MVP, Grafana Cloud free tier généreux, Cloudflare R2 ~5€/mois pour < 100GB. Total < 150€/mois MVP.

**Décisions techniques majeures** :
1. **3 deployment units (NFR80)** : `core-api` + `workers` + `nats-cluster` au MVP. Pas 10 services séparés (ops burden). `payment-svc` split en V0 prod (NFR81 — PCI-adjacent isolation).
2. **GitOps ArgoCD** : 0 manual `kubectl apply`. Tout passe par Git → ArgoCD sync → K8s.
3. **Multi-source ArgoCD Applications** : 1 Application = 3 charts (core-api + workers + nats-cluster). Permet sync atomique.
4. **`@tukio/observability` lib nouvelle** : Architecture ne la liste pas explicitement (pas dans les 8 packages Story 0.1) — décision Story 0.12 d'ajouter ce package pour DRY (sinon chaque service duplique 50 lignes OTel setup).
5. **Grafana Cloud (vs self-hosted)** : free tier + intégration native + pas de babysitter à payer. V2+ migration self-hosted si volume justifie.
6. **Doppler Operator (vs External Secrets Operator + Vault)** : UX Doppler excellent + intégration K8s native + déjà figé Architecture ligne 690. ESO + Vault reportés V2+.
7. **Neon (vs RDS / Cloud SQL)** : serverless + branching + free tier + RGPD-friendly (eu-central-1 region) — Architecture ligne 991.
8. **Cloudflare R2 (vs S3)** : pas de fees egress (vs S3 9¢/GB) — économie significative pour photos services + KYC.
9. **NetworkPolicy strict deny-all** : security best practice K8s, whitelist explicite par service.
10. **Sampling traces 100 %/10 %** staging/production : équilibre debug vs cost Tempo.

### Versions à utiliser (latest stable au moment du Sprint 0)

| Stack | Version | Rationale |
|---|---|---|
| **Helm** | v3.x latest | Standard K8s package manager |
| **ArgoCD** | v2.10+ | Multi-source apps stable |
| **Hetzner Cloud K8s** | latest managed | Architecture ligne 989 |
| **Neon Postgres** | PG 16 | Cohérent Story 0.6 + 0.10 |
| **Cilium CNI** | latest | NetworkPolicy support |
| **Ingress NGINX** | latest stable | Standard K8s ingress |
| **cert-manager** | v1.14+ | Let's Encrypt automation |
| **kube-prometheus-stack** | latest | Prometheus + Alertmanager |
| **Grafana Cloud** | n/a (managed) | Free tier MVP |
| **OpenTelemetry SDK** | latest stable | Auto-instrumentation NestJS |
| **Doppler Operator** | latest | Secrets sync K8s |
| **Loki + Promtail** | latest stable | Logs structurés |
| **Tempo** | latest stable | Traces (Grafana Cloud managed) |

> ⚠️ **ArgoCD multi-source apps** : feature stable depuis v2.6 (mid-2023). Vérifier que la version Hetzner managed K8s installée supporte (devrait être OK 2026).

> ⚠️ **OpenTelemetry NestJS auto-instrumentation** : packages `@opentelemetry/auto-instrumentations-node` + `@opentelemetry/sdk-node` — vérifier compat NestJS 11 + Fastify (devrait OK).

### Project Structure cible

```
infra/
├─ terraform/                                           # ← cette story (Hetzner + Neon + Cloudflare + ArgoCD bootstrap)
│  ├─ main.tf, variables.tf, outputs.tf
│  ├─ cluster.tf                                       # K8s + Cilium
│  ├─ argocd.tf                                        # ArgoCD Helm release + bootstrap
│  ├─ observability.tf                                 # Prometheus + Loki + OTel Collector
│  ├─ network.tf                                       # Ingress + DNS
│  ├─ r2.tf                                            # Cloudflare R2 buckets
│  └─ README.md
├─ k8s/                                                # ← cette story
│  ├─ helm-charts/
│  │  ├─ core-api/                                     # 6 services
│  │  ├─ workers/                                      # 4 services
│  │  └─ nats-cluster/                                 # NATS R3
│  ├─ argocd/
│  │  ├─ applications/{tukio-staging,tukio-production}.yaml
│  │  └─ projects/tukio.yaml
│  ├─ observability/
│  │  ├─ alertmanager-rules.yaml
│  │  └─ promtail-config.yaml
│  ├─ grafana-dashboards/{tukio-overview,saga-booking-payment,apps-public-cwv}.json
│  └─ README.md
├─ docker-compose/                                     # déjà Story 0.10
└─ scripts/                                            # déjà Story 0.10

packages/observability/                                # ← cette story (NOUVEAU package)
├─ package.json, tsconfig.json
└─ src/{tracing,metrics,correlation-attribute,setup-observability}.ts + index.ts + tests

docs/
├─ runbook/                                            # ← cette story (placeholders)
│  ├─ disaster-recovery.md
│  ├─ on-call.md
│  ├─ saga-replay.md (placeholder)
│  ├─ stripe-dispute-handling.md (placeholder)
│  └─ rgpd-erase-request.md (placeholder)
└─ adr/                                                # Story 0.13 finalise les 14 ADRs

apps/<service>/src/main.ts                             # ← UPDATE × 10 services (wire setupObservability)
.github/workflows/{deploy-staging,deploy-production}.yml # ← UPDATE (Story 0.11 placeholders finalisés)
```

### Pattern code — Helm `templates/<service>/deployment.yaml` (squelette)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-{{ .Values.service.name }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "tukio.labels" . | nindent 4 }}
    tukio.one/service: {{ .Values.service.name }}
    tukio.one/deployment-unit: {{ .Values.deploymentUnit }}
spec:
  replicas: {{ .Values.replicas }}
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .Values.service.name }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  template:
    metadata:
      labels:
        {{- include "tukio.labels" . | nindent 8 }}
        app.kubernetes.io/name: {{ .Values.service.name }}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/path: {{ .Values.metrics.path }}
        prometheus.io/port: {{ .Values.metrics.port | quote }}
    spec:
      serviceAccountName: {{ .Values.service.name }}-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: {{ .Values.service.name }}
          image: "{{ .Values.image.registry }}/tukio/{{ .Values.service.name }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.port }}
              name: http
            - containerPort: {{ .Values.metrics.port }}
              name: metrics
          envFrom:
            - secretRef:
                name: {{ .Values.service.name }}-doppler  # géré par Doppler Operator
          env:
            - name: NODE_ENV
              value: {{ .Values.environment }}
            - name: PORT
              value: {{ .Values.service.port | quote }}
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: "http://otel-collector.tukio-monitoring:4318"
            - name: OTEL_TRACES_SAMPLER_ARG
              value: {{ .Values.observability.tracesSamplerArg | quote }}
          startupProbe:
            httpGet: { path: /health, port: http }
            failureThreshold: 30
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /health, port: http }
            initialDelaySeconds: {{ .Values.healthcheck.initialDelaySeconds }}
            periodSeconds: {{ .Values.healthcheck.periodSeconds }}
            timeoutSeconds: {{ .Values.healthcheck.timeoutSeconds }}
            failureThreshold: {{ .Values.healthcheck.failureThreshold }}
          readinessProbe:
            httpGet: { path: /ready, port: http }
            initialDelaySeconds: {{ .Values.readiness.initialDelaySeconds }}
            periodSeconds: {{ .Values.readiness.periodSeconds }}
            timeoutSeconds: {{ .Values.readiness.timeoutSeconds }}
            failureThreshold: {{ .Values.readiness.failureThreshold }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ['ALL']
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app.kubernetes.io/name
                      operator: In
                      values: [{{ .Values.service.name }}]
                topologyKey: kubernetes.io/hostname
```

### Pattern code — `@tukio/observability/setupObservability.ts` (squelette)

```ts
// packages/observability/src/setup-observability.ts (squelette)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';

interface ObservabilityConfig {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  tracesSamplerArg?: number;
}

export async function setupObservability(app: INestApplication, config: ObservabilityConfig) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion ?? process.env.SERVICE_VERSION ?? '0.0.0',
      'tukio.one/deployment-environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: config.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }, // noisy
      }),
    ],
  });
  sdk.start();

  // Expose /metrics endpoint via NestJS HTTP adapter
  app.use('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
```

### Critical Architecture Constraints

> Cf. Architecture lignes 1006-1042 + PRD NFR15/44/80-84 + memories `feedback_*.md`.

1. **GitOps strict — 0 `kubectl apply` manuel** : tout passe par ArgoCD sync depuis Git. Si urgence (incident prod) : commit `infra/k8s/`, ArgoCD sync immédiat (webhook GitHub).
2. **NetworkPolicy deny-all par défaut** : whitelist explicite par service. Sécurité maximale en namespace partagé.
3. **HPA sur tous les services backend** : scaling automatique pour saisonnalité 3× pic mai-sept (NFR38).
4. **PDB minAvailable: 1** sur tous les Deployments (zero-downtime rolling updates).
5. **healthcheck 3-tier** : startup (boot lent NestJS) + liveness (`/health`) + readiness (`/ready` check deps).
6. **Resources limits stricts** : evitez OOM Kill sans budget. `cpu.limit` strict (CPU throttling) + `memory.limit` strict (OOM si dépassement).
7. **Image immutable par SHA en prod** : `image.tag = .Chart.AppVersion` qui matche `git tag`. Pas de `:latest` mutable.
8. **Trace sampling staging 100 %, prod 10 %** : équilibre observabilité vs cost Tempo.
9. **PII redaction maintenu** dans logs Pino + traces OTel (NFR16).
10. **Doppler comme single source of truth secrets** : pas de `kubectl create secret` manuel. Tout passe par Doppler UI + Operator sync.
11. **Neon WAL archiving + PITR** non négociable (NFR44 RPO < 5 min, RTO < 1 h).
12. **Approval manuel `production` GitHub Environment** : protection prod (cohérent Story 0.11 AC5).

### What this story does NOT do (out of scope)

- ❌ **Production cluster Hetzner réel** déployé — Story 0.12 livre la config Terraform + Helm. **Application réelle** = action manuelle (Hetzner account + Doppler bootstrap + `terraform apply`) post-implémentation Story 0.12, par tech lead.
- ❌ **PagerDuty intégration** → V1+ (oncall structuré)
- ❌ **Self-hosted Grafana** → V2+ si Grafana Cloud free tier insuffisant
- ❌ **Multi-region failover** → V3+
- ❌ **Service mesh Istio/Linkerd** → V1+ si > 20 services (Architecture ligne 595)
- ❌ **Backup test automatique mensuel** → V1 (Architecture ligne 1042)
- ❌ **DLQ replay tool admin UI** → Story 10.3 V1 (sensible 🔴)
- ❌ **K8s monitoring détaillé pods/nodes** (kube-state-metrics dashboards) → V1+ (default kube-prometheus-stack suffit MVP)
- ❌ **Stripe webhook ingress (payment-svc)** → Stories Epic 4 (config Ingress dédié + IP whitelist Stripe)
- ❌ **Configuration BlackBox Exporter** (synthetic monitoring) → V1+
- ❌ **Vercel deployment frontend** : automatique via Vercel GitHub integration (zero config CI Tukio nécessaire)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `.github/workflows/deploy-staging.yml` (Story 0.11 placeholder) — finaliser avec ArgoCD CLI + healthcheck post-deploy + Slack
> - `.github/workflows/deploy-production.yml` (Story 0.11 placeholder) — finaliser avec approval + healthcheck strict + rollback auto
> - `apps/<service>/src/main.ts` (× 10 services) — ajouter `await setupObservability(app, { serviceName: '...' })` après `app.create(...)`
> - `apps/<service>/.env.example` (× 10) — ajouter `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_SAMPLER_ARG`, `SERVICE_VERSION`

> **À CREATE** :
> - **`infra/terraform/`** : 7 fichiers `.tf` + README
> - **`infra/k8s/helm-charts/core-api/`** : Chart + values × 4 envs + templates × 6 services × 7 templates types (~50 fichiers)
> - **`infra/k8s/helm-charts/workers/`** : idem pour 4 services (~30 fichiers)
> - **`infra/k8s/helm-charts/nats-cluster/`** : Chart + values + templates spécifiques (~10 fichiers)
> - **`infra/k8s/argocd/applications/`** : 2 YAML
> - **`infra/k8s/argocd/projects/tukio.yaml`** : 1 YAML
> - **`infra/k8s/observability/{alertmanager-rules,promtail-config}.yaml`** : 2 YAML
> - **`infra/k8s/grafana-dashboards/`** : 3 JSON
> - **`infra/k8s/README.md`** : documentation
> - **`packages/observability/`** : ~10 fichiers (lib + tests + README)
> - **`docs/runbook/`** : 5 fichiers Markdown (2 complets + 3 placeholders)
> - **Estimation total fichiers créés/modifiés** : ~150 fichiers (Helm verbose, beaucoup de YAML)

### Previous Story Intelligence (Stories 0.1 → 0.11)

**Story 0.6** : `apps/identity-svc/src/main.ts` posé. Story 0.12 ajoute `setupObservability(app, { serviceName: 'identity-svc' })` juste avant `await app.listen(...)`. `HealthController` `/health` + `/ready` déjà implémenté. Migration baseline `tukio_identity` joué via `bootstrap-databases.sh` Story 0.10 — Story 0.12 ré-utilise pour Neon staging.

**Story 0.7** : `OutboxRelayService.isHealthy()` consommé par `/ready` endpoint. `prom-client` métriques exposées (counter `tukio_outbox_published_total` etc.) — Story 0.12 les agrège dans `/metrics` global.

**Story 0.8** : `JwksCacheService.isHealthy()` consommé par `/ready`. `tukio_jwks_cache_refresh_failures_total` métriques.

**Story 0.10** : `docker-compose.dev.yml` avec PG/NATS/Keycloak local — Story 0.12 réplique en cluster K8s staging via Helm. `realm-export.json` réutilisable pour bootstrap Keycloak Phasetwo prod (manuel).

**Story 0.11** : `build-images.yml` push images vers `ghcr.io/<org>/tukio/<service>:<sha>` + `:latest`. Helm charts Story 0.12 référencent ces images via `image.repository` + `image.tag`. `deploy-staging/production.yml` placeholders finalisés Task 14.

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.12 |
|---|---|---|
| EN strict | tous les fichiers + variables en EN | ✅ |
| Helm chart names | kebab-case | ✅ (core-api, workers, nats-cluster) |
| K8s namespace naming | `tukio-<env>` ou `tukio-<purpose>` | ✅ |
| Labels standardisés | `app.kubernetes.io/*` + `tukio.one/*` custom | ✅ |
| GitOps strict | 0 `kubectl apply` manuel | ✅ |
| Image immutable prod | tag par SHA, pas `:latest` | ✅ |
| Doppler unique source secrets | pas de `kubectl create secret` | ✅ |
| `/health` `/ready` `/metrics` standard | (NFR84) | ✅ |
| Trace sampling adaptative | 100% staging / 10% prod | ✅ |
| Coverage observabilité lib | ≥ 70 % (lib I/O lourd) | ✅ |

### Testing Standards

- **Tests `@tukio/observability`** : Vitest, mock OTLP exporter + Prometheus registry, vérifier `/metrics` response valid format Prometheus exposition.
- **Tests Helm charts** : `helm template ... > rendered.yaml` puis lint via `kubeval` ou `kubeconform` (validation K8s schemas).
- **Tests Terraform** : `terraform validate` + `terraform plan` (sans apply réel).
- **Tests E2E déploiement** : non automatisés Story 0.12 (coût cluster réel). Smoke test manuel post-déploiement (Task 16).

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 1006-1042 (GitOps + 3 deployment units + observability).

✅ **Aligné** avec Architecture lignes 2046-2053 (`infra/k8s/helm-charts/`, `argocd/applications/`, `terraform/`, `docker-compose/` Story 0.10).

✅ **Aligné** avec PRD NFR15/44/80-84.

⚠️ **Décision documentée** : `@tukio/observability` lib créée Story 0.12 — non listée Architecture ligne 105 (8 packages initiaux). Décision tactique : sinon chaque service duplique 50 lignes OTel setup. Coût package = bénéfice DRY énorme.

⚠️ **Décision documentée** : Hetzner managed K8s vs self-managed. **Hetzner managed** retenu pour MVP (~50€/mois). Si Hetzner ne propose pas managed K8s à la date du dev, fallback sur Hetzner Cloud + provider K8s like Talos/Kubespray (effort +2 jours, documenter).

⚠️ **Décision documentée** : Neon vs Hetzner Postgres self-hosted. **Neon** retenu (Architecture ligne 991) pour serverless + branching + free tier. Migration self-hosted Hetzner si cost dépasse 100€/mois Neon V1+.

⚠️ **À noter** : la story est **2 jours estimés** côté code écrit (templates Helm + Terraform + lib observability). MAIS **+ 2-3 jours** d'**effort manuel ops** : setup Hetzner account, Doppler tokens, Cloudflare R2, Grafana Cloud, run `terraform apply`, valider end-to-end. **Réalisable en ~5 jours total** avec 1 dev DevOps/SRE.

⚠️ **À noter** : Phasetwo Keycloak managé prod (Architecture ligne 122) — la migration depuis Keycloak local (Docker Compose Story 0.10) vers Phasetwo prod nécessite : (1) export realm `tukio` (Story 0.10 task 10 a posé `realm-export.json`), (2) import Phasetwo via UI ou API, (3) update env var `KEYCLOAK_URL` dans Doppler `tukio/staging/keycloak/url` → Helm chart la consomme via ExternalSecret. Documenter dans runbook.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Cloud-Provider-K8s — Lines 983-989 (Hetzner + alternatives)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Postgres-MVP — Lines 991 (Neon serverless)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Deployment-Strategy — Lines 1006-1015 (GitOps ArgoCD + 3 units + HPA + PDB + NetworkPolicy)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging — Lines 1019-1022 (Loki + rétention)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Monitoring-Alerting — Lines 1024-1035 (OTel + Tempo + Prometheus + Loki + Alertmanager + 6 alertes)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Backup-DR — Lines 1037-1042 (Neon snapshots + R2 versioning + RPO/RTO)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Health-Observability-Endpoints — Lines 745-749 (`/health`, `/ready`, `/metrics`)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Observability-Tracing — Lines 252-258 (OTel + Prometheus + correlation IDs + PII redaction)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Secret-Management — Lines 688-692 (Doppler MVP, V2 Vault)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Sequence — Lines 1056-1057 (Helm charts + observability stack ordre)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.12 — Lines 1033-1047 (7 ACs originaux)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR15 — Cloudflare R2 chiffrement at-rest]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR44 — Backup PG RPO<5min RTO<1h]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR80-84 — 3 unités déploiement, payment-svc split V0, splittables, /health/ready/metrics]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR38 — saisonnalité 3× pic mai-sept]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — main.ts + HealthController]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — métriques prom-client + isHealthy()]
- [Source: _bmad-output/implementation-artifacts/0-10-docker-compose-dev-local-bootstrap-scripts.md — versions stack alignées]
- [Source: _bmad-output/implementation-artifacts/0-11-ci-github-actions-pipeline.md — deploy-staging/production placeholders à finaliser]
- [External: https://argo-cd.readthedocs.io/en/stable/operator-manual/multi-source-applications/ (ArgoCD Multi-source)]
- [External: https://docs.hetzner.com/cloud/load-balancers/overview/ (Hetzner LoadBalancer)]
- [External: https://neon.tech/docs/introduction/branching (Neon branching)]
- [External: https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/ (OTel NestJS setup)]
- [External: https://docs.doppler.com/docs/kubernetes-operator (Doppler Operator)]
- [External: https://grafana.com/docs/grafana-cloud/ (Grafana Cloud)]
- [External: https://developers.cloudflare.com/r2/ (Cloudflare R2)]
- [Memory: feedback_clean_architecture_explicit.md — observability lib séparée des services]
- [Memory: feedback_tech_layer_english.md — naming K8s resources EN]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent)

### Debug Log References

(à remplir — versions retenues ArgoCD/Helm/Terraform providers, decisions Hetzner managed vs self-managed K8s, fallbacks si lib OTel auto-instrumentations not Fastify-compat, choix Grafana Cloud free tier limits hits, time tracker setup ops manuel)

### Completion Notes List

(à remplir — résumé décisions, déviations, points d'attention pour Story 0.13 (ADRs documentent ces décisions infra), Stories Epic 4.13 (saga monitoring V1), Stories Epic 10 (replay tool admin), Stories Epic 1+ (déploiement progressif features))

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 5-7 jours (2-3 j code Helm/Terraform/observability lib + 2-3 j ops manuel setup Hetzner/Doppler/Cloudflare/Grafana Cloud + 1 j smoke tests + docs)
- **Dépendances upstream** :
  - Stories 0.1-0.11 (toutes les libs + services + CI)
  - Story 0.6 (`identity-svc` `main.ts` à updater + HealthController)
  - Story 0.7 (métriques prom-client à exposer via `/metrics`)
  - Story 0.10 (`realm-export.json` réutilisable Phasetwo + bootstrap-databases.sh template Neon)
  - Story 0.11 (`deploy-staging/production.yml` placeholders à finaliser + `build-images.yml` push `ghcr.io` consommé par Helm `image.repository`)
- **Dépendances downstream** :
  - **Story 0.13** (ADRs) — formalise les décisions Hetzner/Neon/Cloudflare/ArgoCD/Doppler dans ADRs
  - **Stories Epic 1+** (toutes les features production) — déployées via ArgoCD sync sur ce cluster
  - **Story 4.13 V1 (saga monitoring)** — utilise dashboards Grafana + alertes Slack saga > 5 min posés ici
  - **Story 10.3 V1 (event replay tool admin)** — utilise infra observability + DLQ stream pour debug
- **FRs covered** : aucun FR direct (foundational)
- **NFRs touchés** :
  - **NFR15** — Cloudflare R2 server-side encryption ✅
  - **NFR16** — PII redaction logs maintenu ✅
  - **NFR38** — HPA scaling pic saisonnier ✅
  - **NFR40** — NATS R3 replicas + DLQ stream ✅
  - **NFR41-46** — alertes lag NATS/outbox/saga + retries + tests chaos prep ✅
  - **NFR44** — Backup PG Neon WAL + PITR (RPO < 5min, RTO < 1h) ✅
  - **NFR61-66** — Observability stack complet (OTel + Prometheus + Tempo + Loki + Grafana) ✅
  - **NFR80-84** — Operability (3 units, splittable, /health /ready /metrics) ✅
  - **R11/R12/R13** — alertes saga + NATS lag + outbox lag opérationnelles ✅
