# gateway-api HTTP utils — Story 1.4a

Pure, framework-agnostic building blocks consumed by the login flow controllers
(Story 1.4b) and the callback handler. **No NestJS DI**, **no Axios**, **no
side effects** beyond crypto + cookie string construction. Keep this layer
unit-testable in isolation — anything stateful belongs in `external/` or
controllers.

## `pkce.ts` — RFC 7636 PKCE materials

```ts
const { verifier, challenge } = generatePkceMaterials();
// → verifier: 32-byte random base64url string (≥ 43 chars)
// → challenge: base64url(sha256(verifier))
```

Used at the `/v1/auth/login` initiate handler. The `verifier` is stored
server-side in the `tukio-pkce-state` cookie (see `cookie-helpers.ts`) and
verified by Keycloak on `/token` exchange.

## `state-jwt.ts` — Anti-CSRF state JWT

```ts
const token = await encodeState({ next, requestId, issuedAt }, secret);
const payload = await decodeState(token, secret); // throws AuthInvalidStateException
```

Signed with HS256 + `STATE_JWT_HMAC_SECRET` (≥ 32 chars). TTL 10 min via the
`exp` claim. Carried as `?state=` through the Keycloak callback and verified
to bind the callback to the initiate request (anti-replay + anti-CSRF).
Decode failures (expired / tampered / wrong secret / missing claim) all map
to `AUTH-INVALID-STATE-001` (anti-enumeration NFR9).

## `cookie-helpers.ts` — Session cookie builders

| Cookie                 | HttpOnly | SameSite | Max-Age | Path       | Notes                          |
| ---------------------- | -------- | -------- | ------- | ---------- | ------------------------------ |
| `tukio-access-token`   | ✓        | Lax      | 5 min   | `/`        | Short-lived KC access token    |
| `tukio-refresh-token`  | ✓        | Strict   | 30 d    | `/v1/auth` | Scoped to refresh endpoint     |
| `tukio-session-active` | ✗        | Lax      | 30 d    | `/`        | JS-readable presence marker    |
| `tukio-csrf-token`     | ✗        | Strict   | 30 d    | `/`        | Double-submit token            |
| `tukio-pkce-state`     | ✓        | Lax      | 10 min  | `/`        | Holds verifier + originalState |

All cookies carry `Secure` and `Domain=.tukio.one` (or no `Domain` in dev).
`TUKIO_DEV_INSECURE_COOKIES=1` drops `Secure` for localhost HTTP testing.
**Never** honored in production (boot-time check in `env.schema.ts`).

```ts
const cookies = buildSessionCookies(
  { accessToken, refreshToken, csrfToken },
  resolveCookieDeployment({ nodeEnv, domain, devInsecureFlag }),
);
// reply.header('set-cookie', cookies);
```

## `redirect-resolver.ts` — Post-login redirect

```ts
const url = resolvePostLoginRedirect({
  claims: decodedJwt,
  locale,
  next: req.query.next,
  zones: configService.getZoneBaseUrls(),
});
```

Decision matrix (first match wins):

1. Admin + TOTP → `admin.tukio.one/<locale>/admin/dashboard`
2. Admin no TOTP → `admin.tukio.one/<locale>/auth/totp-setup` (Story 1.7)
3. Pro `pending_admin_review` → `seller.tukio.one/<locale>/seller/onboarding/pending` (FR17)
4. Pro `active` → `seller.tukio.one/<locale>/seller/dashboard`
5. Pro `rejected` → `seller.tukio.one/<locale>/seller/onboarding/rejected`
6. Customer → `tukio.one/<locale>/account/dashboard` (apex unified, ADR-016)

If `?next=` is a whitelisted `*.tukio.one` (or `localhost` in dev) URL, it
overrides the default. Otherwise the default applies (open-redirect / XSS /
data: URIs are silently dropped).

## Forbidden in this layer

- No NestJS decorators (`@Injectable`, `@Inject`) — keep utils pure.
- No `axios` / HTTP clients — that's `infrastructure/external/`.
- No use-case orchestration — that's `usecases/` (consumed via UseCaseProxy).
- No domain logic — these are infrastructure helpers, not business rules.
