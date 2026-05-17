# Runbook — KYC documents retention (RGPD)

**Story 1.3 (b/d)** — covers the lifecycle of `idCard`, `rib`, and
`kbisOrInsee` files uploaded by Pros during registration. The legal /
RGPD constraint is documented here so any future change to the retention
mechanics keeps the lawful-basis story intact.

## Where the data lives

| Layer            | Storage                                       | Object key shape                                          |
| ---------------- | --------------------------------------------- | --------------------------------------------------------- |
| File bytes       | Cloudflare R2 — `tukio-kyc-{env}` bucket      | `{proProfileId}/{docType}/{uuid}.{ext}` (SSE-S3 at rest)  |
| Object metadata  | `tukio_identity.pro_kyc_documents` Postgres   | `id`, `pro_profile_id`, `doc_type`, `r2_key`, `sha256`, `uploaded_at`, `reviewed_at`, `decision`, `deleted_at` |
| Admin-side audit | `tukio_identity.audit_log` (Story 2.7)        | `admin_action.kyc-reviewed`, `admin_action.kyc-overridden`|

## Retention policy

| Phase                       | Trigger                                  | Action                                                                                        | Mandate                                  |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Active                      | Upload at register time                  | R2 object created; row in `pro_kyc_documents` with `decision=NULL`                            | RGPD lawful basis: contract performance  |
| Reviewed / approved         | Admin approve (Story 2.3)                | `decision='approved'`, `reviewed_at=now()`. Files retained for the lifetime of the Pro account | Same                                     |
| Reviewed / rejected         | Admin reject (Story 2.3)                 | `decision='rejected'`, `reviewed_at=now()`. **90-day TTL** starts ticking                     | RGPD min-required principle              |
| Hard-delete (rejected)      | `reviewed_at + 90d`                      | Cron deletes R2 object + sets `deleted_at`. Row is preserved (truncated metadata only) for audit | RGPD art. 5(1)(e) — storage limitation   |
| Account deletion (Story 1.9)| User RGPD delete                         | Cron deletes all R2 objects + soft-anonymises `pro_kyc_documents` row                          | RGPD art. 17 right to erasure            |

> **Important:** the file bytes never get exposed publicly. Admin moderators
> read documents through short-lived (10 min) presigned R2 GET URLs minted
> server-side (Story 1.3b — `r2KycSignedUrlsTotal` Prom counter).

## Cron implementation (planned — Story 1.10)

```
# identity-svc cron job (NestJS @Cron, Europe/Paris)
0 3 * * *  prune-rejected-kyc-docs.task.ts
```

The job is **deferred to Story 1.10** because the rejection workflow does
not yet exist (Story 2.3 ships it). Story 1.3d only commits the data
model and the lifetime expectations.

Acceptance check for Story 1.10 wiring:

1. Pick a `pro_kyc_documents` row where `decision='rejected'` and
   `reviewed_at < now() - 90 days`.
2. After the cron tick: the R2 object is gone (`HEAD` returns 404) and the
   row has `deleted_at IS NOT NULL`.
3. Prom counter `tukio_r2_kyc_uploads_total{outcome="success"}` increases on
   re-upload but the deleted row is **not** restored — it's referenced only
   from the audit log.

## Manual operator actions

- **Force-delete a single Pro's KYC docs** (DPO request before Story 1.9
  ships) — run the SQL `UPDATE … SET deleted_at = now()` against the row
  AND issue `aws --endpoint-url … s3 rm` for the matching R2 key. Keep
  the operator id in the audit log.
- **Restore a wrongly-deleted document** — not possible after R2 delete
  (no versioning enabled on the KYC bucket). Re-request the document from
  the Pro and re-trigger the upload flow.

## See also

- `docs/runbook/pro-registration-debug.md` — debugging the upload path.
- `docs/runbook/insee-sirene-integration.md` — sibling external dep.
- ADR-008 — RGPD data classification (planning artefacts).
