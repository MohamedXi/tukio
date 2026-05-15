# Story 1.4: Login flow Keycloak (`POST /v1/auth/login` + Authorization Code + PKCE)

Status: ready-for-dev

> ⚠️ **ADR-016 / Story 0.14 (2026-05-15) — frontend topology pivot — IMPACT LOURD sur cette story**
> `apps/customer` a été mergé dans `apps/public` (apex `tukio.one` unifié,
> visiteurs + customers B2C). Conséquences sur ce flow login :
> - Redirect post-login Customer : `customer.tukio.one/{locale}/account/dashboard` → `tukio.one/{locale}/account/dashboard`.
> - Le "cross-zone session sharing" Customer ↔ Customer n'a plus lieu d'être (même origin). Reste la cross-zone vers `seller.tukio.one` (cookie `Domain=.tukio.one`).
> - Callback URL Keycloak : déjà `tukio.one/{locale}/auth/callback` dans la story (✅ aligné).
> - Routes auth-gated `apps/public/[locale]/(authenticated)/...` protégées par le middleware Story 0.14 (`apps/public/src/middleware.ts`) — Story 1.4 doit poser le cookie `tukio-session-active` que ce middleware lit.
> Voir `docs/adr/0016-frontend-topology-pivot-apex-unified.md` et Story 0.14.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Customer / Pro / Admin authentifié sur Tukio,
**I want** un flow de login complet **OAuth 2.0 Authorization Code + PKCE S256** initié depuis `apps/public/{locale}/auth/login` (page UI minimaliste avec CTA "Se connecter avec Tukio" qui appelle `GET /v1/auth/login` côté gateway-api), avec **redirect Keycloak** `auth.tukio.one/realms/tukio/protocol/openid-connect/auth?response_type=code&client_id=tukio-web&redirect_uri=https://tukio.one/{locale}/auth/callback&code_challenge=<S256-of-verifier>&code_challenge_method=S256&state=<csrf-uuid>&kc_locale={locale}` (PKCE obligatoire NFR9, state UUID anti-CSRF, kc_locale matche locale Tukio), **callback Next.js** route handler `apps/public/src/app/[locale]/auth/callback/route.ts` qui forward le `?code=...&state=...` à gateway-api `GET /v1/auth/callback` (code → tokens via Keycloak `/token` endpoint avec PKCE verifier vérifié), **HttpOnly cookies cross-zone Domain=.tukio.one** (`tukio-access-token` HttpOnly+Secure+SameSite=Lax+max-age=5min, `tukio-refresh-token` HttpOnly+Secure+SameSite=Strict+max-age=30j rolling, `tukio-session-active` HttpOnly:false+marker JS-readable, `tukio-csrf-token` HttpOnly:false double-submit), **redirect post-login** intelligent (Pro `tukio:status='pending_admin_review'` → `seller.tukio.one/{locale}/seller/onboarding/pending` Story 1.3, Pro `tukio:status='active'` → `seller.tukio.one/{locale}/seller/dashboard` Story 2.x, Customer → `customer.tukio.one/{locale}/account/dashboard` Story 1.8, Admin → `admin.tukio.one/{locale}/admin/dashboard` après TOTP Story 1.7), **silent refresh** automatique 60s avant expiration access token via `POST /v1/auth/refresh` (refresh token rotation Keycloak NFR12 — anti-thundering-herd cross-tabs via BroadcastChannel Story 0.8), **logout** `POST /v1/auth/logout` qui révoque la session Keycloak + clear cookies + redirect vers `/{locale}/`, **cross-zone session sharing** garantie par `Domain=.tukio.one` (Customer connecté sur customer.tukio.one navigue vers seller.tukio.one en mode pro toggle si role='pro', reste authentifié), **gestion erreurs** : message générique anti-énumération `"Email ou mot de passe incorrect"` côté frontend pour bad credentials (Keycloak retourne 401 mais frontend masque le tukioCode), brute-force lockout Story 1.1 (5 fails/5min → 15 min lock + `LOGIN_ERROR` event publié vers identity-svc bridge), MFA admin obligatoire Story 1.1 (`tukio-admin` client utilise flow `tukio-admin-mfa-required` → si user n'a pas TOTP → redirect `/auth/totp-setup` Story 1.7), labels UI FR + EN i18n strict via next-intl + axe-core RGAA AA tests Playwright e2e,
**so that** TOUS les Stories 1.5+ (password reset Story 1.5 — utilise login → set password → login back), 1.6 (email verify — landing page redirect vers login), 1.7 (admin TOTP setup — utilise login flow Admin avec TOTP requirement), 1.8 (profile management — `useAuth` hook retourne user data depuis JWT du cookie session), 1.9 (account delete — utilise logout + session clear), Stories Epic 2-7 (toutes les pages authentifiées) consomment un mécanisme de session unique, robuste, cross-zone, cohérent ADR-009 + NFR9-13 ; le frontend Tukio devient **pleinement utilisable end-to-end** (un user peut s'inscrire Story 1.2/1.3, vérifier son email Story 1.6, se connecter Story 1.4, gérer son profil Story 1.8, naviguer cross-zones, et se déconnecter — flow utilisateur fermé) ; et le **pattern complet "OAuth Authorization Code + PKCE proxied via gateway-api"** devient le template canonique pour Stories V1+ login social Google + Apple FR5 (juste différents identity providers Keycloak — même flow), V2 SAML SSO B2B Enterprise FR6 (juste un autre Keycloak realm broker — même proxy gateway-api).

> **Outcome attendu** : à la fin de cette story, un user fraîchement registered Story 1.2 (Customer email-verified) qui clique "Se connecter avec Tukio" sur `tukio.one/fr/auth/login` est redirigé vers Keycloak login page (theme Tukio terracotta + Fraunces FR Story 1.1) → entre email + password → Keycloak redirect callback `tukio.one/fr/auth/callback?code=...&state=...` → gateway-api exchange code → tokens → set 4 cookies `Domain=.tukio.one` → 302 redirect vers `customer.tukio.one/fr/account/dashboard` ; le user est authentifié sur les 3 zones (`tukio.one`, `customer.tukio.one`, `seller.tukio.one`) sans re-login ; son JWT décodé montre `tukio:locale='fr'`, `tukio:status='active'`, `realm_access.roles=['client']` ; après 4 min 30 sec d'inactivité, le frontend appelle silencieusement `POST /v1/auth/refresh` qui rotate les tokens → cookies updated → request retry transparent ; un Pro `tukio:status='pending_admin_review'` Story 1.3 qui se connecte est redirigé vers `seller.tukio.one/fr/seller/onboarding/pending` (FR17) ; un Admin qui se connecte voit Keycloak forcer le step TOTP (Story 1.1 flow `tukio-admin-mfa-required`) avant émission token ; un user qui clique "Se déconnecter" voit `/v1/auth/logout` révoque la session Keycloak + clear cookies → redirect `/fr/` ; un test `pnpm playwright test --grep "login"` passe en FR ET EN, 4 scénarios (Customer + Pro pending + Pro active + Admin TOTP), axe-core 0 violations, perf NFR48 ≤ 3s p90 entre clic CTA et dashboard rendered.

## Acceptance Criteria

1. **AC1 — Frontend login page `apps/public/[locale]/auth/login`** : Given un Visitor sur `tukio.one/{fr|en}/auth/login`, When il consulte la page, Then :
   - **Layout** : Server Component layout (réutilise pattern Story 1.2/1.3 — `<PublicHeader>` + form + footer)
   - **Form fields** (UX-DR9 — UX spec ligne 1147 + Story 0.4 atomics) :
     - Hero header : `<h1>Se connecter à Tukio</h1>` (FR) / `<h1>Sign in to Tukio</h1>` (EN), Fraunces 500 charcoal-800
     - `<FormField label="Email" type="email" required>` validé Zod RFC 5322 (`z.string().email()`)
     - `<FormField label="Mot de passe" type="password" required>` (pas de validation complexity côté login — c'est registration only)
     - **CTA principal** : `<Button variant="primary" size="lg" type="submit">Se connecter</Button>`
     - **Lien secondaire 1** : `<Link href="/{locale}/auth/password-reset">Mot de passe oublié ?</Link>` (Story 1.5)
     - **Lien secondaire 2** : `<Link href="/{locale}/auth/sign-up">Pas de compte ? S'inscrire</Link>` (Story 1.2 Customer) ou `?role=pro` selon contexte (Story 1.3 Pro)
   - **Implémentation choisie** : pas de form HTML standard (post-and-redirect classique), mais bouton `<Button>` qui appelle JS `handleSignIn()` qui :
     1. Génère un PKCE `verifier` (32-byte random base64url) côté client
     2. Calcule `challenge = base64url(sha256(verifier))` côté client (via `crypto.subtle.digest`)
     3. Génère un `state` UUID v4 anti-CSRF
     4. Stocke `verifier` dans sessionStorage (court-vivant, used 1 fois) — alternative cookie httponly côté gateway-api (option B plus sécurisée — voir AC3)
     5. **Décision** : option B — gateway-api stocke verifier + state dans un cookie httponly court (TTL 5 min `tukio-pkce-state`). Frontend ne touche pas le verifier directement. **Plus sécurisé** + simpler (pas de risque XSS sur verifier).
     6. Frontend redirige `window.location.href = '/v1/auth/login?next={returnUrl}&clientId={tukio-web|tukio-admin}'` (gateway-api endpoint AC3)
   - **i18n strict** (memory `feedback_i18n_frontend.md`) : zéro hardcoded UI string. Toutes les strings dans `apps/public/messages/{fr,en}.json` sous le namespace `auth.login.*` (~15 keys). Importées via `useTranslations('auth.login')`.
   - **Accessibilité RGAA AA** : labels associés via `htmlFor`, focus visible, navigation Tab/Enter, errors via `role="alert"`, axe-core 0 violations.
   - **Pas de validation password complexity côté login** : on laisse Keycloak retourner 401 generic. Anti-énumération NFR9.
   - **Param `?next=<encoded-url>`** : si présent dans URL `tukio.one/fr/auth/login?next=https%3A%2F%2Fcustomer.tukio.one%2Ffr%2Faccount%2Fbookings%2Fcheckout`, propagé dans `state` JWT-encoded → après login, redirect vers cet URL au lieu du dashboard default.
   - **Param `?role=pro`** : si présent, modifie le label du lien sign-up vers `"Pas de compte ? S'inscrire en tant que Pro"` + `href` vers `?role=pro` (cohérent Story 1.3 entry).
   - **Param `?error=...`** : Keycloak peut retourner ?error=invalid_grant après échec login. Si présent, afficher message générique `"Email ou mot de passe incorrect"` + reset form (anti-énumération NFR9 + AC4).
   - **Test Playwright e2e** (`apps/public/e2e/auth/login.spec.ts`) : naviguer page login FR + EN, vérifier 0 axe-core violations, vérifier liens password-reset + sign-up, cliquer CTA "Se connecter" → vérifier redirect vers `auth.tukio.one/realms/tukio/protocol/openid-connect/auth?...&code_challenge=...&code_challenge_method=S256&state=...` (Task 9).

2. **AC2 — gateway-api endpoint `GET /v1/auth/login` (initiate Authorization Code + PKCE)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts` (NEW), When un browser navigue `gateway.tukio.one/v1/auth/login?next=<url>&clientId=tukio-web` (clientId optional, default `tukio-web`), Then :
   - **Generate PKCE materials côté gateway-api** (sécurité accrue vs frontend) :
     - `verifier` : 32 bytes random base64url-encoded (`crypto.randomBytes(32).toString('base64url')`)
     - `challenge` : `base64url(sha256(verifier))`
     - `state` : UUID v4 + JWT-signed (HMAC) avec payload `{ next: '<url>', issuedAt: ISO, requestId: uuid }` — TTL 10 min — anti-CSRF + anti-replay
   - **Set cookie temporaire** `tukio-pkce-state` (HttpOnly, Secure, SameSite=Lax, `Domain=.tukio.one`, max-age 600s) avec valeur `{ verifier, state }` JWT-encrypted — utilisé par callback AC3
   - **Calculate redirect URL** Keycloak :
     ```
     ${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/auth
       ?response_type=code
       &client_id=${clientId}
       &redirect_uri=${PUBLIC_URL}/${locale}/auth/callback
       &code_challenge=${challenge}
       &code_challenge_method=S256
       &state=${state}
       &kc_locale=${locale}
       &scope=openid profile email tukio-locale-scope
       &prompt=login (force re-auth si déjà session — optionnel UX)
     ```
   - `clientId` peut être `tukio-web` (default) ou `tukio-admin` (si appelé depuis `admin.tukio.one`) — détecté via referer header ou explicit query param
   - `redirect_uri` doit matcher exactement les URIs configurés Story 1.1 AC2 (whitelist Keycloak)
   - **Réponse 302 redirect** vers l'URL Keycloak calculée
   - **Locale detection** : lue depuis le path `/{locale}/auth/login` propagated par le frontend OU header `X-Tukio-Locale` (Story 0.7 propagation)
   - **Tests E2E** :
     - `GET /v1/auth/login` → 302 avec Location header vers `auth.tukio.one/.../auth?...` + cookie `tukio-pkce-state` set
     - `GET /v1/auth/login?clientId=tukio-admin` → 302 avec `client_id=tukio-admin`
     - `GET /v1/auth/login?next=<malicious-url>` → vérifier sanitization (only allow `*.tukio.one` URLs, sinon default `/`)
     - Vérifier `code_challenge` est bien `base64url(sha256(verifier))` matching

3. **AC3 — gateway-api endpoint `GET /v1/auth/callback` (exchange code → tokens, set cookies, redirect)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts` (UPDATE), When Keycloak redirige `tukio.one/{locale}/auth/callback?code=<code>&state=<state>&session_state=<session>` (le frontend Next.js route handler `apps/public/src/app/[locale]/auth/callback/route.ts` capture cette URL et forward à gateway-api `GET /v1/auth/callback?code=...&state=...&locale={locale}`), Then :
   - **Validate state JWT** (read from `tukio-pkce-state` cookie) : vérifier signature HMAC + extraire `{ verifier, originalState, next }` + check expiration (10 min). Si invalid → `400 ErrorEnvelope { tukioCode: 'AUTH-INVALID-STATE-001' }` + redirect `/{locale}/auth/login?error=invalid_state` (avec message UI générique pour security).
   - **Exchange code → tokens** : `POST ${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/token` avec body :
     ```
     grant_type=authorization_code
     client_id=tukio-web
     code=<code-from-keycloak>
     redirect_uri=${PUBLIC_URL}/${locale}/auth/callback
     code_verifier=<verifier-from-cookie>
     ```
   - **Parse Keycloak response** : `{ access_token, refresh_token, id_token, expires_in, refresh_expires_in, token_type, session_state, scope }`
   - **Decode access_token** (sans re-signer, juste extract claims via `jose` decodeJwt) : extract `sub`, `realm_access.roles`, `tukio:locale`, `tukio:status`, `email_verified`, `amr`
   - **Determine post-login redirect** based on JWT claims :
     - `realm_access.roles.includes('admin-*')` → si `amr.includes('totp')` → `${ADMIN_URL}/{locale}/admin/dashboard` ; sinon Keycloak aurait dû forcer TOTP via flow Story 1.1 — si on arrive ici sans `amr.totp`, c'est un bug → redirect `/auth/totp-setup` (Story 1.7) — **assertion d'invariant**
     - `realm_access.roles.includes('pro')` && `tukio:status === 'pending_admin_review'` → `${SELLER_URL}/{locale}/seller/onboarding/pending` (FR17 — middleware Story 1.3 fera aussi cet enforcement, c'est defence in depth)
     - `realm_access.roles.includes('pro')` && `tukio:status === 'active'` → `${SELLER_URL}/{locale}/seller/dashboard`
     - `realm_access.roles.includes('client')` → `${CUSTOMER_URL}/{locale}/account/dashboard`
     - **Override par `next` param** : si `next` du state validé pointe vers une URL whitelisted `*.tukio.one`, redirect vers cet URL au lieu du default
   - **Set 4 cookies** (HTTP response headers `Set-Cookie`) avec `Domain=.tukio.one` (cross-subdomain sharing) :
     ```
     Set-Cookie: tukio-access-token=<access_token>; HttpOnly; Secure; SameSite=Lax; Domain=.tukio.one; Max-Age=300; Path=/
     Set-Cookie: tukio-refresh-token=<refresh_token>; HttpOnly; Secure; SameSite=Strict; Domain=.tukio.one; Max-Age=2592000; Path=/v1/auth
     Set-Cookie: tukio-session-active=1; HttpOnly=false; Secure; SameSite=Lax; Domain=.tukio.one; Max-Age=2592000; Path=/
     Set-Cookie: tukio-csrf-token=<random-32-bytes-base64url>; HttpOnly=false; Secure; SameSite=Strict; Domain=.tukio.one; Max-Age=2592000; Path=/
     ```
     - **`tukio-access-token`** : HttpOnly (XSS protection), Path=/ pour partage cross-zones, Max-Age 5 min cohérent NFR12
     - **`tukio-refresh-token`** : HttpOnly + SameSite=Strict (CSRF protection) + Path=/v1/auth (limit scope), Max-Age 30 jours rolling
     - **`tukio-session-active=1`** : marker non-HttpOnly lisible par JS pour détection rapide session active (cohérent Story 0.8 AC8)
     - **`tukio-csrf-token`** : non-HttpOnly + SameSite=Strict pour double-submit pattern (Architecture lignes 681-686 + Story 0.8 AC8)
   - **Clear cookie temporaire** `tukio-pkce-state` (Max-Age 0)
   - **Réponse 302 redirect** vers l'URL post-login déterminée
   - **Error handling** :
     - Code invalide / expiré → Keycloak retourne 400 `invalid_grant` → gateway-api map en 401 `AUTH-INVALID-CODE-001` + redirect `/auth/login?error=invalid_grant`
     - State invalid → 400 `AUTH-INVALID-STATE-001` + redirect login
     - Keycloak DOWN → 502 `AUTH-EXTERNAL-001` + redirect `/auth/login?error=service_unavailable`
   - **Audit log** (NFR16) : log `LOGIN_SUCCESS` event (correlationId, userId, role, locale, IP, user agent) — consume by analytics V1
   - **Tests E2E** (cf. Task 9) :
     - Valid code + valid state → 302 redirect + 4 cookies set + tukio-pkce-state cleared
     - Invalid code → 400 + redirect login
     - Invalid state → 400 + redirect login
     - Keycloak DOWN (mock) → 502 + redirect login
     - Pro pending → redirect `/seller/onboarding/pending`
     - Pro active → redirect `/seller/dashboard`
     - Admin → redirect `/admin/dashboard` (assume TOTP done by Keycloak)
     - `next` whitelisted → redirect to next URL
     - `next` non-whitelisted → redirect default

4. **AC4 — gateway-api endpoint `POST /v1/auth/refresh` (refresh token rotation NFR12)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts` (UPDATE), When le frontend appelle `POST /v1/auth/refresh` (cookie `tukio-refresh-token` auto-sent + header `X-CSRF-Token` matching cookie `tukio-csrf-token`), Then :
   - **CSRF validation** : header `X-CSRF-Token` doit matcher cookie `tukio-csrf-token` (double-submit pattern). Si mismatch → `403 ErrorEnvelope { tukioCode: 'AUTH-CSRF-MISMATCH-001' }`.
   - **Read refresh_token** depuis cookie (HttpOnly, donc seulement gateway-api peut le lire)
   - **Exchange refresh_token → new tokens** : `POST ${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/token` avec :
     ```
     grant_type=refresh_token
     client_id=tukio-web
     refresh_token=<refresh-token>
     ```
   - **Keycloak rotation native** (cohérent Story 1.1 realm config `attributes.refresh.token.max.reuse: 0`) : retourne `{ access_token, refresh_token (NEW rotated), expires_in, ... }`. Si `refresh_token` était déjà utilisé une fois → Keycloak retourne 400 `invalid_grant` → gateway-api map en `401 AUTH-REFRESH-INVALID-001` + clear cookies (force re-login).
   - **Set new cookies** : `tukio-access-token` (5 min) + `tukio-refresh-token` (rolling 30 jours) — same Domain/SameSite/HttpOnly attrs que AC3
   - **Réponse JSON** (envelope wrapped) :
     ```json
     {
       "method": "POST",
       "code": 200,
       "data": { "expiresIn": 300, "refreshExpiresIn": 2592000 },
       "meta": { "correlationId": "...", "timestamp": "...", "locale": "fr" }
     }
     ```
   - **Error handling** :
     - Refresh expiré → 401 `AUTH-REFRESH-EXPIRED-001` + clear cookies + frontend redirect login
     - Refresh déjà utilisé (rotation détectée) → 401 `AUTH-REFRESH-REUSED-001` + clear cookies + alerte security (suspect attack)
     - Keycloak DOWN → 502 `AUTH-EXTERNAL-001`
   - **Anti-thundering-herd cross-tabs** : Story 0.8 AC7 `RefreshTokenRotationManager` utilise `BroadcastChannel API` pour synchro inter-tabs — garantit qu'un seul tab refresh, les autres reçoivent la notification `tokenRefreshed` et n'appellent pas l'endpoint
   - **Tests E2E** :
     - Valid refresh + CSRF OK → 200 + 2 new cookies set
     - Invalid CSRF → 403
     - Expired refresh → 401 + cookies cleared
     - Reused refresh → 401 + cookies cleared + alerte
     - Concurrent refresh (race condition) → 1 succeeds, 1 gets 401 (rotation enforced)

5. **AC5 — gateway-api endpoint `POST /v1/auth/logout` (revoke session + clear cookies)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts` (UPDATE), When le frontend appelle `POST /v1/auth/logout` (cookies + CSRF header), Then :
   - **CSRF validation** : header `X-CSRF-Token` doit matcher cookie. Si mismatch → 403.
   - **Revoke Keycloak session** : `POST ${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/logout` avec :
     ```
     client_id=tukio-web
     refresh_token=<refresh-token-from-cookie>
     ```
     (Keycloak révoque la session côté serveur, invalide tous les refresh tokens de cette session)
   - **Clear all auth cookies** : Set-Cookie avec `Max-Age=0` pour `tukio-access-token`, `tukio-refresh-token`, `tukio-session-active`, `tukio-csrf-token`
   - **Réponse 200 JSON** (envelope wrapped) :
     ```json
     {
       "method": "POST",
       "code": 200,
       "data": { "message": "Logout successful" },
       "meta": { "correlationId": "...", "timestamp": "...", "locale": "fr" }
     }
     ```
   - **Frontend redirect** post-logout : `<Link href="/{locale}/">` ou `window.location.assign('/' + locale)` (handled by Story 1.4 logout button)
   - **Idempotency** : si déjà logged out (no cookies) → 200 OK direct (pas d'erreur, idempotent)
   - **Tests E2E** :
     - Logout authenticated user → 200 + cookies cleared + Keycloak session revoked (vérifier via Keycloak Admin API user sessions count)
     - Logout already-logged-out → 200 OK
     - Logout sans CSRF → 403

6. **AC6 — Frontend callback route handler `apps/public/src/app/[locale]/auth/callback/route.ts`** : Given Keycloak redirige `tukio.one/{locale}/auth/callback?code=...&state=...`, When Next.js route handler intercepte, Then :
   - **NB** : C'est un **Route Handler Next.js 15** (pas une Page) — fichier `route.ts` (pas `page.tsx`)
   - Implémentation :
     ```ts
     // apps/public/src/app/[locale]/auth/callback/route.ts
     import { NextRequest, NextResponse } from 'next/server';

     export async function GET(req: NextRequest, { params }: { params: { locale: string } }) {
       const url = new URL(req.url);
       const code = url.searchParams.get('code');
       const state = url.searchParams.get('state');
       const error = url.searchParams.get('error');
       const errorDescription = url.searchParams.get('error_description');

       if (error) {
         // Keycloak returned error (user cancelled, account locked, etc.)
         return NextResponse.redirect(new URL(`/${params.locale}/auth/login?error=${error}`, req.url));
       }

       if (!code || !state) {
         return NextResponse.redirect(new URL(`/${params.locale}/auth/login?error=missing_params`, req.url));
       }

       // Forward to gateway-api which will validate state, exchange code, set cookies, redirect
       const gatewayCallbackUrl = `${process.env.GATEWAY_API_URL}/v1/auth/callback?code=${code}&state=${state}&locale=${params.locale}`;

       // We need to forward cookies (specifically tukio-pkce-state) to gateway-api
       // and forward Set-Cookie headers from gateway-api back to user's browser
       const response = await fetch(gatewayCallbackUrl, {
         redirect: 'manual',
         headers: { cookie: req.headers.get('cookie') ?? '' },
       });

       // Build NextResponse from gateway-api's response (forwarding cookies + Location)
       const setCookieHeaders = response.headers.getSetCookie();
       const location = response.headers.get('location') ?? `/${params.locale}/`;
       const nextResponse = NextResponse.redirect(new URL(location, req.url));
       setCookieHeaders.forEach(c => nextResponse.headers.append('Set-Cookie', c));
       return nextResponse;
     }
     ```
   - **Pourquoi route handler vs Server Component page ?** : route handler car (a) c'est une operation server-only (forward cookies, no UI render), (b) explicit GET handler (vs Page qui mix UI + data fetching), (c) easier to forward Set-Cookie headers (Next.js Page Components don't have direct access to set cookies in response).
   - **Edge runtime ou Node runtime ?** : Node runtime (default) — `fetch` cross-subdomain + cookies forwarding fonctionnent. Edge runtime aurait des limitations sur certains headers cookies.
   - **Tests** : Playwright e2e flow complet (Task 9)

7. **AC7 — Cross-zone session sharing + middleware redirect intelligence** : Given un user authentifié sur `customer.tukio.one`, When il navigue vers `seller.tukio.one`, Then :
   - **Cookie shared via `Domain=.tukio.one`** : tous les cookies set par AC3 sont visibles depuis tous les sous-domaines `*.tukio.one`. Le browser auto-attache `tukio-access-token` sur les requests vers `seller.tukio.one`.
   - **Middleware seller** (Story 1.3 finalisé Story 1.4) — `apps/seller/src/middleware.ts` :
     - Vérifie présence cookie `tukio-session-active` (rapide check JS-readable)
     - Si absent → redirect `tukio.one/{locale}/auth/login?next={current-url}` (cross-zone redirect)
     - Si présent → décode JWT du cookie `tukio-access-token` (valeur HttpOnly, mais middleware Next.js a accès server-side via `request.cookies`)
     - Vérifie `realm_access.roles.includes('pro')` (sinon redirect default zone)
     - Vérifie `tukio:status` :
       - `'active'` → continue navigation
       - `'pending_admin_review'` → redirect `/seller/onboarding/pending` (Story 1.3 enforcement)
       - `'rejected'` → redirect `/seller/onboarding/rejected` (Story 2.5 page placeholder)
       - `'suspended'` → redirect `/seller/account/suspended` (Story 6.5 page placeholder)
     - Vérifie `email_verified === true` pour endpoints transactionnels (Story 1.2 `email_verified` middleware logic réutilisée)
   - **Middleware customer** (`apps/customer/src/middleware.ts` — UPDATE Story 1.2) — pattern similaire mais pour rôle `client`
   - **Middleware admin** (`apps/admin/src/middleware.ts` — NEW Story 1.4) :
     - Check `realm_access.roles.includes('admin-*')` sinon redirect login
     - Check `amr.includes('totp')` sinon redirect `/auth/totp-setup` (Story 1.7)
     - Pas de middleware sur `apps/public/` (zone publique sans auth required, sauf paths privés `apps/public/account/...` qui n'existent pas — ces paths sont sur `apps/customer/`)
   - **JWT decode dans middleware** : utilise `jose` `decodeJwt` (no signature verification dans middleware Edge runtime — gateway-api a déjà validé via JWKS Story 0.8) — verification full RS256 + JWKS arrive Story 0.8 `KeycloakJwtGuard` côté backend services
   - **Tests E2E middleware** : se connecter Customer → naviguer customer.tukio.one/account/dashboard → OK. Naviguer seller.tukio.one/seller/listings → vérifier redirect (Customer n'est pas Pro). Se connecter Pro pending → naviguer seller.tukio.one/seller/listings → redirect /seller/onboarding/pending.

8. **AC8 — Frontend `useAuth` + `useLogout` hooks wired (Story 0.8 update finale)** : Given `@tukio/auth-client/hooks/use-auth.ts` (Story 0.8 a posé l'API), When un component consomme `const { user, role, locale, isAuthenticated, isLoading } = useAuth()`, Then :
   - **`<AuthProvider>` Story 0.8** : Story 1.4 finalise le wiring dans les 3 apps (`apps/customer/src/app/[locale]/layout.tsx`, `apps/seller/src/app/[locale]/layout.tsx`, `apps/admin/src/app/[locale]/layout.tsx`) — wrap autour de `{children}`
   - **Init côté client** : `<AuthProvider>` au mount lit le cookie `tukio-session-active` (JS-readable) → si présent, fetch `GET /v1/me` (Story 1.8 — pour MVP : decode JWT côté client via `jose decodeJwt` du cookie `tukio-access-token` ? non — HttpOnly. **Décision MVP** : `<AuthProvider>` appelle `GET /v1/auth/whoami` endpoint nouveau Story 1.4 qui retourne le user data depuis le JWT validé côté gateway-api).
   - **Endpoint nouveau `GET /v1/auth/whoami`** (gateway-api) — réponse :
     ```json
     {
       "method": "GET",
       "code": 200,
       "data": {
         "user": { "userId": "uuid", "email": "...", "firstName": "...", "lastName": "..." },
         "role": "client" | "pro" | "admin-...",
         "locale": "fr" | "en",
         "emailVerified": true | false,
         "tukioStatus": "active" | "pending_admin_review" | "rejected" | "suspended",
         "isAuthenticated": true
       },
       "meta": { ... }
     }
     ```
     - Si pas authentifié → 401 + frontend AuthProvider set `isAuthenticated: false`
   - **`useAuth()` hook** (Story 0.8 finalisé) : retourne le state du context
   - **`useLogout()` hook** (Story 0.8 finalisé) :
     ```ts
     export function useLogout() {
       const { setAuthState } = useContext(AuthContext);
       const router = useRouter();
       const locale = useLocale();
       return useCallback(async () => {
         await fetch('/v1/auth/logout', {
           method: 'POST',
           headers: { 'X-CSRF-Token': cookieManager.getCsrfToken() },
           credentials: 'include',
         });
         setAuthState({ user: null, role: null, locale, isAuthenticated: false, isLoading: false });
         router.push(`/${locale}/`);
       }, [setAuthState, router, locale]);
     }
     ```
   - **Tests** : `@testing-library/react` `renderHook(useAuth)` mocked AuthContext → vérifie state propagation. `useLogout` mocked fetch → vérifie call + state cleared + router push.

9. **AC9 — Tests Playwright e2e login flow FR + EN + axe-core (NFR48 + UX-DR9)** : Given `apps/public/e2e/auth/login.spec.ts` (NEW), When je lance `pnpm --filter=apps/public test:e2e --grep "login"`, Then :
   - **Test 1 (happy path FR Customer)** : précréer un user `customer1@tukio.one` Customer email-verified via Keycloak Admin API fixture → naviguer `localhost:3000/fr/auth/login` → cliquer "Se connecter" → entrer email + password sur Keycloak login page (theme Tukio Story 1.1 themed) → submit → vérifier redirect vers `customer.tukio.one/fr/account/dashboard` + cookies set
   - **Test 2 (happy path EN Customer)** : idem en `/en/auth/login` → Keycloak login en EN (kc_locale) → vérifier UI strings EN + redirect customer.tukio.one/en/account/dashboard
   - **Test 3 (Pro pending)** : précréer Pro `pending_admin_review` → login → vérifier redirect `seller.tukio.one/fr/seller/onboarding/pending` (FR17)
   - **Test 4 (Pro active)** : précréer Pro `tukio_status='active'` (admin validé Story 2.5 fixture) → login → vérifier redirect `seller.tukio.one/fr/seller/dashboard`
   - **Test 5 (Admin TOTP)** : précréer Admin avec TOTP configuré → login → Keycloak force step TOTP → entrer code TOTP (utiliser `totp-generator` npm fixture) → vérifier redirect `admin.tukio.one/fr/admin/dashboard`
   - **Test 6 (bad credentials anti-énumération)** : entrer mauvais password → vérifier UI message générique `"Email ou mot de passe incorrect"` (FR), pas de mention "user not found" — anti-énumération NFR9
   - **Test 7 (brute-force lockout)** : 5x bad password en 5 min → 6ᵉ tentative bloquée par Keycloak (NFR10) → vérifier UI message `"Trop de tentatives, votre compte est temporairement verrouillé"` (Story 1.1 brute-force config)
   - **Test 8 (silent refresh)** : login → wait 4 min 30 sec → trigger une API call (e.g. `<HeartbeatComponent>` test only) → vérifier `POST /v1/auth/refresh` appelé silencieusement + nouveaux cookies set + API call retry succeeded transparent UX (NFR12)
   - **Test 9 (cross-zone session)** : login Customer → naviguer customer.tukio.one/account → OK → naviguer seller.tukio.one (sans seller role) → vérifier redirect approprié OU tukio.one mode public (selon décision UX MVP)
   - **Test 10 (logout)** : login → cliquer "Se déconnecter" → vérifier `POST /v1/auth/logout` appelé + cookies cleared + redirect `/fr/`. Naviguer protected page → vérifier redirect login (session révoquée).
   - **Test 11 (CSRF protection)** : login → simuler call `POST /v1/auth/logout` sans header `X-CSRF-Token` → vérifier 403 (CSRF protection enforced)
   - **Test 12 (axe-core a11y)** : `await injectAxe(page); await checkA11y(page);` sur `/auth/login` page — vérifier 0 violations critical/serious (RGAA AA)
   - **Test 13 (NFR48 perf)** : mesurer temps `page.goto('/fr/auth/login')` → click "Se connecter" → Keycloak page rendered → fill form → submit → callback redirect → dashboard rendered. Assert ≤ 3 s p90 (10 runs p9). Marge plus réduite que Story 1.2/1.3 car flow plus simple (pas d'INSEE/R2).
   - **Coverage** : ≥ 80 % gateway-api endpoints (login, callback, refresh, logout, whoami), ≥ 80 % frontend hooks (useAuth, useLogout, RefreshTokenRotation)

10. **AC10 — Documentation runbook + observability + ADR addendum** : Given le scope cross-cutting Story 1.4, When je consulte `docs/`, Then :
    - **`docs/runbook/login-flow-debug.md`** (NEW ~80 lignes) : flow end-to-end (login page → /v1/auth/login → Keycloak auth → callback → /v1/auth/callback → token exchange → cookies set → redirect post-login), troubleshooting (state mismatch, code expired, Keycloak DOWN, cookies not set, cross-zone session loss, refresh rotation failures, CSRF mismatches), commandes utiles (Keycloak Admin API list user sessions, Redis throttler keys query, JWT decoder)
    - **`docs/runbook/cookie-architecture.md`** (NEW ~40 lignes) : 4 cookies architecture (access-token / refresh-token / session-active / csrf-token), Domain=.tukio.one rationale, SameSite policy choice (Lax vs Strict), Path scoping for refresh-token, rotation strategy
    - **`docs/runbook/refresh-token-rotation.md`** (NEW ~50 lignes) : NFR12 implementation, anti-thundering-herd cross-tabs (BroadcastChannel API Story 0.8), reused refresh detection + alerte security (suspect attack), Keycloak `refresh.token.max.reuse: 0` enforcement Story 1.1
    - **`packages/auth-client/README.md`** (UPDATE Story 0.8) : section "Login flow integration" qui dit "Story 1.4 a finalisé le wiring `<AuthProvider>` dans les 3 apps + endpoints gateway-api `/v1/auth/{login,callback,refresh,logout,whoami}`. Voir `docs/runbook/login-flow-debug.md`."
    - **Métriques Prometheus** ajoutées (gateway-api) :
      - `tukio_auth_login_attempts_total{result=success|invalid_credentials|locked|external_error}` (counter)
      - `tukio_auth_login_duration_seconds` (histogram)
      - `tukio_auth_callback_success_total{role}` (counter — login successes par rôle)
      - `tukio_auth_refresh_calls_total{result=success|expired|reused|csrf_mismatch}` (counter)
      - `tukio_auth_logout_calls_total` (counter)
      - `tukio_auth_keycloak_calls_total{operation=auth|token|logout|certs,status}` (counter — observabilité Keycloak side)
    - **Dashboard Grafana** (`infra/k8s/grafana-dashboards/auth-flow.json` NEW) : 6 panels (login funnel success rate, p95 latency callback, refresh rotation health, brute-force lockouts/h, Keycloak external call status, NATS event lag for LOGIN_ERROR Story 1.1 webhook bridge)
    - **Audit log** : `LOGIN_SUCCESS` event publié vers identity-svc (NATS event `identity.user.logged-in.v1` — schema dans `@tukio/contracts/events/identity` NEW Story 1.4) — consumed by analytics V1 (login funnel) + audit trail Story 2.7
    - **ADR** : pas de nouvel ADR Story 1.4 (s'inscrit dans ADR-009 Keycloak split + ADR-014 envelope existants)

## Tasks / Subtasks

- [ ] **Task 1 — Étendre `@tukio/contracts` avec event login + types whoami** (AC: #2, #3, #8, #10)
  - [ ] 1.1 — Créer `packages/contracts/src/events/identity/user-logged-in.v1.{schema.json,ts}` (audit event NATS)
  - [ ] 1.2 — Créer `packages/contracts/src/dtos/identity/whoami-response.dto.ts` (Zod schema response `/v1/auth/whoami`)
  - [ ] 1.3 — Update `packages/contracts/src/types/error-codes.ts` : ajouter `AUTH-INVALID-STATE-001`, `AUTH-INVALID-CODE-001`, `AUTH-CSRF-MISMATCH-001`, `AUTH-REFRESH-INVALID-001`, `AUTH-REFRESH-EXPIRED-001`, `AUTH-REFRESH-REUSED-001`, `AUTH-EXTERNAL-001`
  - [ ] 1.4 — Update `packages/contracts/src/index.ts` barrel + subpath exports
  - [ ] 1.5 — `pnpm --filter=@tukio/contracts build && test`

- [ ] **Task 2 — gateway-api : endpoint `GET /v1/auth/login` (initiate Authorization Code + PKCE)** (AC: #2)
  - [ ] 2.1 — Créer `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts` (skeleton 4 endpoints)
  - [ ] 2.2 — Créer `apps/gateway-api/src/usecases/auth/initiate-login.usecase.ts` (génère verifier + challenge + state + redirect URL)
  - [ ] 2.3 — Créer `apps/gateway-api/src/infrastructure/http/utils/pkce.ts` (helpers `generateVerifier`, `computeChallenge`, `generateState`)
  - [ ] 2.4 — Créer `apps/gateway-api/src/infrastructure/http/utils/state-jwt.ts` (HMAC sign/verify state JWT 10 min TTL)
  - [ ] 2.5 — Créer `apps/gateway-api/src/infrastructure/http/utils/cookie-helpers.ts` (set/clear cookies avec opts cohérents AC3)
  - [ ] 2.6 — Sanitize `next` param : whitelist `*.tukio.one` URLs only, sinon default `/{locale}/`
  - [ ] 2.7 — Tests E2E `apps/gateway-api/test/auth-login.e2e-spec.ts` (8+ cases AC2)

- [ ] **Task 3 — gateway-api : endpoint `GET /v1/auth/callback` (exchange code → tokens, set cookies)** (AC: #3)
  - [ ] 3.1 — Update `auth-login.controller.ts` : ajouter `@Get('callback')` handler
  - [ ] 3.2 — Créer `apps/gateway-api/src/usecases/auth/handle-callback.usecase.ts` (validate state, exchange code, decode JWT, determine redirect, set cookies)
  - [ ] 3.3 — Update `apps/gateway-api/src/infrastructure/external/keycloak/keycloak-oauth.client.ts` (NEW) : wrapper axios pour `/token` endpoint Keycloak (séparé de keycloak-admin Story 1.2 pour clarity)
  - [ ] 3.4 — Helper `extractRedirectFromClaims(payload)` : map roles + status → URL appropriate (Customer/Pro pending/Pro active/Admin)
  - [ ] 3.5 — Audit log : publish `identity.user.logged-in.v1` event via outbox (Story 0.7 pattern — gateway-api a son propre outbox? non — il forward au identity-svc qui publie. **Décision MVP** : gateway-api appelle identity-svc `POST /internal/audit/login-success` qui publie l'event. Alternative : gateway-api n'a pas d'outbox, publie direct via `@tukio/messaging` natsClient — risque cohérence si gateway-api crash entre cookie set et NATS publish. **Décision finale** : gateway-api fire-and-forget audit event via NATS direct (pas critical pour login, juste analytics) ; persistence Story 1.10 reconciliation si miss).
  - [ ] 3.6 — Tests E2E `apps/gateway-api/test/auth-callback.e2e-spec.ts` (12+ cases AC3)

- [ ] **Task 4 — gateway-api : endpoint `POST /v1/auth/refresh` (refresh token rotation)** (AC: #4)
  - [ ] 4.1 — Update `auth-login.controller.ts` : ajouter `@Post('refresh')` handler
  - [ ] 4.2 — Créer `apps/gateway-api/src/usecases/auth/refresh-token.usecase.ts`
  - [ ] 4.3 — Créer `apps/gateway-api/src/infrastructure/http/guards/csrf.guard.ts` (double-submit cookie pattern)
  - [ ] 4.4 — Reused refresh detection : si Keycloak retourne 400 invalid_grant sur refresh, log + alerte counter `tukio_auth_refresh_reused_total` + clear cookies
  - [ ] 4.5 — Tests E2E `auth-refresh.e2e-spec.ts` (5+ cases AC4)

- [ ] **Task 5 — gateway-api : endpoint `POST /v1/auth/logout` (revoke session + clear cookies)** (AC: #5)
  - [ ] 5.1 — Update `auth-login.controller.ts` : ajouter `@Post('logout')` handler
  - [ ] 5.2 — Créer `apps/gateway-api/src/usecases/auth/logout.usecase.ts`
  - [ ] 5.3 — Idempotent (200 si déjà logged out)
  - [ ] 5.4 — Tests E2E `auth-logout.e2e-spec.ts` (3+ cases AC5)

- [ ] **Task 6 — gateway-api : endpoint `GET /v1/auth/whoami` (return user data from JWT)** (AC: #8)
  - [ ] 6.1 — Update `auth-login.controller.ts` : ajouter `@Get('whoami')` handler
  - [ ] 6.2 — Utiliser `KeycloakJwtGuard` Story 0.8 (validation JWT RS256 + JWKS) — endpoint requires authentication
  - [ ] 6.3 — Lire `request.actor` (set by `KeycloakJwtGuard`) + map vers `WhoamiResponse` DTO
  - [ ] 6.4 — Tests E2E `auth-whoami.e2e-spec.ts` (3 cases : authenticated → user data, unauthenticated → 401, expired token → 401)

- [ ] **Task 7 — gateway-api : wiring app.module.ts + throttler + audit publisher** (AC: #2-#6)
  - [ ] 7.1 — Update `apps/gateway-api/src/app.module.ts` : ajouter `AuthLoginController`, `CsrfGuard`, KeycloakOAuthClient injection
  - [ ] 7.2 — Update throttler : ajouter `'auth-login'` 10/min/IP (Architecture ligne 707), `'auth-refresh'` 30/min/IP (refresh est plus frequent que login)
  - [ ] 7.3 — Update `apps/gateway-api/.env.example` : ajouter `STATE_JWT_HMAC_SECRET=<32-byte-base64>`, `KEYCLOAK_OAUTH_URL=http://localhost:8080`, `PUBLIC_BASE_URL=http://localhost:3000`, `CUSTOMER_BASE_URL=http://localhost:3001`, `SELLER_BASE_URL=http://localhost:3002`, `ADMIN_BASE_URL=http://localhost:3003`
  - [ ] 7.4 — Update `apps/gateway-api/src/infrastructure/config/environment-config.service.ts` : `getStateJwtSecret()`, `getKeycloakOAuthConfig()`, `getZoneBaseUrls()`

- [ ] **Task 8 — Frontend : login page UI + callback route handler + AuthProvider wiring** (AC: #1, #6, #7, #8)
  - [ ] 8.1 — Créer `apps/public/src/app/[locale]/auth/login/page.tsx` (Server Component layout) + `apps/public/src/features/auth/login/components/LoginCta.tsx` (Client Component avec bouton "Se connecter" qui redirige vers `/v1/auth/login`)
  - [ ] 8.2 — Créer `apps/public/src/app/[locale]/auth/callback/route.ts` (Route Handler — cf. AC6 squelette)
  - [ ] 8.3 — Update `apps/customer/src/app/[locale]/layout.tsx` : wrap dans `<AuthProvider config={...}>` (Story 0.8 finalisé)
  - [ ] 8.4 — Update `apps/seller/src/app/[locale]/layout.tsx` : idem
  - [ ] 8.5 — Créer `apps/admin/src/app/[locale]/layout.tsx` (NEW — admin app n'avait pas de layout final Story 0.8 placeholder) : `<AuthProvider config={...}>`
  - [ ] 8.6 — Créer `apps/customer/src/components/LogoutButton.tsx` (Client Component) qui utilise `useLogout()` (Story 0.8 hook finalisé Story 1.4 Task 9)
  - [ ] 8.7 — Idem pour `apps/seller` et `apps/admin`
  - [ ] 8.8 — Update `apps/public/messages/{fr,en}.json` : namespace `auth.login.*` (~15 keys)
  - [ ] 8.9 — Helper `apps/public/src/lib/redirect-url.ts` : whitelist `*.tukio.one` URLs sanitization
  - [ ] 8.10 — Update `packages/auth-client/src/providers/auth-provider.tsx` (Story 0.8 placeholder) : implémenter `useEffect` qui fetch `GET /v1/auth/whoami` au mount + setAuthState

- [ ] **Task 9 — Frontend : finaliser hooks `useAuth` + `useLogout` + `RefreshTokenRotation`** (AC: #4, #8)
  - [ ] 9.1 — Update `packages/auth-client/src/hooks/use-auth.ts` (Story 0.8) : finalize implementation (lecture context + state)
  - [ ] 9.2 — Update `packages/auth-client/src/hooks/use-logout.ts` (Story 0.8) : implementation finale (call /v1/auth/logout + clear state + router.push)
  - [ ] 9.3 — Update `packages/auth-client/src/hooks/use-role.ts` + `use-require-role.ts` (Story 0.8) : finalize (basé sur `useAuth`)
  - [ ] 9.4 — Update `packages/auth-client/src/refresh/refresh-token-rotation.ts` (Story 0.8) : finaliser (interval 30s check, BroadcastChannel inter-tabs, fetch `/v1/auth/refresh` avec CSRF header)
  - [ ] 9.5 — Update `packages/api-client/src/client.ts` : axios interceptor — sur 401 `AUTH-NOT-AUTHENTICATED-002`, trigger refresh + retry request
  - [ ] 9.6 — Update `packages/auth-client/src/cookies/cookie-manager.ts` (Story 0.8) : finaliser `getCsrfToken`, `addCsrfHeader` helpers
  - [ ] 9.7 — Tests `@testing-library/react` : useAuth state propagation, useLogout call + state clear + router push, refresh trigger before expiry, BroadcastChannel inter-tabs sync

- [ ] **Task 10 — Middleware Next.js apps : seller (UPDATE Story 1.3), customer (UPDATE Story 1.2), admin (NEW)** (AC: #7)
  - [ ] 10.1 — Update `apps/customer/src/middleware.ts` (Story 1.2) : ajouter check `realm_access.roles.includes('client')` (sinon redirect /), check `tukio_status='suspended'` redirect approprié
  - [ ] 10.2 — Update `apps/seller/src/middleware.ts` (Story 1.3) : ajouter check role `pro` + status `active`/`pending_admin_review`/`rejected`/`suspended` redirects
  - [ ] 10.3 — Créer `apps/admin/src/middleware.ts` (NEW) : check role `admin-*` + check `amr.includes('totp')` sinon redirect `/auth/totp-setup` Story 1.7
  - [ ] 10.4 — Décoder JWT du cookie `tukio-access-token` server-side dans middleware (Edge runtime — `jose decodeJwt` no-verify, gateway-api a déjà validé)
  - [ ] 10.5 — Helper `apps/<app>/src/middleware/decode-jwt.ts` partagé (depuis `@tukio/auth-client/middleware-helpers` Story 0.8 + finalize Story 1.4)
  - [ ] 10.6 — Tests E2E middleware : `apps/{customer,seller,admin}/e2e/middleware/role-redirect.spec.ts`

- [ ] **Task 11 — Tests Playwright e2e login flow FR + EN + axe-core + perf NFR48** (AC: #9)
  - [ ] 11.1 — Créer `apps/public/e2e/auth/login.spec.ts` avec 13 tests (cf. AC9)
  - [ ] 11.2 — Setup fixture `setupTestUsers` : Keycloak Admin API pré-créer 3 users (Customer email-verified, Pro pending, Pro active, Admin avec TOTP) — cleanup post-test
  - [ ] 11.3 — Helper `loginAsUser(page, email, password)` : remplir form Keycloak login + submit + wait redirect
  - [ ] 11.4 — Helper TOTP : utiliser `totp-generator` npm pour generate code from secret fixture
  - [ ] 11.5 — Run Playwright en CI (`.github/workflows/e2e.yml` UPDATE Story 1.2/1.3) : ajouter `--grep "login"`
  - [ ] 11.6 — Vérifier 0 violations axe-core sur login page
  - [ ] 11.7 — Vérifier perf NFR48 ≤ 3s p90

- [ ] **Task 12 — Observability + runbooks + commit** (AC: #10)
  - [ ] 12.1 — Ajouter métriques Prometheus gateway-api (6 counters/histograms)
  - [ ] 12.2 — Créer `infra/k8s/grafana-dashboards/auth-flow.json` (6 panels)
  - [ ] 12.3 — Créer `docs/runbook/login-flow-debug.md` (~80 lignes)
  - [ ] 12.4 — Créer `docs/runbook/cookie-architecture.md` (~40 lignes)
  - [ ] 12.5 — Créer `docs/runbook/refresh-token-rotation.md` (~50 lignes)
  - [ ] 12.6 — Update `packages/auth-client/README.md` (Story 0.8) : section Login flow integration
  - [ ] 12.7 — Update `packages/contracts/README.md` : section Identity events ajouter `user-logged-in.v1`
  - [ ] 12.8 — Lint + typecheck + tests : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main]` à la racine — tous passent
  - [ ] 12.9 — Vérifier coverage : ≥ 80 % gateway-api endpoints, ≥ 80 % frontend hooks, ≥ 80 % middlewares (NFR71)
  - [ ] 12.10 — Commit `feat(auth): login flow Keycloak Authorization Code + PKCE end-to-end (4 gateway-api endpoints + login UI + callback handler + AuthProvider wired + cross-zone session sharing + refresh rotation + logout + middleware role-based redirects + Playwright e2e FR/EN)` — Story 1.4 done

## Dev Notes

### Pourquoi cette story est le **closing du flow auth fullstack**

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §Authentication Flow (lignes 1731-1738) + §Auth Cross-Cutting (lignes 234-241) + §Authentication & Security (lignes 665-697) + §CSRF (lignes 681-686) ; `_bmad-output/planning-artifacts/prd.md` §FR4 (login Keycloak), §FR9 (admin TOTP), §FR17 (block transactional unverified), §NFR9-13 (HTTPS, mTLS, JWT RS256 JWKS, MFA admin, refresh rotation, cookies) ; `_bmad-output/planning-artifacts/epics.md` §Story 1.4 (lignes 1132-1147) ; `_bmad-output/planning-artifacts/ux-design-specification.md` §UX-DR9 sign-up funnel (login pattern similar) ; Story 1.1 (4 OIDC clients + claim mappers + flow MFA admin), Story 0.8 (`@tukio/auth-client` libs), Stories 1.2 (Customer register) + 1.3 (Pro register).

Stories 1.1, 1.2, 1.3, 0.8 ont posé toutes les briques individuelles du flow auth. **Story 1.4 ferme la boucle** : un user fraîchement registered Story 1.2/1.3 peut maintenant **se connecter et utiliser le frontend Tukio**. Avant Story 1.4, le système est testable backend-only (e2e via curl + JWT mock). Après Story 1.4, le frontend Tukio devient **pleinement utilisable end-to-end** avec un browser.

**Story 1.4 = pattern OAuth complet proxied via gateway-api.** Réutilisable pour V1+ login social FR5 (Google + Apple = juste différents Keycloak Identity Providers — même flow), V2 SAML SSO B2B FR6 (Phasetwo orgs SAML broker — même flow proxied).

### Décisions techniques majeures (à acter dans Story 1.4)

1. **OAuth flow proxied via gateway-api** (pas direct browser → Keycloak). Justification : (a) sécurité — frontend ne touche jamais les tokens (HttpOnly), (b) audit log centralisé gateway-api, (c) CSRF protection wired, (d) cohérent avec ADR-008 gateway-api seul accès public, (e) facilite migration V1+ social login + V2 SAML (juste swap clientId + Keycloak IdP setup).
2. **PKCE materials générés gateway-api** (verifier + state stockés dans cookie httponly temporaire). Justification : pas de risque XSS sur verifier (HttpOnly cookie). Frontend ne voit ni verifier ni state — juste redirige vers `/v1/auth/login` qui set le cookie + 302.
3. **State JWT-signed HMAC** (10 min TTL) avec payload `{ next, issuedAt, requestId }`. Justification : anti-CSRF + anti-replay + permet de propager le `next` URL post-login sans param exposé URL.
4. **4 cookies dédiés** (architecture Story 0.8 + 1.4 finalize) :
   - `tukio-access-token` HttpOnly Lax 5min Path=/ — utilisé par tous les endpoints API
   - `tukio-refresh-token` HttpOnly Strict 30j Path=/v1/auth (limit scope refresh-only) — sécurité accrue
   - `tukio-session-active` non-HttpOnly Lax 30j — marker JS-readable pour `<AuthProvider>` détection rapide
   - `tukio-csrf-token` non-HttpOnly Strict 30j — double-submit pattern
5. **Refresh token rotation native Keycloak** (`max.reuse: 0` configuré Story 1.1 realm). Si refresh token est réutilisé une 2ème fois → 400 invalid_grant → gateway-api alerte security (suspect attack — token volé).
6. **Anti-thundering-herd cross-tabs** (BroadcastChannel API Story 0.8) : un seul tab refresh, les autres reçoivent la notification. Cohérent avec multi-tab UX (user navigue customer.tukio.one + seller.tukio.one en simultané).
7. **CSRF double-submit cookie pattern** (Architecture lignes 681-686 + Story 0.8 AC8) : `tukio-csrf-token` lisible JS + header `X-CSRF-Token` requis sur POST/PUT/PATCH/DELETE + check header === cookie côté `CsrfGuard` gateway-api.
8. **Callback handler = Next.js Route Handler** (pas Page Server Component). Justification : (a) operation server-only (forward cookies + Set-Cookie relay), (b) explicit GET handler, (c) accès direct à `request.headers` + `response.headers` natifs.
9. **Anti-énumération NFR9** : message UI générique pour all login errors (`"Email ou mot de passe incorrect"`) — pas de leak côté UI, mais codes API distincts pour observability.
10. **Audit event `identity.user.logged-in.v1`** publié vers NATS via gateway-api → identity-svc consume → outbox → analytics V1. Fire-and-forget MVP (pas critical pour login response).
11. **Cross-zone redirects via env-configured base URLs** (`PUBLIC_BASE_URL`, `CUSTOMER_BASE_URL`, `SELLER_BASE_URL`, `ADMIN_BASE_URL`). Local : localhost:3000-3003. Staging : `*.staging.tukio.one`. Prod : `*.tukio.one`.
12. **MFA admin** : géré entièrement par Keycloak (flow `tukio-admin-mfa-required` Story 1.1 AC3) — gateway-api callback assume que le claim `amr.totp` est présent si role `admin-*`. Si absent → bug Keycloak setup → redirect /auth/totp-setup Story 1.7.
13. **i18n strict** (memory) : zéro hardcoded UI. EN strict tech (paths URL, claim names, event types).

### Versions à utiliser (latest stable)

| Lib | Rôle | Version cible | Notes |
|---|---|---|---|
| **`jose`** | JWT decode + state JWT sign HMAC | latest stable (Story 0.8 déjà installée) | Réutilisé Story 1.4 |
| **`@nestjs/throttler`** | Rate limiting | Story 1.2 already installed | Réutilisé Story 1.4 |
| **`axios`** | HTTP client gateway-api → Keycloak | Story 1.2 already installed | Pour OAuth token exchange |
| **`cookie`** ou **`@fastify/cookie`** | Cookie parsing/setting (NestJS) | latest stable | Bundle Fastify adapter Story 0.6 |
| **`@playwright/test` + `@axe-core/playwright`** | E2E + a11y | Story 0.9 + Story 1.2 already used | |
| **`totp-generator`** | TOTP fixture pour tests Admin (Task 11.4) | latest stable | npm package simple, pas RFC compliance issue ici (juste tests fixtures) |
| **`keycloak-js`** | Frontend (Story 0.8 — finalisé Story 1.4 wiring) | latest stable | Réutilisé Story 1.4 wiring `<AuthProvider>` |

### Project Structure cible (fichiers créés/modifiés Story 1.4)

```
packages/contracts/src/
├─ events/identity/user-logged-in.v1.{schema.json,ts}                # NEW Story 1.4
├─ dtos/identity/whoami-response.dto.ts                              # NEW Story 1.4
└─ types/error-codes.ts                                              # UPDATE — 7 codes AUTH-*

apps/gateway-api/src/
├─ usecases/auth/                                                    # NEW Story 1.4
│  ├─ initiate-login.usecase.ts
│  ├─ handle-callback.usecase.ts
│  ├─ refresh-token.usecase.ts
│  ├─ logout.usecase.ts
│  └─ whoami.usecase.ts
├─ infrastructure/
│  ├─ external/keycloak/keycloak-oauth.client.ts                     # NEW Story 1.4
│  ├─ http/
│  │  ├─ controllers/auth-login.controller.ts                        # NEW Story 1.4 (5 endpoints)
│  │  ├─ guards/csrf.guard.ts                                        # NEW Story 1.4
│  │  └─ utils/{pkce,state-jwt,cookie-helpers,redirect-resolver}.ts  # NEW Story 1.4 (4 utils)
│  ├─ config/environment-config.service.ts                           # UPDATE — getStateJwtSecret + getZoneBaseUrls
│  └─ usecases-proxy/usecases-proxy.module.ts                        # UPDATE — wire 5 auth use cases
└─ test/auth/{auth-login,auth-callback,auth-refresh,auth-logout,auth-whoami}.e2e-spec.ts  # NEW (5 spec files)

apps/gateway-api/.env.example                                        # UPDATE — STATE_JWT_HMAC_SECRET, ZONE_BASE_URLs

apps/public/src/
├─ app/[locale]/auth/
│  ├─ login/page.tsx                                                 # NEW Story 1.4
│  └─ callback/route.ts                                              # NEW Story 1.4
├─ features/auth/login/
│  ├─ components/LoginCta.tsx                                        # NEW Story 1.4
│  └─ index.ts
├─ lib/redirect-url.ts                                               # NEW Story 1.4 — whitelist URL sanitization
├─ messages/{fr,en}.json                                             # UPDATE — auth.login.*
└─ e2e/auth/login.spec.ts                                            # NEW Story 1.4 (13 tests)

apps/customer/src/
├─ app/[locale]/layout.tsx                                           # UPDATE — wrap AuthProvider
├─ middleware.ts                                                     # UPDATE Story 1.2 — finalize role checks
├─ components/LogoutButton.tsx                                       # NEW Story 1.4
└─ e2e/middleware/role-redirect.spec.ts                              # NEW Story 1.4

apps/seller/src/
├─ app/[locale]/layout.tsx                                           # UPDATE — wrap AuthProvider
├─ middleware.ts                                                     # UPDATE Story 1.3 — finalize status checks
├─ components/LogoutButton.tsx                                       # NEW Story 1.4
└─ e2e/middleware/role-redirect.spec.ts                              # NEW Story 1.4

apps/admin/src/
├─ app/[locale]/layout.tsx                                           # NEW (Story 0.8 placeholder, Story 1.4 final)
├─ middleware.ts                                                     # NEW Story 1.4 — admin role + TOTP check
├─ components/LogoutButton.tsx                                       # NEW Story 1.4
└─ e2e/middleware/role-redirect.spec.ts                              # NEW Story 1.4

packages/auth-client/src/                                            # UPDATE Story 0.8 — finalisations
├─ providers/auth-provider.tsx                                       # finalize fetch /v1/auth/whoami
├─ hooks/{use-auth,use-logout,use-role,use-require-role}.ts         # finalize implementations
├─ refresh/refresh-token-rotation.ts                                 # finalize BroadcastChannel + interval
├─ cookies/cookie-manager.ts                                         # finalize getCsrfToken/addCsrfHeader
└─ middleware/decode-jwt.ts                                          # NEW Story 1.4 — helper shared

packages/api-client/src/
└─ client.ts                                                         # UPDATE — axios interceptor 401 → refresh

infra/k8s/grafana-dashboards/
└─ auth-flow.json                                                    # NEW Story 1.4

docs/runbook/
├─ login-flow-debug.md                                               # NEW Story 1.4
├─ cookie-architecture.md                                            # NEW Story 1.4
└─ refresh-token-rotation.md                                         # NEW Story 1.4

# Estimation total fichiers : ~55-65 nouveaux + ~25 updates = ~85 fichiers touchés
```

### Pattern code — `auth-login.controller.ts` (squelette annotated)

```ts
// apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts
@Controller('/v1/auth')
export class AuthLoginController {
  constructor(
    private readonly initiateLoginUseCaseProxy: UseCaseProxy<InitiateLoginUseCase>,
    private readonly handleCallbackUseCaseProxy: UseCaseProxy<HandleCallbackUseCase>,
    private readonly refreshTokenUseCaseProxy: UseCaseProxy<RefreshTokenUseCase>,
    private readonly logoutUseCaseProxy: UseCaseProxy<LogoutUseCase>,
    private readonly whoamiUseCaseProxy: UseCaseProxy<WhoamiUseCase>,
  ) {}

  @Get('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Query('next') next: string | undefined,
    @Query('clientId') clientId: 'tukio-web' | 'tukio-admin' = 'tukio-web',
    @Query('locale') locale: 'fr' | 'en' = 'fr',
    @Res({ passthrough: false }) res: Response,
  ) {
    const { redirectUrl, pkceCookie } = await this.initiateLoginUseCaseProxy.getInstance().execute({ next, clientId, locale });
    res.cookie('tukio-pkce-state', pkceCookie, { httpOnly: true, secure: true, sameSite: 'lax', domain: '.tukio.one', maxAge: 600_000, path: '/' });
    res.redirect(302, redirectUrl);
  }

  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('locale') locale: 'fr' | 'en',
    @Cookies('tukio-pkce-state') pkceCookie: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.handleCallbackUseCaseProxy.getInstance().execute({ code, state, locale, pkceCookie });
    // result.cookies = [{ name, value, opts }]
    result.cookies.forEach(c => res.cookie(c.name, c.value, c.opts));
    res.cookie('tukio-pkce-state', '', { maxAge: 0, domain: '.tukio.one' }); // clear pkce cookie
    res.redirect(302, result.redirectUrl);
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  async refresh(
    @Cookies('tukio-refresh-token') refreshToken: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<{ expiresIn: number; refreshExpiresIn: number }> {
    const result = await this.refreshTokenUseCaseProxy.getInstance().execute({ refreshToken });
    result.cookies.forEach(c => res.cookie(c.name, c.value, c.opts));
    return { expiresIn: result.expiresIn, refreshExpiresIn: result.refreshExpiresIn };
  }

  @Post('logout')
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(200)
  async logout(
    @Cookies('tukio-refresh-token') refreshToken: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<{ message: string }> {
    if (refreshToken) {
      await this.logoutUseCaseProxy.getInstance().execute({ refreshToken });
    }
    // Clear all auth cookies
    ['tukio-access-token', 'tukio-refresh-token', 'tukio-session-active', 'tukio-csrf-token'].forEach(name => {
      res.cookie(name, '', { maxAge: 0, domain: '.tukio.one', path: name === 'tukio-refresh-token' ? '/v1/auth' : '/' });
    });
    return { message: 'Logout successful' };
  }

  @Get('whoami')
  @UseGuards(KeycloakJwtGuard) // Story 0.8 — requires JWT
  async whoami(@CurrentActor() actor: Actor): Promise<WhoamiResponse> {
    return this.whoamiUseCaseProxy.getInstance().execute({ actor });
  }
}
```

### Critical Architecture Constraints

> Cf. Architecture lignes 234-241, 665-697, 1731-1738 ; Story 0.8 + Story 1.1 + memories.

1. **JWT validation re-faite dans CHAQUE service downstream** (NFR11) — gateway-api callback exchange OK, mais services downstream re-vérifient via `KeycloakJwtGuard` Story 0.8.
2. **PKCE S256 obligatoire** (NFR9 OWASP) — `code_challenge_method=S256` toujours.
3. **Tokens en mémoire React Context, jamais localStorage** (Story 0.8 décision XSS protection).
4. **CSRF double-submit cookie** sur POST/PUT/PATCH/DELETE.
5. **MFA admin obligatoire** (NFR12 + FR9) — `tukio-admin` client + flow `tukio-admin-mfa-required` Story 1.1.
6. **`Domain=.tukio.one`** sur tous cookies — cross-subdomain partage.
7. **Refresh anti-thundering-herd** (BroadcastChannel) Story 0.8 finalisé Story 1.4.
8. **Rate-limiting** (NFR10) — login 10/min/IP, refresh 30/min/IP.
9. **HTTPS partout** (NFR9) — `Secure` flag sur tous cookies.
10. **Anti-énumération NFR9** — message UI générique.

### Previous Story Intelligence

**Story 0.6** (Pretre identity-svc + envelope) : envelope ADR-014 réutilisé tel quel par gateway-api (déjà wiré Story 1.2). DomainException base + EnvelopeExceptionFilter wrap les `AuthInvalidStateException` Story 1.4.

**Story 0.7** (`@tukio/messaging`) : NATS publisher utilisé pour `identity.user.logged-in.v1` audit event. Pas de transaction outbox côté gateway-api MVP (fire-and-forget).

**Story 0.8** (`@tukio/auth` + `@tukio/auth-client`) : 🔴 **TOUTE LA STORY 1.4 EST LE WIRING REAL des libs Story 0.8**. `<AuthProvider>` Context, `useAuth`, `useLogout`, `useRole`, `RefreshTokenRotation`, `CookieManager`, `KeycloakAuthMiddleware` — Story 0.8 a posé les API, Story 1.4 finalise les implémentations + wire dans les apps. `KeycloakJwtGuard` + `RolesGuard` réutilisés (whoami endpoint).

**Story 0.13** (cookie acquisition + cross-zone Vercel rewrites) : pattern cross-zone redirect Story 1.4 (post-login customer/seller/admin) utilise les Vercel rewrites Story 0.13 pour les zones URLs.

**Story 1.1** (Keycloak realm) : 🔴 **dépendance critique** :
- 4 OIDC clients (`tukio-web`, `tukio-admin`, `tukio-api`, `tukio-mobile`) — Story 1.4 utilise `tukio-web` + `tukio-admin` selon contexte
- Redirect URIs configurés Story 1.1 AC2 — Story 1.4 callback URL `${PUBLIC_BASE_URL}/{locale}/auth/callback` doit être whitelisted (vérifier Story 1.1 implementation a bien inclus localhost dev URLs)
- Claim mappers `tukio:locale` + `tukio:status` + audience-mapper-tukio-api + amr-mapper Story 1.1 AC4 — Story 1.4 callback decode JWT + utilise ces claims pour redirect logic
- Flow MFA admin `tukio-admin-mfa-required` Story 1.1 AC3 — Story 1.4 admin login auto-force TOTP (pas de code spécifique côté gateway-api, juste assume Keycloak fait le travail)
- Brute-force protection Story 1.1 AC1 (`bruteForceProtected: true`, 5 fails / 15 min lock) — Story 1.4 expose le message UI générique pour `account_disabled` Keycloak error
- Webhook bridge Phasetwo Story 1.1 AC5 — Story 1.4 ne touche pas (LOGIN_ERROR events sont gérés Story 1.10 consumer identity-svc)

**Story 1.2** (Customer register) : pattern gateway-api scaffolding (Pretre légère + envelope + throttler) réutilisé Story 1.4. `<SignUpForm>` Story 1.2 + `<LoginCta>` Story 1.4 = layout siblings sous `apps/public/[locale]/auth/`. CSRF cookie `tukio-csrf-token` documenté Story 1.2 mais non wired (Story 1.4 wire).

**Story 1.3** (Pro register) : middleware seller redirect `pending_admin_review` Story 1.3 finalisé Story 1.4 (ajout role check + status checks complets). Cross-zone redirect post-register `/seller/onboarding/pending` → consommé Story 1.4 callback redirect logic. Verify token Story 1.2/1.3 → consommé Story 1.6 (pas Story 1.4 — Story 1.4 ne touche pas email verify flow).

### Latest Tech Information

- **Keycloak 26 OAuth 2.0** : endpoints standards `/realms/{realm}/protocol/openid-connect/auth` (initiate), `/token` (exchange), `/logout` (revoke). Documentation : https://www.keycloak.org/docs/26.0/securing_apps/.
- **PKCE S256** : RFC 7636. `verifier` base64url-encoded random 43-128 chars, `challenge = base64url(sha256(verifier))`. Standard sécurité OAuth public clients.
- **Refresh token rotation** : Keycloak realm config `attributes.refresh.token.max.reuse: 0` (Story 1.1 AC1). Toute réutilisation détectée → 400 invalid_grant.
- **Next.js 15 Route Handlers** : `app/[locale]/auth/callback/route.ts` exporte des fonctions HTTP (GET, POST, etc.). Documentation : https://nextjs.org/docs/app/building-your-application/routing/route-handlers. Node runtime par défaut.
- **`crypto.subtle.digest`** : Web Crypto API natif (browser + Node 18+). Utilisé pour SHA-256 verifier → challenge côté gateway-api.

### What this story does NOT do (out of scope)

- ❌ **Password reset flow** → Story 1.5 (réutilise login après reset)
- ❌ **Email verification landing page + endpoint** → Story 1.6 (réutilise login après verify)
- ❌ **Admin TOTP setup wizard UI** → Story 1.7 (Story 1.4 redirect vers TOTP setup si admin sans TOTP, Story 1.7 implémente la page)
- ❌ **Profile management `GET/PATCH /v1/me`** → Story 1.8 (whoami endpoint Story 1.4 ≠ profile management)
- ❌ **Account deletion** → Story 1.9
- ❌ **identity-svc Pretre consolidation + reconciliation** → Story 1.10
- ❌ **Login social Google + Apple** → V1 FR5 (réutilisera flow Story 1.4 + Keycloak Identity Providers)
- ❌ **SAML SSO B2B Enterprise** → V2 FR6 (réutilisera flow Story 1.4 + Phasetwo orgs SAML broker)
- ❌ **Pro 2FA optionnel** → V1 FR10
- ❌ **Conversion compte client → Pro** → V1 FR13
- ❌ **In-app notification center** → V1 Epic 11
- ❌ **Login attempt audit detailed** → Story 2.7 (consume `identity.user.logged-in.v1` event Story 1.4)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `packages/contracts/src/types/error-codes.ts` (Stories 1.2/1.3) — 7 codes AUTH-*
> - `packages/contracts/src/index.ts` — barrel
> - `packages/contracts/README.md` — section Identity events
> - `packages/auth-client/src/{providers,hooks,refresh,cookies,middleware-helpers}/...` (Story 0.8 placeholders) — finalize implementations
> - `packages/auth-client/README.md` (Story 0.8) — section Login flow
> - `packages/api-client/src/client.ts` — axios interceptor 401 → refresh
> - `apps/gateway-api/src/app.module.ts` (Story 1.2) — wire AuthLoginController + CsrfGuard + throttlers
> - `apps/gateway-api/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` — wire 5 auth use cases
> - `apps/gateway-api/src/infrastructure/config/environment-config.service.ts` — getStateJwtSecret + getZoneBaseUrls + getKeycloakOAuthConfig
> - `apps/gateway-api/.env.example` — env vars Story 1.4
> - `apps/public/messages/{fr,en}.json` — namespace auth.login.*
> - `apps/customer/src/middleware.ts` (Story 1.2) — finalize role + status checks
> - `apps/seller/src/middleware.ts` (Story 1.3) — finalize status checks complete
> - `apps/customer/src/app/[locale]/layout.tsx` — wrap AuthProvider
> - `apps/seller/src/app/[locale]/layout.tsx` — wrap AuthProvider

> **À CREATE** :
> - `packages/contracts/src/events/identity/user-logged-in.v1.{schema.json,ts}` (2)
> - `packages/contracts/src/dtos/identity/whoami-response.dto.ts` (1)
> - `apps/gateway-api/src/usecases/auth/{initiate-login,handle-callback,refresh-token,logout,whoami}.usecase.ts` (5)
> - `apps/gateway-api/src/infrastructure/external/keycloak/keycloak-oauth.client.ts` (1)
> - `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts` (1)
> - `apps/gateway-api/src/infrastructure/http/guards/csrf.guard.ts` (1)
> - `apps/gateway-api/src/infrastructure/http/utils/{pkce,state-jwt,cookie-helpers,redirect-resolver}.ts` (4)
> - `apps/gateway-api/test/auth/{auth-login,auth-callback,auth-refresh,auth-logout,auth-whoami}.e2e-spec.ts` (5)
> - `apps/public/src/app/[locale]/auth/{login/page.tsx,callback/route.ts}` (2)
> - `apps/public/src/features/auth/login/{components/LoginCta.tsx,index.ts}` (2)
> - `apps/public/src/lib/redirect-url.ts` (1)
> - `apps/public/e2e/auth/login.spec.ts` (1)
> - `apps/customer/src/components/LogoutButton.tsx` (1)
> - `apps/customer/e2e/middleware/role-redirect.spec.ts` (1)
> - `apps/seller/src/components/LogoutButton.tsx` (1)
> - `apps/seller/e2e/middleware/role-redirect.spec.ts` (1)
> - `apps/admin/src/{app/[locale]/layout.tsx,middleware.ts,components/LogoutButton.tsx}` (3)
> - `apps/admin/e2e/middleware/role-redirect.spec.ts` (1)
> - `infra/k8s/grafana-dashboards/auth-flow.json` (1)
> - `docs/runbook/{login-flow-debug,cookie-architecture,refresh-token-rotation}.md` (3)
> - **Estimation total fichiers** : ~38 nouveaux + ~25 updates = ~63 fichiers touchés.

### Testing Standards

- **Coverage cibles** (NFR71) :
  - gateway-api 5 use cases auth: ≥ 90 %
  - gateway-api endpoints auth: ≥ 85 %
  - frontend hooks `useAuth`/`useLogout`/`useRole`: ≥ 80 %
  - frontend `<AuthProvider>` + `RefreshTokenRotation`: ≥ 80 %
  - middlewares apps customer/seller/admin: ≥ 85 %
- **Tests unit** Vitest mocks
- **Tests integration** testcontainers Keycloak (Story 0.9) — bootstrap-realm Story 1.1 + tester real OAuth flow
- **Tests E2E** Playwright FR + EN + axe-core (cf. AC9 — 13 cases)
- **Performance** : NFR48 ≤ 3 s p90 desktop login (10 runs p9)
- **Security tests** : CSRF mismatch, state replay, code reuse, refresh reuse — explicit cases dans Tasks 4-5

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 234-241 (Auth) + 665-697 (Security) + 1731-1738 (Auth Flow) + 681-686 (CSRF).

✅ **Aligné** avec PRD §FR4 (login Keycloak), §FR9 (admin TOTP), §FR17 (block transactional unverified) + §NFR9-13.

✅ **Aligné** avec UX-DR9 (sign-up funnel, login pattern similar).

✅ **Aligné** avec memory `feedback_clean_architecture_explicit.md` (Pretre).

✅ **Aligné** avec memory `feedback_api_envelope_response.md` (envelope wrap).

✅ **Aligné** avec memory `feedback_tech_layer_english.md` (paths URL EN strict).

✅ **Aligné** avec memory `feedback_i18n_frontend.md` (FR + EN dès maintenant).

✅ **Aligné** avec memory `feedback_latest_versions.md` (Keycloak 26, latest stable libs).

⚠️ **Décision documentée** : OAuth flow proxied via gateway-api (cf. Décisions techniques §1).

⚠️ **Décision documentée** : PKCE materials générés gateway-api côté server (verifier HttpOnly cookie) (cf. Décisions techniques §2).

⚠️ **Décision documentée** : 4 cookies architecture (cf. Décisions techniques §4 + `docs/runbook/cookie-architecture.md`).

⚠️ **Décision documentée** : callback handler = Next.js Route Handler (pas Page) (cf. Décisions techniques §8).

⚠️ **À noter** : Story 1.4 ne touche PAS le Keycloak SMTP send (Story 1.1 a configuré mais désactivé au profit de Resend Story 1.6). Login flow assume `email_verified` est déjà true (Story 1.6 a finalisé le verify avant login).

⚠️ **À noter** : la **page `/auth/totp-setup`** Story 1.7 est un placeholder dans `apps/admin/` Story 1.4 — Story 1.4 redirige les admins sans TOTP vers cette page mais ne l'implémente pas. Story 1.7 finalise.

⚠️ **À noter** : la **page `/auth/account-suspended`** Story 6.5 + page `/seller/onboarding/rejected` Story 2.5 sont des placeholders dans Story 1.4 middleware — middleware redirige mais les pages sont des stubs `<EmptyState variant="warning">` placeholder Story 1.4.

⚠️ **À noter** : le **logout button** est ajouté dans les 3 apps (customer, seller, admin) en Story 1.4 — placement UI MVP basique (header dropdown). Polish UX Stories Epic 1+ (e.g., dropdown avec avatar + email + role + "Mon profil" + "Mes paramètres" + "Se déconnecter").

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Auth — Lines 234-241]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security — Lines 665-697]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Flow — Lines 1731-1738]
- [Source: _bmad-output/planning-artifacts/architecture.md#CSRF — Lines 681-686]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Security — Lines 699-708 (rate limiting)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1-Story-1.4 — Lines 1132-1147]
- [Source: _bmad-output/planning-artifacts/prd.md#FR4 — Login Keycloak]
- [Source: _bmad-output/planning-artifacts/prd.md#FR9 — Admin TOTP obligatoire]
- [Source: _bmad-output/planning-artifacts/prd.md#FR17 — Block transactional unverified]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9-13 — Security + sessions]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR48 — UX]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — Coverage]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR9 — sign-up funnel (login pattern)]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 (envelope + DomainEvent)]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — Story 0.6 (Pretre + envelope ADR-014)]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — Story 0.7 (NATS audit event publish)]
- [Source: _bmad-output/implementation-artifacts/0-8-setup-tukio-auth-backend-frontend.md — Story 0.8 (TOUTE LA BASE — finalisée Story 1.4)]
- [Source: _bmad-output/implementation-artifacts/0-9-setup-tukio-api-client-i18n-client-testing.md — Story 0.9 (testcontainers Keycloak helper)]
- [Source: _bmad-output/implementation-artifacts/0-13-initialize-adrs-vercel-multi-zones-acquisition-schema.md — Story 0.13 (Vercel rewrites cross-zone)]
- [Source: _bmad-output/implementation-artifacts/1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo.md — Story 1.1 (4 OIDC clients + claim mappers + flow MFA admin)]
- [Source: _bmad-output/implementation-artifacts/1-2-customer-b2c-registration.md — Story 1.2 (gateway-api scaffolding + envelope + throttler)]
- [Source: _bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md — Story 1.3 (middleware seller redirect)]
- [External: https://datatracker.ietf.org/doc/html/rfc7636 — PKCE OAuth 2.0]
- [External: https://www.keycloak.org/docs/26.0/securing_apps/ — Keycloak securing apps]
- [External: https://nextjs.org/docs/app/building-your-application/routing/route-handlers — Next.js 15 Route Handlers]
- [External: https://datatracker.ietf.org/doc/html/rfc6749 — OAuth 2.0]
- [External: https://datatracker.ietf.org/doc/html/rfc7519 — JWT]
- [External: https://datatracker.ietf.org/doc/html/rfc8176 — AMR Values for OAuth 2.0]
- [Memory: feedback_clean_architecture_explicit.md]
- [Memory: feedback_api_envelope_response.md]
- [Memory: feedback_tech_layer_english.md]
- [Memory: feedback_i18n_frontend.md]
- [Memory: feedback_latest_versions.md]
- [Memory: feedback_comprehensive_briefs.md]
- [Memory: feedback_trust_docs.md]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent au démarrage)

### Debug Log References

(à remplir au cours de l'implémentation — vérification compat Keycloak 26 OAuth endpoints, validation PKCE S256 algorithme contre RFC 7636 spec, choix Next.js Route Handler vs Page Server Component pour callback (Route Handler décidé), vérification cookies `Domain=.tukio.one` propagation cross-zones en local (Docker Compose Story 0.10 — vérifier `/etc/hosts` ou `*.localhost` resolution), test Keycloak `prompt=login` force re-auth comportement, validation BroadcastChannel API browser support (Chrome 54+, Firefox 38+, Safari 15.4+), validation refresh token reuse detection Keycloak `max.reuse: 0` enforce strict (vérifier réalisme via testcontainer real Keycloak), validation cross-zone middleware decode JWT Edge runtime + jose decodeJwt (no signature verify, gateway-api fait la verify), drift R8 si gateway-api restart entre login et NATS audit event publish — fire-and-forget MVP accepté)

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 1.5 (password reset → réutilise login après reset), Story 1.6 (email verify → réutilise login après verify), Story 1.7 (admin TOTP setup → utilise redirect Story 1.4 quand `amr.totp` absent), Story 1.8 (profile management → utilise `<AuthProvider>` + useAuth Story 1.4 wired), Story 1.9 (delete + logout flow), Story 1.10 (audit consume `identity.user.logged-in.v1` event Story 1.4), Story 2.5 (page `/seller/onboarding/rejected` à finaliser), Story 2.7 (audit log login events), Story 6.5 (page `/auth/account-suspended` à finaliser))

### File List

(à remplir à la fin — liste exhaustive des fichiers créés/modifiés/supprimés)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 1-2 (semaines 4-6 du planning MVP, 4ᵉ story Epic 1)
- **Estimation effort** : 5-8 jours (1 dev fullstack senior — story complexe à cause OAuth flow proxied + cookies multi-attributes + refresh rotation + 3 apps middleware + e2e Keycloak real testcontainer ~85 fichiers touchés)
- **Dépendances upstream** :
  - **Story 0.2** (`ready-for-dev`) — `@tukio/contracts` envelope + DomainEvent
  - **Story 0.6** (`ready-for-dev`) — Pretre identity-svc + envelope ADR-014 (réutilisé gateway-api Story 1.2)
  - **Story 0.7** (`ready-for-dev`) — NATS publisher (audit event)
  - **Story 0.8** (`ready-for-dev`) — 🔴 **TOUTE LA BASE** : `@tukio/auth` + `@tukio/auth-client` placeholders (finalisés Story 1.4)
  - **Story 0.9** (`ready-for-dev`) — `@tukio/testing` testcontainers Keycloak helper
  - **Story 0.10** (`ready-for-dev`) — Docker Compose Keycloak local
  - **Story 0.13** (`ready-for-dev`) — Vercel rewrites cross-zone
  - **Story 1.1** (`ready-for-dev`) — Keycloak realm + 4 clients + claim mappers + flow MFA admin + brute-force
  - **Story 1.2** (`ready-for-dev`) — gateway-api scaffolding (Pretre + envelope + throttler) + Customer users
  - **Story 1.3** (`ready-for-dev`) — Pro users `pending_admin_review` + middleware seller squelette
- **Dépendances downstream** :
  - **Story 1.5** (Password reset) — réutilise login flow après reset
  - **Story 1.6** (Email verify) — réutilise login flow après verify
  - **Story 1.7** (Admin TOTP setup) — Story 1.4 redirect → Story 1.7 page
  - **Story 1.8** (Profile management) — utilise `<AuthProvider>` + `useAuth` finalisés Story 1.4
  - **Story 1.9** (Account delete) — utilise logout flow Story 1.4
  - **Story 1.10** (identity-svc consolidation + reconciliation) — consume audit event `identity.user.logged-in.v1` Story 1.4
  - **Story 2.5** (Pro acceptation/rejet) — finalise pages `/seller/onboarding/{rejected,accepted}` (Story 1.4 placeholders)
  - **Story 2.7** (Audit trail) — consume `identity.user.logged-in.v1` event
  - **Stories Epic 2-7+** — toutes les pages authentifiées utilisent `<AuthProvider>` + middleware redirect Story 1.4
  - **Story V1 FR5** (Login social Google + Apple) — réutilise flow Story 1.4 + Keycloak Identity Providers
  - **Story V2 FR6** (SAML SSO B2B) — réutilise flow Story 1.4 + Phasetwo orgs SAML broker
- **FRs covered** :
  - **FR4** ✅ Login Customer / Pro / Admin via Keycloak
  - **FR9** ✅ Admin TOTP obligatoire (via flow `tukio-admin-mfa-required` Story 1.1 + redirect Story 1.4)
  - **FR17** ✅ Block transactional unverified (middleware finalisé Story 1.4)
- **NFRs touchés** :
  - **NFR9** ✅ HTTPS/HSTS + PKCE S256 + anti-énumération
  - **NFR10** ✅ Rate limit login 10/min/IP + refresh 30/min/IP
  - **NFR11** ✅ JWT RS256 + JWKS validation downstream services Story 0.8
  - **NFR12** ✅ MFA TOTP admin obligatoire (Story 1.1 flow) + refresh token rotation natif Keycloak
  - **NFR13** ✅ Cookies HttpOnly + Secure + SameSite policy + Domain=.tukio.one
  - **NFR48** ✅ UX login ≤ 3s p90
  - **NFR71** ✅ Coverage thresholds
  - **R8** ✅ Drift Keycloak ↔ DB mitigated via audit event + Story 1.10 reconciliation

> **Prochaine story (auto-discover via `bmad-create-story`) → Story 1.5** (Password reset flow `POST /v1/auth/password-reset/request` + `POST /v1/auth/password-reset/confirm`)

---

**Dev agent next steps :**
1. Lire ce file en entier (Story Foundation + AC + Tasks + Dev Notes + References)
2. Vérifier les artefacts upstream (Stories 0.2, 0.6-0.10, 0.13, 1.1, 1.2, 1.3) sont bien en `ready-for-dev` ou `done`. **CRITIQUE** : Story 0.8 doit être implémentée AVANT Story 1.4 (Story 1.4 finalise les libs Story 0.8 — TOUTE LA BASE)
3. Implémenter Tasks 1-12 dans l'ordre (Tasks 1-3 indépendantes peuvent paralléliser ; Tasks 4-7 backend séquentielles ; Tasks 8-10 frontend peuvent paralléliser avec Tasks 5-7)
4. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main] && pnpm playwright test --grep "login"`
5. Commit Story 1.4 quand : 13/13 e2e tests passent + coverage ≥ thresholds + lint OK + axe-core 0 violations + perf NFR48 OK + cross-zone session sharing test passes
6. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` : `1-4-login-flow-keycloak-authorization-code-pkce: review` (puis `done` après code-review)
