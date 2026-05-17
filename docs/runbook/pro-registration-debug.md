# Runbook — Pro registration debug

**Story 1.3 (a-bis/b-bis/c/d v2)** — covers the end-to-end flow `apps/public` →
`gateway-api` → `identity-svc` → INSEE SIRENE + Keycloak + Cloudflare R2.
Use this runbook when a Pro reports they cannot complete the wizard, the
admin queue is empty after a known submission, or the Grafana
`pro-registration` dashboard shows an outcome spike.

## 0. Triage in 60 seconds

1. Grafana → `Tukio — Pro Registration (Story 1.3d)` dashboard (UID
   `tukio-pro-registration`). Read the **outcome split** panel: which
   outcome is firing? `throttled`, `external_unreachable`, `conflict`,
   `validation_failed` all point to different sub-systems.
2. If everything is at `0`: the gateway-api is not receiving the request →
   jump straight to §1 (frontend).
3. If success is flat-lining but latency p95 has spiked: jump to §2
   (gateway-api) or §3 (identity-svc) depending on where the histogram
   ramped.

## 1. Frontend (apps/public wizard)

Symptoms: nothing in gateway-api logs; user reports a blank wizard, broken
CSS, or a network error before submit.

Checks:

- Browser devtools network tab — is the `POST /v1/auth/pro/register`
  actually firing? If the button stays in `Envoi en cours…` forever, the
  axios timeout (60s — bumped in `SignUpProProviders`) fires and you should
  see an `ApiError {network}` in the console.
- Confirm `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SELLER_BASE_URL` are set
  on the public app deployment. In dev: 4000 and 3002 respectively.
- next-intl rendering: if you see a raw key like `seller.onboarding.cta.submit`
  on screen, the locale message JSON is missing the entry. Run
  `pnpm --filter=public test` — the JSON parse test will fail loud.
- File rejections come from `@tukio/ui/file-upload` (MIME / size). Check the
  error label under each FileUpload slot.

## 2. Gateway-api (`apps/gateway-api`)

Symptoms: Prom counter `tukio_register_pro_total{outcome="throttled"}`
spikes, or 5xx logs in `gateway-api.log`.

Checks:

- Logs: `docker logs gateway-api | grep -E "register-pro|RegisterPro"`.
  Look for the `tukio.correlation_id` of the failing call and trace it
  forward into identity-svc.
- Rate limit: 3 / minute / IP at `/v1/auth/pro/register` (hardcoded in
  `auth-pro.controller.ts` `@Throttle({ default: { limit: 3, ttl: 60_000 } })`).
  Redis backs the throttle store — `redis-cli KEYS 'throttler:*pro*'` shows
  the active windows.
- Multipart guardrails (registered in `main.ts`): per-file 5 MB, 3 files,
  5 parts total, 1 MB fieldSize. Breaches are translated to `413
  PayloadTooLargeException` in `parse-multipart-pro-register.ts`. If the
  user reports the wizard returning a generic 500, this translation may
  have regressed.
- HMAC headers sent to identity-svc: `x-internal-service-token`,
  `x-internal-service-timestamp`, `x-internal-service-body-sha256`. The
  body sha256 is a deterministic sentinel (`MULTIPART_BODY_HASH_SENTINEL`)
  because Fastify cannot expose the raw multipart body before
  `req.parts()` — see ADR-006 / Story 1.3c.
- Timeout to identity-svc: `IDENTITY_SVC_TIMEOUT_MS` defaults to 30s. With
  16 MB max payload + INSEE + R2 + Keycloak, p95 should sit < 6s.

## 3. Identity-svc (`apps/identity-svc`)

Symptoms: `tukio_insee_calls_total{outcome!="success_active"}` spikes, or
`r2-kyc` upload counter shows `fail`.

Checks (INSEE):

- `INSEE_API_KEY` env var present in droplet secrets — never committed.
  Rotate via DO secret store; bounce identity-svc to pick up.
- INSEE rate limit: 30 req/min/key. If `outcome="rate_limited"` is firing,
  request a quota lift from INSEE or stagger calls.
- INSEE down: outcome `unreachable`. The validator surfaces this as
  `EXTERNAL-002` to the caller (mapped to 502 by gateway-api). Wizard
  shows the `errors.external` toast.
- ADR-006 documents the apiKey-vs-OAuth2 deviation — see
  `insee-sirene-integration.md`.

Checks (R2 KYC):

- Bucket `tukio-kyc-staging` (or `…-prod`) reachable from the droplet?
  `aws --endpoint-url <r2 endpoint> s3 ls s3://tukio-kyc-staging` should
  list the latest uploads.
- R2 credentials in droplet secret store. SSE-S3 enabled.
- Upload fail spike → check Cloudflare R2 dashboard for the bucket health.

Checks (Keycloak):

- A `tukio_register_pro_total{outcome="conflict"}` spike with no signal in
  INSEE/R2 metrics usually means SIRET-or-email already exists. Search the
  Keycloak admin console for the duplicate email; check the
  `pros.siret_unique` Postgres constraint.
- A `validation_failed` spike on otherwise-valid input usually means a
  Zod schema mismatch between `RegisterProInputSchema` (Story 1.3a) and
  the wizard's `AccountStepSchema` / `CompanyStepSchema` (Story 1.3d). The
  CI typecheck job catches drift; investigate the diff between contracts
  releases.

## 4. Admin review (Story 2.3 / 2.4)

If the wizard reports success but the admin queue is empty:

- The Pro lands in Keycloak with `tukio:status = pending_admin_review`.
- The seller-app middleware (Story 1.3d) redirects them to
  `/seller/onboarding/pending` for any non-whitelist /seller path. If a
  newly-registered Pro can browse `/seller/listings`, the middleware
  cookie read regressed — see `pendingAdminReviewRedirect` unit spec.
- The admin verification queue (Story 2.3) reads from the same Keycloak
  attribute. If the queue is empty, search Keycloak by attribute
  `tukio:status` directly.

## 5. Escalation

- INSEE quota exhausted → escalate to the data-ops on call.
- R2 bucket compromised / data leak → escalate to the security on call;
  rotate R2 keys via DO secret store; freeze new pro registrations by
  setting the gateway-api Throttle to `0/min` until cleared.
- Story 1.4 (login) regressions can manifest here once shipped; cross-link
  with `customer-registration-debug.md`.
