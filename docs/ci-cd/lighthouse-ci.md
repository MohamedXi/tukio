# Lighthouse CI — Configuration et setup

**Outil** : [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) — assertions automatisées sur les Core Web Vitals (LCP, INP, CLS), l'accessibilité, le SEO.

**Workflow consommateur** : `.github/workflows/lighthouse-ci.yml` — matrix `[public-desktop, public-mobile, customer, seller, admin]`.

**Configs** : `.lighthouserc/{public-desktop,public-mobile,customer,seller,admin}.json`.

**Statut bloquant** : 🔴 **Bloquant pour PR sur les frontends** — assertions strictes sur `apps/public/` (RA1 SEO mitigation). Si LCP > 2.5 s, perf < 0.9, ou a11y < 0.9 → CI fail → PR bloquée.

---

## Pourquoi

Sans Lighthouse CI :

- Pas de garde-fou contre les régressions Core Web Vitals.
- Le SEO (RA1 risque opérationnel #1) peut se dégrader silencieusement.
- L'accessibilité (NFR54, RGAA AA) n'est pas vérifiée à chaque PR.

Avec Lighthouse CI :

- Chaque PR touchant un frontend voit le score Lighthouse calculé sur 3 runs.
- Les **assertions** dans `.lighthouserc/<app>.json` font fail le job si un seuil est dépassé.
- L'**app GitHub Lighthouse CI** poste un status check par app sur la PR + un commentaire avec le score détaillé.

---

## Étapes

### 1. Installer l'app GitHub Lighthouse CI

1. Va sur https://github.com/apps/lighthouse-ci
2. Click **Configure** (en haut à droite)
3. Sélectionne ton compte (`MohamedXi`)
4. **Repository access** → **Only select repositories** → coche `MohamedXi/tukio`
5. **Install** (ou **Save** si déjà installé)

### 2. Récupérer le token GitHub App

Après installation, l'app expose un token unique au repo.

**Méthode A — Via la page de l'app après install** :

1. Sur la page https://github.com/apps/lighthouse-ci, après l'install, tu es redirigé vers une page « Setup ».
2. Le token est affiché en clair sur cette page (1 seule fois).
3. **Copie le token immédiatement**.

**Méthode B — Via GitHub Apps installations** :

1. https://github.com/settings/installations
2. Trouve **Lighthouse CI** dans la liste
3. **Configure**
4. La page affiche le token (sous forme « Repository token » ou similaire selon la version)

Format : `xxxxxxxxxxxxxxxxxxxxxx` (chaîne alphanumérique).

### 3. Ajouter le secret au repo GitHub

1. GitHub → `MohamedXi/tukio` → Settings → Secrets and variables → Actions
2. **New repository secret**
3. Name : `LHCI_GITHUB_APP_TOKEN`
4. Value : colle le token copié
5. **Add secret**

### 4. Vérifier sur la prochaine PR

1. Ouvre/re-trigger une PR qui modifie un fichier dans `apps/public/**` ou `packages/ui/**`
2. Le workflow `Lighthouse CI` se lance
3. Sur la PR, après 5-10 min :
   - 5 status checks apparaissent : `Lighthouse — public-desktop`, `Lighthouse — public-mobile`, `Lighthouse — customer`, `Lighthouse — seller`, `Lighthouse — admin`
   - Un commentaire est posté par Lighthouse CI avec le rapport détaillé

---

## Configs Lighthouse par app

### `apps/public/` — strict (SEO public, RA1)

#### `.lighthouserc/public-desktop.json`

Form-factor desktop, 3 runs.

| Métrique                          | Threshold      | Severity |
| --------------------------------- | -------------- | -------- |
| `categories:performance`          | ≥ 0.9          | error    |
| `categories:accessibility`        | ≥ 0.9          | error    |
| `categories:seo`                  | ≥ 0.95         | error    |
| `categories:best-practices`       | ≥ 0.9          | warn     |
| `largest-contentful-paint`        | ≤ 2500 ms      | error    |
| `cumulative-layout-shift`         | ≤ 0.1          | error    |
| `interaction-to-next-paint`       | ≤ 200 ms       | error    |
| `total-blocking-time`             | ≤ 300 ms       | warn     |
| `first-contentful-paint`          | ≤ 1800 ms      | warn     |

#### `.lighthouserc/public-mobile.json`

Form-factor mobile (preset `perf`), 3 runs, **mêmes thresholds en error** (mobile = signal Google CWV principal).

URLs auditées :

- `http://localhost:3000/fr`
- `http://localhost:3000/en`
- `http://localhost:3000/fr/search`
- `http://localhost:3000/fr/help`

### `apps/{customer,seller,admin}/` — pragmatique (apps connectées)

Form-factor mobile, 3 runs.

| Métrique                          | Threshold       | Severity |
| --------------------------------- | --------------- | -------- |
| `categories:performance`          | ≥ 0.7           | error    |
| `categories:accessibility`        | ≥ 0.9           | error    |
| `categories:best-practices`       | ≥ 0.9           | warn     |
| `largest-contentful-paint`        | ≤ 4000 ms       | error    |
| `cumulative-layout-shift`         | ≤ 0.1           | warn     |

Pas de seuil SEO sur les apps connectées (derrière auth, non indexées par les bots).

URLs auditées : home + login uniquement (pas de pages d'app loggué — gérer ça en Story Epic 1+ avec un seed user CI).

---

## Modifier les assertions

### Relâcher temporairement un threshold (MVP)

Édite `.lighthouserc/<app>.json` :

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.7 }]  // était 0.9
      }
    }
  }
}
```

Commit + re-run du workflow.

### Ajouter une URL à auditer

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/fr",
        "http://localhost:3000/fr/nouvelle-page"  // ← ajout
      ]
    }
  }
}
```

### Désactiver une assertion (warn → off)

```json
{
  "interaction-to-next-paint": ["off", {}]
}
```

Ou retirer la clé du fichier.

---

## Stratégie de form-factor

Le spec original mandate `public` en mobile + desktop, et les apps connectées en mobile uniquement. Le diff actuel implémente :

- `public-desktop.json` + `public-mobile.json` → 2 matrix entries pour `apps/public/`
- `customer.json`, `seller.json`, `admin.json` → 1 matrix entry mobile chacun

Pour ajouter desktop sur customer (par exemple) :

1. Créer `.lighthouserc/customer-desktop.json` (copy de `customer.json` avec `preset: 'desktop'`)
2. Ajouter au matrix dans `lighthouse-ci.yml` :
   ```yaml
   - config: customer-desktop
     app: customer
   ```

---

## Affected detection

Le workflow `lighthouse-ci.yml` ne run que sur les frontends affected. Logique :

```sh
pnpm turbo run build --filter='...[origin/<base>]' --dry-run=json \
  | node -e '... extract affected packages ...'
```

Si la PR touche uniquement `apps/customer/`, seul le matrix entry `customer` tournera. Les 4 autres seront skip avec :

```
::notice::customer not affected by this PR — skipping Lighthouse.
```

**Cas particulier** : changes dans `packages/ui/` affectent **tous** les frontends → toute la matrix tourne (UI changes invalident le score visuel + perf).

---

## Lancer Lighthouse en local

Pour reproduire le résultat CI sur ta machine :

```sh
# 1. Build l'app
pnpm --filter=public build

# 2. Démarrer le serveur en background
pnpm --filter=public start &
SERVER_PID=$!

# 3. Run Lighthouse CI
pnpm dlx @lhci/cli@0.14.0 autorun --config=.lighthouserc/public-desktop.json

# 4. Cleanup
kill $SERVER_PID
```

Ou plus simplement avec Chrome DevTools :

1. `pnpm --filter=public dev`
2. Ouvre Chrome → `http://localhost:3000/fr`
3. F12 → onglet **Lighthouse** → **Analyze page load**

---

## Troubleshooting

### `LCP > 2.5s` sur public

Causes fréquentes :

1. **`next/image` mal configuré** sur la hero image — manque `priority`, mauvais `sizes`, format inadapté
2. **Polices custom non préchargées** — utiliser `next/font` avec `display: swap`
3. **Bundle JS trop gros** — vérifier `apps/public/.next/analyze/` (build avec `ANALYZE=true`)
4. **Cloudflare Images** mal routé — vérifier le `loader` dans `next.config.mjs`

Reproduction locale :

```sh
pnpm --filter=public build && pnpm --filter=public start
# Ouvrir http://localhost:3000/fr en mode incognito + DevTools Lighthouse
```

### `CLS > 0.1`

Causes :

1. **Images sans `width` + `height`** ou sans aspect-ratio CSS
2. **Polices custom** qui chargent en retard et provoquent un FOUT
3. **Pubs / iframes / widgets** qui injectent du DOM dynamiquement
4. **Layout shift au chargement** d'une dropdown / modal

Outil de debug : DevTools → onglet **Performance Insights** → trace les layout shifts.

### `Server did not become ready in 60000ms`

Le pattern `startServerReadyPattern: "Ready in"` ne match pas la log de démarrage Next.js.

Vérifier :

```sh
pnpm --filter=public start
# Vérifier que la sortie contient "Ready in <duration>"
```

Si Next.js a changé la log dans une version récente, mettre à jour le pattern :

```json
"startServerReadyPattern": "ready|listening|started"
```

### Status check « Lighthouse — public-desktop » absent sur la PR

- L'app GitHub Lighthouse CI n'est pas installée → suivre l'étape 1.
- `LHCI_GITHUB_APP_TOKEN` n'est pas dans repo secrets.
- La PR ne touche pas un path dans le `paths:` filter → comportement attendu.

### Lighthouse CI met 15+ min à tourner

Causes :

1. Pas de cache pnpm/Next.js → cache miss complet (`actions/cache@v4` key drift)
2. `numberOfRuns: 3` × 4-5 URLs × 5 apps = nombreux runs → 15+ min OK la 1ʳᵉ fois
3. Cold start Next.js 16 sur runner shared

Optimisations :

- Réduire `numberOfRuns: 2` sur les apps connectées (moins critique).
- Restreindre `url:` à 1-2 pages clé par app.
- Activer Turborepo Remote Cache (voir [`turborepo-remote-cache.md`](./turborepo-remote-cache.md)).

### Lighthouse échoue avec `Error: Browser not found`

Le runner GitHub Actions a Chrome installé par défaut, mais certaines versions custom peuvent manquer. Forcer l'install :

```yaml
- name: Install Chrome
  uses: browser-actions/setup-chrome@latest
```

---

## Coût et limites

L'app **Lighthouse CI GitHub App** est **gratuite** sans limite de runs.

L'upload vers `temporary-public-storage` est **gratuit** mais les rapports sont **purgés après 7 jours**. Pour de l'historique long terme :

- Self-host [LHCI Server](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/server.md) sur un VPS (~$5/mois).
- OU : payer Codecov Plans pour leur intégration Lighthouse.

---

## Documentation officielle

- GitHub : https://github.com/GoogleChrome/lighthouse-ci
- CLI reference : https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/cli.md
- Assertions : https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#assertions
- App GitHub : https://github.com/apps/lighthouse-ci

## Voir aussi

- [`turborepo-remote-cache.md`](./turborepo-remote-cache.md) — étape précédente.
- [`slack-webhooks.md`](./slack-webhooks.md) — étape suivante.
- [`.github/CI_PIPELINE.md`](../../.github/CI_PIPELINE.md#lighthouse-assertions) — résumé des assertions.
