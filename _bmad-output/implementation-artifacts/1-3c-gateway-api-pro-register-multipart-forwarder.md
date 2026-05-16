# Story 1.3c: gateway-api `POST /v1/auth/pro/register` (multipart) + forwarder vers identity-svc

Status: ready-for-dev

> 🧩 **Sub-story 3/4 de Story 1.3** (décomposée 2026-05-16 via `/bmad-correct-course`).
> Parent : `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` (umbrella source-of-truth des ACs/Dev Notes complets).
> Proposal : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-16.md`.
> Dépend de : **1.3a + 1.3b livrés + mergés**.
> Sub-story suivante : `1-3d-frontend-wizard-seller-middleware-e2e-observability`.

## Story

**As a** dev backend qui implémente Epic 1 Story 1.3,
**I want** que `apps/gateway-api` expose l'endpoint public `POST /v1/auth/pro/register` (multipart/form-data, 3 fichiers max 5 MB) qui :
1. Valide le multipart côté gateway via multer (3 fichiers, MIME whitelist `image/jpeg`, `image/png`, `application/pdf`, taille max 5 MB/file, total ≤ 15 MB) ;
2. Parse + valide les champs JSON `RegisterProInputSchema` via `ZodValidationPipe` (réutilise schema `@tukio/contracts/dtos/identity/register-pro` Story 1.3a) ;
3. Applique throttling Redis scope `pro-register` 3/min (anti-bruteforce sur création de compte sensible KYC) ;
4. Merge l'`acquisition` cookie `tk_acq` first-touch (réutilise pattern Story 1.2c `merge-acquisition.ts`) ;
5. Forwarde la requête multipart vers `POST /v1/internal/pros` sur identity-svc (Story 1.3b) via `RegisterProForwarder` (use case BFF Pretre) + `IdentitySvcClient.registerPro` qui reconstruit le multipart via `form-data` npm + signe HMAC `${ts}.POST.${path}.${sha256(body)}` (`InternalServiceGuard` Story 1.2b) ;
6. Map les erreurs identity-svc (`IdentityConflictException 409`, `IdentityValidationException 422`, `ExternalServiceException 502 INSEE/R2`) vers le `EnvelopeExceptionFilter` Story 1.2c qui produit l'enveloppe canonique `ErrorEnvelope` ;
7. Retourne `{ method:'POST', code:201, data:{ userId, proProfileId, requiresAdminReview:true, requiresEmailVerification:true }, meta:{ correlationId, locale, timestamp } }`,
**so that** le sub-story 1.3d (frontend wizard) puisse appeler cet endpoint depuis `apps/public` avec `withCredentials: true` + multipart FormData, et que **le pattern "multipart forwarder gateway → identity-svc"** soit canonique pour Stories 3.4 (photo upload listing → catalog-svc), 4.x (booking attachments → order-svc).

> **Outcome attendu** : à la fin de 1.3c, `pnpm --filter=gateway-api test:e2e auth-pro-register.e2e-spec.ts` passe (7+ cases : 201 happy, 422 Luhn, 422 INSEE inactive, 409 SIRET duplicate, 429 throttle, 502 INSEE down, multer reject file too large). `curl -X POST https://api.tukio.one/v1/auth/pro/register -F "data=@input.json" -F "idCard=@id.jpg" -F "rib=@rib.pdf"` retourne 201 enveloppe canonique (après merge 1.3d staging deploy).

## Acceptance Criteria (héritées de Story 1.3)

Cette story couvre **AC3** intégralement. Les ACs 1, 2, 4, 5, 6, 7, 8, 9, 10 sont couvertes par les autres sub-stories.

### AC1 (1.3c) — gateway-api endpoint multipart + throttler + acquisition merge

Voir parent ligne 191-281 pour la spec complète du endpoint.

- `apps/gateway-api/src/domain/ports/identity-svc.port.ts` (UPDATE Story 1.2c) — ajouter `registerPro(input: RegisterProInput, files: { idCard, rib, kbisOrInsee? }): Promise<RegisterProResponse>` à l'interface
- `apps/gateway-api/src/usecases/register-pro.forwarder.ts` (NEW) — forwarder Pretre (orchestre IdentitySvcClient + merge acquisition cookie)
- `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` (UPDATE Story 1.2c) — ajouter `registerPro` :
  ```ts
  async registerPro(input, files) {
    const form = new FormData();
    form.append('data', JSON.stringify(input));
    form.append('idCard', files.idCard.buffer, { filename: files.idCard.originalname, contentType: files.idCard.mimetype });
    form.append('rib', files.rib.buffer, ...);
    if (files.kbisOrInsee) form.append('kbisOrInsee', files.kbisOrInsee.buffer, ...);
    const body = form.getBuffer();
    const ts = Date.now().toString();
    const path = '/v1/internal/pros';
    const sig = hmac(this.secret, `${ts}.POST.${path}.${sha256(body)}`);
    return this.http.post(`${this.identityUrl}${path}`, body, {
      headers: { ...form.getHeaders(), 'X-Tukio-Timestamp': ts, 'X-Tukio-Signature': sig, 'X-Tukio-Correlation-Id': correlationId },
      maxContentLength: 16 * 1024 * 1024,
    });
  }
  ```
- `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.spec.ts` (UPDATE) — ajouter cases multipart + HMAC sur body bytes
- `apps/gateway-api/src/infrastructure/http/controllers/auth-pro.controller.ts` (NEW) :
  ```ts
  @Public()
  @Throttle({ 'pro-register': { limit: 3, ttl: 60_000 } })
  @Post('register')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'idCard', maxCount: 1 },
    { name: 'rib', maxCount: 1 },
    { name: 'kbisOrInsee', maxCount: 1 },
  ], multerConfig))
  async register(@Body('data', JsonZodPipe(RegisterProInputSchema)) input, @UploadedFiles() files, @Cookies('tk_acq') acqCookie?, @Headers('X-Tukio-Locale') locale?) {
    const merged = mergeAcquisition(input.acquisition, acqCookie);
    return this.forwarder.execute({ ...input, acquisition: merged, locale }, files);
  }
  ```
- `apps/gateway-api/src/infrastructure/http/utils/multer.config.ts` (NEW) — limits `{ fileSize: 5 * 1024 * 1024 }` + MIME whitelist `['image/jpeg','image/png','application/pdf']` + total files 3
- `apps/gateway-api/src/infrastructure/http/utils/sort-files-by-fieldname.ts` (NEW) — copy depuis identity-svc 1.3b (pattern partagé future `@tukio/utils` ?)
- `apps/gateway-api/src/app.module.ts` (UPDATE) — ajouter throttler config sensitive `'pro-register'` avec limit 3 + ttl 60_000 ms (réutilise Redis storage Story 1.2c)
- `apps/gateway-api/.env.example` (UPDATE) — ajouter `THROTTLER_PRO_REGISTER_LIMIT=3` + `THROTTLER_PRO_REGISTER_TTL_MS=60000`
- `apps/gateway-api/src/infrastructure/config/environment-config.service.ts` (UPDATE) — ajouter `getProRegisterThrottle()` Zod-validated
- `apps/gateway-api/test/auth-pro-register.e2e-spec.ts` (NEW) — Nest e2e harness + nock mock identity-svc, 7+ cases :
  1. 201 happy path : multipart 3 fichiers + champs valides → 201 enveloppe + cookies acquisition merged + correlation-id propagated
  2. 422 Luhn invalid : `siret: '12345678901235'` → 422 IDENTITY-VALIDATION-001
  3. 422 INSEE inactive : nock identity-svc retourne 422 IDENTITY-VALIDATION-003 → forwardé tel quel
  4. 409 SIRET conflict : nock identity-svc retourne 409 IDENTITY-CONFLICT-002 → forwardé
  5. 429 throttle : 4ᵉ requête dans la fenêtre 60s → 429 RATE-LIMIT-EXCEEDED-001 + Retry-After header
  6. 502 INSEE down : nock identity-svc retourne 502 IDENTITY-EXTERNAL-002 → forwardé
  7. multer reject : file 6 MB → 422 envelope ValidationFailed (multer kicks in before controller)
  8. (bonus) acquisition cookie merge : cookie `tk_acq=base64(...)` + input.acquisition.utm_campaign='X' → merged dans payload forwardé (first-touch wins sur source/medium/campaign, last-touch sur content/term)

### Hors scope 1.3c
- identity-svc infra (1.3b)
- Frontend (1.3d)
- E2E Playwright frontend (1.3d)
- Observability + Grafana + runbooks (1.3d)

## Tasks / Subtasks

- [ ] **Task 1 — Port + forwarder + IdentitySvcClient extension** (AC: #1) — Story 1.3 parent Task 6.1-6.3
  - [ ] 1.1 — Update `domain/ports/identity-svc.port.ts` (ajouter `registerPro`)
  - [ ] 1.2 — Créer `usecases/register-pro.forwarder.ts`
  - [ ] 1.3 — Update `identity-svc.client.ts` (multipart via form-data + HMAC body bytes)
  - [ ] 1.4 — `pnpm --filter=gateway-api add form-data`
  - [ ] 1.5 — Update `identity-svc.client.spec.ts` (cases multipart + HMAC)

- [ ] **Task 2 — Controller `POST /v1/auth/pro/register` + multer config + throttler** (AC: #1) — Story 1.3 parent Task 6.4-6.9
  - [ ] 2.1 — Vérifier `multer` + `@types/multer` (sinon installer)
  - [ ] 2.2 — Créer `multer.config.ts` (5 MB/file + MIME whitelist)
  - [ ] 2.3 — Créer `utils/sort-files-by-fieldname.ts`
  - [ ] 2.4 — Créer `auth-pro.controller.ts` (FileFieldsInterceptor + throttle scope `pro-register` 3/min + merge acquisition)
  - [ ] 2.5 — Update `app.module.ts` (throttler config `'pro-register'`)
  - [ ] 2.6 — Update `.env.example` (2 throttler vars)
  - [ ] 2.7 — Update `environment-config.service.ts` + Zod schema

- [ ] **Task 3 — Tests E2E backend** (AC: #1) — Story 1.3 parent Task 6.10
  - [ ] 3.1 — Créer `test/auth-pro-register.e2e-spec.ts` (Nest e2e + nock identity-svc, 7+ cases)
  - [ ] 3.2 — `pnpm --filter=gateway-api test:e2e auth-pro-register.e2e-spec.ts` pass
  - [ ] 3.3 — `pnpm --filter=gateway-api lint && typecheck && test` → 0 errors

## Dev Notes

### Patterns réutilisés (cohérent Story 1.2c)
- `EnvelopeExceptionFilter` — handle `IdentityConflictException`, `IdentityValidationException`, `ExternalServiceException` toutes natives Story 1.3a, mapping auto vers `ErrorEnvelope` avec `tukioCode`
- `ThrottlerModule` Redis storage — scope `'pro-register'` indépendant du scope `'auth-register'` (Customer Story 1.2c) ; les 2 scopes coexistent dans la même config
- `merge-acquisition.ts` — pattern Story 1.2c first-touch source/medium/campaign / last-touch content/term ; le `tk_acq` cookie est partagé entre Customer et Pro signup (cohérent UTM attribution)
- `InternalServiceGuard` HMAC body bytes — le body multipart est signé par sha256(buffer concat de tous les parts boundary inclus) ; identique signature au pattern Story 1.2c JSON

### Pas de cookie split entre Customer et Pro
- L'acquisition cookie `tk_acq` est partagé : si un visiteur landing en `?utm_source=google_ads` puis switche vers `?role=pro` au sign-up, son first-touch est conservé. C'est conforme à la spec K-04 first-touch wins du plan d'acquisition.

### Hors scope (couvert ailleurs)
- Use case Pretre `RegisterProUseCase` (1.3a — domain pur)
- Infrastructure INSEE/R2/DB (1.3b — adapters)
- Frontend wizard (1.3d)
- Tests Playwright frontend (1.3d)
- Observability (1.3d)

## File List
_(à remplir pendant le dev)_

## Change Log
_(à remplir pendant le dev)_

## Story Completion Status
- [ ] All tasks complete
- [ ] `pnpm --filter=gateway-api test:e2e auth-pro-register` pass (7+ cases)
- [ ] `pnpm --filter=gateway-api lint && typecheck && test` pass (régression Story 1.2c)
- [ ] Status updated to `review` then `done` après code-review
