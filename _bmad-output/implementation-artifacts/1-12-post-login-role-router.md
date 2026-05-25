# Story 1.12: Resolver post-login par rôle unifié (gateway-api)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> 🆕 **Story créée le 2026-05-25** via `/bmad-create-story`, suite au `/bmad-correct-course` de répercussion d'**ADR-0017** (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-25.md`). Comble le seul vrai manque révélé par l'analyse : aucun aiguillage **fiable** par rôle après authentification (« tout le monde atterrit pareil »). Décision **gateway-side unifié** actée 2026-05-25 (révise l'esquisse apex de l'ADR-0017 AC3).

## Story

**As a** utilisateur authentifié (client, pro converti, ou admin),
**I want** être redirigé après login / vérification email vers l'espace correspondant à mon rôle,
**so that** je n'atterris pas systématiquement au même endroit — le bug actuel où le redirect post-auth ne tient pas compte du rôle.

## Acceptance Criteria

1. **Given** une pure function `post-login-destination-resolver.ts` dans `gateway-api`, **When** on lui passe `{ role, locale }` + les `zones`, **Then** elle retourne une URL absolue avec la précédence : `admin*` → `ZONE_BASE_URL_ADMIN`, sinon `pro` → `${ZONE_BASE_URL_SELLER}/{locale}/seller/dashboard`, sinon `client` → `${ZONE_BASE_URL_PUBLIC}/{locale}/account/dashboard`. Le `tukio:status` n'est **pas** une entrée (le bounce pending est délégué au middleware seller, cf. AC6).
2. **Given** le `BackendActor.role` (déjà dérivé par précédence `admin-super > admin-modo > admin-support > pro > client`), **When** un user a plusieurs rôles (ex. client + pro converti), **Then** le resolver aiguille selon le rôle primaire → un pro converti atterrit sur `/seller/dashboard` (priorité pro, IA §I.3) ; l'accès à `/account` reste possible via le menu in-app.
3. **Given** le flow login — la use case d'échange du callback gateway (`auth-login.controller.ts` `GET /v1/auth/callback`, qui calcule aujourd'hui `redirectUrl`, `:137-148`), **When** l'échange réussit, **Then** le `redirectUrl` est calculé via ce resolver partagé (et non une destination fixe / un `next` role-blind).
4. **Given** le flow email-verify (Story 1.6), **When** son `redirectUrl` post-vérification est calculé, **Then** il consomme **le même** resolver — le `post-verify-redirect-resolver.ts` que la Story 1.6 prévoyait est **fusionné** dans `post-login-destination-resolver.ts` (un seul resolver pour login + email-verify, zéro duplication).
5. **Given** les callbacks front (apex `apps/public/.../auth/callback/route.ts` qui relaie le `Location` gateway, `:54-62` ; seller/mobile à venir), **When** l'auth réussit, **Then** ils **relaient** le `Location` calculé par la gateway — aucune logique de décision de destination côté front.
6. **Given** un pro `tukio:status = pending_admin_review`, **When** le resolver l'aiguille vers `/seller/dashboard`, **Then** le middleware seller (`decidePendingRedirect`, `pending-admin-review-decision.ts`) le bounce ensuite vers `/seller/onboarding/pending` — le resolver **ne gère pas** le statut, il route par rôle ; l'enforcement d'accès reste aux middlewares de zone.
7. **Given** des tests unitaires colocalisés `post-login-destination-resolver.spec.ts`, **When** ils tournent, **Then** ils couvrent ≥ 90 % de la pure function : client, pro, chaque rôle admin, dual-rôle client+pro, les 2 locales (fr/en), et l'absence de rôle Tukio (fallback défensif).

## Tasks / Subtasks

- [ ] **Task 1 — Pure resolver `post-login-destination-resolver.ts`** (AC: 1, 2, 6)
  - [ ] Créer `apps/gateway-api/src/infrastructure/http/utils/post-login-destination-resolver.ts` (même dossier que `post-verify-redirect-resolver.ts` prévu par 1.6 et que `merge-acquisition.ts`).
  - [ ] Signature pure, façon `decidePendingRedirect` : `resolvePostLoginDestination(input: { role: Role; locale: 'fr' | 'en' }, zones: { public: string; seller: string; admin: string }): string`. (Injecter `zones` en argument pour garder la fonction pure et testable sans config.)
  - [ ] Précédence : `role.startsWith('admin')` → `zones.admin` ; `role === 'pro'` → `${zones.seller}/${locale}/seller/dashboard` ; sinon (`client` / fallback) → `${zones.public}/${locale}/account/dashboard`.
  - [ ] Fallback défensif : rôle inconnu / absent → destination `client` (jamais d'URL vide).
  - [ ] Ne PAS lire `tukio:status` ici (le bounce pending est au middleware seller — AC6).
- [ ] **Task 2 — Brancher le flow login** (AC: 3, 5)
  - [ ] Dans la use case d'échange du callback (derrière `exchangeProxy`, cf. `auth-login.controller.ts:137`), remplacer le calcul de `redirectUrl` par `resolvePostLoginDestination({ role: actor.role, locale: actor.locale }, this.config.getZoneBaseUrls())`.
  - [ ] Conserver le respect d'un `next`/`state` **safe** s'il existe déjà (ne pas régresser `sanitizeNextUrl` Story 1.4a) : le `next` validé prime, sinon fallback resolver. À confirmer selon l'implémentation 1.4b.
  - [ ] Vérifier que l'apex `auth/callback/route.ts:54-62` relaie bien ce `Location` sans le réécrire (aucun changement attendu — juste valider en e2e).
- [ ] **Task 3 — Unifier avec email-verify (dépendance Story 1.6)** (AC: 4)
  - [ ] Story 1.6 étant `ready-for-dev`, exposer le resolver pour qu'elle l'importe au lieu de créer `post-verify-redirect-resolver.ts`. Si 1.6 est développée après, ajouter une note dans son fichier (déjà fait : bandeau ADR-0017). Si avant, faire la fusion ici.
  - [ ] Cas pro pending au post-verify : même logique qu'AC6 (resolver route pro → seller/dashboard, middleware seller bounce). Confirmer que le comportement 1.6 (Pro pending → onboarding/pending) est préservé via le middleware, pas via le resolver.
- [ ] **Task 4 — Tests** (AC: 7)
  - [ ] `post-login-destination-resolver.spec.ts` (vitest, colocalisé) ≥ 90 % : client fr/en, pro fr/en, admin-super/admin-modo/admin-support, dual-rôle (actor.role=pro), rôle absent → fallback client.
  - [ ] Test d'intégration / e2e gateway : callback login d'un client → `Location` apex /account/dashboard ; d'un pro → seller/dashboard ; d'un admin → admin base URL.
- [ ] **Task 5 — Observabilité** (optionnel, aligné conventions)
  - [ ] Log structuré (Pino) `service`, `correlationId`, `actor.role`, `destination` au moment de la décision (pas de PII au-delà de l'`actor.id`).

## Dev Notes

### État actuel (lu dans le code — à respecter, ne pas casser)

- **Le callback gateway calcule déjà un `redirectUrl`.** `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts` : `GET /v1/auth/callback` (`:137-148`) récupère `{ redirectUrl, sessionCookies, clearPkceCookie }` de la use case d'échange puis `reply.redirect(redirectUrl, 302)`. `publicBase = this.config.getZoneBaseUrls().public` (`:119`) sert de fallback. **C'est ICI que le resolver se branche** — le `redirectUrl` doit devenir role-based.
- **L'apex relaie déjà le `Location`.** `apps/public/src/app/[locale]/auth/callback/route.ts:54-62` : `const redirectTo = gwResponse.headers.get('location'); … NextResponse.redirect(new URL(destination, req.url))`. ⇒ **aucun changement côté apex** (AC5) ; le seller n'a pas de callback OAuth propre (auth sur l'apex, ADR-0016).
- **`BackendActor` porte le rôle primaire prêt à l'emploi.** `packages/auth/src/types/actor.ts:11` : `{ userId, role: Role, roles: Role[], locale, email, emailVerified, amr, acr }`. `role` est **déjà** dérivé par précédence `admin-super > admin-modo > admin-support > pro > client` (cf. commentaire `:6-10`). ⇒ le resolver switch sur `actor.role`, la précédence dual-rôle est gratuite (AC2).
- **`tukio:status` n'est pas sur l'actor** : il est lu d'un claim via `readStatusClaim` côté middleware seller. ⇒ le resolver n'en a pas besoin (AC6).
- **Zones** : `EnvironmentConfigService.getZoneBaseUrls()` (`environment-config.service.ts:99-101`) → `{ public, seller, admin }` depuis `ZONE_BASE_URL_PUBLIC|SELLER|ADMIN` (`env.schema.ts:61-71`). Injecter en argument du resolver.

### Pattern à copier — pure decision function

`apps/seller/src/middleware/pending-admin-review-decision.ts` (`:56-73`) :

```ts
export type PendingRedirectDecision = { redirect: false } | { redirect: true; locale: string };
export function decidePendingRedirect(pathname: string, cookieToken: string | undefined): PendingRedirectDecision { … }
```

Avec son `.spec.ts` colocalisé. Même esprit que `coming-soon-gate-decision.ts` (Story 0.15). **Story 1.12 = même discipline** : fonction pure, sans I/O, `zones` passé en argument, spec exhaustive.

### Ce que cette story NE fait PAS

- Pas de gestion du statut pending dans le resolver (délégué au middleware seller — AC6).
- Pas d'inscription / pas de rôle assigné (invariant ADR-0017 : `pro` ne s'obtient que par le wizard de conversion Story 1.3 v2).
- Pas de logique de décision côté front (les callbacks relaient — AC5).

### Project Structure Notes

- Resolver : `apps/gateway-api/src/infrastructure/http/utils/post-login-destination-resolver.ts` (+ `.spec.ts`) — cohérent Pattern Pretre (utilitaire infra HTTP, sans dépendance domaine).
- Conflit potentiel à surveiller : la Story 1.6 (ready-for-dev) planifie `post-verify-redirect-resolver.ts` + `post-verify-redirect-resolver` dans son arbo (`6.6`, ligne ~369/473 de `1-6-…md`). **Résolution : un seul fichier `post-login-destination-resolver.ts`** consommé par les deux flows. Le bandeau ADR-0017 est déjà posé en tête de la story 1.6.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` #Story 1.12] — 5 AC d'origine + total epic.
- [Source: `docs/adr/0017-auth-client-first-conversion-pro.md` #Decision pt.3 + Implementation Notes] — resolver gateway-side, précédence admin→pro→client, callbacks relaient.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-25.md`] — contexte correct-course + handoff.
- [Source: `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts:137-148`] — point d'insertion login.
- [Source: `apps/public/src/app/[locale]/auth/callback/route.ts:54-62`] — relais Location apex.
- [Source: `packages/auth/src/types/actor.ts:11`] — `BackendActor.role` (précédence).
- [Source: `apps/seller/src/middleware/pending-admin-review-decision.ts:56-73`] — pattern decision function + bounce pending.
- [Source: `apps/gateway-api/src/infrastructure/config/environment-config.service.ts:99-101` + `env.schema.ts:61-71`] — `getZoneBaseUrls()` / `ZONE_BASE_URL_*`.
- [Source: `_bmad-output/implementation-artifacts/1-6-email-verification-flow-landing-page.md`] — resolver post-verify à fusionner.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
