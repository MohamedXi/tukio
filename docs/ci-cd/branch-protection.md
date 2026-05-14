# Branch protection rules — Configuration

**Outil** : GitHub native [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

**Convention projet** : `main` carrie le README only — toutes les PRs visent `develop` (voir mémoire `project_git_workflow.md` + `.agents/context/git-workflow.md`).

**Statut bloquant** : 🔴 **Vital** — sans protection, les merges directs contournent toute la CI.

---

## Pourquoi

Sans branch protection :

- Possible de `git push` directement sur `main` / `develop` (contourne la CI).
- Possible de merger une PR avec checks rouges.
- Possible de force-push et réécrire l'historique partagé.
- Pas de garantie qu'une PR a été revue.

Avec branch protection :

- `git push` direct refusé → toute change passe par une PR.
- Merge bloqué tant que tous les status checks requis ne sont pas verts.
- Linear history (rebase/squash uniquement) → log lisible.
- Possible de restreindre qui peut merger (admins / équipe spécifique).

---

## Architecture des branches

```
main (carrie le README only)
  ↑
  └── develop (intégration — toutes les PRs y arrivent)
       ↑
       ├── feature/story-X.X-<slug>
       ├── feature/story-Y.Y-<slug>
       └── fix/<bug-description>
```

**Promotion vers main** : périodique (release), via une PR `develop → main` qui ne contient que des merges déjà reviewés.

---

## Setup `main`

GitHub → `MohamedXi/tukio` → Settings → Branches → **Add branch protection rule**.

### Branch name pattern

```
main
```

### Options à cocher

#### Pull request workflow

- ☑ **Require a pull request before merging**
  - **Required approving reviews** : `1`
  - ☑ **Dismiss stale pull request approvals when new commits are pushed**
  - ☐ **Require review from Code Owners** _(optionnel — activer quand `.github/CODEOWNERS` existe)_
  - ☐ **Require approval of the most recent reviewable push** _(optionnel — strict)_
  - ☐ **Allow specified actors to bypass required pull requests** _(garder vide)_

#### Status checks

- ☑ **Require status checks to pass before merging**
  - ☑ **Require branches to be up to date before merging**
  - **Status checks that are required** — ajouter au fur et à mesure qu'ils apparaissent (faut faire une 1ʳᵉ run de la CI complète pour que GitHub propose les noms) :
    - `CI success`
    - `Lighthouse — public-desktop`
    - `Lighthouse — public-mobile`
    - `Lighthouse — customer`
    - `Lighthouse — seller`
    - `Lighthouse — admin`
    - (optionnel) `codecov/patch`, `codecov/project` une fois Codecov configuré

#### Discipline

- ☑ **Require conversation resolution before merging**
- ☑ **Require signed commits** — _**V1+** quand GPG keys provisionnées (pas pour MVP)_
- ☑ **Require linear history**
- ☐ **Require deployments to succeed before merging** _(garder décoché — pas de deployment gating MVP)_
- ☐ **Lock branch** _(garder décoché — branche active)_

#### Restrictions

- ☑ **Restrict who can push to matching branches**
  - **Restrict push access** : ton compte (`MohamedXi`) + futurs admins / mainteneurs
  - ☑ **Allow force pushes** : **Specify who can force push** → vide (personne)
  - ☑ **Do not allow deletions**

#### Bypass

- ☑ **Do not allow bypassing the above settings** _(même les admins doivent passer par PR — VITAL pour `main`)_

### Save changes

---

## Setup `develop`

Mêmes règles que `main` avec quelques **relaxations** pour fluidifier le dev MVP :

GitHub → Settings → Branches → **Add branch protection rule**.

### Branch name pattern

```
develop
```

### Options à cocher

Tout comme `main`, sauf :

- **Required approving reviews** : `0` _(en solo MVP)_ OU `1` _(team)_
- ☐ **Dismiss stale pull request approvals when new commits are pushed** _(optionnel)_
- ☐ **Require review from Code Owners**
- ☑ **Do not allow bypassing the above settings** OU `☐` selon ta préférence
- Status checks required : **identiques à `main`**

---

## Ordre d'activation (important)

GitHub n'autorise pas à requérir un status check avant que celui-ci n'ait au moins **1 run réussi sur la branche concernée**.

Donc :

1. **Étape 1** : créer la rule SANS status checks required (juste « Require PR » + « Require linear history »).
2. **Étape 2** : ouvrir une PR test → laisser la CI tourner → tous les checks doivent apparaître au moins 1 fois.
3. **Étape 3** : éditer la rule → ajouter tous les checks dans **Required status checks**.
4. **Étape 4** : Save.

Maintenant la rule est complète.

---

## Permissions GitHub par rôle

| Rôle           | Push direct `develop`/`main` | Open PR | Approve PR | Merge PR  | Force push |
| -------------- | ---------------------------- | ------- | ---------- | --------- | ---------- |
| **Admin**      | ❌ (bypass désactivé)        | ✅      | ✅         | ✅        | ❌         |
| **Maintain**  | ❌                           | ✅      | ✅         | ✅        | ❌         |
| **Write**      | ❌                           | ✅      | ✅         | ✅ (via PR) | ❌         |
| **Triage**     | ❌                           | ✅      | ❌         | ❌        | ❌         |
| **Read**       | ❌                           | ❌      | ❌         | ❌        | ❌         |

L'admin **n'est pas exempté** des règles tant que `Do not allow bypassing` est coché.

---

## Vérification

Test rapide : essayer de push direct sur `develop` depuis local.

```sh
git checkout develop
echo "test" > test.txt
git add test.txt
git commit -m "chore: test branch protection"
git push origin develop
```

Résultat attendu :

```
remote: error: GH006: Protected branch update failed for refs/heads/develop.
remote: error: Required status check "CI success" is expected. 
remote: error: At least 1 approving review is required by reviewers with write access.
```

Cleanup :

```sh
git reset --hard HEAD~1
```

---

## Bypass exceptionnel

Pour les **hotfixes critiques** où tu veux bypass temporairement :

### Option A — Désactiver la rule temporairement

1. Settings → Branches → ton rule → **Edit**
2. Décocher `Do not allow bypassing`
3. Faire le hotfix push
4. Recocher immédiatement

**Loggable** : tout changement de rule apparaît dans l'audit log GitHub.

### Option B — PR ultra-rapide

1. Créer une branche `fix/<urgent>`
2. PR → self-approve (si le rule autorise) → merge avec `Squash and merge`
3. Tag `v<hotfix>` si prod

L'option B est préférable — garde l'historique propre.

---

## CODEOWNERS (V1+)

Pour activer **Require review from Code Owners**, créer `.github/CODEOWNERS` :

```
# CODEOWNERS — auto-assign reviewers based on file paths
# Format: <path-glob> @<github-handle> [@<github-handle>...]

# Tout par défaut — tech-lead
*                                       @MohamedXi

# Backend services
apps/identity-svc/                      @MohamedXi
apps/catalog-svc/                       @MohamedXi
apps/booking-svc/                       @MohamedXi
apps/order-svc/                         @MohamedXi
apps/payment-svc/                       @MohamedXi

# Frontends
apps/public/                            @MohamedXi
apps/customer/                          @MohamedXi
apps/seller/                            @MohamedXi
apps/admin/                             @MohamedXi

# Shared packages
packages/                               @MohamedXi
tools/                                  @MohamedXi

# CI/CD + infra
.github/                                @MohamedXi
infra/                                  @MohamedXi
docs/ci-cd/                             @MohamedXi

# BMad outputs — readonly via PR
_bmad-output/                           @MohamedXi
```

Quand l'équipe grossit, ajouter d'autres mainteneurs par domaine :

```
apps/identity-svc/  @MohamedXi @auth-team-lead
packages/ui/        @MohamedXi @design-system-team
```

---

## Audit et révision

Recommandations :

| Rôle     | Audit                                                                  | Fréquence       |
| -------- | ---------------------------------------------------------------------- | --------------- |
| Tech-lead | Vérifier la liste des status checks requis (synchro avec workflows)   | Par Sprint      |
| Tech-lead | Auditer les PRs mergées sans review (cas exceptionnels)               | Mensuel         |
| Admin    | Auditer le repo audit log (Settings → Audit log) pour les bypass      | Trimestriel     |

---

## Troubleshooting

### Status check « CI success » never reported

- La CI n'a pas tourné car la PR cible une autre branche que `main`/`develop` (vérifier `on:` du workflow).
- Le workflow a échoué AVANT le job `ci-success` (regarder le job par job).
- `paths-ignore` filtre la PR (docs-only → la CI court-circuit, le check « CI success » est posté par le job `docs-only`).

### « Required status check is missing »

- Le check n'a jamais tourné sur la branche concernée → faire 1 PR de test, attendre que le check apparaisse, puis le re-cocher dans la rule.

### `develop` accepte des merges sans CI green malgré la rule

- La rule n'inclut pas `develop` dans son `Branch name pattern` → vérifier.
- L'option `Require status checks` n'est pas cochée.
- Quelqu'un avec « Bypass » access mergé manuellement → désactiver bypass.

### `main` accidentellement push-é direct par admin

- Auditer dans Settings → Audit log → filtre `branch.update`.
- Renforcer : `Do not allow bypassing` doit être coché.

---

## Documentation officielle

- Branch protection : https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- CODEOWNERS : https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- Required reviews from Code Owners : https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches#require-review-from-code-owners

## Voir aussi

- [`.agents/context/git-workflow.md`](../../.agents/context/git-workflow.md) — branches, commits, Husky.
- [`slack-webhooks.md`](./slack-webhooks.md) — étape précédente.
- [`trivy-cve-management.md`](./trivy-cve-management.md) — étape suivante (optionnelle).
