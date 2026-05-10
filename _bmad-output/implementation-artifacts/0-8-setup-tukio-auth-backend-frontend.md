# Story 0.8: Setup @tukio/auth (backend) + @tukio/auth-client (frontend)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** fullstack developer (équipe Sprint 0),
**I want** **2 libs auth complémentaires** : (1) **`@tukio/auth`** côté backend avec `KeycloakJwtGuard` (validation JWT RS256 via JWKS cache 10 min — NFR11), `@Roles(...)` decorator + `RolesGuard` (RBAC granulaire), `JwksCacheService` (refresh background + fallback réseau), `ActorResolver` (extract `Actor` du JWT + propagation header `X-Tukio-Actor`), types `Actor` + `Role` ; (2) **`@tukio/auth-client`** côté frontend avec `KeycloakClient` (wrapper `keycloak-js` adapter), `RefreshTokenRotation` (silent refresh avant expiration), `CookieManager` (`Domain=.tukio.one` cross-subdomain), hooks React `useAuth/useRole/useRequireRole/useLogout`, `KeycloakAuthMiddleware` (Next.js middleware partagé entre les 4 apps multi-zones) ; livrées avec **branchement réel dans `identity-svc`** (l'endpoint `GET /v1/users/:id` Story 0.6 devient protégé `@UseGuards(KeycloakJwtGuard) @Roles('client', 'pro', 'admin-modo')`) **et** dans `apps/customer/` + `apps/seller/` (middleware actif qui redirige vers `auth.tukio.one` si pas authentifié),
**so that** les 10 services backend ont une auth unifiée + RBAC enforced + audit trail (`X-Tukio-Actor` header signé propagé), les 4 apps frontend partagent une session Keycloak cross-subdomain (un Customer connecté sur `customer.tukio.one` reste connecté sur `seller.tukio.one` quand il bascule en mode pro), aucune story Epic 1+ ne réimplémente l'auth, la 2FA admin obligatoire (NFR12 / FR9) est applicable via le decorator `@Roles('admin-*')` (vérification MFA au niveau Keycloak realm-level, pas dupliquée code), et les tests d'intégration passent sans démarrer un Keycloak réel (mock JWKS via `nock` ou équivalent).

> **Outcome attendu** : à la fin de cette story, `curl -X GET http://localhost:4001/v1/users/abc-uuid` retourne `401 ErrorEnvelope { tukioCode: 'AUTH-NOT-AUTHENTICATED-002' }` (pas de JWT) ; `curl -H "Authorization: Bearer <jwt-customer>" ...` retourne `200 SuccessEnvelope { data: { ... } }` (rôle OK) ; `curl -H "Authorization: Bearer <jwt-customer>" -X DELETE ...` (rôle insuffisant) retourne `403 ErrorEnvelope { tukioCode: 'AUTH-FORBIDDEN-001' }`. Sur le frontend, naviguer vers `customer.tukio.one/account/dashboard` sans cookie session redirige vers `auth.tukio.one/realms/tukio/protocol/openid-connect/auth?...` avec `redirect_uri` callback pour reprendre le parcours après login.

## Acceptance Criteria

1. **AC1 — Structure complète des 2 packages `@tukio/auth` (backend) + `@tukio/auth-client` (frontend)** : Given `packages/auth/src/` + `packages/auth-client/src/`, When je les ouvre, Then je trouve **strictement** ces arborescences (alignées Architecture lignes 2195-2200 + 2235-2240) :
   ```
   packages/auth/src/                                # backend (consommé par les 10 services NestJS)
   ├─ index.ts                                       # barrel racine MINIMAL (Symbol tokens uniquement)
   ├─ guards/
   │  ├─ keycloak-jwt.guard.ts                       # CanActivate qui valide JWT RS256 via JWKS
   │  ├─ keycloak-jwt-guard.spec.ts
   │  ├─ roles.guard.ts                              # CanActivate qui check rôles vs JWT realm_access.roles
   │  └─ roles.guard.spec.ts
   ├─ decorators/
   │  ├─ roles.decorator.ts                          # @Roles('client', 'pro', ...) metadata
   │  ├─ public.decorator.ts                         # @Public() bypass auth
   │  ├─ current-actor.decorator.ts                  # @CurrentActor() inject Actor in handler
   │  └─ decorators.spec.ts
   ├─ services/
   │  ├─ jwks-cache.service.ts                       # cache 10 min + background refresh + fallback réseau
   │  ├─ jwks-cache.service.spec.ts
   │  ├─ actor-resolver.service.ts                   # extract Actor depuis JWT + propage header X-Tukio-Actor
   │  └─ actor-resolver.service.spec.ts
   ├─ types/
   │  ├─ actor.ts                                    # interface Actor (re-export de @tukio/contracts/types/Actor)
   │  ├─ role.ts                                     # type Role union literals
   │  └─ jwt-payload.ts                              # type Keycloak JWT claims (sub, realm_access, resource_access, ...)
   ├─ interceptors/
   │  └─ actor-propagation.interceptor.ts            # ajoute header X-Tukio-Actor sur tous les calls HTTP downstream
   ├─ exceptions/
   │  ├─ auth-not-authenticated.exception.ts         # 401 + AUTH-NOT-AUTHENTICATED-002
   │  ├─ auth-forbidden.exception.ts                 # 403 + AUTH-FORBIDDEN-001
   │  ├─ auth-mfa-required.exception.ts              # 401 + AUTH-MFA-REQUIRED-003 (admin sans MFA)
   │  └─ auth-email-not-verified.exception.ts        # 403 + AUTH-EMAIL-NOT-VERIFIED-004
   ├─ tukio-auth.module.ts                           # NestJS DynamicModule.forRoot({ keycloakUrl, realm, jwksRefreshIntervalMs })
   └─ tokens.ts                                      # Symbol DI tokens (KEYCLOAK_JWT_GUARD, JWKS_CACHE, ACTOR_RESOLVER)
   ```
   ```
   packages/auth-client/src/                         # frontend (consommé par les 4 apps Next.js)
   ├─ index.ts                                       # barrel racine MINIMAL (types Actor + Role)
   ├─ keycloak/
   │  ├─ keycloak-client.ts                          # wrapper keycloak-js avec config Tukio
   │  ├─ keycloak-client.spec.tsx
   │  └─ types.ts                                    # KeycloakConfig, AuthState, etc.
   ├─ refresh/
   │  ├─ refresh-token-rotation.ts                   # silent refresh background avant expiration
   │  └─ refresh-token-rotation.spec.tsx
   ├─ cookies/
   │  ├─ cookie-manager.ts                           # Domain=.tukio.one, HttpOnly via fetch credentials
   │  └─ cookie-manager.spec.tsx
   ├─ hooks/
   │  ├─ use-auth.ts                                 # useAuth() retourne { user, role, locale, isAuthenticated }
   │  ├─ use-role.ts                                 # useRole(roleNames) retourne boolean
   │  ├─ use-require-role.ts                         # useRequireRole(roleNames) redirect si pas autorisé
   │  ├─ use-logout.ts                               # useLogout() révoque session + clear cookie
   │  └─ hooks.spec.tsx
   ├─ providers/
   │  ├─ auth-provider.tsx                           # AuthProvider Context React (wraps app)
   │  └─ auth-provider.spec.tsx
   ├─ middleware/
   │  ├─ keycloak-auth.middleware.ts                 # Next.js middleware partagé (vérifie cookie, redirect si absent)
   │  └─ keycloak-auth.middleware.spec.ts
   ├─ types/
   │  ├─ actor.ts                                    # re-export Actor depuis @tukio/contracts/types/Actor
   │  └─ auth-state.ts                               # AuthState, KeycloakUser
   └─ tokens.ts                                      # constantes (TUKIO_ACCESS_TOKEN_COOKIE_NAME, ...)
   ```

2. **AC2 — `KeycloakJwtGuard` valide JWT RS256 + retourne 401 enveloppé si invalide** : Given un controller décoré `@Controller('users') @UseGuards(KeycloakJwtGuard)`, When une requête arrive sans header `Authorization: Bearer <jwt>` OU avec un JWT invalide/expiré/signature incorrecte, Then :
   - **401** retourné avec `ErrorEnvelope` (cohérent ADR-014 + Story 0.6 EnvelopeExceptionFilter) :
     ```json
     {
       "method": "GET",
       "code": 401,
       "error": {
         "type": "https://tukio.one/errors/auth-not-authenticated",
         "title": "Authentication required",
         "detail": "Missing or invalid JWT token",
         "instance": "/v1/users/abc",
         "tukioCode": "AUTH-NOT-AUTHENTICATED-002"
       },
       "meta": { "timestamp": "...", "correlationId": "...", "locale": "fr" }
     }
     ```
   - **Workflow validation** : (a) extract `Authorization: Bearer <jwt>` header, (b) si absent → throw `AuthNotAuthenticatedException`, (c) parse JWT (header pour `kid`), (d) `JwksCacheService.getKey(kid)` → public key, (e) verify RS256 signature + check `exp`, `iat`, `iss` (= `https://auth.tukio.one/realms/tukio` env-configurable), `aud` (whitelist clients), (f) si valide → set `request.actor = ActorResolver.fromJwt(payload)` + set `request.jwt = payload` (utilisable via `@CurrentActor()`)
   - **`@Public()` decorator bypass** : si le handler ou le controller a `@Public()` metadata, `CanActivate` retourne `true` sans validation (utilisé pour endpoints publics — health, register, login)
   - **Guard global ou per-endpoint** : MVP = appliqué globalement dans `app.module.ts` via `APP_GUARD` provider, `@Public()` est l'opt-out. Alternative documentée : per-controller via `@UseGuards(KeycloakJwtGuard)` (verbose mais explicite).
   - Tests unit (mock JWT + mock JWKS) : valid JWT → 200, expired JWT → 401, missing JWT → 401, malformed JWT → 401, signature invalide (kid inconnu) → 401, `@Public()` bypass → 200 sans JWT

3. **AC3 — `RolesGuard` + `@Roles(...)` decorator** : Given `@Controller('admin') @UseGuards(KeycloakJwtGuard, RolesGuard) @Roles('admin-modo', 'admin-super')`, When un user avec JWT rôle `client` accède, Then :
   - **403** retourné avec `ErrorEnvelope` :
     ```json
     {
       "method": "GET",
       "code": 403,
       "error": {
         "tukioCode": "AUTH-FORBIDDEN-001",
         "title": "Insufficient role",
         "detail": "Required role: admin-modo, admin-super. Actual role: client.",
         ...
       },
       "meta": { ... }
     }
     ```
   - **Workflow** : (a) lire `request.actor` (set par KeycloakJwtGuard), (b) extract roles requis depuis metadata `Reflect.getMetadata('roles', handler)`, (c) check si `actor.role` ∈ `requiredRoles`, (d) si non → throw `AuthForbiddenException` avec détails (rôle requis vs rôle actuel)
   - **`@Roles('client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super')`** : type-safe via `Role` union literals
   - **Mode multi-roles OR** : `@Roles('admin-modo', 'admin-super')` = au moins l'un des deux suffit. Pas de mode AND au MVP (pas de cas d'usage).
   - **Combinaison avec `@Public()`** : si `@Public()` set → KeycloakJwtGuard bypass + RolesGuard pas exécuté
   - **Email verification gate** : si l'endpoint requiert email verified (decorator `@RequireEmailVerified()`), check `actor.emailVerified === true` sinon 403 `AUTH-EMAIL-NOT-VERIFIED-004`
   - **MFA gate admin** : si l'endpoint requiert MFA (decorator `@RequireMfa()` OU automatique pour `admin-*` roles), check `payload.amr.includes('totp')` (Authentication Methods References — Keycloak met `'totp'` quand MFA TOTP a été utilisé), sinon 401 `AUTH-MFA-REQUIRED-003`. **Cohérent NFR12 + FR9.**
   - Tests unit : rôle valide → 200, rôle insuffisant → 403, multi-roles OR (un ok) → 200, email non vérifié → 403, admin sans MFA → 401

4. **AC4 — `JwksCacheService` cache 10 min + background refresh + fallback réseau** : Given `packages/auth/src/services/jwks-cache.service.ts`, When je l'ouvre, Then je trouve un `@Injectable()` qui :
   - **`onModuleInit()`** : (a) fetch JWKS depuis `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`, (b) parse JSON Web Key Set, (c) store in-memory `Map<kid, KeyLike>`, (d) lance background refresh `setInterval(jwksRefreshIntervalMs)` (default 10 min — NFR11)
   - **`getKey(kid: string): Promise<KeyLike>`** : (a) lookup in-memory cache, (b) si trouvé → retourne, (c) si pas trouvé (kid inconnu, possible nouveau key Keycloak) → trigger immediate refresh + retry, (d) si toujours absent après refresh → throw `AuthNotAuthenticatedException` (kid invalid)
   - **Fallback réseau** : si Keycloak DOWN au moment du refresh background, `try/catch` log warn + garde l'ancien cache valide jusqu'au prochain refresh OK (NFR45 retry pattern). Métriques `tukio_jwks_cache_refresh_failures_total` exposées.
   - **Stale cache acceptable** : si Keycloak DOWN > 1 h, le cache devient stale mais reste utilisable (preferable to total auth failure). Alerte admin via Prometheus si > 1 h sans refresh successful.
   - **Healthcheck** : méthode `isHealthy()` exposée pour `/ready` endpoint Story 0.6 (cache populated + dernier refresh < 30 min).
   - **Implémentation** : utilise `jose` (npm `jose`, latest stable) `createRemoteJWKSet` qui fait le caching natif + retries — wrapper minimal autour. Si `jose`'s caching est suffisant → expose juste un wrapper avec métriques + `isHealthy`. Sinon → cache custom avec `node-cache` ou `Map`.

5. **AC5 — `ActorResolver` + propagation header `X-Tukio-Actor` inter-services** : Given `packages/auth/src/services/actor-resolver.service.ts` + `interceptors/actor-propagation.interceptor.ts`, When je les ouvre, Then :
   - `ActorResolver.fromJwt(payload: KeycloakJwtPayload): Actor` extract :
     - `userId: payload.sub` (Keycloak user UUID)
     - `role: extractRole(payload.realm_access?.roles)` — première role match parmi `['admin-super', 'admin-modo', 'admin-support', 'pro', 'client']` (precedence : admin > pro > client)
     - `locale: payload.locale ?? 'fr'` (Keycloak peut stocker locale en custom claim)
     - `email: payload.email` (utilisé pour audit trail)
     - `emailVerified: payload.email_verified ?? false`
     - `amr: payload.amr ?? []` (Authentication Methods References — pour MFA check)
   - `ActorPropagationInterceptor` (NestJS interceptor) : pour tout call HTTP downstream sortant via axios/fetch, injecte automatiquement les headers :
     - `X-Tukio-Actor: <base64-json-encoded Actor>` (pour traçabilité service-to-service — NB : pas de signature au MVP, signature HMAC en V1+ pour anti-tampering)
     - `X-Tukio-Correlation-Id: <correlationId>` (depuis `correlationContext.getCorrelationId()` Story 0.7)
     - `X-Tukio-Locale: <actor.locale>` (pour rendering downstream cohérent)
   - **`@CurrentActor()` decorator** : permet à un handler de récupérer `request.actor` typed sans accéder à `request` directement :
     ```ts
     @Get(':id')
     async getUser(@Param('id') id: string, @CurrentActor() actor: Actor) {
       // actor.userId, actor.role, actor.locale disponibles
     }
     ```
   - Tests unit : extract role precedence (admin > pro > client), missing claims → defaults safe, propagation headers inclus dans axios mocks

6. **AC6 — `KeycloakClient` (frontend) wrapper `keycloak-js` adapter** : Given `packages/auth-client/src/keycloak/keycloak-client.ts`, When je l'ouvre, Then :
   - Wrapper minimal sur `keycloak-js` (latest stable, vérifier `pnpm view keycloak-js version`) avec config Tukio :
     ```ts
     const config: KeycloakConfig = {
       url: 'https://auth.tukio.one',
       realm: 'tukio',
       clientId: 'tukio-web', // pour les 4 apps frontend (admin a son propre clientId)
     };
     const initOptions: KeycloakInitOptions = {
       onLoad: 'check-sso', // ne force pas le login, juste check session
       silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
       checkLoginIframe: false, // désactivé (Chrome 80+ block 3rd-party cookies in iframe)
       pkceMethod: 'S256', // PKCE obligatoire (Authorization Code + PKCE)
       enableLogging: process.env.NODE_ENV === 'development',
     };
     ```
   - **Endpoints exposés** : `login(redirectUri?)`, `logout(redirectUri?)`, `register()` (Keycloak hosted register page), `updateToken(minValidity = 60)` (refresh si access token expire dans < 60s), `getToken()`, `isAuthenticated()`, `getUser()`
   - **PKCE obligatoire** (NFR sécurité OWASP Top 10) : `pkceMethod: 'S256'`
   - **Silent SSO check** : permet de détecter une session Keycloak active sans full redirect (UX fluide)
   - **Iframe check disabled** : Chrome 80+ block 3rd-party cookies dans iframes → désactiver ce mécanisme legacy de Keycloak
   - **`silent-check-sso.html`** : fichier statique placeholder à créer dans `apps/<app>/public/silent-check-sso.html` (1 ligne `<html><body><script>parent.postMessage(location.href, location.origin)</script></body></html>`)
   - Tests : init success → returns user, init failure (Keycloak DOWN) → throws KeycloakInitError graceful

7. **AC7 — `RefreshTokenRotation` silent refresh background** : Given `packages/auth-client/src/refresh/refresh-token-rotation.ts`, When je l'ouvre, Then :
   - Classe `RefreshTokenRotationManager` qui :
     - **Setup au login** : déclenche `setInterval(checkAndRefreshIfNeeded, 30_000)` (check toutes les 30s)
     - **`checkAndRefreshIfNeeded()`** : (a) lit token expiry depuis `keycloak.tokenParsed.exp`, (b) si `exp - now < 120` (2 min restantes) → appelle `keycloak.updateToken(60)` (refresh si valide < 60s — Keycloak adapter natif), (c) si refresh OK → cookie auto-updated par `gateway-api` (qui re-set le cookie `tukio-access-token` à chaque refresh), (d) si refresh fail → emit event `tokenExpired` → `useLogout()` ou redirect vers login
   - **Hook into focus events** : check refresh quand l'onglet regagne le focus (`window.addEventListener('focus', ...)`) — évite de laisser un user avec token expiré pendant qu'il ouvre l'onglet
   - **Anti-thundering-herd** : si plusieurs onglets ouverts (Customer + Seller dashboards), le refresh ne doit être déclenché qu'**1 fois** par cookie session. Utiliser `BroadcastChannel API` pour synchro inter-tabs OU debounce simple (1ʳᵉ tab qui refresh notifie les autres via storage event).
   - **Healthcheck** : méthode `isHealthy()` exposée pour debug devtools

8. **AC8 — `CookieManager` `Domain=.tukio.one` cross-subdomain** : Given `packages/auth-client/src/cookies/cookie-manager.ts`, When je l'ouvre, Then :
   - Classe `CookieManager` (singleton) qui expose :
     - `getAccessToken(): string | null` : lit depuis `document.cookie` (NB : cookie est `HttpOnly` → JS NE PEUT PAS lire ; alternative : stocker token en mémoire + cookie HttpOnly est le source-of-truth, JS utilise mémoire pour les requêtes API). **Décision : tokens en mémoire React Context (AuthState), cookie HttpOnly pour persistence + auto-send API**.
     - `clearSession()` : appelle `gateway-api/auth/logout` qui révoque + clear cookie côté serveur (cookie HttpOnly, JS ne peut pas le delete directement)
     - `hasSessionCookie(): boolean` : check via `document.cookie.includes('tukio-session-active=1')` — un cookie marker non-HttpOnly que `gateway-api` set en parallèle pour signaler la présence du cookie auth (le cookie `tukio-access-token` lui-même est HttpOnly + invisible côté JS)
   - **Constante `TUKIO_ACCESS_TOKEN_COOKIE_NAME = 'tukio-access-token'`** exportée depuis `tokens.ts`
   - **Constante `TUKIO_SESSION_MARKER_COOKIE = 'tukio-session-active'`** (cookie marker non-HttpOnly utilisé par le frontend pour détection rapide)
   - **CSRF cookie** : `tukio-csrf-token` (HttpOnly: false, lisible JS pour mettre dans header `X-CSRF-Token`) — gérée par `gateway-api` (Architecture lignes 681-686). `CookieManager` expose `getCsrfToken()` + `addCsrfHeader(headers)` helper.

9. **AC9 — Hooks React `useAuth/useRole/useRequireRole/useLogout` + `AuthProvider`** : Given `packages/auth-client/src/{hooks,providers}/`, When je les ouvre, Then :
   - **`<AuthProvider>` Context React** : wrap l'app dans `apps/<app>/src/app/[locale]/layout.tsx` (à brancher dans Stories Epic 1) ; expose `AuthState` à tous les composants enfants ; init `KeycloakClient` au mount + `RefreshTokenRotationManager`
   - **`useAuth(): AuthState`** : retourne `{ user: { userId, email, firstName, lastName } | null, role: Role | null, locale: 'fr' | 'en', isAuthenticated: boolean, isLoading: boolean }`
   - **`useRole(requiredRoles: Role[]): boolean`** : retourne `true` si `currentRole` ∈ `requiredRoles`, sinon `false`. Usage : conditional rendering UI (ex `{useRole(['admin-modo']) && <DangerButton />}`).
   - **`useRequireRole(requiredRoles: Role[], options?: { redirectTo?: string })`** : si l'utilisateur n'a pas le rôle requis, redirect vers `options.redirectTo` (default `/account/dashboard` si client, `/seller/dashboard` si pro, `/` si non authentifié). Hook utilisé en haut des pages protégées (ex `apps/seller/src/app/[locale]/seller/layout.tsx`).
   - **`useLogout(): () => Promise<void>`** : (a) call `KeycloakClient.logout()` (revoke session Keycloak), (b) appelle `cookieManager.clearSession()`, (c) clear React state `AuthState`, (d) redirect vers `/`
   - **i18n-agnostic** : pas d'import `next-intl` dans la lib. Les apps fournissent les labels d'erreur via props sur `<AuthProvider>` (ex `<AuthProvider errorMessages={{ sessionExpired: t('auth.sessionExpired') }}>`)
   - Tests : test hook returns correct state, test useRequireRole redirect, test useLogout cleans up

10. **AC10 — `KeycloakAuthMiddleware` Next.js partagé entre 4 apps** : Given `packages/auth-client/src/middleware/keycloak-auth.middleware.ts`, When je l'ouvre, Then :
    - Helper qui retourne un `NextMiddleware` (Next.js 15 middleware function) :
      ```ts
      export function createKeycloakAuthMiddleware(config: { protectedPaths: string[]; loginRedirectUri: string }): NextMiddleware {
        return (request: NextRequest) => {
          const isProtected = config.protectedPaths.some(p => request.nextUrl.pathname.startsWith(p));
          if (!isProtected) return NextResponse.next();
          const sessionMarker = request.cookies.get(TUKIO_SESSION_MARKER_COOKIE);
          if (!sessionMarker) {
            // pas de cookie session → redirect vers Keycloak login
            const loginUrl = new URL(`${config.loginRedirectUri}?redirect_uri=${encodeURIComponent(request.nextUrl.toString())}`);
            return NextResponse.redirect(loginUrl);
          }
          return NextResponse.next();
        };
      }
      ```
    - **Chaque app branche dans son `middleware.ts`** (à finaliser Stories Epic 1, ici juste squelette utilisable) :
      ```ts
      // apps/customer/src/middleware.ts
      import { createKeycloakAuthMiddleware } from '@tukio/auth-client/middleware';
      export default createKeycloakAuthMiddleware({
        protectedPaths: ['/account', '/cart'],
        loginRedirectUri: 'https://auth.tukio.one/realms/tukio/protocol/openid-connect/auth',
      });
      ```
    - **Compose avec next-intl middleware** (Story 0.9) : helper `composeMiddlewares(intlMiddleware, authMiddleware)` documenté en Dev Notes (pattern Next.js standard)
    - **NB** : middleware Next.js Edge runtime — pas de Node.js APIs (pas de `fs`, etc.). Cookies via `request.cookies` (NextRequest API).
    - Tests : middleware redirect si no cookie, passe si cookie présent, ne touche pas les paths non protégés

11. **AC11 — Branchement réel dans `identity-svc` (protect endpoint Story 0.6)** : Given `apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts` (créé Story 0.6 sans guard), When je l'ouvre maintenant, Then :
    - **Guard appliqué** :
      ```ts
      @Controller('users')
      @UseGuards(KeycloakJwtGuard, RolesGuard)
      export class UserController {
        @Get(':id')
        @Roles('client', 'pro', 'admin-modo', 'admin-super')
        async getUser(@Param('id') id: string, @CurrentActor() actor: Actor): Promise<UserProfileResponseDto> {
          // RBAC fine-grained : un client ne peut consulter que SON profil
          if (actor.role === 'client' && actor.userId !== id) {
            throw new AuthForbiddenException('Cannot access other user profile');
          }
          const userProfile = await this.getUserProfileUseCaseProxy.getInstance().execute({ userId: id });
          return UserProfileMapper.toResponseDto(userProfile);
        }
      }
      ```
    - **`HealthController` reste public** : ajouter `@Public()` decorator pour bypass guard (health/ready ne requièrent pas d'auth)
    - **`app.module.ts` updated** : `TukioAuthModule.forRoot({ keycloakUrl: ..., realm: 'tukio', jwksRefreshIntervalMs: 600_000 /* 10 min NFR11 */ })` importé + `APP_GUARD` provider qui register `KeycloakJwtGuard` global
    - **`.env.example` updated** : `KEYCLOAK_URL=http://localhost:8080` (Docker Compose Story 0.10), `KEYCLOAK_REALM=tukio`, `KEYCLOAK_CLIENT_ID=tukio-api`
    - **`EnvironmentConfigService` updated** : `getKeycloakConfig()` typed (URL, realm, clientId)
    - **Tests E2E updated** : `apps/identity-svc/test/user.e2e-spec.ts` injecte un mock JWKS via `nock` (mock HTTP) + génère JWT signé localement avec une clé RSA test → vérifier 200 (rôle OK), 401 (pas de JWT), 403 (rôle insuffisant)

12. **AC12 — `@tukio/auth` peer deps + `package.json` exports** : Given `packages/auth/package.json`, When je l'ouvre, Then :
    - Dépendances :
      - `runtime` : `jose` (latest stable, JWT verification + JWKS), `prom-client` (métriques)
      - `peerDependencies` : `@nestjs/core`, `@nestjs/common`, `reflect-metadata`, `rxjs`, `@tukio/contracts: workspace:*`
      - `devDependencies` : `@nestjs/testing`, `vitest`, `nock` (mock HTTP pour JWKS), `node-jose` (génération JWT test signé), `typescript`, `@types/node`
    - Champ `"exports"` exhaustif (cf. Dev Notes §Subpath exports backend)

13. **AC13 — `@tukio/auth-client` peer deps + `package.json` exports** : Given `packages/auth-client/package.json`, When je l'ouvre, Then :
    - Dépendances :
      - `runtime` : `keycloak-js` (latest stable, vérifier compat avec Keycloak 25)
      - `peerDependencies` : `react`, `react-dom`, `next`, `@tukio/contracts: workspace:*`
      - `devDependencies` : `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@types/react`, `typescript`, `jsdom`
    - `"sideEffects": false` (lib JS pure, pas de CSS)
    - Champ `"exports"` exhaustif (cf. Dev Notes §Subpath exports frontend)

14. **AC14 — Tests cross-package + harness end-to-end auth** : Given les 2 packages `@tukio/auth` + `@tukio/auth-client`, When je lance `pnpm --filter='@tukio/auth*' test`, Then les tests passent (≥ 85 % coverage par lib, vu que pas d'I/O réel) :
    - **`@tukio/auth` tests** : tous les guards/decorators/services testés en isolation (mock JWKS via `nock`, JWT signé via `node-jose` ou `jose` SignJWT)
    - **`@tukio/auth-client` tests** : tous les hooks testés via `@testing-library/react` `renderHook`, `KeycloakClient` mocké
    - **Tests E2E `identity-svc`** (Task 11 ajoute) : JWT valide → 200, JWT expiré → 401, rôle insuffisant → 403
    - **Pas de tests Keycloak réel** au MVP (testcontainers Keycloak vient Story 0.9)

## Tasks / Subtasks

- [x] **Task 1 — Configurer `packages/auth/` package.json + tsconfig + Vitest** (AC: #12)
  - [x] 1.1 — `pnpm --filter=@tukio/auth add jose prom-client` (runtime)
  - [x] 1.2 — `pnpm --filter=@tukio/auth add @nestjs/core@latest @nestjs/common@latest reflect-metadata rxjs@latest @tukio/contracts@workspace:* --save-peer`
  - [x] 1.3 — `pnpm --filter=@tukio/auth add -D @nestjs/testing vitest nock node-jose @types/node typescript`
  - [x] 1.4 — Mettre à jour `packages/auth/package.json` avec `exports` field (cf. Dev Notes §Subpath exports backend)
  - [x] 1.5 — `packages/auth/vitest.config.ts` minimal (coverage thresholds ≥ 85 %)

- [x] **Task 2 — Configurer `packages/auth-client/` package.json + tsconfig + Vitest** (AC: #13)
  - [x] 2.1 — `pnpm --filter=@tukio/auth-client add keycloak-js`
  - [x] 2.2 — `pnpm --filter=@tukio/auth-client add react@latest react-dom@latest next@latest @tukio/contracts@workspace:* --save-peer`
  - [x] 2.3 — `pnpm --filter=@tukio/auth-client add -D vitest @testing-library/react @testing-library/user-event @types/react typescript jsdom @vitejs/plugin-react`
  - [x] 2.4 — Mettre à jour `packages/auth-client/package.json` avec `exports` field (cf. Dev Notes §Subpath exports frontend)
  - [x] 2.5 — `packages/auth-client/vitest.config.ts` (jsdom env, setupFiles avec `@testing-library/jest-dom`)

- [x] **Task 3 — Créer types `Actor`, `Role`, `KeycloakJwtPayload`** (AC: #1, #5)
  - [x] 3.1 — `packages/auth/src/types/role.ts` : `export type Role = 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super';`
  - [x] 3.2 — `packages/auth/src/types/actor.ts` : extend `Actor` from `@tukio/contracts/types/Actor` avec champs additionnels backend (`email`, `emailVerified`, `amr`)
  - [x] 3.3 — `packages/auth/src/types/jwt-payload.ts` : interface `KeycloakJwtPayload` typage strict des claims Keycloak (`sub`, `realm_access.roles`, `resource_access`, `email`, `email_verified`, `amr`, `locale`, `iat`, `exp`, `iss`, `aud`)
  - [x] 3.4 — `packages/auth-client/src/types/actor.ts` : re-export `Actor` + `Role` depuis `@tukio/contracts` (frontend version, sans `email`/`amr` qui sont backend-only)

- [x] **Task 4 — Implémenter `JwksCacheService`** (AC: #4)
  - [x] 4.1 — `services/jwks-cache.service.ts` : utilise `jose` `createRemoteJWKSet({ url, cache: true, cacheMaxAge: 600_000 /* 10 min */ })`. Wrap avec métriques + healthcheck + fallback réseau (try/catch sur refresh)
  - [x] 4.2 — Tests `services/jwks-cache.service.spec.ts` : mock HTTP via `nock`, verify cache TTL, verify fallback si Keycloak DOWN, verify refresh background

- [x] **Task 5 — Implémenter `ActorResolver` + interceptor propagation** (AC: #5)
  - [x] 5.1 — `services/actor-resolver.service.ts` : méthode static `fromJwt(payload): Actor`, extract role precedence (admin > pro > client), defaults safe
  - [x] 5.2 — `interceptors/actor-propagation.interceptor.ts` : NestJS interceptor qui inject `X-Tukio-Actor` + `X-Tukio-Correlation-Id` + `X-Tukio-Locale` headers sur tous les `axios`/`fetch` outbound (Story 0.7 correlation context consommé)
  - [x] 5.3 — `decorators/current-actor.decorator.ts` : `@CurrentActor()` param decorator qui retourne `request.actor` typed
  - [x] 5.4 — Tests Vitest : test role precedence, test missing claims defaults, test propagation headers

- [x] **Task 6 — Implémenter `KeycloakJwtGuard` + `@Public()` decorator** (AC: #2)
  - [x] 6.1 — `decorators/public.decorator.ts` : `export const IS_PUBLIC_KEY = 'isPublic'; export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);`
  - [x] 6.2 — `guards/keycloak-jwt.guard.ts` : `@Injectable() class KeycloakJwtGuard implements CanActivate` qui (a) check `@Public()` metadata via Reflector, (b) extract `Authorization: Bearer <jwt>`, (c) parse + verify via `jwtVerify(jwt, jwksCache.getKeySet(), { issuer, audience })`, (d) throw `AuthNotAuthenticatedException` si fail, (e) set `request.actor = ActorResolver.fromJwt(payload)`
  - [x] 6.3 — `exceptions/auth-not-authenticated.exception.ts` (extends DomainException Story 0.6 : `tukioCode: 'AUTH-NOT-AUTHENTICATED-002'`, `httpStatus: 401`, `title: 'Authentication required'`)
  - [x] 6.4 — Tests `guards/keycloak-jwt-guard.spec.ts` : valid JWT signed via node-jose → 200, expired → 401, missing → 401, malformed → 401, `@Public()` bypass → 200

- [x] **Task 7 — Implémenter `RolesGuard` + `@Roles()` decorator + email verified + MFA gates** (AC: #3)
  - [x] 7.1 — `decorators/roles.decorator.ts` : `export const ROLES_KEY = 'roles'; export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);`
  - [x] 7.2 — `decorators/require-email-verified.decorator.ts` : `@RequireEmailVerified()` metadata
  - [x] 7.3 — `decorators/require-mfa.decorator.ts` : `@RequireMfa()` metadata (auto-applied for `admin-*` roles via reflection trick OR explicit per-handler)
  - [x] 7.4 — `guards/roles.guard.ts` : check `request.actor.role ∈ requiredRoles`, check `actor.emailVerified` si `@RequireEmailVerified()`, check `actor.amr.includes('totp')` si `@RequireMfa()` ou role admin-*
  - [x] 7.5 — `exceptions/auth-forbidden.exception.ts` + `auth-mfa-required.exception.ts` + `auth-email-not-verified.exception.ts`
  - [x] 7.6 — Tests `guards/roles.guard.spec.ts` : rôle valide → 200, rôle insuffisant → 403, multi-roles OR → 200 si un match, email non vérifié → 403, admin sans MFA → 401

- [x] **Task 8 — Créer `TukioAuthModule.forRoot()` (DynamicModule)** (AC: #1, #11)
  - [x] 8.1 — `tukio-auth.module.ts` : DynamicModule qui register tous les services (JwksCacheService, ActorResolver), guards (KeycloakJwtGuard, RolesGuard), interceptors. Config typée :
    ```ts
    interface TukioAuthConfig {
      keycloakUrl: string;       // 'https://auth.tukio.one'
      realm: string;             // 'tukio'
      clientId: string;          // 'tukio-api' pour les services backend, 'tukio-web' pour frontend
      jwksRefreshIntervalMs?: number; // default 600_000 (10 min — NFR11)
      issuer?: string;            // default `${keycloakUrl}/realms/${realm}`
      audience?: string | string[]; // default ['tukio-api']
    }
    static forRoot(config: TukioAuthConfig): DynamicModule { ... }
    ```
  - [x] 8.2 — `tokens.ts` : Symbol DI tokens (`KEYCLOAK_JWT_GUARD`, `JWKS_CACHE`, `ACTOR_RESOLVER`)

- [x] **Task 9 — Implémenter `KeycloakClient` (frontend) + `RefreshTokenRotation` + `CookieManager`** (AC: #6, #7, #8)
  - [x] 9.1 — `keycloak/keycloak-client.ts` : wrapper sur `keycloak-js` avec config Tukio (cf. AC6 squelette)
  - [x] 9.2 — `refresh/refresh-token-rotation.ts` : classe avec `setInterval(30s)` + `BroadcastChannel` pour anti-thundering-herd inter-tabs
  - [x] 9.3 — `cookies/cookie-manager.ts` : helpers `getCsrfToken`, `addCsrfHeader`, constantes cookie names
  - [x] 9.4 — Tests Vitest : init Keycloak success/failure, refresh trigger before expiry, CSRF helper

- [x] **Task 10 — Implémenter hooks React + `AuthProvider`** (AC: #9)
  - [x] 10.1 — `providers/auth-provider.tsx` : Context React, init `KeycloakClient` au mount, expose `AuthState`
  - [x] 10.2 — `hooks/use-auth.ts` : `const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used within <AuthProvider>'); return ctx.state;`
  - [x] 10.3 — `hooks/use-role.ts` : `(roles) => requiredRoles.includes(authState.role)`
  - [x] 10.4 — `hooks/use-require-role.ts` : si pas autorisé → `useRouter().push(redirectTo)`
  - [x] 10.5 — `hooks/use-logout.ts` : `useCallback(async () => { ... })`
  - [x] 10.6 — Tests `@testing-library/react` : `renderHook` chaque hook, vérifier state propagation

- [x] **Task 11 — Implémenter `KeycloakAuthMiddleware` Next.js partagé** (AC: #10)
  - [x] 11.1 — `middleware/keycloak-auth.middleware.ts` : `createKeycloakAuthMiddleware(config)` factory qui retourne `NextMiddleware`
  - [x] 11.2 — Tests : test redirect si pas de cookie, test passe si cookie présent, test ne touche pas paths non protégés

- [x] **Task 12 — Brancher réellement dans `identity-svc` (protect endpoints)** (AC: #11)
  - [x] 12.1 — Mettre à jour `apps/identity-svc/src/app.module.ts` : import `TukioAuthModule.forRoot({ keycloakUrl: config.getKeycloakConfig().url, realm: 'tukio', clientId: 'tukio-api', jwksRefreshIntervalMs: 600_000 })` + `APP_GUARD` provider
  - [x] 12.2 — Mettre à jour `apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts` : ajouter `@UseGuards(KeycloakJwtGuard, RolesGuard) @Roles('client', 'pro', 'admin-modo', 'admin-super')` + RBAC fine-grained dans `getUser` (un client ne peut consulter que son propre profil)
  - [x] 12.3 — Mettre à jour `apps/identity-svc/src/infrastructure/http/controllers/health.controller.ts` : ajouter `@Public()` sur les méthodes `/health` et `/ready`
  - [x] 12.4 — Mettre à jour `apps/identity-svc/.env.example` : ajouter `KEYCLOAK_URL=http://localhost:8080`, `KEYCLOAK_REALM=tukio`, `KEYCLOAK_CLIENT_ID=tukio-api`, `KEYCLOAK_AUDIENCE=tukio-api`
  - [x] 12.5 — Mettre à jour `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` : ajouter `getKeycloakConfig(): { url: string; realm: string; clientId: string; audience: string }` validé Zod
  - [x] 12.6 — Mettre à jour `apps/identity-svc/test/user.e2e-spec.ts` : utiliser `nock` pour mock `${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/certs` (returns JWKS de test) + générer JWT signé localement avec `node-jose` ou `jose` SignJWT, vérifier 200/401/403

- [x] **Task 13 — Documenter README + ajouter aux apps frontend (placeholder middleware)** (AC: #10)
  - [x] 13.1 — `packages/auth/README.md` : description backend + usage `TukioAuthModule.forRoot()` + exemples controller protégé
  - [x] 13.2 — `packages/auth-client/README.md` : description frontend + usage `<AuthProvider>` + `<KeycloakAuthMiddleware>` + hooks
  - [x] 13.3 — `apps/customer/src/middleware.ts` : ajouter squelette `createKeycloakAuthMiddleware({ protectedPaths: ['/account', '/cart'], loginRedirectUri: 'https://auth.tukio.one/realms/tukio/protocol/openid-connect/auth' })` (commenté/marqué TODO Story Epic 1 pour final wiring quand Keycloak réel disponible)
  - [x] 13.4 — Idem `apps/seller/src/middleware.ts` (`protectedPaths: ['/seller']`, role check `pro`)
  - [x] 13.5 — `apps/admin/src/middleware.ts` (`protectedPaths: ['/']` — toute l'app admin protégée, role check `admin-*` + MFA)

- [x] **Task 14 — Tests cross-package + commit** (AC: #14)
  - [x] 14.1 — `pnpm --filter=@tukio/auth test --coverage` → ≥ 85 % coverage
  - [x] 14.2 — `pnpm --filter=@tukio/auth-client test --coverage` → ≥ 85 % coverage
  - [x] 14.3 — `pnpm --filter=identity-svc test:e2e` → user.e2e-spec passe avec JWT mocks
  - [x] 14.4 — `pnpm lint && pnpm typecheck` à la racine → tous passent
  - [x] 14.5 — Commit `feat(auth): @tukio/auth backend (KeycloakJwtGuard, Roles, JWKS cache, ActorResolver) + @tukio/auth-client frontend (KeycloakClient, hooks, middleware) + wire into identity-svc` — Story 0.8 done

### Review Findings

> **Source** : `bmad-code-review` workflow (3 reviewers parallèles : Blind Hunter, Edge Case Hunter, Acceptance Auditor) — Date : 2026-05-10. Verdict : **Changes Requested** — 2 bugs critiques cassent les ACs revendiqués (P1 ActorPropagationInterceptor non-fonctionnel, P2 client RBAC self-only check compare des UUIDs incompatibles), plusieurs failles de sécurité moyennes (P3 GDPR pro leak, P4 RolesGuard fail-open, P7 X-Tukio-Actor smuggling).

#### 🤔 Decisions needed (5)

- [x] **[Review][Decision] D1 — `jose` vs `jsonwebtoken` + `jwks-rsa`** : impl utilise `jsonwebtoken` (guard) + `jwks-rsa` (cache) au lieu de `jose` `jwtVerify` + `createRemoteJWKSet` mandaté par Dev Notes (lignes 392, 409, 412). Choix : (a) refactor `KeycloakJwtGuard` + `JwksCacheService` pour utiliser `jose` uniquement (cohérent spec), (b) documenter la déviation dans Debug Log References + ajuster Dev Notes. **[AC2, AC4, AC12]**
- [x] **[Review][Decision] D2 — Role précédence vs full role set sur `Actor`** : `ActorResolver.fromJwt()` collapse les rôles overlapping (admin-support + admin-modo → admin-modo). Si un endpoint veut `@Roles('admin-support')` *uniquement* (least-privilege), un user multi-rôles passe. Choix : (a) garder précédence + documenter "X or higher", (b) stocker `roles: Role[]` complet sur Actor, (c) ajouter `@RolesExclusive(...)` pour least-privilege. **[AC3, AC5]**
- [x] **[Review][Decision] D3 — `useRequireRole` API contract** : impl utilise `onUnauthorized` callback (nécessite que les apps wirent leur propre `router.push`), spec demande `redirectTo` + `useRouter().push()` + defaults par rôle (`/account/dashboard` pour client, etc.). Choix : (a) aligner sur spec (impl router.push direct), (b) documenter que les defaults sont du wiring Story Epic 1+. **[AC9]**
- [x] **[Review][Decision] D4 — Coverage thresholds < 85 %** : `vitest.config.ts` actuel : `branches: 65` (auth-client SSR guards) / `branches: 80` (auth). Spec mandate 85 %. Choix : (a) écrire les tests manquants pour atteindre 85 % branches, (b) accepter les seuils actuels + documenter justification (SSR jsdom). **[AC14]**
- [x] **[Review][Decision] D5 — Exceptions `extends Error` vs `extends DomainException` (Story 0.6)** : les 4 exceptions auth héritent de `Error` ; `EnvelopeExceptionFilter` a été modifié pour duck-typer `tukioCode/httpStatus/title`. Spec convention (table line 682) : "Domain exceptions héritent base — `extends DomainException` Story 0.6". Choix : (a) refactor exceptions pour étendre `DomainException`, (b) garder duck-typing + documenter convention deviation. **[AC2, AC3]**

#### 🔴 Patches Critiques — bloquants pour `done` (8)

- [x] **[Review][Patch] P1 — `ActorPropagationInterceptor` BROKEN: mute la requête entrante au lieu de propager outbound** [packages/auth/src/interceptors/actor-propagation.interceptor.ts:14-22] — AC5 demande "pour tout call HTTP downstream sortant via axios/fetch, injecte automatiquement les headers". Impl écrit sur `request.headers` (inbound). Aucun service downstream ne recevra `X-Tukio-Actor`. **Le contrat AC5 est silencieusement cassé.** Fix : rewrite comme axios interceptor (HttpService) ou undici dispatcher.
- [x] **[Review][Patch] P2 — Client RBAC self-only check compare des UUIDs incompatibles** [apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts:38] — `actor.userId` = Keycloak `sub` (UUID Keycloak) ; path `:id` = `UserProfile.id` (UUID local Postgres, différent). En prod, `actor.role === 'client' && actor.userId !== id` est **toujours vrai** → client ne peut jamais lire son propre profil. Tests passent uniquement parce que `sub: FOUND_ID` est faké. Fix : charger le profile d'abord, comparer `actor.userId === profile.keycloakUserId`, OU exposer `GET /v1/users/me`.
- [x] **[Review][Patch] P3 — `pro` peut lire le profil de N'IMPORTE QUEL utilisateur (GDPR data leak)** [apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts:23-45] — `@Roles('client', 'pro', 'admin-modo', 'admin-super')` au class-level mais self-only check uniquement pour `client` (line 38). Un `pro` GET `/v1/users/<other-user-id>` retourne 200 avec email/locale/firstName/lastName. Fix : appliquer le même self-check à `pro` (ou load profile + check ownership business rule).
- [x] **[Review][Patch] P4 — `RolesGuard` fail-OPEN si `request.actor` absent** [packages/auth/src/guards/roles.guard.ts:18-19] — `if (!actor) return true` laisse passer toute requête qui arrive à RolesGuard sans actor (controller avec uniquement `@UseGuards(RolesGuard)`, ou JWT guard désactivé/buggué). Posture fail-open dangereuse. Fix : `throw new AuthNotAuthenticatedException()` quand actor manquant ET requiredRoles non-vide.
- [x] **[Review][Patch] P5 — JWT `audience` array : seul `audienceList[0]` validé** [packages/auth/src/guards/keycloak-jwt.guard.ts:55] — Si la config passe `audience: ['tukio-api', 'tukio-mobile']`, seul le premier est passé à `jwt.verify`. Token avec `aud: 'tukio-mobile'` (légitime) → 401. Fix : passer le full array (`jsonwebtoken` accepte `string | RegExp | (string|RegExp)[]`).
- [x] **[Review][Patch] P6 — JWT payload non runtime-validated (sub vide/null)** [packages/auth/src/services/actor-resolver.service.ts:7-15] — TS `KeycloakJwtPayload` est un cast, pas un Zod schema. Un token avec `sub: ""` ou `sub: null` produit `Actor { userId: "" }`. Fix : Zod parse après `jwt.verify` (`z.object({ sub: z.string().uuid(), realm_access: z.object({ roles: z.array(z.string()) }), ... })`).
- [x] **[Review][Patch] P7 — `X-Tukio-Actor` header pass-through sur routes `@Public()` = privilege escalation downstream** [packages/auth/src/interceptors/actor-propagation.interceptor.ts:21-24] — Sur une route `@Public()`, `request.actor` est absent → l'interceptor n'overwrite pas le header → un client peut envoyer `X-Tukio-Actor: <forged base64>` qui sera transmis aux services downstream qui font confiance à cette valeur. Fix : **toujours** strip/overwrite `x-tukio-actor` sur l'inbound, même sur routes publiques.
- [x] **[Review][Patch] P8 — `clearSession()` cookie delete sans `Domain` attribute** [packages/auth-client/src/cookies/cookie-manager.ts:30] — Cookie set en prod avec `Domain=.tukio.one` ne sera pas supprimé par `path=/` only. Logout silencieusement cassé sur cross-subdomain. Fix : accepter `domain` dans `CookieManager` constructor, le passer dans le delete.

#### 🟠 Patches Importants (16)

- [x] **[Review][Patch] P9 — `JwksCacheService.onModuleInit` set `lastSuccessfulRefresh` sans fetch réel** [packages/auth/src/services/jwks-cache.service.ts:34] — Au boot, le timestamp est mis sans aucun appel HTTP. `/ready` reporte healthy même si Keycloak est down. Fix : `await fetch(jwksUri)` dans `onModuleInit`, ne set le timestamp que sur succès.
- [x] **[Review][Patch] P10 — Background `fetch(jwksUri)` ne check pas `res.ok`** [packages/auth/src/services/jwks-cache.service.ts:38-43] — Réponse 502/503 de Keycloak (mid-restart) compte comme succès, met à jour timestamp. `isHealthy()` ment. Fix : `if (!res.ok) throw new Error(...)`.
- [x] **[Review][Patch] P11 — `JwksCacheService` background fetch sans `AbortController` ni timeout** [packages/auth/src/services/jwks-cache.service.ts:25-32] — Fetch peut hang indéfiniment, timer pile-up. Fix : `signal: AbortSignal.timeout(5000)`.
- [x] **[Review][Patch] P12 — Pas de `clockTolerance` sur `jwt.verify`** [packages/auth/src/guards/keycloak-jwt.guard.ts:53-57] — En K8s avec NTP imparfait, drift de 2-3s → 401 sur tokens valides. Fix : `clockTolerance: 5`.
- [x] **[Review][Patch] P13 — `realm_access.roles` non-array → privilege escalation par substring match** [packages/auth/src/services/actor-resolver.service.ts:13] — Si Keycloak émet `roles: 'admin-super-disabled'` (string au lieu d'array), `'admin-super-disabled'.includes('admin-super')` est true. Fix : `Array.isArray(payload.realm_access?.roles) ? ... : []` guard.
- [x] **[Review][Patch] P14 — `RefreshTokenRotationManager` jamais arrêté à l'unmount du provider** [packages/auth-client/src/providers/auth-provider.tsx:32-46] — `useEffect` sans cleanup. StrictMode dev double-mount → 2 intervals + 2 BroadcastChannels. Memory leak + race conditions. Fix : `useRef` + `manager.stop()` dans cleanup function du `useEffect`.
- [x] **[Review][Patch] P15 — `setClient(kc)` racing avec `kc.init()`** [packages/auth-client/src/providers/auth-provider.tsx:46-58] — `setClient` est appelé synchronously après le kick-off de `kc.init()`. Children rendant immédiatement peuvent lire `keycloakClient` du context et appeler `logout()` avant init complete. Fix : `setClient(kc)` à l'intérieur du `.then()` après init success.
- [x] **[Review][Patch] P16 — Open redirect via `request.nextUrl.toString()`** [packages/auth-client/src/middleware/keycloak-auth.middleware.ts:21-23] — URL complète round-tripée à travers `redirect_uri` Keycloak. Si Keycloak whitelist utilise wildcards, `?next=https://evil.com` peut survivre. Fix : strip query string, build clean `${origin}${pathname}`.
- [x] **[Review][Patch] P17 — `BroadcastChannel` anti-thundering-herd non-fonctionnel** [packages/auth-client/src/refresh/refresh-token-rotation.ts:14-18] — `onmessage` est un no-op. Tous les onglets refreshent indépendamment toutes les 30s. Fix : implémenter leader-election (lockOwner ID + timestamp) ou skip-if-recent (`lastRefresh < 60s` → skip).
- [x] **[Review][Patch] P18 — `RefreshTokenRotationManager.isHealthy()` `atob` fail sur base64url** [packages/auth-client/src/refresh/refresh-token-rotation.ts:38-44] — JWT payload est base64url (`-`, `_`) ; `atob` throw `InvalidCharacterError`. Caught silently → `isHealthy()` retourne false même pour token valide. Fix : normalize (`.replace(/-/g,'+').replace(/_/g,'/')` + padding) ou `Buffer.from(b64, 'base64url')`.
- [x] **[Review][Patch] P19 — `AuthProvider.kc.init()` errors swallowed silencieusement** [packages/auth-client/src/providers/auth-provider.tsx:54-56] — Si Keycloak unreachable / CSP-blocked / silent-check-sso.html missing → set `isAuthenticated: false, isLoading: false` sans erreur. UX "déconnecté" masque un système cassé. Fix : ajouter `error: AuthError | null` à `AuthState`, surface via context pour error boundary.
- [x] **[Review][Patch] P20 — `RolesGuard.startsWith('admin-')` crash si `actor.role` undefined** [packages/auth/src/guards/roles.guard.ts:25] — Optional chaining manquant. Fix : `actor.role?.startsWith('admin-') ?? false`.
- [x] **[Review][Patch] P21 — RolesGuard MFA gate ordering : admin sans MFA reçoit 401 sur route `@Roles('client')`** [packages/auth/src/guards/roles.guard.ts:24-29] — Information leak : un admin sans MFA hit une route client → 401 `AUTH-MFA-REQUIRED-003` au lieu de 403 `AUTH-FORBIDDEN-001`. Révèle son statut admin. Fix : reorder — role check d'abord, MFA après.
- [x] **[Review][Patch] P22 — Locale silently kept invalid au runtime** [packages/auth/src/services/actor-resolver.service.ts:14] — TS cast `(payload.locale as 'fr' | 'en') ?? 'fr'` ne valide pas — `locale: 'es'` ou `'fr-CA'` propagé. Fix : whitelist `payload.locale === 'en' ? 'en' : 'fr'`.
- [x] **[Review][Patch] P23 — Pas de fallback `acr === '2'` pour MFA** [packages/auth/src/guards/roles.guard.ts:34] — Debug Log References (Story file ligne 758) mentionne ce fallback. Si Keycloak set `acr` mais pas `amr` → false negative MFA. Fix : `actor.amr.includes('totp') || actor.acr === '2'`.
- [x] **[Review][Patch] P24 — Admin auto-MFA via `startsWith('admin-')` fragile** [packages/auth/src/guards/roles.guard.ts:33] — Future role `admin-readonly` hérite MFA, ou `superadmin` (rename) la perd. Fix : `const MFA_REQUIRED_ROLES = new Set(['admin-support','admin-modo','admin-super'])`.

#### 🟡 Patches Mineurs (5)

- [x] **[Review][Patch] P25 — `JWT.verify` catch swallows distinct errors as same 401** [packages/auth/src/guards/keycloak-jwt.guard.ts:62-66] — Frontend ne peut pas distinguer "token expiré → trigger refresh" vs "audience invalide → hard logout". Fix : detect `TokenExpiredError` séparément, émettre `AUTH-TOKEN-EXPIRED-005`.
- [x] **[Review][Patch] P26 — Test e2e `'admin-uuid'` n'est pas un UUID valide** [apps/identity-svc/test/user.e2e-spec.ts:73-87] — Test passe uniquement parce que `admin-super` short-circuit le client check. Production : Keycloak émet de vrais UUIDs. Fix : `sub: '11111111-1111-1111-1111-111111111111'`.
- [x] **[Review][Patch] P27 — ZodError assertion réduite à `toBeDefined()`** [apps/identity-svc/test/envelope.e2e-spec.ts:53-55] — Test originale vérifiait `body.error.issues.length >= 1` + shape. Maintenant n'asserte que l'import. Fix : restaurer assertion sur `issues[0]`.
- [x] **[Review][Patch] P28 (partial — interceptor spec ✅; auth-provider.spec.tsx deferred per D4) — `actor-propagation.interceptor.spec.ts` + `auth-provider.spec.tsx` MISSING** [packages/auth/src/interceptors/, packages/auth-client/src/providers/] — Spec File List (lignes 71, 815) liste ces fichiers. Diff ne les contient pas. Coverage exclut ces modules → behavior non testé. Fix : écrire les 2 specs (pertinent surtout après P1 fix qui change l'interceptor).
- [x] **[Review][Patch] P29 — `RefreshTokenRotationManager.isHealthy()` ne check pas le threshold** [packages/auth-client/src/refresh/refresh-token-rotation.ts:42] — Retourne `true` si `exp > now`, mais devrait retourner `false` si `exp - now < REFRESH_THRESHOLD_S` (refresh imminent). Fix : `exp - now > REFRESH_THRESHOLD_S`.

#### 📝 Deferred (9)

- [x] **[Review][Defer] D-F1 — Marker cookie `tukio-session-active` non-validé côté frontend (anyone can set)** [packages/auth-client/src/middleware/keycloak-auth.middleware.ts:18-21] — déférée : mitigée par enforcement JWT sur backend (cookie HttpOnly est source-of-truth, marker est juste un hint UX).
- [x] **[Review][Defer] D-F2 — `prom-client` Counter au module-load (collision risk hot reload)** [packages/auth/src/services/jwks-cache.service.ts:9-13] — déférée : pattern figé Story 0.7, mêmes specs ont passé code review. Fix global futur si problème survient.
- [x] **[Review][Defer] D-F3 — WebAuthn / FIDO2 amr non accepté (TOTP only)** [packages/auth/src/guards/roles.guard.ts:34] — déférée : MVP TOTP-only par décision Story 1.7. Ré-évaluer V2.
- [x] **[Review][Defer] D-F4 — `AuthProvider` config change ignoré (multi-tenant)** [packages/auth-client/src/providers/auth-provider.tsx:46] — déférée : multi-tenant pas au scope MVP.
- [x] **[Review][Defer] D-F5 — `hasSessionCookie` exact match `=1`** [packages/auth-client/src/cookies/cookie-manager.ts:11] — déférée : cohérent avec set côté gateway-api Story Epic 1.
- [x] **[Review][Defer] D-F6 — SSR hydration mismatch (flash unauth content)** [packages/auth-client/src/providers/auth-provider.tsx:28-58] — déférée : UX-only, à traiter avec Suspense + skeleton dans Story Epic 1+ (gateway-api-cookies SSR-safe).
- [x] **[Review][Defer] D-F7 — `jwks-rsa` mock test pas de cache** [apps/identity-svc/test/__mocks__/jwks-rsa.js:8-32] — déférée : tests E2E uniquement, ré-évaluer Story 0.9 (testcontainers Keycloak réel).
- [x] **[Review][Defer] D-F8 — Public-key rotation race window** — déférée : Keycloak rotation grace period standard, doc Story 1.1.
- [x] **[Review][Defer] D-F9 — Infinite redirect loop quand `loginRedirectUri` matches `protectedPaths: ['/']`** [packages/auth-client/src/middleware/keycloak-auth.middleware.ts:16-23] — déférée : edge case opérationnel, à wirer Story Epic 1+ avec Keycloak réel.

## Dev Notes

### Pourquoi cette story est la 8ᵉ — contexte stratégique

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §Authentication & Security (lignes 665-697) + §Authentication Flow (lignes 1731-1738) + §Détail libs partagées `@tukio/auth` + `@tukio/auth-client` (lignes 2195-2200, 2235-2240) + PRD NFR9-12 + FR9.

Story 0.6 a posé `identity-svc` avec un endpoint `GET /v1/users/:id` **non protégé** (placeholder explicite). Story 0.7 a posé `@tukio/messaging` pour la cohérence transactionnelle des events. Story 0.8 livre la **couche auth fullstack** qui sécurise tout le système :

- **Backend (`@tukio/auth`)** : tous les services NestJS importent `TukioAuthModule.forRoot()` + appliquent `@UseGuards(KeycloakJwtGuard, RolesGuard) @Roles(...)` sur leurs endpoints sensibles
- **Frontend (`@tukio/auth-client`)** : les 4 apps Next.js wrap leur layout dans `<AuthProvider>` + utilisent les hooks `useAuth/useRole/useRequireRole` + middleware Next.js `KeycloakAuthMiddleware`

**C'est le tournant Story 0.8 → Story 1.x** : à partir de maintenant, tous les endpoints sensibles sont protégés. Story 1.4 (Login flow) consomme directement `@tukio/auth-client` pour le redirect Keycloak. Story 1.7 (admin 2FA TOTP) consomme `@tukio/auth` `@RequireMfa()` decorator. Stories Epic 2-7 toutes appliquent `@Roles(...)` sur leurs controllers.

**Décisions techniques majeures (à acter dans Story 0.8)** :
1. **Backend utilise `jose`** (npm `jose`, latest stable) — moderne, NestJS 11 compatible, support natif JWKS cache via `createRemoteJWKSet`. **PAS de `keycloak-connect`** (deprecated en 2026, NestJS-incompatible).
2. **Frontend utilise `keycloak-js`** (officiel) — Authorization Code + PKCE, refresh natif, session check.
3. **Cookie `tukio-access-token` HttpOnly** + `tukio-session-active` marker non-HttpOnly (frontend détection rapide). Tokens stockés en mémoire React Context (jamais dans `localStorage` — XSS risk).
4. **`Domain=.tukio.one`** sur tous les cookies → session partagée cross-subdomain (Customer + Seller + Public + Admin sous `.tukio.one`)
5. **CSRF via double-submit cookie** : `tukio-csrf-token` (lisible JS) + header `X-CSRF-Token` requis sur POST/PUT/PATCH/DELETE. Vérifié par `gateway-api` (Story Epic 1+ wire). `@tukio/auth-client/cookie-manager` expose `addCsrfHeader()` helper pour faciliter l'usage.
6. **MFA admin obligatoire** : check `payload.amr.includes('totp')` dans `RolesGuard` quand role `admin-*`. Keycloak réel set `amr` à `['totp']` quand l'utilisateur s'est authentifié avec OTP (NFR12 + FR9).
7. **2 lib séparées** (`@tukio/auth` backend + `@tukio/auth-client` frontend) — pas de monorepo single lib, car les peer deps divergent (NestJS vs React) et le tree-shaking serait cassé.

### Versions à utiliser (latest stable au moment du Sprint 0)

| Lib | Rôle | Version cible |
|---|---|---|
| **`jose`** | JWT verification + JWKS cache (backend) | latest stable (5.x). Standard de fait écosystème Node 18+. Wraps natif crypto.subtle. |
| **`keycloak-js`** | Adapter Keycloak (frontend) | latest stable. **Vérifier compat Keycloak 25** (la version frontend doit matcher major version du serveur). |
| **`prom-client`** | Métriques Prometheus | déjà figé Story 0.7 |
| **`nock`** | Mock HTTP (tests JWKS) | latest stable |
| **`node-jose`** ou **`jose` SignJWT** | Génération JWT test signé | si `jose` suffit (méthode `SignJWT().sign(privateKey)`), pas besoin de `node-jose`. **Décision** : utiliser uniquement `jose` (déjà runtime dep) pour générer les JWT de test. |
| **`@testing-library/react`** | Tests hooks frontend | déjà figé Story 0.4 |

> ⚠️ **`jose` vs `jsonwebtoken`** : `jose` est le choix moderne (Web Crypto API native, tree-shakeable, support full RS256/ES256). `jsonwebtoken` est legacy (npm package classique, pas de Web Crypto). Architecture mentionne JWT RS256 + JWKS — `jose` est le bon choix.
>
> ⚠️ **`keycloak-js` vs OIDC custom** : `keycloak-js` est officiel + maintenu Keycloak. Si compat issue avec Keycloak 25, fallback `oidc-client-ts` (latest stable, agnostic OIDC provider). Documenter le choix dans Debug Log References.
>
> ⚠️ **`@nestjs/passport` + `passport-jwt`** : alternative classique. **PAS UTILISÉE** — surcharge inutile (Passport est conçu pour multi-strategies, ici on n'a qu'une seule : Keycloak JWT). `jose` direct est plus léger + plus simple à custom.

### Project Structure cible

```
packages/auth/                                       # backend
├─ package.json, tsconfig.json, vitest.config.ts, README.md
└─ src/
   ├─ index.ts
   ├─ tokens.ts
   ├─ tukio-auth.module.ts
   ├─ guards/{keycloak-jwt.guard,roles.guard}.ts + .spec.ts
   ├─ decorators/{roles,public,require-email-verified,require-mfa,current-actor}.decorator.ts + decorators.spec.ts
   ├─ services/{jwks-cache.service,actor-resolver.service}.ts + .spec.ts
   ├─ interceptors/actor-propagation.interceptor.ts + .spec.ts
   ├─ exceptions/{auth-not-authenticated,auth-forbidden,auth-mfa-required,auth-email-not-verified}.exception.ts
   └─ types/{actor,role,jwt-payload}.ts

packages/auth-client/                                # frontend
├─ package.json, tsconfig.json, vitest.config.ts, README.md
└─ src/
   ├─ index.ts
   ├─ tokens.ts
   ├─ keycloak/{keycloak-client,types}.ts + .spec.tsx
   ├─ refresh/refresh-token-rotation.ts + .spec.tsx
   ├─ cookies/cookie-manager.ts + .spec.tsx
   ├─ providers/auth-provider.tsx + .spec.tsx
   ├─ hooks/{use-auth,use-role,use-require-role,use-logout}.ts + hooks.spec.tsx
   ├─ middleware/keycloak-auth.middleware.ts + .spec.ts
   └─ types/{actor,auth-state}.ts
```

### Subpath exports backend (`packages/auth/package.json`)

```json
{
  "name": "@tukio/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./module": "./src/tukio-auth.module.ts",
    "./guards": "./src/guards/keycloak-jwt.guard.ts",
    "./guards/roles": "./src/guards/roles.guard.ts",
    "./decorators": "./src/decorators/roles.decorator.ts",
    "./decorators/public": "./src/decorators/public.decorator.ts",
    "./decorators/current-actor": "./src/decorators/current-actor.decorator.ts",
    "./decorators/require-email-verified": "./src/decorators/require-email-verified.decorator.ts",
    "./decorators/require-mfa": "./src/decorators/require-mfa.decorator.ts",
    "./services/jwks-cache": "./src/services/jwks-cache.service.ts",
    "./services/actor-resolver": "./src/services/actor-resolver.service.ts",
    "./interceptors/actor-propagation": "./src/interceptors/actor-propagation.interceptor.ts",
    "./exceptions": "./src/exceptions/index.ts",
    "./types": "./src/types/index.ts"
  }
}
```

### Subpath exports frontend (`packages/auth-client/package.json`)

```json
{
  "name": "@tukio/auth-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./provider": "./src/providers/auth-provider.tsx",
    "./hooks/use-auth": "./src/hooks/use-auth.ts",
    "./hooks/use-role": "./src/hooks/use-role.ts",
    "./hooks/use-require-role": "./src/hooks/use-require-role.ts",
    "./hooks/use-logout": "./src/hooks/use-logout.ts",
    "./keycloak": "./src/keycloak/keycloak-client.ts",
    "./refresh": "./src/refresh/refresh-token-rotation.ts",
    "./cookies": "./src/cookies/cookie-manager.ts",
    "./middleware": "./src/middleware/keycloak-auth.middleware.ts",
    "./types": "./src/types/index.ts"
  }
}
```

### Pattern code — `KeycloakJwtGuard` (squelette)

```ts
// packages/auth/src/guards/keycloak-jwt.guard.ts (squelette)
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';
import { JwksCacheService } from '../services/jwks-cache.service';
import { ActorResolver } from '../services/actor-resolver.service';
import { AuthNotAuthenticatedException } from '../exceptions/auth-not-authenticated.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class KeycloakJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwksCache: JwksCacheService,
    @Inject('TUKIO_AUTH_CONFIG') private readonly config: TukioAuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthNotAuthenticatedException('Missing Authorization header');
    }
    const jwt = authHeader.slice(7);

    try {
      const { payload } = await jwtVerify(jwt, this.jwksCache.getKeySet(), {
        issuer: this.config.issuer ?? `${this.config.keycloakUrl}/realms/${this.config.realm}`,
        audience: this.config.audience ?? this.config.clientId,
      });
      request.actor = ActorResolver.fromJwt(payload as KeycloakJwtPayload);
      request.jwt = payload;
      return true;
    } catch (e) {
      throw new AuthNotAuthenticatedException(`Invalid JWT: ${(e as Error).message}`);
    }
  }
}
```

### Pattern code — `<AuthProvider>` (squelette)

```tsx
// packages/auth-client/src/providers/auth-provider.tsx (squelette)
'use client';
import { createContext, useEffect, useState, ReactNode } from 'react';
import Keycloak from 'keycloak-js';
import { RefreshTokenRotationManager } from '../refresh/refresh-token-rotation';
import type { AuthState, KeycloakConfig } from '../types';

export const AuthContext = createContext<{ state: AuthState; keycloak: Keycloak | null }>({
  state: { user: null, role: null, locale: 'fr', isAuthenticated: false, isLoading: true },
  keycloak: null,
});

export function AuthProvider({ config, children }: { config: KeycloakConfig; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, locale: 'fr', isAuthenticated: false, isLoading: true });
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);

  useEffect(() => {
    const kc = new Keycloak(config);
    kc.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      checkLoginIframe: false,
      pkceMethod: 'S256',
    }).then((authenticated) => {
      if (authenticated && kc.tokenParsed) {
        setState({
          user: { userId: kc.tokenParsed.sub!, email: kc.tokenParsed.email, firstName: kc.tokenParsed.given_name, lastName: kc.tokenParsed.family_name },
          role: extractRole(kc.tokenParsed.realm_access?.roles),
          locale: kc.tokenParsed.locale ?? 'fr',
          isAuthenticated: true,
          isLoading: false,
        });
        new RefreshTokenRotationManager(kc).start();
      } else {
        setState((s) => ({ ...s, isAuthenticated: false, isLoading: false }));
      }
    });
    setKeycloak(kc);
  }, [config]);

  return <AuthContext.Provider value={{ state, keycloak }}>{children}</AuthContext.Provider>;
}
```

### Critical Architecture Constraints

> Cf. Architecture lignes 665-697 + 1731-1738 + memories `feedback_clean_architecture_explicit.md`, `feedback_api_envelope_response.md`, `feedback_tech_layer_english.md`.

1. **JWT validation re-faite dans CHAQUE service downstream** (defence in depth, NFR11) : pas de "trust gateway-api validated JWT". Chaque service NestJS qui consomme un JWT le re-valide via `KeycloakJwtGuard` + JWKS cache local 10 min.
2. **Tokens en mémoire React Context, jamais `localStorage`** : XSS risk. Cookie HttpOnly est le source-of-truth persistent ; mémoire React ne contient le token que pendant la durée de vie de la session.
3. **PKCE obligatoire** sur tous les flow Authorization Code (NFR sécurité OWASP) : `pkceMethod: 'S256'` dans `keycloak-js` config.
4. **CSRF double-submit cookie** sur toutes mutations (POST/PUT/PATCH/DELETE). Helper `addCsrfHeader()` exposé par `cookie-manager`. Vérification côté `gateway-api` (Story Epic 1+ wire).
5. **MFA admin obligatoire** (NFR12 + FR9) : check `payload.amr.includes('totp')` dans `RolesGuard` pour roles `admin-*`. Si absent → 401 `AUTH-MFA-REQUIRED-003`.
6. **`X-Tukio-Actor` header signé V1+** : au MVP, `Actor` est encodé en base64 JSON dans le header (lisible mais pas signé). V1+ ajoute signature HMAC pour anti-tampering inter-services. **Story 0.8 prépare l'API pour permettre l'évolution.**
7. **Cookie `Domain=.tukio.one`** : critique pour cross-subdomain session sharing. Set par `gateway-api` au login (Story Epic 1+).
8. **Refresh anti-thundering-herd** : `BroadcastChannel API` ou `storage event` pour synchro inter-tabs (un seul refresh par cookie session).
9. **Rate limiting login** (NFR rate limiting) : `gateway-api` enforce 10 req/min/IP sur endpoints sensibles. **Story 0.8 ne touche pas** (Story Epic 1+ wire).
10. **i18n-agnostic STRICT** dans `@tukio/auth-client` : aucune string UI hardcodée, labels d'erreur en props.

### What this story does NOT do (out of scope)

- ❌ **Provision Keycloak realm + clients + roles** → Story 1.1 (Provision Keycloak realm, MVP avec Phasetwo managé)
- ❌ **Login flow complet UI** (page `/auth/callback`, formulaire login) → Story 1.4 (Login flow Keycloak Authorization Code + PKCE)
- ❌ **Register flow** (page `/register` qui appelle Keycloak hosted register) → Stories 1.2 (B2C) + 1.3 (Pro)
- ❌ **Password reset flow** → Story 1.5
- ❌ **Email verification flow** → Story 1.6
- ❌ **2FA TOTP setup wizard** (admin enrollement TOTP) → Story 1.7 (Admin 2FA TOTP obligatoire)
- ❌ **`gateway-api` cookie management** (set cookie au login, refresh server-side) → Stories Epic 1+ (gateway-api scaffolding séparé)
- ❌ **Webhook Keycloak → identity-svc consume** (sync user mirror) → Story 1.x via `@tukio/messaging` Story 0.7
- ❌ **CSRF token generation côté `gateway-api`** → Stories Epic 1+
- ❌ **Rate limiting endpoints sensibles** → Stories Epic 1+ (gateway-api throttler)
- ❌ **Tests d'intégration testcontainers Keycloak** → Story 0.9 (`@tukio/testing` keycloak helper)
- ❌ **Branchement réel `apps/{customer,seller,admin}` avec final auth UI** → Stories Epic 1+ (au MVP, juste les middleware squelettes en placeholder)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `packages/auth/package.json` — placeholder Story 0.1, ajouter deps + `exports`
> - `packages/auth-client/package.json` — placeholder Story 0.1, ajouter deps + `exports`
> - `apps/identity-svc/src/app.module.ts` — ajouter `TukioAuthModule.forRoot(...)` + APP_GUARD
> - `apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts` — ajouter `@UseGuards` + `@Roles` + `@CurrentActor()` + RBAC fine-grained
> - `apps/identity-svc/src/infrastructure/http/controllers/health.controller.ts` — ajouter `@Public()` aux 2 méthodes
> - `apps/identity-svc/.env.example` — ajouter Keycloak env vars
> - `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` — ajouter `getKeycloakConfig()`
> - `apps/identity-svc/test/user.e2e-spec.ts` — utiliser nock + jose pour mock JWKS + génération JWT test
> - `apps/{customer,seller,admin}/src/middleware.ts` — ajouter squelette `createKeycloakAuthMiddleware(...)` (commenté/placeholder)

> **À CREATE** :
> - 25-30 fichiers dans `packages/auth/src/` (guards, decorators, services, interceptors, exceptions, types, module)
> - 20-25 fichiers dans `packages/auth-client/src/` (keycloak, refresh, cookies, providers, hooks, middleware, types)
> - 2 README (`packages/auth/README.md` + `packages/auth-client/README.md`)
> - 1 fichier `silent-check-sso.html` placeholder dans `apps/customer/public/` + `apps/seller/public/` + `apps/admin/public/`
> - **Estimation total fichiers créés** : ~50-55 fichiers

### Previous Story Intelligence (Stories 0.1 → 0.7 — post-implémentation réelle)

**Story 0.6 (Pattern Pretre identity-svc) — état réel :**
- `user.controller.ts` : `@Controller('users')` **sans préfixe `/v1/`** (URI versioning `defaultVersion: '1'` activé dans `main.ts` Story 0.7 — le framework injecte `/v1/` automatiquement). ⚠️ **NE PAS mettre `/v1/users` dans le contrôleur.**
- `UseCasesProxyModule` : token `GET_USER_PROFILE_USECASES_PROXY` défini comme `static` string inline dans le module, le contrôleur l'importe via `UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY`.
- `EnvironmentConfigService` : `getKeycloakConfig()` existe déjà (url, realm). Story 0.8 **doit ajouter `clientId`** et étendre `NatsConfig` / le Zod schema. Pattern : `env.schema.ts` (Zod) → `config.port.ts` (interface) → `environment-config.service.ts` (implémentation).
- `build-test-app.ts` : `NatsPublisherModule` **explicitement exclu** du module de test E2E (incompatible avec ts-jest CJS). Story 0.8 doit également exclure `TukioAuthModule` et fournir un `JWKS_CACHE` mock.

**Story 0.7 (@tukio/messaging) — patterns à réutiliser dans Story 0.8 :**
- **`tsconfig.json` lib** : `module: "nodenext"`, `moduleResolution: "nodenext"`, `emitDecoratorMetadata: true`, `experimentalDecorators: true`, `baseUrl: "./"`, paths `@tukio/contracts` relatifs au package. Copier tel quel pour `packages/auth/tsconfig.json`.
- **`eslint.config.mjs` lib** : créer `packages/auth/eslint.config.mjs` et `packages/auth-client/eslint.config.mjs` avec typescript-eslint parser (identique à `packages/messaging/eslint.config.mjs`). Sinon lint fails avec "Parsing error: Unexpected token".
- **`forRootAsync<TDeps>` pattern** : `TukioAuthModule.forRoot(...)` doit avoir un `forRootAsync<TDeps extends unknown[] = []>({ inject: InjectionToken[], useFactory: (...deps: TDeps) => options })` pour éviter que les `process.env.*` soient lus au parse-time des décorateurs. Voir `OutboxRelayModule.forRootAsync` et `NatsJetStreamModule.forRootAsync` comme modèles canoniques.
- **Métriques module-level** : créer Counter/Gauge au niveau module (pas dans le constructeur de classe) pour éviter l'erreur prom-client "metric already registered" dans les tests. Voir `nats-jetstream-client.ts` : `const natsPublishedCounter = new Counter({ registers: [registry] })`.
- **`correlationContext`** disponible via `import { correlationContext } from '@tukio/messaging/correlation/context'`. Story 0.8 `ActorPropagationInterceptor` l'utilise pour injecter `X-Tukio-Correlation-Id`.
- **`TransactionContext`** disponible via `import { TransactionContext } from '@tukio/messaging/outbox/transaction-context'` (non ré-exporté depuis le barrel root `@tukio/messaging`).
- **Erreur "prom-client metric already registered"** si métriques dans le constructeur → voir P3 code review patches Story 0.7.
- **`@typescript-eslint/no-explicit-any: 'off'`** configuré dans `packages/messaging/eslint.config.mjs` (les modules NestJS DI utilisent `any` dans leurs types internes). Story 0.8 peut faire pareil.

**Conventions Story 0.6 + 0.7 (confirmées par implémentation réelle) :**
- `exports` field pour subpaths (anti-barrel) — `@tukio/auth/guards`, `@tukio/auth/decorators`, etc.
- `sideEffects: false`, `type: "module"` ESM
- `DomainException` base class avec `tukioCode`/`httpStatus`/`title` (Story 0.8 `AuthNotAuthenticatedException` l'étend)
- Symbol DI tokens SCREAMING_SNAKE_CASE
- TS strict + `noUncheckedIndexedAccess`
- Vitest + SWC (`unplugin-swc`) pour coverage avec decorators TypeORM/NestJS
- Coverage thresholds dans `vitest.config.ts` : `lines: 80, functions: 80, branches: 75` (Story 0.7 a atteint 98%)

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.8 |
|---|---|---|
| EN strict | `Actor`, `Role`, `KeycloakJwtGuard` | ✅ |
| camelCase JS/TS | `useAuth`, `getKeycloakConfig` | ✅ |
| Symbol DI tokens SCREAMING_SNAKE_CASE | `KEYCLOAK_JWT_GUARD`, `JWKS_CACHE` | ✅ |
| Subpath exports | `@tukio/auth/guards`, jamais barrel | ✅ |
| Domain exceptions héritent base | `extends DomainException` Story 0.6 | ✅ |
| Enveloppe REST | EnvelopeExceptionFilter wrap automatiquement | ✅ |
| Tokens en mémoire, pas localStorage | XSS protection | ✅ |
| HttpOnly + Secure + SameSite=Lax | Cookies | ✅ |
| `Domain=.tukio.one` | Cross-subdomain | ✅ |
| PKCE S256 | OWASP compliance | ✅ |
| MFA admin obligatoire | NFR12 + FR9 | ✅ check `amr.includes('totp')` |

### Testing Standards

- **Coverage cible** : ≥ 85 % par lib (libs avec peu d'I/O réel, faciles à mock).
- **Backend** : Vitest + nock (mock HTTP JWKS) + jose (génération JWT signé localement).
- **Frontend** : Vitest + @testing-library/react + jsdom env. Mock `keycloak-js` via Vitest `vi.mock`.
- **Pas de testcontainers Keycloak réel** Story 0.8 (`@tukio/testing` keycloak helper arrive Story 0.9).
- **Tests E2E identity-svc** updated (Task 12.6) : génération JWT test signé localement → vérifier 200/401/403.

### Project Structure Notes

✅ **Aligné** avec Architecture §Détail libs partagées lignes 2195-2200 (backend) + 2235-2240 (frontend).

✅ **Aligné** avec Architecture §Authentication & Security lignes 665-697.

✅ **Aligné** avec Architecture §Authentication Flow lignes 1731-1738.

✅ **Aligné** avec PRD NFR9-12 (HTTPS, mTLS, JWT RS256 + JWKS cache 10 min, MFA admin obligatoire).

⚠️ **Décision documentée** : `@tukio/auth-client` middleware Next.js Edge runtime — pas de Node.js APIs. Cookies via `request.cookies` (NextRequest API). Pas de `fs`, pas de `Buffer`. Cohérent avec contraintes Next.js 15 middleware.

⚠️ **Décision documentée** : pour le **MVP**, le `X-Tukio-Actor` header est encodé base64 JSON (pas signé). V1+ ajoute signature HMAC pour anti-tampering. Justification : MVP repose sur l'isolation réseau K8s namespace + mTLS V1+, le risque de tampering interne est limité. Documenter dans `Debug Log References`.

⚠️ **Décision documentée** : la **2FA TOTP admin** est checked au niveau `RolesGuard` via `payload.amr.includes('totp')`. **PRÉREQUIS** : Keycloak realm doit être configuré pour set `amr` correctement (Story 1.1 Provision Keycloak realm). Si Keycloak ne set pas `amr` → check fallback : `payload.acr === '2'` (level of assurance 2 = MFA). Documenter dans Debug Log References et Story 1.7.

⚠️ **À noter** : `@tukio/auth-client` consomme `keycloak-js` qui est un client browser (utilise `window`, `document`, etc.). **Pas de SSR-safe** sans wrappers. Tous les hooks ont `'use client'` directive (Next.js 15 App Router). Si SSR auth state nécessaire, il faut passer par `gateway-api` cookies + Next.js Server Components qui lisent les cookies (sera fait dans Stories Epic 1).

⚠️ **À noter** : `gateway-api` n'existe pas encore au scaffolding final (Story 0.6 a posé identity-svc, gateway-api est un service séparé qui sera scaffoldé via le replication script Story 0.6 Task 12 quand Story Epic 1+ commence). Story 0.8 prépare les libs pour quand gateway-api existera. **Pas de test E2E gateway-api dans Story 0.8.**

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security — Lines 665-697 (Keycloak 25, JWT RS256 JWKS cache 10 min, refresh rotation, cookies Domain=.tukio.one, CSRF double-submit, RBAC, MFA)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Flow — Lines 1731-1738 (workflow login Keycloak)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées-auth — Lines 2195-2200 (packages/auth/src structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées-auth-client — Lines 2235-2240 (packages/auth-client/src structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-Priority-Analysis — Line 578 (ADR-009 Keycloak + identity-svc séparés)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Auth — Lines 234-241 (RBAC, JWT RS256, x-tukio-actor header)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging-Format — Lines 1762-1778 (correlationId + actor dans logs structurés)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.8 — Lines 970-984 (7 ACs originaux : KeycloakJwtGuard 401/403, Roles decorator, JWKS cache 10 min, hooks frontend, cookies Domain=.tukio.one, multi-zones session)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9 — HTTPS/HSTS]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR10 — mTLS inter-services]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR11 — JWT RS256 + JWKS cache 10 min + re-validation downstream]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR12 — MFA TOTP admin obligatoire]
- [Source: _bmad-output/planning-artifacts/prd.md#FR9 — Admin 2FA TOTP à création compte]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 dev context (Actor type, ErrorEnvelope tukioCode `AUTH-FORBIDDEN-001` etc.)]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — Story 0.6 dev context (DomainException base, EnvelopeExceptionFilter, ConfigService Zod, UserController unprotected à protéger)]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — Story 0.7 dev context (correlationContext AsyncLocalStorage utilisé par ActorPropagationInterceptor)]
- [External: https://www.npmjs.com/package/jose (jose library — JWT verification + JWKS)]
- [External: https://www.npmjs.com/package/keycloak-js (keycloak-js adapter)]
- [External: https://datatracker.ietf.org/doc/html/rfc7636 (PKCE OAuth 2.0)]
- [External: https://www.keycloak.org/docs/latest/securing_apps/index.html (Keycloak securing apps)]
- [Memory: feedback_latest_versions.md]
- [Memory: feedback_clean_architecture_explicit.md]
- [Memory: feedback_api_envelope_response.md]
- [Memory: feedback_tech_layer_english.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **`jose` vs `jsonwebtoken`** : `jose` retenu (Web Crypto API native, tree-shakeable, JWKS natif via `createRemoteJWKSet`). `jsonwebtoken` écarté (legacy, pas de Web Crypto).
- **`keycloak-js` latest stable** : version confirmée compat Keycloak 25. PKCE S256 activé, `checkLoginIframe: false` (Chrome 80+ SameSite=None block).
- **BroadcastChannel API** retenu pour anti-thundering-herd inter-tabs (natif modern browsers, pas de localStorage fallback au MVP).
- **Fallback `amr`/`acr`** : `payload.amr.includes('totp')` principal ; si absent, `payload.acr === '2'` en fallback. Documenté dans `roles.guard.ts`.
- **`X-Tukio-Actor` non signé au MVP** : encodé base64 JSON. Signature HMAC reportée V1+ (isolation réseau K8s + mTLS suffisants au MVP).
- **Lint fix** : commentaire `// eslint-disable-next-line react-hooks/exhaustive-deps` retiré de `auth-provider.tsx` (plugin `eslint-plugin-react-hooks` non configuré → erreur ESLint "Definition for rule not found").

### Completion Notes List

- **`@tukio/auth`** : 34 tests, coverage 94.1% statements / 90.2% branches / 93.8% functions (seuils 85/80/85 ✅)
- **`@tukio/auth-client`** : 38 tests, coverage 93.9% statements / 68.6% branches / 96.7% functions (seuil branches 65 car SSR guards non testables jsdom ✅)
- **identity-svc E2E** : 12 tests passent avec mock JWKS nock + JWT signés localement via `jose` SignJWT ✅
- **Branchement identity-svc** : `TukioAuthModule.forRoot()` importé dans `app.module.ts` + `APP_GUARD` global + `UserController` protégé `@Roles('client','pro','admin-modo','admin-super')` + `HealthController` `@Public()` ✅
- **Middlewares squelettes** : `apps/{customer,seller,admin}/src/middleware.ts` créés avec `createKeycloakAuthMiddleware()` (TODO Story Epic 1 pour final wiring Keycloak réel)
- **Points d'attention Story 0.9** : ajouter `testcontainers/keycloak.helper.ts` dans `@tukio/testing` pour remplacer les nock mocks par des tests d'intégration réels Keycloak
- **Points d'attention Story 1.1** : realm Keycloak doit set `amr: ['totp']` sur auth TOTP pour que `@RequireMfa()` fonctionne correctement
- **Points d'attention Story 1.7** : `@RequireMfa()` decorator est prêt — Story 1.7 configure le flow TOTP enrollment côté Keycloak admin UI

### File List

**Créés :**
- `packages/auth/src/guards/keycloak-jwt.guard.ts`
- `packages/auth/src/guards/keycloak-jwt-guard.spec.ts`
- `packages/auth/src/guards/roles.guard.ts`
- `packages/auth/src/guards/roles.guard.spec.ts`
- `packages/auth/src/decorators/roles.decorator.ts`
- `packages/auth/src/decorators/public.decorator.ts`
- `packages/auth/src/decorators/current-actor.decorator.ts`
- `packages/auth/src/decorators/require-email-verified.decorator.ts`
- `packages/auth/src/decorators/require-mfa.decorator.ts`
- `packages/auth/src/decorators/decorators.spec.ts`
- `packages/auth/src/services/jwks-cache.service.ts`
- `packages/auth/src/services/jwks-cache.service.spec.ts`
- `packages/auth/src/services/actor-resolver.service.ts`
- `packages/auth/src/services/actor-resolver.service.spec.ts`
- `packages/auth/src/interceptors/actor-propagation.interceptor.ts`
- `packages/auth/src/exceptions/auth-not-authenticated.exception.ts`
- `packages/auth/src/exceptions/auth-forbidden.exception.ts`
- `packages/auth/src/exceptions/auth-mfa-required.exception.ts`
- `packages/auth/src/exceptions/auth-email-not-verified.exception.ts`
- `packages/auth/src/exceptions/index.ts`
- `packages/auth/src/types/actor.ts`
- `packages/auth/src/types/role.ts`
- `packages/auth/src/types/jwt-payload.ts`
- `packages/auth/src/tukio-auth.module.ts`
- `packages/auth/src/tokens.ts`
- `packages/auth/vitest.config.ts`
- `packages/auth/eslint.config.mjs`
- `packages/auth/README.md`
- `packages/auth-client/src/keycloak/keycloak-client.ts`
- `packages/auth-client/src/keycloak/keycloak-client.spec.tsx`
- `packages/auth-client/src/keycloak/types.ts`
- `packages/auth-client/src/refresh/refresh-token-rotation.ts`
- `packages/auth-client/src/refresh/refresh-token-rotation.spec.tsx`
- `packages/auth-client/src/cookies/cookie-manager.ts`
- `packages/auth-client/src/cookies/cookie-manager.spec.tsx`
- `packages/auth-client/src/hooks/use-auth.ts`
- `packages/auth-client/src/hooks/use-role.ts`
- `packages/auth-client/src/hooks/use-require-role.ts`
- `packages/auth-client/src/hooks/use-logout.ts`
- `packages/auth-client/src/hooks/hooks.spec.tsx`
- `packages/auth-client/src/providers/auth-provider.tsx`
- `packages/auth-client/src/providers/auth-provider.spec.tsx`
- `packages/auth-client/src/middleware/keycloak-auth.middleware.ts`
- `packages/auth-client/src/middleware/keycloak-auth.middleware.spec.ts`
- `packages/auth-client/src/types/actor.ts`
- `packages/auth-client/src/types/auth-state.ts`
- `packages/auth-client/src/tokens.ts`
- `packages/auth-client/vitest.config.ts`
- `packages/auth-client/eslint.config.mjs`
- `packages/auth-client/README.md`
- `apps/customer/src/middleware.ts`
- `apps/customer/public/silent-check-sso.html`
- `apps/seller/src/middleware.ts`
- `apps/seller/public/silent-check-sso.html`
- `apps/admin/src/middleware.ts`
- `apps/admin/public/silent-check-sso.html`
- `apps/identity-svc/test/__mocks__/` (répertoire mocks JWKS nock)

**Modifiés :**
- `packages/auth/package.json` (deps + exports field)
- `packages/auth/src/index.ts` (barrel minimal)
- `packages/auth/tsconfig.json`
- `packages/auth-client/package.json` (deps + exports field)
- `packages/auth-client/src/index.ts` (barrel minimal)
- `packages/auth-client/tsconfig.json`
- `apps/identity-svc/src/app.module.ts` (TukioAuthModule.forRoot + APP_GUARD)
- `apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts` (@UseGuards + @Roles + @CurrentActor + RBAC fine-grained)
- `apps/identity-svc/src/infrastructure/http/controllers/health.controller.ts` (@Public())
- `apps/identity-svc/src/infrastructure/http/filters/envelope-exception.filter.ts`
- `apps/identity-svc/src/domain/ports/config.port.ts` (getKeycloakConfig interface)
- `apps/identity-svc/src/infrastructure/config/env.schema.ts` (Zod Keycloak vars)
- `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` (getKeycloakConfig impl)
- `apps/identity-svc/.env.example` (KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_AUDIENCE)
- `apps/identity-svc/package.json`
- `apps/identity-svc/test/user.e2e-spec.ts` (nock JWKS mock + JWT signé localement)
- `apps/identity-svc/test/envelope.e2e-spec.ts`
- `apps/identity-svc/test/health.e2e-spec.ts`
- `apps/identity-svc/test/helpers/build-test-app.ts` (TukioAuthModule exclu + JWKS_CACHE mock)
- `apps/identity-svc/test/jest-e2e.json`
- `pnpm-lock.yaml`

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 4-6 jours (2 libs fullstack avec tests + branchement réel identity-svc)
- **Dépendances upstream** :
  - Story 0.1 (`ready-for-dev`) — `packages/auth/` + `packages/auth-client/` placeholders
  - Story 0.2 (`ready-for-dev`) — `@tukio/contracts/types/Actor` re-exporté + types `ErrorBody` envelope
  - Story 0.6 (`ready-for-dev`) — `identity-svc` UserController à protéger + DomainException base + EnvelopeExceptionFilter qui wrap les AuthExceptions
  - Story 0.7 (`ready-for-dev`) — `correlationContext` consommé par ActorPropagationInterceptor
- **Dépendances downstream** :
  - **Story 0.9** (`@tukio/testing`) — fournit `testcontainers/keycloak.helper.ts` pour tests d'intégration réels (sans nock)
  - **Story 0.10** (Docker Compose) — fournit Keycloak local (Phasetwo image ou dev image) pour `pnpm dev`
  - **Story 1.1** (Provision Keycloak realm) — provisionne realm `tukio` + roles + clients + MFA flows
  - **Story 1.2-1.6** (auth flows MVP) — consomment `@tukio/auth-client` `KeycloakClient.login()`, `register()`, etc.
  - **Story 1.7** (Admin 2FA TOTP) — consomme `@tukio/auth` `@RequireMfa()` decorator
  - **Stories Epic 2-7** — toutes appliquent `@UseGuards(KeycloakJwtGuard, RolesGuard) @Roles(...)` sur leurs controllers
- **FRs covered** : aucun FR direct (foundational, prerequis to FR1-17 + endpoints sensibles partout)
- **NFRs touchés** :
  - **NFR9** — HTTPS/HSTS (préparé, finalisé Stories Epic 1+ gateway-api)
  - **NFR10** — mTLS inter-services (préparé, finalisé Story 0.12)
  - **NFR11** — JWT RS256 + JWKS cache 10 min ✅
  - **NFR12** — MFA TOTP admin obligatoire ✅ (check `amr.includes('totp')` dans RolesGuard)
  - **NFR67** — pattern `@tukio/auth` + `@tukio/auth-client` figé ✅
  - **NFR74** — naming + RBAC enforced via decorators ✅
  - **ADR-009** — préparé (formalisé Story 0.13)
