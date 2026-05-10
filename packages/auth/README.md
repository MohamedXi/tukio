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

## Exception codes

| Code                        | HTTP | Meaning                 |
| --------------------------- | ---- | ----------------------- |
| AUTH-NOT-AUTHENTICATED-002  | 401  | Missing or invalid JWT  |
| AUTH-FORBIDDEN-001          | 403  | Role insufficient       |
| AUTH-MFA-REQUIRED-003       | 401  | MFA required (admin-\*) |
| AUTH-EMAIL-NOT-VERIFIED-004 | 403  | Email not verified      |
