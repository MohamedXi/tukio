# Story 1.3c: gateway-api `POST /v1/auth/pro/register` (multipart) + forwarder vers identity-svc

Status: done

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

- [x] **Task 1 — Port + forwarder + IdentitySvcClient extension** (AC: #1) — Story 1.3 parent Task 6.1-6.3
  - [x] 1.1 — Update `domain/ports/identity-svc.port.ts` (ajouter `registerPro` + `ForwardRegisterProInput` + `RegisterProForwardedFile`)
  - [x] 1.2 — Créer `usecases/register-pro.forwarder.ts` (BFF Pretre forwarder + mapping erreurs)
  - [x] 1.3 — Update `identity-svc.client.ts` (multipart via form-data + HMAC `MULTIPART_BODY_HASH_SENTINEL` côté gateway — dévie du spec body-bytes : Fastify ne peut pas exposer le raw body au guard avant `req.parts()`, alignement avec identity-svc Story 1.3b D1)
  - [x] 1.4 — `pnpm --filter=gateway-api add form-data @fastify/multipart`
  - [x] 1.5 — Update `identity-svc.client.spec.ts` (6 cas registerPro : signature sentinel + kbisOrInsee inclus + 409 / 422 / 502 / malformed envelope)

- [x] **Task 2 — Controller `POST /v1/auth/pro/register` + Fastify multipart + throttler** (AC: #1) — Story 1.3 parent Task 6.4-6.9
  - [x] 2.1 — Dévie du spec : gateway-api tourne sur Fastify (cf. Story 1.2c), donc utilisation de `@fastify/multipart` + parser custom au lieu de `multer` + `FileFieldsInterceptor` (pattern aligné avec identity-svc 1.3b)
  - [x] 2.2 — Créer `infrastructure/http/utils/parse-multipart-pro-register.ts` (MIME whitelist `image/jpeg` / `image/png` / `application/pdf`, fileSize 5 MB, traduction `FST_REQ_FILE_TOO_LARGE` → 413 `PayloadTooLargeException`, validation Zod du `payload` JSON)
  - [x] 2.3 — N/A : pattern identity-svc 1.3b utilise structural `MultipartRequest` ; pas de `sort-files-by-fieldname.ts` séparé
  - [x] 2.4 — Créer `auth-pro.controller.ts` (Fastify `@Req()` + `@Public()` + `@Throttle({ default: { limit: 3, ttl: 60_000 } })` + merge acquisition first-touch)
  - [x] 2.5 — Update `main.ts` (register `@fastify/multipart` avec `throwFileSizeLimit: true` + caps fileSize 5 MB / files 3 / parts 5 / fieldSize 1 MB) + ajout `AuthProController` dans `HttpModule`
  - [x] 2.6 — Update `.env.example` (`THROTTLER_PRO_REGISTER_LIMIT=3` + `THROTTLER_PRO_REGISTER_TTL_MS=60000`)
  - [x] 2.7 — Update `env.schema.ts` + `IConfigService.ThrottlerConfig` + `EnvironmentConfigService.getThrottlerConfig().proRegisterLimit/proRegisterTtlMs`

- [x] **Task 3 — Tests E2E backend** (AC: #1) — Story 1.3 parent Task 6.10
  - [x] 3.1 — Créer `test/auth-pro-register.e2e-spec.ts` (11 cas — Nest e2e harness + Fastify multipart enregistré + mock `IIdentitySvcClient` + `form-data` côté test : 201 happy, 422 Luhn, 409 SIRET conflict forwardé, 422 INSEE inactive forwardé avec issues, 502 INSEE down, 429 throttle 4ᵉ requête, tk_acq cookie wins, 400 MIME disallowed, 413 oversize > 5 MB, 400 rib missing, X-Tukio-Correlation-Id propagé)
  - [x] 3.2 — `pnpm --filter=gateway-api test:e2e` pass (17/17 — 11 nouveaux + 6 customer regression)
  - [x] 3.3 — `pnpm --filter=gateway-api lint && typecheck && test` → 0 errors (5 suites / 41 unit tests pass — pre-existing `@tukio/auth-client` `next/server.js` typecheck error hors scope)

### Review Findings (AI — 2026-05-17)

Blind Hunter + Edge Case Hunter + Acceptance Auditor parallèles (Sonnet 4.6). 10 dismissed, 4 deferred.

#### Decisions

- [x] [Review][Decision] D1 — Throttle env vars morts + scope 'default' au lieu de 'pro-register' nommé — **Résolu Option B** : suppression des dead env vars (`THROTTLER_PRO_REGISTER_LIMIT/TTL_MS`) de env.schema + config.port + service + .env.example. Valeurs hardcodées dans le controller (cohérent Story 1.2c pattern). — `THROTTLER_PRO_REGISTER_LIMIT/TTL_MS` sont validés dans env.schema + exposés via `ThrottlerConfig` mais jamais consommés ; `@Throttle({ default: { limit: 3, ttl: 60_000 } })` hardcode les valeurs à la compilation. Le spec AC1 exige un scope nommé `'pro-register'` dans `app.module.ts`. Deux options : (A) Enregistrer un second throttler nommé `'proRegister'` dans ThrottlerModule + utiliser `@Throttle({ proRegister: { limit: proRegisterLimit, ttl: proRegisterTtlMs } })` (flexibilité ops) ; (B) Supprimer les env vars morts et garder les valeurs hardcodées (simplifier). Choisir.

#### Patches

- [x] [Review][Patch] P1 — FST_PARTS_LIMIT / FST_FILES_LIMIT surfacent en 500 [parse-multipart-pro-register.ts:catch] — **Résolu** : `isFileTooLargeError` étendue en `isFastifyMultipartLimitError` (Set des 4 codes FST_*) → 413. 4 paramétrisés `.each()` dans le spec.
- [x] [Review][Patch] P2 — `valueTruncated` non vérifié pour le field `payload` [parse-multipart-pro-register.ts:field-parse] — **Résolu** : contrôle `valueTruncated === true` avant stockage du JSON → 413 PayloadTooLargeException.
- [x] [Review][Patch] P3 — `originalName` forwarded verbatim sans sanitization [parse-multipart-pro-register.ts:toBuffer] — **Résolu** : ajout `sanitizeFilename()` (strip traversal + non-alphanum → `_`, cap 200 chars, fallback `'upload'`).
- [x] [Review][Patch] P4 — `IDENTITY_SVC_TIMEOUT_MS` default 5s trop court pour upload 16 MB [env.schema.ts:L22] — **Résolu** : relevé à 30 000 ms avec commentaire dans env.schema + .env.example.

#### Deferred

- [x] [Review][Defer] W1 — Throttler keyed sur proxy IP (`trustProxy` absent) [main.ts:FastifyAdapter] — `FastifyAdapter({ logger: false })` sans `trustProxy: true` : `req.ip` = IP du reverse proxy (Caddy) en prod, pas l'IP réelle du client. La limite 3/min est partagée par tous les utilisateurs derrière le proxy. Pre-existing depuis Story 1.2c (affecte aussi `/v1/auth/customer/register`). Ticket séparé.
- [x] [Review][Defer] W2 — POST retry sur erreurs réseau/5xx potentiellement non-idempotent [identity-svc.client.ts:axiosRetry] — `err.response.status >= 500` déclenche le retry pour POST. Si identity-svc crée Keycloak user mais échoue avant DB, la compensation saga de 1.3a devrait annuler, mais pas garanti. Mitigé par contraintes DB (email/SIRET unique → 409 en cas de doublon). Pre-existing depuis 1.2c. Fix propre : idempotency key header — V1.
- [x] [Review][Defer] W3 — Validation MIME par Content-Type header client seul, pas magic bytes [parse-multipart-pro-register.ts:ALLOWED_MIME_TYPES] — Un client peut uploader un fichier exécutable avec `Content-Type: image/jpeg`. Risk limité si R2 ne sert pas les fichiers KYC publiquement (accès signé uniquement). Magic byte validation V1 hardening (npm `file-type`).
- [x] [Review][Defer] W4 — `form.getBuffer()` double le pic mémoire (~32 MB/requête) [identity-svc.client.ts:registerPro] — `toBuffer()` matérialise 3 × 5 MB puis `form.getBuffer()` concat une deuxième fois. Pic RSS ~32 MB par requête concurrente. Optimisation V1 : passer `form` directement comme stream body axios.

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

### NEW
- `apps/gateway-api/src/usecases/register-pro.forwarder.ts`
- `apps/gateway-api/src/usecases/register-pro.forwarder.spec.ts`
- `apps/gateway-api/src/infrastructure/http/controllers/auth-pro.controller.ts`
- `apps/gateway-api/src/infrastructure/http/utils/parse-multipart-pro-register.ts`
- `apps/gateway-api/src/infrastructure/http/utils/parse-multipart-pro-register.spec.ts`
- `apps/gateway-api/test/auth-pro-register.e2e-spec.ts`

### MODIFIED
- `apps/gateway-api/src/domain/ports/identity-svc.port.ts` (+`registerPro` / +`ForwardRegisterProInput` / +`RegisterProForwardedFile`)
- `apps/gateway-api/src/domain/ports/config.port.ts` (+`proRegisterLimit` / +`proRegisterTtlMs` on `ThrottlerConfig`)
- `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` (+`registerPro` + `MULTIPART_BODY_HASH_SENTINEL` + multipart envelope)
- `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.spec.ts` (+6 cases `registerPro` + `nock.activate()` guard against customer-suite `nock.restore()`)
- `apps/gateway-api/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` (+`REGISTER_PRO_FORWARDER` + factory)
- `apps/gateway-api/src/infrastructure/http/http.module.ts` (+`AuthProController`)
- `apps/gateway-api/src/infrastructure/config/env.schema.ts` (+2 throttler env vars)
- `apps/gateway-api/src/infrastructure/config/environment-config.service.ts` (+throttler getters)
- `apps/gateway-api/src/main.ts` (`@fastify/multipart` register with limits)
- `apps/gateway-api/src/usecases/register-customer.forwarder.spec.ts` (mock now provides `registerPro` stub to satisfy full port)
- `apps/gateway-api/test/auth-customer-register.e2e-spec.ts` (TestForwarderModule now provides `REGISTER_PRO_FORWARDER` for HttpModule wiring)
- `apps/gateway-api/.env.example` (2 throttler env vars)
- `apps/gateway-api/package.json` (deps `form-data` + `@fastify/multipart`; jest module-mapper extended with `.dto.ts` fallback to align with identity-svc)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1.3c → in-progress → review)
- `_bmad-output/implementation-artifacts/1-3c-gateway-api-pro-register-multipart-forwarder.md` (Tasks/File List/Change Log/Status)

## Change Log

| Date | Change | Notes |
| ---- | ------ | ----- |
| 2026-05-17 | Implemented `registerPro` end-to-end on gateway-api BFF | New `POST /v1/auth/pro/register` (Fastify multipart) forwards to identity-svc `POST /v1/internal/pros` (Story 1.3b). Throttled 3/min, merges `tk_acq` first-touch acquisition cookie, signs HMAC with `MULTIPART_BODY_HASH_SENTINEL` (aligned with identity-svc 1.3b D1 — Fastify cannot expose multipart raw body to the guard). 41 unit + 17 e2e tests pass. |

### Deviations from story spec
- **Multipart parsing** : story called for `multer` + `FileFieldsInterceptor`. Gateway-api runs on Fastify (consistent with Story 1.2c) → switched to `@fastify/multipart` + custom parser (`parse-multipart-pro-register.ts`), same shape as identity-svc Story 1.3b for symmetry.
- **HMAC body-hash** : story called for HMAC over `${ts}.POST.${path}.${sha256(body)}`. Fastify cannot expose the raw multipart body to `InternalServiceGuard` (parsing is opt-in at controller time). Both ends use the fixed `MULTIPART_BODY_HASH_SENTINEL = sha256('TUKIO_MULTIPART_NO_BODY_HASH')` as already accepted in identity-svc Story 1.3b code-review (D1). HMAC still binds (ts, method, path, sentinel) — within 5 min replay window, a network-internal attacker could tamper the body. Accepted for MVP given the DO firewall + V1+ mTLS plan.
- **Payload field name** : story spec mentioned `data`; identity-svc Story 1.3b parser expects `payload`. Aligned with the server (`payload`).
- **Multipart field Content-Type** : `form.append('payload', JSON.stringify(payload))` is sent WITHOUT `contentType: 'application/json'` — `@fastify/multipart` auto-parses JSON-typed fields, which would silently break the server-side `JSON.parse(payloadJson)` step.
- **Oversize handling** : added explicit `FST_REQ_FILE_TOO_LARGE` → 413 `PayloadTooLargeException` translation in the parser (raw FastifyError otherwise bubbles as 500 INTERNAL-SERVER-ERROR-001).

### Pre-existing issues observed (out of scope)
- `@tukio/auth-client` typecheck fails on `next/server.js` import resolution — present on `develop` before this branch.
- `@tukio/i18n-client` Vitest fails on `next/server.js` / `next/link` import — present on `develop` before this branch.
- Both should be picked up separately (probably Story 1.6 or a sprint-status follow-up entry).

## Story Completion Status
- [x] All tasks complete
- [x] `pnpm --filter=gateway-api test:e2e auth-pro-register` pass (11 cases — 4 more than required)
- [x] `pnpm --filter=gateway-api lint && typecheck && test` pass (regression Story 1.2c verified — customer e2e still green)
- [x] Status updated to `review` (sprint-status.yaml + this file)
