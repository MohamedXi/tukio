# Runbook — INSEE SIRENE integration

**Story 1.3b/d** — INSEE SIRENE is the registry of all French legal
entities. We use it to validate that the SIRET a Pro submits at
registration corresponds to a real, active legal entity. This document
captures the **API choice deviation**, the auth model, rate limits, and
operational gotchas.

## Auth model — apiKey vs OAuth2 (deviation)

The architecture spec (planning artefacts §INSEE) describes OAuth2 client
credentials. **We deviate to direct apiKey** because:

- INSEE published a new auth model in 2024 that supersedes the legacy
  OAuth2 endpoint with a per-key header (`X-INSEE-Api-Key-Integration`).
- The OAuth2 endpoint requires a TLS client cert handshake against a
  legacy gateway that DO Droplets cannot reach without an outbound proxy.
- The apiKey model is simpler, sufficient for our access pattern (max 1
  call per Pro registration), and the only currently-documented option on
  api.insee.fr.

Concretely:

```
GET https://api.insee.fr/api-sirene/3.11/siret/{siret}
Headers:
  X-INSEE-Api-Key-Integration: <secret apiKey, droplet env var only>
  Accept: application/json
```

The apiKey lives in droplet secrets as `INSEE_API_KEY`. **Never committed
to git.** Rotate via DO secret store → `systemctl restart identity-svc`.

## Rate limits

- **30 requests / minute / apiKey** (free tier). Bursts beyond → INSEE
  returns 429 with a `Retry-After` header. The validator
  (`InseeSiretValidatorService`) surfaces this as
  `tukio_insee_calls_total{outcome="rate_limited"}` and propagates a
  `EXTERNAL-002` to the caller — the wizard shows the generic external
  toast.
- If we hit the cap recurrently: request quota uplift via the INSEE
  contact form (turn-around: ~2 weeks) OR introduce server-side caching
  for known-valid SIRETs (90-day TTL since the SIRENE register changes
  slowly).

## Outcomes the validator surfaces

| INSEE response                            | Outcome label       | tukio code              | UX banner                |
| ----------------------------------------- | ------------------- | ----------------------- | ------------------------ |
| 200 + `etablissement.etatAdministratif=A` | `success_active`    | (none — happy)          | n/a                      |
| 200 + `etatAdministratif=F` (fermé)       | `success_inactive`  | `IDENTITY-VALIDATION-003` | inline SIRET inactive    |
| 404                                       | `not_found`         | `IDENTITY-VALIDATION-003` | inline SIRET inactive    |
| 429                                       | `rate_limited`      | `EXTERNAL-002`          | generic external toast   |
| 5xx or network                            | `unreachable`       | `EXTERNAL-002`          | generic external toast   |

## Fallback strategy

INSEE is not on the booking critical path — only the registration path.
If INSEE goes down:

- Pros cannot register **until INSEE recovers**.
- The wizard surfaces a clear external-error toast (FR
  *"Service de validation momentanément indisponible…"*).
- We do **not** queue submissions for later validation: the SIRET check is
  a security guardrail to keep the marketplace catalog clean. The product
  trade-off is acknowledged in PRD-NFR48.

If INSEE is unreachable for > 1h:

1. Alert lands in `#tukio-alerts-identity` Slack channel (Story 4.13 relay
   pattern, reusing the saga-watchdog flow for the
   `tukio_insee_calls_total{outcome="unreachable"}` increase).
2. Manual override flag (planned Story 1.10) lets ops switch the
   validator to **trust-but-flag** mode: registration goes through and
   the SIRET row is tagged `requires_manual_review`. **Never enable in
   production without the security on-call** because it bypasses the
   anti-fraud check.

## See also

- `docs/runbook/pro-registration-debug.md`
- `docs/runbook/kyc-docs-retention.md`
- ADR-006 — INSEE integration design notes (planning artefacts).
- Story 1.3a `RegisterProInputSchema.SiretSchema` — client-side Luhn
  check (catches typos before reaching INSEE).
