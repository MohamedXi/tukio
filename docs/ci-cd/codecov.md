# Codecov — Configuration et setup

> ⚠️ **STATUT : DEFERRED V1+** — Codecov n'est **pas configuré** dans le MVP.
> Le free tier privé est limité à **250 uploads/mois**, insuffisant pour une CI active. La coverage est actuellement stockée en **GHA artifact** (14 jours de rétention) via `ci.yml#test` step `Upload coverage artifact`.
> Re-activer Codecov quand le projet atteint la rentabilité ou si le budget passe à €14+/user/mois.
> Pour V1+, ce guide reste à jour — il suffira de :
> 1. Réintroduire `codecov.yml` à la racine (cf. git history `8c230b5..cee91ab`).
> 2. Réajouter la step `Upload coverage to Codecov` dans `ci.yml`.
> 3. Ajouter le secret `CODECOV_TOKEN` (cf. § « Étapes » ci-dessous).

**Outil** : [Codecov](https://about.codecov.io/) — agrégation de coverage de tests, status checks GitHub, commentaires automatiques sur les PR.

**Workflow consommateur** : `.github/workflows/ci.yml#test` step `Upload coverage to Codecov`.

**Config repo** : [`codecov.yml`](../../codecov.yml) à la racine (12 flags granulaires, thresholds par layer Pretre).

**Statut bloquant** : 🟡 **Non bloquant pour le merge** — `continue-on-error: true` sur la step d'upload. Mais le commentaire PR + les status checks Codecov informent sur la qualité.

---

## Pourquoi

Sans Codecov configuré :

- Upload de coverage échoue silencieusement (warning dans les logs).
- Pas de commentaire automatique sur la PR.
- Pas de visibilité sur le delta coverage (`+2.3%` ou `-0.5%` par PR).
- Pas d'historique des coverage trends par workspace.

Avec Codecov configuré :

- Commentaire PR automatique avec **delta** par flag (12 workspaces).
- **Status check** par workspace si la patch coverage chute sous le threshold (`codecov.yml` config).
- Dashboard Codecov : trends, sunburst, files browser.

---

## Étapes

### 1. Installer l'app GitHub Codecov

1. Va sur https://github.com/apps/codecov
2. Click **Configure** (en haut à droite)
3. Sélectionne ton compte (`MohamedXi`)
4. **Repository access** → **Only select repositories** → coche `MohamedXi/tukio`
5. **Save**

Vérification : tu dois voir Codecov listé dans GitHub → `MohamedXi/tukio` → Settings → Integrations → Installed GitHub Apps.

### 2. Lier le compte Codecov.io

1. Va sur https://app.codecov.io
2. **Login** avec ton compte GitHub
3. Sur le dashboard, autorise l'accès aux repos
4. Le repo `MohamedXi/tukio` doit apparaître dans la liste — click dessus

Si le repo n'apparaît pas : retourne sur GitHub Apps → Codecov → vérifie que `tukio` est bien dans **Repository access**.

### 3. Récupérer le token d'upload

1. Dans le repo Codecov, click **Settings** (icône engrenage en haut à droite)
2. Onglet **General**
3. Section **Repository Upload Token**
4. Click **Copy** — format : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 4. Ajouter le secret au repo GitHub

1. GitHub → `MohamedXi/tukio` → Settings → Secrets and variables → Actions
2. **New repository secret**
3. Name : `CODECOV_TOKEN`
4. Value : colle le token copié
5. **Add secret**

### 5. Trigger une CI run pour vérifier

1. Ouvre n'importe quelle PR (ou re-run la dernière CI)
2. Dans les logs de la step `Upload coverage to Codecov`, tu dois voir :
   - `Uploading coverage to https://codecov.io...`
   - `Submitted at https://codecov.io/github/MohamedXi/tukio/commit/<sha>`
3. Sur la PR, attendre 1-2 min — Codecov poste un commentaire automatique.

---

## Configuration `codecov.yml` actuelle

Le fichier [`codecov.yml`](../../codecov.yml) à la racine du repo configure :

### Status checks par workspace (12 flags)

| Flag                       | Target | Paths                                            |
| -------------------------- | ------ | ------------------------------------------------ |
| `contracts`                | 95 %   | `packages/contracts/`                            |
| `messaging`                | 80 %   | `packages/messaging/`                            |
| `auth`                     | 85 %   | `packages/auth/`                                 |
| `auth-client`              | 85 %   | `packages/auth-client/`                          |
| `api-client`               | 80 %   | `packages/api-client/`                           |
| `i18n-client`              | 80 %   | `packages/i18n-client/`                          |
| `testing`                  | 70 %   | `packages/testing/`                              |
| `ui`                       | 80 %   | `packages/ui/`                                   |
| `backend-domain`           | 80 %   | `apps/*-svc/src/domain/`, `gateway-api/src/domain/` |
| `backend-usecases`         | 70 %   | `apps/*-svc/src/usecases/`                       |
| `backend-infrastructure`   | 50 %   | `apps/*-svc/src/infrastructure/`                 |
| `frontend`                 | 60 %   | `apps/public/`, `customer/`, `seller/`, `admin/` |

### Patch coverage (PR-level)

| Flag group        | Target | Comment                                         |
| ----------------- | ------ | ----------------------------------------------- |
| `default`         | 80 %   | Fallback pour tout fichier non flagué           |
| `contracts`       | 95 %   | Lib pure types — couverture quasi exhaustive    |
| `packages`        | 85 %   | Tous packages partagés                          |
| `backend`         | 70 %   | Domain + usecases + infrastructure agrégés      |
| `frontend`        | 80 %   | Code Next.js touché par la PR                   |

### Carryforward

`carryforward: true` est activé sur tous les flags. Signification :

- Quand une PR ne touche PAS un workspace, Codecov **reporte** la coverage précédente comme baseline.
- Évite que le project coverage chute artificiellement quand seule 1 partie du code est testée dans la PR.

### Fichiers ignorés

`codecov.yml#ignore` exclut :

- `**/*.spec.ts`, `**/*.test.ts`, `**/*.e2e-spec.ts`, `**/__tests__/**`, `**/test/**` — tests eux-mêmes
- `**/dist/**`, `**/.next/**`, `**/coverage/**` — outputs de build
- `**/*.stories.tsx`, `**/*.d.ts` — Storybook + type-only
- `infra/**`, `tools/**`, `_bmad/**`, `_bmad-output/**`, `docs/**` — non-code

Note : **`main.ts` et `index.ts` ne sont PAS exclus** — ils contiennent du wiring critique (envelope filter, Sentry init) qui doit être couvert.

---

## Modifier les thresholds

Pour relâcher un threshold (utile en MVP quand peu de tests existent) :

```yaml
coverage:
  status:
    project:
      backend-domain:
        target: 60% # passé de 80 % à 60 % pour MVP
```

Pour ajouter un nouveau flag (nouveau workspace) :

```yaml
flags:
  <new-flag-name>:
    paths: [packages/<new-pkg>/]
    carryforward: true
```

Puis ajouter une entrée `status.project.<new-flag-name>` avec son target.

Re-déployer en commitant `codecov.yml` — Codecov re-lit le fichier au prochain upload.

---

## Troubleshooting

### Codecov upload échoue avec « Token not provided »

- Vérifier que `CODECOV_TOKEN` est bien dans repo secrets (pas environment secret).
- Le step a `continue-on-error: true` → l'erreur n'apparaît pas dans le job result, mais dans les logs détaillés du step.

### Codecov ne poste pas de commentaire sur la PR

- Vérifier que la PR a été créée APRÈS l'install de l'app Codecov GitHub.
- Vérifier que `comment.require_changes: false` dans `codecov.yml` (commentaire posté même sans changement de coverage).
- Attendre 2-3 min — Codecov a un délai de traitement.

### Coverage drop inexpliqué entre deux PRs

- Vérifier `carryforward: true` sur les flags concernés.
- Possible que des fichiers de bootstrap (`main.ts`, etc.) aient été récemment réécrits sans tests — la coverage chute mathématiquement.
- Voir le sunburst dans Codecov pour identifier les fichiers responsables.

### Status check « codecov/patch » échoue

- Le `patch.target` est dépassé (la PR n'a pas testé suffisamment ses propres changements).
- Voir le commentaire Codecov sur la PR : il liste les fichiers modifiés avec leur coverage individuelle.
- Soit ajouter des tests, soit relâcher le threshold (`codecov.yml#status.patch.<flag>.target`).

### « 0 % coverage » sur tous les flags après le 1er upload

- Vérifier que `pnpm turbo run test:cov` produit bien des fichiers `coverage/lcov.info` ou `coverage/coverage-final.json` dans chaque workspace.
- Vérifier que `codecov/codecov-action@v4` est bien configuré pour découvrir ces fichiers (par défaut : récursivement).

---

## Coût et limites (free tier)

Codecov free tier accepte :

- Repos open-source illimités.
- Repos privés : **1 utilisateur, 250 uploads/mois**.

`tukio` est privé pour le moment. Si vous dépassez 250 uploads/mois (probable avec une CI active), passer au tier **Team** ($14/user/mois) ou self-host Codecov.

Alternative open : [Coveralls](https://coveralls.io/) (gratuit pour privés mais moins d'features).

---

## Documentation officielle

- Quick start : https://docs.codecov.com/docs/quick-start
- `codecov.yml` reference : https://docs.codecov.com/docs/codecov-yaml
- Flags : https://docs.codecov.com/docs/flags
- Carryforward flags : https://docs.codecov.com/docs/carryforward-flags

## Voir aussi

- [`turborepo-remote-cache.md`](./turborepo-remote-cache.md) — étape suivante recommandée.
- [`branch-protection.md`](./branch-protection.md) — utiliser les Codecov status checks comme required checks.
