# Runbook — Customer Registration Debug

Story 1.2 (1.2a–1.2d) · Epic 1 — Identity & Authentication Backbone

## Flow Overview

```
Browser
  → tukio.one/fr/auth/sign-up      (Next.js apps/public)
  → POST /v1/auth/customer/register (gateway-api :4000, public, @Throttle 5/min)
  → POST /internal/customers        (identity-svc :4001, HMAC-signed InternalServiceGuard)
      ├─ Keycloak Admin API          (register user + assign role `client`)
      ├─ Postgres                    (INSERT user_profiles row, INSERT outbox row ×2)
      └─ NATS JetStream              (OutboxRelayService publishes identity.user.registered.v1 + notification.email.send.v1)
```

**correlation-id** — `X-Tukio-Correlation-Id` propagated from browser → gateway-api → identity-svc. Every log line should include it.

## Prometheus Alerts

| Alert | Condition | Runbook section |
|---|---|---|
| RegistrationErrorRate | error rate > 5% on 5 min | #rate-limit / #keycloak-down |
| RegistrationLatency | p95 > 5s on 5 min | #identity-svc-slow |

Grafana dashboard: `infra/k8s/grafana-dashboards/identity-registration.json`

## Troubleshooting

### 429 Too Many Requests (rate limit)

The gateway-api `@Throttle({ default: { limit: 5, ttl: 60_000 } })` limits to 5 req/min per IP.

**Check**: `redis-cli TTL "throttle_default_<ip>_default"` — should be 0–60.

**If legitimate burst**: Increase `THROTTLER_SENSITIVE_LIMIT` env var on gateway-api and redeploy.

**If attack**: Block at Cloudflare/load-balancer level by IP.

### 409 Conflict — Email already registered

Anti-énumération (NFR9): the UI shows a generic message. The actual conflict is logged server-side.

**Check gateway-api** for `IDENTITY-CONFLICT-001` with the correlationId.

**Check identity-svc** Postgres: `SELECT id, tukio_status FROM user_profiles WHERE email_hash = encode(digest('<email>', 'sha256'), 'hex')` (requires `CREATE EXTENSION pgcrypto;`).

### Keycloak DOWN (identity-svc returns IDENTITY-EXTERNAL-001 / 502 from gateway)

**Symptoms**: registration surfaces 502 to the client; `IDENTITY-EXTERNAL-001` in logs.

**Check**:
```bash
curl http://localhost:8080/realms/tukio/.well-known/openid-configuration
# should return 200 JSON

docker compose -f infra/docker-compose/docker-compose.dev.yml ps keycloak
# should show status "healthy"
```

**Resolution**:
1. Restart Keycloak: `docker compose -f infra/docker-compose/docker-compose.dev.yml restart keycloak`
2. Wait for health: `docker compose -f infra/docker-compose/docker-compose.dev.yml logs -f keycloak | grep "started"`
3. If Keycloak user was created but DB row was not: the `registerCustomer` use case runs Keycloak FIRST then DB. A DB failure after Keycloak success triggers a Keycloak user deletion (compensation). Check identity-svc logs for `compensate: deleting Keycloak user`.

### DB Transaction Rollback / Keycloak Compensation

If Postgres is down AFTER the Keycloak user was created, identity-svc compensates:
1. Catches `QueryFailedError` from TypeORM in `runInTransaction`.
2. Calls `keycloakAdmin.deleteUser(keycloakUserId)` in the `finally` block.
3. Re-throws as `ExternalServiceException`.

**Check**: `docker logs identity-svc | grep "compensate"`.

**If compensation fails** (Keycloak also down): an orphan Keycloak user is left. Manual cleanup:
```bash
# Get admin token
TOKEN=$(curl -s -X POST http://localhost:8080/realms/tukio/protocol/openid-connect/token \
  -d 'grant_type=client_credentials&client_id=tukio-api&client_secret=<secret>' | jq -r .access_token)

# Find and delete user
USER_ID=$(curl -s "http://localhost:8080/admin/realms/tukio/users?email=<email>" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
curl -X DELETE "http://localhost:8080/admin/realms/tukio/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### NATS DOWN / Outbox Accumulation

Registration still succeeds (outbox is transactional). Events accumulate in `outbox` table until NATS recovers.

**Check**: `SELECT COUNT(*), MIN(created_at) FROM outbox WHERE delivered_at IS NULL;`

**Resolution**: Start NATS: `docker compose -f infra/docker-compose/docker-compose.dev.yml restart nats`

The `OutboxRelayService` will replay pending events on reconnect.

### identity-svc Slow (p95 > 5s)

The Keycloak Admin API `getUserByEmail` and `createUser` calls are typically 100–500ms. If consistently > 2s:

1. Check Keycloak heap: `docker stats keycloak`
2. Check Postgres connection pool: identity-svc logs `QueryRunner connect` timing
3. Check `KEYCLOAK_ADMIN_TOKEN_EXPIRY_BUFFER_SECONDS` — default 60s. If the service-account token expires every request, latency spikes.

## Useful Queries

```bash
# Find registration by correlationId in identity-svc logs (docker dev)
docker logs identity-svc 2>&1 | grep '<correlationId>'

# Check user in Postgres
psql $DATABASE_URL -c "SELECT id, email_hash, tukio_status, email_verified, created_at FROM user_profiles ORDER BY created_at DESC LIMIT 10;"

# Check outbox events
psql $DATABASE_URL -c "SELECT event_type, aggregate_id, delivered_at, created_at FROM outbox ORDER BY created_at DESC LIMIT 20;"

# HMAC secret check (gateway-api and identity-svc must match)
echo $TUKIO_INTERNAL_SERVICE_SECRET | wc -c  # should be ≥ 32 chars + newline
```

## Key Environment Variables

| Service | Variable | Purpose |
|---|---|---|
| gateway-api | `TUKIO_INTERNAL_SERVICE_SECRET` | HMAC key for `/internal/*` calls |
| gateway-api | `IDENTITY_SVC_URL` | identity-svc base URL |
| gateway-api | `THROTTLER_SENSITIVE_LIMIT` | rate limit on register (default 5/min) |
| identity-svc | `KEYCLOAK_URL` | Keycloak base URL |
| identity-svc | `KEYCLOAK_CLIENT_SECRET_TUKIO_API` | Service-account secret |
| identity-svc | `TUKIO_INTERNAL_SERVICE_SECRET` | Must match gateway-api |

## On-call Escalation

If the issue cannot be resolved in 15 min: escalate to the Platform team with:
- The `correlationId` from the failing request
- Relevant log window (last 100 lines from gateway-api + identity-svc)
- Current Grafana error rate + p95 screenshot
