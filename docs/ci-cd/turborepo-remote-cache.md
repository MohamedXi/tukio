# Turborepo Remote Cache — Configuration et setup

> ⚠️ **STATUT : DEFERRED V1+** — Turborepo Remote Cache (Vercel) n'est **pas configuré** dans le MVP.
> Le free tier Vercel Hobby est limité à **1 utilisateur** ; si tu invites un collaborateur, ça passe à $20/user/mois. Le **GitHub Actions cache** (`actions/cache@v4`) est suffisant pour MVP — chaque job restore le cache pnpm + Turborepo via `hashFiles('pnpm-lock.yaml')`.
> Re-activer quand l'équipe grandit ou si tu veux **partager le cache entre runs locaux + CI** (gain de temps notable sur les builds locaux).
> Pour V1+, ce guide reste à jour — il suffira de :
> 1. Créer un compte/team Vercel + access token (cf. § « Étapes » ci-dessous).
> 2. Ajouter les secrets `TURBO_TOKEN` + `TURBO_TEAM`.
> 3. Réintroduire `env: TURBO_TOKEN/TURBO_TEAM/TURBO_CACHE: 'remote:rw'` dans `ci.yml`.
> **Alternative self-host gratuite** : [`ducktors/turborepo-remote-cache`](https://github.com/ducktors/turborepo-remote-cache) sur un droplet DO ($4/mois) — voir section « Self-hosting » plus bas.

**Outil** : [Turborepo Remote Cache](https://turborepo.com/docs/core-concepts/remote-caching) via [Vercel](https://vercel.com/) (provider par défaut, free tier).

**Workflows consommateurs** : tous (`ci.yml`, `lighthouse-ci.yml`, `build-images.yml`, `chaos-tests.yml`).

**Config repo** : `TURBO_CACHE: 'remote:rw'` dans `ci.yml#env` (remplace `TURBO_REMOTE_ONLY` déprécié).

**Statut bloquant** : 🟢 **Non bloquant** — CI tourne sans, juste 2-5× plus lente (rebuild from scratch à chaque PR).

---

## Pourquoi

Sans Remote Cache :

- Chaque PR re-build tous les workspaces affected from scratch (~10-15 min CI).
- Pas de partage de cache entre runs sur la même branche.
- Les PRs sur le même service ne profitent pas d'un build précédent.

Avec Remote Cache :

- 1ʳᵉ run cache miss → build complet + upload du cache.
- Runs suivants cache hit → restauration en ~5-10 s, total CI ~3-5 min.
- Cache partagé entre développeurs locaux + CI runners.

Gain mesuré sur un monorepo équivalent : **CI de 12 min → 4 min** en moyenne, **30 s pour les rebuilds incrementaux**.

---

## Étapes

### 1. Créer un compte Vercel

1. Va sur https://vercel.com/signup
2. **Continue with GitHub** (avec le compte qui héberge le repo `tukio`)
3. Accepte les conditions

Pas besoin de déployer quoi que ce soit sur Vercel — uniquement l'utiliser comme provider de cache.

### 2. Créer une équipe Vercel (free tier)

Le Remote Cache est lié à une **team**, pas à un compte personnel.

1. https://vercel.com/teams/create
2. **Name** : `tukio` (ou ce que tu veux)
3. **Slug** : choisi automatiquement (ex. `tukio-org`) — note-le, c'est `TURBO_TEAM`
4. **Plan** : Hobby (free) → suffit pour 1 dev + CI MVP
5. **Create**

### 3. Créer un access token Vercel

1. Va sur https://vercel.com/account/tokens
2. **Create Token**
3. **Token Name** : `tukio-turbo-cache` (descriptif)
4. **Scope** : sélectionne ton équipe `tukio`
5. **Expiration** : `No Expiration` (sinon tu devras renouveler — voir Maintenance)
6. **Create**
7. **Copie immédiatement** le token (affiché 1 seule fois — il ne sera plus visible après)

Format : `xxxxxxxxxxxxxxxxxxxxxxxx` (24 chars).

### 4. Ajouter les 2 secrets au repo GitHub

GitHub → `MohamedXi/tukio` → Settings → Secrets and variables → Actions → **New repository secret**.

1. **Secret 1** :
   - Name : `TURBO_TOKEN`
   - Value : le token Vercel copié
2. **Secret 2** :
   - Name : `TURBO_TEAM`
   - Value : le slug de ton équipe (ex. `tukio-org`)

### 5. Vérifier la connexion

1. Re-run la CI sur ta PR (ou ouvre une nouvelle PR)
2. Dans les logs du job `setup` (ou n'importe quel job qui setup Turbo), tu dois voir :
   ```
   • Remote caching enabled
   ```
3. Lors du build, les workspaces déjà buildés afficheront :
   ```
   <package>:build: cache hit, replaying logs <hash>
   ```

Si tu vois `Remote caching disabled` ou `cache bypass, force executing`, le token n'est pas correctement configuré.

---

## Vérification en local

Tu peux activer le Remote Cache pour ton développement local :

```sh
# Authentification interactive
pnpm turbo login

# Lier le repo à l'équipe
pnpm turbo link
# → choisis ton équipe Vercel `tukio`

# Test
pnpm turbo run build --filter=identity-svc
# 1ʳᵉ run : "cache miss, executing"
pnpm turbo run build --filter=identity-svc
# 2ᵉ run : "cache hit, replaying logs"
```

Tes builds locaux remontent dans le même cache que la CI — tu profites de la mise en cache faite par les runs CI précédents.

**Important** : ne commit JAMAIS `.turbo/config.json` (généré par `turbo link`). Il est dans `.gitignore` par défaut.

---

## Stratégie de cache (CI/CD pipeline)

### Clés de cache utilisées dans `ci.yml`

| Cache scope     | Key                                                                   | Restore keys                                     |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| pnpm store      | `pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`            | `pnpm-${{ runner.os }}-`                         |
| Turborepo       | `turbo-${{ runner.os }}-${{ github.ref_name }}-${{ github.sha }}`     | `turbo-${{ runner.os }}-${{ github.ref_name }}-` |
| Next.js builds  | `nextjs-${{ runner.os }}-${{ hashFiles('apps/**/next.config.*', ...) }}` | `nextjs-${{ runner.os }}-`                    |

Le Turbo cache **distribué** via Vercel est utilisé EN PLUS du cache GitHub Actions (`actions/cache@v4`). Ils ne se concurrencent pas :

- **GHA cache** = cache local au runner, intra-CI run.
- **Turbo Remote Cache** = cache distribué entre tous les runs et tous les développeurs.

---

## Sécurité du cache

### Qui peut lire/écrire ?

- **Membres de l'équipe Vercel** : lecture + écriture via `pnpm turbo`.
- **CI runners** : lecture + écriture via `TURBO_TOKEN` (mode `remote:rw`).
- **Personne d'autre** : impossible sans le token.

### Que stocke le cache ?

- Outputs des `turbo run <task>` (ex. `dist/**`, `.next/**`).
- Logs des tâches (recapturés sur cache hit).
- **Hash** des inputs (pas les inputs eux-mêmes).

**Aucun secret n'est mis en cache** — les variables d'environnement listées dans `turbo.json#globalEnv` invalident le cache si elles changent.

### Rotation du token

Si le token Vercel est compromis :

1. https://vercel.com/account/tokens → **Revoke** sur l'ancien token
2. **Create Token** un nouveau
3. Mettre à jour le secret `TURBO_TOKEN` dans GitHub
4. Aucune action requise sur le cache existant (il reste valide)

---

## Modes alternatifs

Le pipeline utilise `TURBO_CACHE: 'remote:rw'` (read-write distant uniquement).

Autres modes possibles :

| `TURBO_CACHE`    | Comportement                                                                       | Usage                                    |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| `local:rw,remote:rw` | Lecture + écriture local ET distant (par défaut)                              | Dev local                                |
| `remote:rw`      | Lecture + écriture distant uniquement, pas de cache local                          | CI (notre choix — évite encombrement)    |
| `remote:r`       | Lecture seule distant (n'écrit pas vers Vercel)                                    | PR forks (lecture des caches existants)  |
| `local:rw`       | Cache local uniquement (offline)                                                   | Sans connexion réseau                    |

---

## Self-hosting (optionnel)

Si tu veux éviter Vercel :

- [`@vercel/remote-nx-cache`](https://github.com/vercel/remote-cache) en self-hosted Docker
- [`turbo-remote-cache`](https://github.com/ducktors/turborepo-remote-cache) (community, plus simple)

Setup type (1 service Node) :

```sh
docker run -d -p 3000:3000 \
  -e TURBO_TOKEN=mysecret \
  -v /data:/cache \
  ducktors/turborepo-remote-cache
```

Puis :

```yaml
env:
  TURBO_TOKEN: mysecret
  TURBO_API: https://my-turbo-cache.tukio.one
```

Pas nécessaire pour MVP — Vercel free tier est généreux.

---

## Troubleshooting

### `Remote caching disabled`

- Vérifier que `TURBO_TOKEN` ET `TURBO_TEAM` sont tous les 2 dans repo secrets.
- Vérifier que `TURBO_TEAM` correspond exactement au slug Vercel (pas le nom affiché). Le slug est dans l'URL : `https://vercel.com/<slug>/`.

### `Failed to retrieve cache from remote: unauthorized`

- Token Vercel expiré ou révoqué — créer un nouveau et mettre à jour le secret.
- Le token n'a pas accès à l'équipe spécifiée — vérifier le scope au moment de la création.

### `cache bypass, force executing`

- L'utilisateur a passé `--force` à `pnpm turbo` (intentionnellement).
- OU : le hash des inputs a changé (modif de code ou de `turbo.json`) → comportement attendu, le cache devra être re-rempli.

### Cache hit ratio faible (< 50 %)

- Vérifier `fetch-depth: 0` dans `actions/checkout` (sinon Turbo ne peut pas calculer les inputs).
- Vérifier que `turbo.json#globalEnv` ne contient pas trop de variables (chaque var dans cette liste invalide tout le cache au moindre changement).
- Vérifier que les `inputs` par tâche ne capturent pas des fichiers transient (logs, etc.).

### Coût Vercel

Free tier (Hobby) : illimité pour le cache, mais l'équipe est limitée à 1 utilisateur.

Si tu ajoutes des devs à l'équipe Vercel :

- Pro plan : $20/user/mois.
- OU : reste à 1 utilisateur Vercel (toi), et donne le `TURBO_TOKEN` aux autres devs (moins propre, mais fonctionne).

---

## Documentation officielle

- Quick start : https://turborepo.com/docs/core-concepts/remote-caching
- API reference : https://turborepo.com/docs/reference/configuration
- Self-host : https://github.com/ducktors/turborepo-remote-cache

## Voir aussi

- [`codecov.md`](./codecov.md) — étape précédente.
- [`lighthouse-ci.md`](./lighthouse-ci.md) — étape suivante.
