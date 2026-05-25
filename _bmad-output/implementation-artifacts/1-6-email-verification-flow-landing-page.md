# Story 1.6: Vérification email (native Keycloak) + pages de gating FR17

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> 🔄 **RE-ÉCRITE le 2026-05-25 (ADR-0018, cf. `sprint-change-proposal-2026-05-25-adr-0018.md`)**
> La vérification email est désormais **native Keycloak** (`verifyEmail: true`, required-action `VERIFY_EMAIL`).
> **Supprimés** par rapport à la version initiale : le custom `POST /v1/auth/email/verify` + `…/validate`,
> la landing « auto-verify on landing », la table app `email_verification_tokens`, le hook `useVerifyEmail`,
> le custom `POST /v1/auth/email/resend` rate-limité (Keycloak gère l'envoi + le renvoi).
> **Reste à la charge de Tukio** : (a) thème `verify-email.ftl` (existe), (b) SMTP realm → Resend, (c) le
> **redirect post-vérification via `resolvePostLoginRedirect`** (`redirect-resolver.ts`, Story 1.4b — déjà livré),
> (d) les **pages de gating FR17** `verify-email-required`. Aucun mécanisme `signup_intent` (Story 1.11 annulée).

> ⚠️ **ADR-016 / Story 0.14** : `apps/customer` mergé dans `apps/public` — `customer.tukio.one` → `tukio.one` (apex).
> Routes customer authentifiées sous `apps/public/[locale]/(authenticated)/…`.

## Story

**As a** Customer / Pro fraîchement inscrit (via Keycloak, Stories 1.13/1.14) avec `email_verified=false`,
**I want** que Keycloak gère nativement la vérification de mon email (envoi + clic + confirmation),
**so that** je débloque les fonctionnalités transactionnelles (réservation, paiement, messagerie — FR17), l'app se contentant d'**enforcer le gating** tant que l'email n'est pas vérifié.

## Acceptance Criteria

1. **Given** le realm `tukio` (`verifyEmail: true`, required-action `VERIFY_EMAIL` — Story 1.13), **When** un utilisateur s'inscrit (self-registration ou social), **Then** Keycloak **envoie l'email de vérification** (template themé `infra/keycloak/themes/tukio/email/*` + `login/verify-email.ftl`) et exige la vérification avant d'émettre des tokens valides — **aucun endpoint custom Tukio** (`POST /v1/auth/email/verify`, `…/validate`, `…/resend`) ni table `email_verification_tokens` côté app.
2. **Given** le SMTP du realm, **When** Keycloak envoie l'email, **Then** il passe par **Resend (SMTP)** — config SMTP du realm (Story 1.13/1.1), expéditeur + branding Tukio.
3. **Given** la vérification réussie, **When** Keycloak redirige vers `…/auth/callback`, **Then** la destination est calculée par **`resolvePostLoginRedirect`** (gateway, Story 1.4b) : `client` → `/account/dashboard`, `pro pending` → `/seller/onboarding/pending`, etc. — pas de redirect hardcodé ni de `signup_intent`.
4. **Given** un utilisateur authentifié mais `email_verified=false` (claim JWT), **When** il accède à une route gated FR17 (`/(authenticated)/…/checkout`, `/seller/onboarding`), **Then** le middleware le redirige vers la page **`verify-email-required`** de sa zone.
5. **Given** les pages `verify-email-required` finalisées (placeholders Story 1.2) — `apps/public/src/app/[locale]/(authenticated)/auth/verify-email-required/page.tsx` (Customer) + `apps/seller/src/app/[locale]/auth/verify-email-required/page.tsx` (Pro) — **When** elles s'affichent, **Then** elles montrent `<EmptyState variant="warning">` (Story 0.5) « Vérifiez votre email » + un CTA **« Renvoyer le lien »** qui déclenche le **renvoi natif Keycloak** (page d'action KC / endpoint KC), FR + EN, RGAA AA.
6. **Given** Playwright, **When** les tests tournent, **Then** ils couvrent le gating FR17 (Customer checkout + Pro onboarding) + le rendu des pages `verify-email-required` (FR/EN, axe-core 0 violation) + le retour post-vérification via le resolver.

## Tasks / Subtasks

- [ ] **Task 1 — Vérifier la config realm KC-native** (AC: 1, 2) — _dépend Story 1.13_
  - [ ] Confirmer `verifyEmail: true` + required-action `VERIFY_EMAIL` activée ; thème `verify-email.ftl` + emails themés ; SMTP realm → Resend (sender, host, credentials en secrets).
- [ ] **Task 2 — Gating middleware FR17** (AC: 4)
  - [ ] Middleware apex `(authenticated)` + seller : si claim JWT `email_verified=false` sur route gated → redirect `verify-email-required` (réutiliser le decode JWT Story 1.4d / pattern `*-decision.ts`).
- [ ] **Task 3 — Pages `verify-email-required`** (AC: 5)
  - [ ] Finaliser les 2 pages (Customer apex + seller) avec `<EmptyState variant="warning">` + CTA renvoi natif KC, i18n FR/EN.
- [ ] **Task 4 — Redirect post-vérification** (AC: 3)
  - [ ] S'assurer que le retour KC post-verify passe par `/auth/callback` + `resolvePostLoginRedirect` (aucun nouveau code de décision).
- [ ] **Task 5 — Tests** (AC: 6)
  - [ ] Playwright : gating Customer/Pro + pages verify-email-required (FR/EN) + axe-core.

## Dev Notes

### Contexte réel

- **KC-native** : realm `verifyEmail: true` (`realm-base.json`), thème `infra/keycloak/themes/tukio/login/verify-email.ftl` + `email/` existants. La vérification (envoi, clic, `emailVerified=true`) est **gérée par Keycloak** — Tukio ne code plus le endpoint ni les tokens.
- **Redirect** : `resolvePostLoginRedirect` (`apps/gateway-api/src/infrastructure/http/utils/redirect-resolver.ts`, Story 1.4b) gère déjà toutes les destinations (client/pro/admin + statuts). Réutiliser, ne pas dupliquer (cf. Story 1.12 clôturée).
- **Gating** : claim JWT `email_verified` (custom claims realm Story 1.1) ; middleware Story 1.4d décode déjà le JWT. Les pages `verify-email-required` sont des placeholders posés par Story 1.2.
- **Resend** : Keycloak envoie via SMTP — configurer le realm SMTP vers Resend (Stories 0.20 Resend déjà en place pour le transactionnel pre-launch).

### Supprimé (ne plus implémenter)

`POST /v1/auth/email/verify`, `/validate`, `/resend` custom ; landing auto-verify ; `email_verification_tokens` (app) ; `useVerifyEmail` ; rate-limit custom resend. Tout est natif Keycloak.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` #Story 1.6 (re-scopée)]
- [Source: `docs/adr/0018-registration-keycloak-hosted-social-idp.md` #Decision pt.4 (email-verify natif)]
- [Source: `infra/keycloak/realm-config/realm-base.json` `verifyEmail`] + `themes/tukio/login/verify-email.ftl`.
- [Source: `apps/gateway-api/src/infrastructure/http/utils/redirect-resolver.ts`] — `resolvePostLoginRedirect`.
- Dépendances : Story 1.13 (realm + SMTP), Story 1.4d (middleware decode JWT).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
