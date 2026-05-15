# @tukio/auth

NestJS backend auth — Keycloak JWT RS256 guard + RBAC + JWKS cache for Tukio microservices.

## Quick-start

```ts
// app.module.ts
TukioAuthModule.forRootAsync<[EnvironmentConfigService]>({
  inject: [EnvironmentConfigService],
  useFactory: (config) => ({
    keycloakUrl: config.getKeycloakConfig().url,
    realm: config.getKeycloakConfig().realm,
    clientId: config.getKeycloakConfig().clientId,
    audience: config.getKeycloakConfig().audience,
  }),
}),
// + { provide: APP_GUARD, useClass: KeycloakJwtGuard }
```

## Protecting endpoints

```ts
@Controller('users')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('client', 'pro')
export class UserController {
  @Get(':id')
  async getUser(@CurrentActor() actor: BackendActor) { ... }

  @Public() @Get('/health') health() { ... }
}
```

## Realm dependency (Story 1.1)

This package requires the `tukio` Keycloak realm provisioned via Story 1.1:

```sh
pnpm docker:up:wait && pnpm keycloak:bootstrap
```

**JWKS endpoint**: `${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/certs`
(cached 10 min by `JwksCacheService`)

**Custom JWT claims** emitted by the realm:

- `tukio:locale` — user locale (`fr` | `en`), default `fr`
- `tukio:status` — account status (`active` | `pending_admin_review` | `rejected` | `suspended`)
- `aud: ["tukio-api"]` — validated by `KeycloakJwtGuard`
- `realm_access.roles` — contains one of `client` | `pro` | `admin-support` | `admin-modo` | `admin-super`
- `amr` — includes `totp` after MFA; consumed by `@RequireMfa()` via `payload.amr.includes('totp')`
- `acr === '2'` — fallback MFA indicator (resilience for future Keycloak versions)

See `infra/scripts/bootstrap-keycloak-realm.sh` and `docs/runbook/keycloak-realm-bootstrap.md`.

## Exception codes

| Code                        | HTTP | Meaning                 |
| --------------------------- | ---- | ----------------------- |
| AUTH-NOT-AUTHENTICATED-002  | 401  | Missing or invalid JWT  |
| AUTH-FORBIDDEN-001          | 403  | Role insufficient       |
| AUTH-MFA-REQUIRED-003       | 401  | MFA required (admin-\*) |
| AUTH-EMAIL-NOT-VERIFIED-004 | 403  | Email not verified      |
