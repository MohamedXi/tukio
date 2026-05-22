# Deferred Work

## Deferred from: code review of 1-4b-gateway-api-endpoints-usecases-csrf-e2e (2026-05-18, round 2)

- **D9** — `auth-customer-register.e2e-spec.ts:2509` + `auth-pro-register.e2e-spec.ts:2635` bumped `jest.setTimeout(30_000)` (6× the 5s default) to mask slow module-wiring boot. Either 6s real boot (alarming) or hedge against flake. Root cause investigation deferred to ops sprint.
- **D10** — Keycloak refresh-reuse detection relies on fragile error-description string match (`'Token is not active'` / `'stale'`). Keycloak version-upgrade can change the description and silently break reuse detection. Add a Story 0.9 contract test asserting Keycloak 25 emits the expected string.
- **D11** — `csrf.guard.ts` references `req.cookies` which depends on `fastifyCookie` plugin being registered on the production boot path. Diff doesn't show `main.ts`; verify `fastifyCookie` is wired in production `bootstrap()` (the `@Cookies(PKCE_COOKIE) pkceCookie: string | undefined` decorator resolution would throw without it).
- **D12** — No fuzz test for refresh token with newline / null-byte / extremely long string passed via cookie. `KeycloakOAuthClient.refreshTokens` posts as form data ; a null-byte could break form encoding. Property-based testing not in MVP scope.
- **D13** — Throttler state is in-process and shared across e2e cases inside the same suite ; cases are coupled by ordering. Currently safe because each suite stays under the per-route limit, but adding a 6th login case would silently fail. Refactor into `beforeEach` Throttler reset would help.

## Deferred from: code review of 1-4a-contracts-utils-keycloak-oauth-client (2026-05-18)

- **D1** — `requestId` dans le state JWT n'est jamais validé contre un nonce store Redis. Sans stockage des IDs utilisés, un token intercepté peut être rejoué pendant les 10 min de TTL. Scope prévu : Story 1.4b (Redis nonce store, même instance que ThrottlerModule). [state-jwt.ts]
- **D2** — `PKCE_STATE_MAX_AGE_SEC` dans `cookie-helpers.ts` et `STATE_TTL_SECONDS` dans `state-jwt.ts` sont deux constantes indépendantes à la même valeur (600s). Un changement sur l'une sans l'autre crée un désynchronisation Max-Age cookie vs JWT exp. Refactor : exporter une constante partagée depuis un fichier constants.ts ou la config. Non-bloquant (bug latent seulement si quelqu'un change une seule valeur). [cookie-helpers.ts:14 / state-jwt.ts:7]
- **D3** — `UserLoggedInRole` dans `user-logged-in.v1.ts` redéfinit les 5 mêmes littéraux que `UserRoleEnum` dans `whoami-response.dto.ts`. Si un nouveau rôle est ajouté, il faut mettre à jour les deux définitions séparément. Refactor Story 1.10 : faire dériver `UserLoggedInRole` de `UserRoleEnum` ou extraire une constante commune. [user-logged-in.v1.ts:4 / whoami-response.dto.ts:3]

## Deferred from: code review of 1-3a-bis-extend-register-pro-input-schema (2026-05-17)

- **D1** — `requiresEmailVerification: z.literal(false)` dans `RegisterProResponseSchema` : la valeur est logiquement correcte (Customer déjà vérifié) mais la response schema complète sera redéfinie dans Story 1.3b-bis handler refactor. Actuellement `literal(false)` — confirmer ou ajuster lors de 1.3b-bis review. [décision review 2026-05-17]
- **W1** — Année 0000 acceptée comme DoB (pas de borne inférieure min, ex: 1900) [register-pro.dto.ts] — Cas hypothétique, aucun impact pratique. Ajouter `.refine(y >= 1900)` en V1+.
- **W2** — City Unicode-whitespace-only (zero-width space `​` non trimmé par `String.prototype.trim()`) [register-pro.dto.ts] — Cas extrêmement rare pour un nom de ville FR MVP. Déféré.
- **W3** — `radiusKm` float/entier : message d'erreur Zod non testé [register-pro.spec.ts] — Fonctionnellement correct, test message fin déféré.
- **W4** — `vatNumber` avec lettres exclues I/O non testées explicitement [register-pro.spec.ts] — Regex `[0-9A-HJ-NP-Z]` correct, test exhaustif déféré.
- **W5** — Téléphone `+337XXXXXXXX` (mobile 07) non explicitement testé [register-pro.spec.ts] — Regex valide (7 match `[1-9]`), test déféré.
- **W6** — `legalForm` avec valeurs limites (null, numérique, empty string) non testées [register-pro.spec.ts] — Enum Zod rejette automatiquement, test fin déféré.
- **W7** — Cast `(noCharter as { acceptCharter?: true }).acceptCharter` cosmétiquement trompeur [register-pro.spec.ts] — Fonctionne correctement à runtime, refactor cosmétique déféré.

## Deferred from: code review of 1-3c-gateway-api-pro-register-multipart-forwarder (2026-05-17)

- **W1** — Throttler keyed sur proxy IP (`trustProxy` absent) [`main.ts:FastifyAdapter`] — `FastifyAdapter({ logger: false })` sans `trustProxy: true` : `req.ip` = IP Caddy reverse proxy en prod, pas l'IP client réelle. Limite 3/min partagée par tous derrière le proxy. Pre-existing depuis Story 1.2c (affecte aussi `/v1/auth/customer/register`). Fix : ajouter `trustProxy: true` à `FastifyAdapter`.
- **W2** — POST retry sur erreurs réseau/5xx potentiellement non-idempotent [`identity-svc.client.ts:axiosRetry`] — Retries sur `err.response.status >= 500` pour POST registerPro. Si identity-svc crée Keycloak user puis échoue avant commit DB, la compensation saga de 1.3a annule normalement. Mitigé par contraintes DB uniqueness (email/SIRET). Pre-existing pattern 1.2c. Fix propre : idempotency key header — V1.
- **W3** — Validation MIME par Content-Type client seul, pas magic bytes [`parse-multipart-pro-register.ts:ALLOWED_MIME_TYPES`] — Un exécutable avec `Content-Type: image/jpeg` passe la whitelist. Risk limité si R2 KYC non servi publiquement. Magic byte validation V1 hardening via npm `file-type`.
- **W4** — `form.getBuffer()` double le pic mémoire (~32 MB/requête) [`identity-svc.client.ts:registerPro`] — `toBuffer()` matérialise 3 × 5 MB ; `form.getBuffer()` concat en un second buffer. Optimisation V1 : passer `form` comme stream body axios (streamed multipart send, pas de copy).

## Deferred from: code review of 1-3b-identity-svc-infrastructure-insee-r2-controller (2026-05-17)

- **W1** — R2 `delete()` n'a pas de `correlationId` dans la signature de port — orphan compensation logs perdent le lien de trace. Story 1.10 reconciliation job aura besoin de retrouver "quel register a généré quel orphan blob". Étendre `DeleteInput` avec correlationId optionnel et logger côté adapter.
- **W2** — prom-client counters manquants : `tukio_keycloak_orphan_users_total`, `tukio_r2_orphan_kyc_objects_total`, `tukio_insee_rate_limit_total`, `tukio_insee_5xx_total`. Story 1.10 (reconciliation job) et Story 4.13 (observability MVP) en ont besoin. Pattern Story 1.2b à étendre.
- **W3** — `ProTransactionContext.tokenRepo` est une dépendance leaky du repo pro (le `tokenRepo` est injecté juste pour forwarder, jamais appelé par pro registration). Touche le contrat de Story 1.3a (`pro-profile.repository.port.ts`). À refactor en V1+ : retirer `tokenRepo` du `ProTransactionContext` (ne devrait pas étendre `TransactionContext` parent customer).
- **W4** — `UserProfile.registerPro()` factory dédiée : actuellement `RegisterProUseCase` fait `UserProfile.register(...)` puis `UserProfile.create({ ...userProfile, role: PRO, status: PENDING_ADMIN_REVIEW })` — TODO inline ligne 317. Le spread perd toute invariant future ajoutée à `register()`. Ajouter une factory dédiée à l'aggregate.
- **W5** — INSEE adapter sans retry/circuit breaker — single transient blip = 502 utilisateur. Parent story narrative mentionnait un circuit breaker mais pas implémenté en 1.3b. V1+ scope.
- **W6** — ESLint disable `no-unsafe-*` sur `parse-multipart-pro-register.ts` — fix propre via tsconfig project service (le module augmentation de `@fastify/multipart` n'est pas pickée par ESLint). Non-bloquant.
- **W7** — MIME magic-byte validation via lib `file-type` — `filePart.mimetype` est client-supplied via Content-Type, donc un `.exe` labelé `image/jpeg` passe la whitelist. KYC blob arrive R2 avec wrong stated type → admin signed URL → risque XSS si rendu inline. Story 2.3-2.4 (admin KYC review) devra faire la double-check au retrieve + envisager file-type lib ici. Nouvelle dep à valider.
- **W8** — `R2_KYC_BUCKET` hardcoded à `tukio-kyc-staging` dans `infra/docker-compose/apps.prod.yml` + `INSEE_API_URL` utilise le default Zod (jamais exporté par le workflow). Pas de bucket prod existant. Sprint dédié post-MVP go-live prod : (a) créer secret droplet `r2_kyc_bucket`, (b) ajouter `export R2_KYC_BUCKET=...` aux 2 SSH steps de `deploy-staging.yml` (et du futur `deploy-production.yml`), (c) ajouter `INSEE_API_URL` au workflow export pour permettre l'override (INSEE sandbox vs prod).

## Deferred from: code review of 1-3a-contracts-pro-domain-usecase (2026-05-16)

- **W1** — `ProTransactionContext` port design n'enforce pas le QueryRunner partagé — Story 1.3b implémentation doit garantir que `userProfileRepo` et `proProfileRepo` utilisent le même `QueryRunner` (documentation-only dans le port). Si mal implémenté → writes non atomiques sans erreur visible.
- **W2** — `InseeSiretSnapshot.address` (adresse INSEE authoritative) ignorée, adresse user-supplied utilisée à la place — un pro peut enregistrer un SIRET d'une vraie entreprise avec une adresse différente. À comparer dans le KYC admin (Stories 2.3-2.4).
- **W3** — `etatAdministratif !== 'A'` magic string — définir `InseeEtatAdministratif.ACTIF = 'A'` / `CESSE = 'C'` dans le port pour éviter la dérive si INSEE ajoute un nouveau code. Story 1.3b.
- **W4** — Fixtures SIRET : seul `35600000000048` (La Poste) vérifié live contre INSEE. Les 5 autres sont des composites Luhn calculés algorithmiquement. Acceptable (Luhn est la règle locale, existence = 1.3b), mais le spec AC1 demandait "5+ SIRETs réels". Documentation quality.
- **W5** — `retryAfter` / `retryAfterMs` non propagé comme champ typé dans `ExternalServiceException` — actuellement embedé dans le message string seulement. L'implémentation HTTP en 1.3b (gateway-api forwarder) doit lire le header `Retry-After` et le retransmettre côté client.
- **W6** — UUID queue fragilité dans les tests — `register-pro.usecase.spec.ts` utilise un tableau `queue.shift()` qui peut s'épuiser dans des tests double-`execute()`. Test fragility, non bloquant prod.
- **W7** — `PhoneNumber` regex accepte `08xx` (numéros surtaxés) — `/^(?:\+33|0)[1-9]\d{8}$/` matches `080...`/`089...`. Acceptable MVP (nombres légaux), mais `08xx` inadaptés à la réception de SMS. À restreindre à `[1-79]` si contact SMS planifié en V1.
- **W8** — `input.acceptTerms` non lu dans le use case — `UserProfile.register()` hard-code `acceptTerms: true`. Le literal type `acceptTerms: true` enforced par TS suffit. Si le type est relâché à `boolean` dans un refactor, la vérification deviendra silencieuse.

## Deferred from: code review of 1-2c-gateway-api-pretre-forwarder (2026-05-16)

- **D1** — Redis non validé au démarrage [`app.module.ts:62`] — `new Redis(url)` sans onModuleInit probe ; démarrage silencieux si Redis down. À corriger en V1.
- **D2** — Timeout Redis non configuré [`app.module.ts:62`] — ioredis defaults sans `connectTimeout`/`commandTimeout` explicites ; potentiel ralentissement sous Redis lent. V1.
- **D3** — HTTP 400 identity-svc mappé en IdentitySvcValidationError trop large [`identity-svc.client.ts:132`] — identity-svc n'émet que 422 pour la validation Zod ; le mapping 400→validation est défensif mais potentiellement trompeur.
- **D4** — Pas de log sur les retries axios [`identity-svc.client.ts:49-58`] — faible observabilité prod sur les échecs identity-svc intermittents. V1 observability.
- **D5** — Regex PII email trop large dans EnvelopeExceptionFilter [`envelope-exception.filter.ts:25`] — faux positifs possibles (pre-existing dans identity-svc aussi).
- **D6** — Fallback `statusCode ?? 200` dans ResponseEnvelopeInterceptor [`response-envelope.interceptor.ts:50`] — latent si statusCode non défini par le framework.
- **D7** — Unicode normalization non normalisée avant HMAC [`identity-svc.client.ts:68`] — risque théorique pour caractères composés/décomposés ; faible probabilité pratique.
- **D8** — Config service alloue de nouveaux objets à chaque getXxxConfig() [`environment-config.service.ts:49+`] — pression GC mineure ; micro-optimisation V1.
- **D9** — Pas de validation Content-Type sur les réponses identity-svc [`identity-svc.client.ts:77-87`] — axios parse JSON même si la réponse est text/html. V1.
- **D10** — Collide timestamp HMAC (résolution 1 seconde) [`identity-svc.client.ts:70`] — mitigé par body hash (emails différents → hashes différents) + conflict 409 downstream.
- **D11** — Longueur secret HMAC non re-validée dans le constructeur client [`identity-svc.client.ts:40`] — déjà validée par env.schema au boot ; redondance defense-in-depth optionnelle.
- **D12** — Correlation ID inbound non validé (format non-UUID accepté) [`auth-customer.controller.ts:67`] — logs moins traçables si ID malformé ; impact faible.
- **D13** — Fenêtre rate-limit off-by-one (comportement exact @nestjs/throttler) [`auth-customer.controller.ts:57`] — dépend de l'implémentation rolling window du throttler.
- **D14** — Dérive schéma acquisition gateway vs identity-svc — les deux utilisent `@tukio/contracts`, dérive impossible à runtime mais non vérifiée par test dédié.
- **D15** — Race condition timeout + retry [`identity-svc.client.ts:49-58`] — axios-retry gère via request-level timeout ; non bloquant en pratique.
- **D16** — ThrottlerModule 1 scope vs 2 scopes spécifiés [`app.module.ts:55-60`] — choix pragmatique documenté dans Dev Notes ; V1 refactor 2-scopes avec @SkipThrottle planifié.

## Deferred from: code review of 1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo (2026-05-16)

- **D-1** — Account theme PF5 vs login PF4 CSS pipeline mismatch [`themes/tukio/account/theme.properties`]. Account theme inherits `keycloak.v3` (PatternFly v5 selectors `.pf-v5-c-*`), but the CSS copied from login targets v2/PF4 (`.pf-c-*`). Account console will render partially unstyled. Will be revisited in Story 1.8 (Profile management UI).

## Deferred from: code review of 0-1-bootstrap-monorepo-turborepo-scaffold-nextjs-apps-nestjs-services (2026-05-09)

- **W1** — `@tukio/*` path mapping dans `tsconfig.base.json` ne résout pas correctement depuis les sous-dossiers des workspaces NestJS. Sera résolu dès le 1er import réel dans Story 0.2 (contracts).
- **W2** — Les 8 packages partagés exposent `./src/index.ts` comme `main`, incompatible avec la résolution `nodenext` de NestJS. Ne casse rien tant que les packages sont vides ; à corriger avant Story 0.2.
- **W3** — Les Dockerfiles sont des placeholders 1-stage sans contexte workspace pnpm. Scope Story 0.10 (Docker Compose + multi-stage builds).
- **W4** — `turbo.json` n'a pas de `globalEnv` pour les variables `NEXT_PUBLIC_*`. À ajouter quand les `.env` sont introduits en Story 0.2+.
- **W5** — `packages/ui/tsconfig.json` n'inclut pas `lib: ["dom"]` ni `jsx: "react-jsx"`. Bloquant pour les premiers composants React. Scope Story 0.4 (composants atomiques).
- **W6** — `process.env.PORT` sans validation `@nestjs/config`/Joi/Zod dans tous les services. Pas de déploiement en Story 0.1 ; ajouter avec la config applicative en Epic 1.
- **W7** — Les fichiers `*.tsbuildinfo` ne sont pas déclarés dans les `outputs` de `turbo.json`, ce qui invalide la compilation incrémentale sur les restore de cache CI. Optimisation à adresser en Story 0.11 (CI pipeline).
- **W8** — Les 8 packages partagés n'ont pas d'`eslint.config.mjs` local et utilisent le config racine sans parser TypeScript dédié. Les règles boundaries strictes arrivent en Story 0.6.

## Deferred from: code review of 0-2-initialize-tukio-contracts-envelope-nats-events-dtos (2026-05-09)

- **D1** — `tukioCode` dans `ErrorBody` est typé `string` libre. Story 0.6 (Pretre + envelope interceptor) ajoutera un regex (ex: `^[A-Z]+-[A-Z0-9]+-\d{3}$` type `AUTH-001`).
- **D2** — `format: "uuid"` JSON Schema accepte v1-v5. Acceptable car Keycloak/Stripe émettent diverses versions. Validation v4-strict possible côté consommateur si besoin (Story Epic 1+).
- **D3** — `Money.amount` typé `number` permet les floats au compile-time (JSON Schema runtime exige integer). Branded type `Cents` à introduire en Story 0.7 (messaging) avec validation publish-side.
- **D4** — `@tukio/*: ["./packages/*/src"]` résout vers un dossier (pas index.ts explicite). Fonctionne sous bundler resolution, fragile sous nodenext. À durcir quand les packages auront leur `dist/` (Story 0.6).
- **D5** — Pas de check automatique que les 14 tsconfigs apps/services restent en sync sur les paths `@tukio/contracts`. Script de vérification à ajouter en Story 0.11 (CI pipeline).
- **D6** — Lint rule `tukio/event-naming` couvre uniquement les `Property` AST nodes. N'attrape pas template literals, `publish('event')`, `subscribe('event')`, `@Subject('event')`. À étendre en Story 0.7 quand le wrapper NATS est livré.
- **D7** — `RegisterCustomerSchema.password` n'a que `min(12).max(128)`, pas de complexité (regex caractères spéciaux/chiffres) ni normalisation NFKC. À durcir en Epic 1 (Story 1.2 customer registration).
- **D8** — `@tukio/contracts` expose ses sources `.ts` directement via `exports` field. Fonctionne sous bundler (Next.js, Vitest) mais Node ne peut pas exécuter `.ts` sans loader. Story 0.6 ajoutera un script `build` qui émet `dist/` + mettra à jour `exports` pour pointer vers `dist/` quand les services NestJS commenceront à consommer au runtime.

## Deferred from: code review of 0-3-setup-design-system-tailwind-v4-tukio-ui (2026-05-09)

- **W1** — Full-height flex shell `min-h-full flex flex-col` retiré de `<body>` (apps/*/layout.tsx). Décision intentionnelle pour les apps placeholder ; les pages gèrent leur propre hauteur (`min-h-screen`). À revisiter si un layout composite a besoin d'un shell fixe.
- **W2** — `h5`, `h6` absents du heading reset globals.css. Spec AC3 définit h1-h4 uniquement. À inclure explicitement si des composants Story 0.4+ utilisent h5/h6.
- **W3** — `a { text-decoration: none; color: inherit }` WCAG 1.4.1 (globals.css). Requis par spec AC3, tradeoff connu. Chaque composant doit restaurer le soulignement ou un contraste suffisant. À documenter dans la contribution guide Story 0.4.
- **W4** — `--animate-modal-enter` / `--animate-shimmer` absents de `@theme{}` — pas de utility class Tailwind générée. Keyframes définis pour usage manuel CSS direct. Ajouter `--animate-*` en Story 0.5 quand les patterns consomment ces animations.
- **W5** — `--breakpoint-xs: 0px` always-active (theme.css + breakpoints.ts). Spécifié AC1. Tradeoff sémantique : `xs:` utility = toujours vrai. Documenter dans le guide tokens Story 0.4 : "xs: base mobile — pas de guard min-width".
- **W6** — Fraunces `weight: 'variable'` au lieu du weight array (apps/*/layout.tsx). Déviation documentée dans le Dev Agent Record, forcée par Next.js validation (axes + weight array incompatibles). Valide techniquement.
- **W7** — `tsd` absent des devDependencies (packages/ui/package.json). Alternative inline `AssertEqual<A, B>` choisie. Équivalent fonctionnel per spec "tsd ou expect-type".
- **W8** — Bouton placeholder sans `onClick` (apps/public/page.tsx). Placeholder cosmétique pour Lighthouse. Remplacé par vrai composant Button en Story 0.4.
- **W9** — `text-wrap: balance/pretty` support partiel (~75% / Chrome-only). Requis par spec. Progressive enhancement acceptable pour Sprint 0 placeholder.

## Deferred from: code review of 0-6-pattern-pretre-scaffolding-template-identity-svc (2026-05-10)

- **D1** — `ResponseEnvelopeInterceptor` statusCode hardcodé 200 si un futur controller uses `@HttpCode(201)` avec Express adapter — pas de controller non-200 actuellement, aucun impact.
- **D2** — `EMAIL_REGEX` permissif (accepte double dots, leading hyphens dans domain part) — acceptable MVP, à durcir si conformité RFC 5321 stricte requise en Epic 1+.
- **D3** — `Email.create` avec TypeORM partial hydration (`select()` sans `email`) retourne 422 au lieu de 500 — colonne `email NOT NULL`, cas pratiquement impossible sans requête explicitement partielle.
- **D4** — `sed_inplace` détection BSD/GNU fragile sur Linux exotique (Nix, etc.) — fonctionne macOS + Linux standard (Ubuntu, Alpine CI).
- **D5** — Script `--force` ne nettoie pas les fichiers orphelins d'un run `replicate-pretre-structure.sh` partiel interrompu — à améliorer si le script est utilisé fréquemment (Story 0.7+).
- **D6** — `buildMeta` locale non-supportée silencieusement mappée à `'fr'` sans log ni warning — acceptable tant que seuls FR/EN sont supportés (Story 7.1 next-intl ajoutera routing locale).
- **D7** — `asEnvelopeMethod` mappe `OPTIONS/HEAD` → `'GET'` dans l'enveloppe — pas d'endpoints CORS/HEAD actuels, à corriger quand CORS sera configuré (Story 0.11 CI ou Epic 7).
- **D8** — AC6: `toUserProfileResponseDto()` standalone function vs `UserProfileMapper.toResponseDto()` static method (spec) — fonctionnellement identique, renommage cosmétique.
- **D9** — AC9: Index UNIQUE séparé vs contrainte `UNIQUE` inline dans la migration — fonctionnellement identique au niveau DB PostgreSQL.
- **D10** — AC9: Scripts migration `tsx ./node_modules/typeorm/cli.js` vs `typeorm-ts-node-esm` — fonctionnellement équivalent, à standardiser lors de la Story 0.11 CI setup.
- **D11** — AC12: `jest.config.ts` sans threshold `infrastructure/` (couvert par `pnpm test:e2e:cov`) — threshold séparé pragmatique, à consolider en mono-run Jest dans Story 0.11.
- **D12** — AC13: `tokens.template.ts` sentinel/fichier virtuel dans `REPLICATE_FILES` — fonctionne mais design inhabituel ; remplacer par un vrai fichier template si le script est étendu.

## Deferred from: code review of 0-7-setup-tukio-messaging-nats-jetstream (2026-05-10)

- **D1** — `NatsJetStreamClient.subscribe()` retourne void sans handle de stop — aucun moyen d'arrêter la consumer loop ou de détecter son arrêt silencieux. Architectural decision Sprint 0 ; à adresser avec lifecycle management des consumers (Epic 5+, notification-svc).
- **D2** — LISTEN failure silencieuse : aucun log/metric si `LISTEN tukio_outbox_new` échoue au boot — relay tombe en polling-only sans signal opérateur. Story 0.12 (structured logging + Alertmanager).
- **D3** — DLQ = status `failed` en DB uniquement, pas un subject NATS actif — AC4 et commentaire TODO code explicitent que DLQ routing (stream `tukio.dlq`) est out-of-scope Story 0.7. Story 0.12.
- **D4** — `notifyPool` optionnel : si wired, `pg_notify` fire avant commit tx externe → spurious wakeups (pas de corruption, relay SKIP LOCKED couvre). Code path mort car `OUTBOX_NOTIFY_POOL` jamais wired actuellement. À corriger si pool activé.
- **D5** — Race onModuleDestroy : pollTimer peut firer entre start de destroy et clearInterval — fenêtre ~0ms en Node.js event loop, SKIP LOCKED + NATS drain couvrent la cohérence. Très faible impact.
- **D6** — DB password visible dans options du module si `DEBUG=*` NestJS — convient Sprint 0 (pas de prod). Story 0.12 secrets management (Vault / K8s sealed secrets).

## Deferred from: code review of 0-8-setup-tukio-auth-backend-frontend (2026-05-10)

- **D-F1** — Marker cookie `tukio-session-active` non-validé côté frontend (anyone can set marker) — déférée : mitigée par enforcement JWT côté backend (cookie HttpOnly access-token est source-of-truth, marker = hint UX). Re-revue si gateway-api change le contract Story Epic 1+.
- **D-F2** — `prom-client` Counter au module-load level (collision risk hot-reload) — déférée : pattern figé Story 0.7 (mêmes specs ont passé code review). Fix global si problème survient en CI.
- **D-F3** — WebAuthn / FIDO2 / `mfa` amr non accepté (TOTP-only) — déférée : MVP TOTP-only par décision Story 1.7. Ré-évaluer V2 quand WebAuthn est mis en production.
- **D-F4** — `<AuthProvider>` config change ignoré post-mount (multi-tenant scenario) — déférée : multi-tenant pas au scope MVP.
- **D-F5** — `hasSessionCookie()` exact match `=1` — déférée : cohérent avec set côté gateway-api Story Epic 1+.
- **D-F6** — SSR hydration mismatch (flash unauth content au mount) — déférée : UX-only, à traiter avec Suspense + skeleton dans Story Epic 1+ (gateway-api SSR-safe cookies).
- **D-F7** — `jwks-rsa` mock test pas de cache — déférée : tests E2E uniquement, ré-évaluer Story 0.9 (testcontainers Keycloak réel).
- **D-F8** — Public-key rotation race window — déférée : Keycloak grace period standard, doc Story 1.1.
- **D-F9** — Infinite redirect loop quand `loginRedirectUri` matches `protectedPaths: ['/']` — déférée : edge case opérationnel, à wirer Story Epic 1+ avec Keycloak réel.

## Deferred from: dev-mode runtime fix for identity-svc (2026-05-10)

> **Contexte** : `pnpm dev` cassait sur identity-svc avec `Cannot find module dist/main`. Cause profonde : path mapping `@tukio/*` → `./packages/*/src` (sources TS) + `package.json` `exports` qui pointent vers TS sources → Node ne peut pas exécuter au runtime. Fix appliqué : NestJS webpack mode + custom `webpack.config.js` qui (a) ajoute `extensionAlias: { '.js': ['.ts', '.js'] }` pour nodenext imports, (b) bundle les `@tukio/*` packages au lieu de les externalize. dist/main.js redevient flat. Tests + builds OK.

- **W1** — Story 0.2 D8 (build packages first + dist/ exports) reste **non résolu**. Le webpack bundle est un workaround : il ne propage pas les benefits d'ESM tree-shaking entre packages, et chaque service va dupliquer le bundle de @tukio/* dans son dist/main.js. À résoudre en Story 0.10 (Docker Compose) ou Story 0.11 (CI) — quand on aura plusieurs services réels en prod.
- **W2** — Les 9 autres services NestJS (gateway-api, catalog-svc, booking-svc, payment-svc, order-svc, messaging-svc, notification-svc, review-svc, media-svc) tournent encore avec `nest start --watch` (sans webpack) **uniquement parce qu'ils sont des scaffolds vides** ne consommant pas `@tukio/*` packages. Dès qu'ils commenceront à consommer `@tukio/contracts`, `@tukio/auth`, `@tukio/messaging` (Stories Epic 2-7), ils casseront avec le même symptôme. Migration : copier `webpack.config.js` + `nest-cli.json` updates + scripts `package.json` d'identity-svc lors du scaffolding via `replicate-pretre-structure.sh` (Story 0.6 Task 12).
- **W3** — `webpack.config.js` actuel d'identity-svc inline une regex `/^@tukio\//` pour détecter les workspace packages. À factoriser dans un fichier partagé `webpack.tukio.config.js` au workspace root quand W2 sera traitée.
- **W4** — Mode debug Node DevTools (`--inspect`) a été préservé dans `start:debug` mais pas re-testé. À valider quand on aura un cas concret de debug runtime.

## Deferred from: code review of 0-9-setup-tukio-api-client-i18n-client-testing (2026-05-11)

- **D-09-1** — AC17 migration Story 0.7 chaos test (`it.skip` → `it()` real testcontainer) + Story 0.8 e2e (nock JWKS mock → real Keycloak testcontainer). Infrastructure shipped Story 0.9 (`startNatsContainer`, `startKeycloakContainer`). Migration deferred Story 0.11 quand le tag `@nightly` séparera fast (mocks) / slow (testcontainers) tests CI.
- **D-09-2** — `formatPercent` doesn't validate `value > 1` (caller error : passe `5` au lieu de `0.05`). Caller-responsibility, documenter via JSDoc + types stricter. Pas de fix code.
- **D-09-3** — `meilisearch.helper.ts` utilise `version: 'latest'` (CI flake risk si Meilisearch ships breaking minor). Pin à v1.10 explicite lors de Story 0.10 (Docker Compose pinning).
- **D-09-4** — `nats.helper.ts` `client.drain()` après pause peut laisser connection ouverte. Best-effort cleanup OK pour le MVP, raffiner usage chaos-test réel Story 0.11.
- **D-09-5** — `useCurrentLocale` throws inside React render (no Error Boundary required). Stories Epic 1+ wirent Error Boundary niveau app. Pattern documenté dans `@tukio/i18n-client/README.md`.

## Deferred from: code review of 0-10-docker-compose-dev-local-bootstrap-scripts (2026-05-13)

- **D-10-1** — Keycloak healthcheck dépend du whitespace JSON littéral (`grep -q '"status": "UP"'`). Fragile mais fonctionne ; refactor attendra que Keycloak 26+ offre un endpoint plus standardisé. [`infra/docker-compose/docker-compose.dev.yml:81-85`]
- **D-10-2** — `KC_HOSTNAME=localhost` bake une assumption host-only. Tokens issued avec `iss: http://localhost:8080`. Si un service backend doit tourner en container (Story 0.12+), JWT validation casse sur mismatch. Intentionnel pour le workflow Sprint 0 (services en host via `pnpm dev`). [`infra/docker-compose/docker-compose.dev.yml:69`]
- **D-10-3** — Pre-existing identity-svc unit-test bug : `apps/identity-svc/jest.config.ts` manque le mapping `^@tukio/contracts/exceptions/domain$` (présent dans `test/jest-e2e.json`). Vérifié sur baseline `develop`, même échec — pas une régression Story 0.10. Hors scope ; à fixer en code review identity-svc dédiée.
- **D-10-4** — Race concurrente bootstrap-databases / bootstrap-keycloak-realm (deux devs ou dev+CI sur même DB). Pas réaliste en pratique ; advisory_lock à ajouter si CI/CD parallélise un jour.
- **D-10-5** — `kcadm.sh update realms/{name}` patche les fields fournis mais ne supprime pas les fields retirés du JSON local. Quirk Keycloak documenté ; idempotence partielle.
- **D-10-6** — `$PSQL` interpolé non-quoté dans bootstrap-databases.sh. Fonctionne pour les paramètres connus ; refactor en bash array serait plus propre. [`infra/scripts/bootstrap-databases.sh:34`]
- **D-10-7** — Migration Ctrl-C laisse état half-applied. Concern TypeORM-level (pas de migrations transactionnelles all-or-nothing natives), pas réglable côté script.
- **D-10-8** — README `Conventional commits` indentation potentiellement régressée par le diff Story 0.10. À re-vérifier visuellement, cosmétique. [`README.md` Conventions]
- **D-10-9** — `seed-categories.ts` UPDATE service_types est destructif (clobbers manual additions dev). Acceptable pour un seed dev ; `array_cat` + `DISTINCT` serait plus respectueux mais YAGNI MVP. [`infra/scripts/seed-categories.ts:168-171`]
- **D-10-10** — `echo $REALM_JSON | kcadm -f -` SIGPIPE truncation possible si kcadm fail-fast. Refactor en mktemp file serait propre ; pas observé en pratique. [`infra/scripts/bootstrap-keycloak-realm.sh:64-72`]
- **D-10-11** — `COMPOSE_PROFILE` env override non validé contre les profils déclarés. Si typo, stack démarre incomplet. Defensive coding à ajouter Story 0.11. [`infra/scripts/run-chaos-tests.sh:11-12`]
- **D-10-12** — `tukio_test_postgres` collision avec stack pré-existant `pnpm docker:test:up`. CI runners fresh, dev rare ; warning serait nice-to-have.
- **D-10-13** — Pas de doctor script pour détecter un `.env.local` Story 0.6 obsolète (`tukio_identity_user`/`changeme`). Le `pnpm dev` échouera de manière confuse pour ces devs. À ajouter Story 0.11 (CI doctor) ou Story 1.10.
- **D-10-14** — `KCADM` string interp re-exec `docker exec` à chaque iter (~20 fois). Optimisation mineure (~200ms total) ; refactor en function avec one-time check possible. [`infra/scripts/bootstrap-keycloak-realm.sh:24`]
- **D-10-15** — `tmpfs:512m` pour Postgres test peut OOM sur runners CI petits (< 4 GB RAM). Documenter min-RAM dans Story 0.11 README CI. [`infra/docker-compose/docker-compose.test.yml:21-22`]
- **D-10-16** — Admin TOTP MFA non effectivement enforcé pour `tukio-admin`. Conditional OTP élevée à REQUIRED **realm-wide** (pas per-client) + sans seeding admin user avec required-action `configure-totp`, les admins peuvent toujours se connecter sans TOTP. Spec FR9 + NFR12 partiellement délivré. **→ Story 1.7** wire auth flow override per-client + admin user seeding. [`infra/scripts/bootstrap-keycloak-realm.sh:213-225`]
- **D-10-17** — Wildcard redirect URI `https://*.tukio.one/*` committé dans `realm-export.json` (consommé par Story 0.9 testcontainers). Vecteur de phishing si subdomain compromis. **Kept intentionnellement** pour preview envs Vercel (`pr-*.tukio.one`) + staging. **→ Story 0.12** override prod plus strict via Phasetwo. [`infra/scripts/bootstrap-keycloak-realm.sh:128`]
- **D-10-18** — `seed-categories.ts` service_types curated divergent du spec littéral (pop-up tents sans lighting/dismantling, linens sans setup, dance-floors avec dismantling). **Kept curated** comme MVP réaliste. **→ Story 3.1** valide les service_types canoniques avec product owner. [`infra/scripts/seed-categories.ts:60-220`]

## Deferred from: code review of 0-11-ci-github-actions-pipeline (2026-05-14)

- **DF1** — Dockerfile `pnpm deploy --legacy /deploy` may miss runtime files (`nest-cli.json`, `.env.example`, `tsconfig.<svc>.json`). Validated locally for identity-svc (462 MB image, healthcheck OK), but full coverage on the 9 other services pends live Story 0.12 K8s rollout. Re-validate during 0.12.
- **DF2** — `HEALTHCHECK curl /health` baked into all 10 Dockerfiles, but only identity-svc currently implements `/health` (Story 0.8). Other services will add it in their Epic 1+ stories. Containers may stay `unhealthy` in K8s until each service ships its endpoint.
- **DF3** — `lighthouse-ci.yml` does not yet emit a PR comment when LCP/CLS regresses > 10 % vs `main` (AC2 last sub-bullet). Dev Notes mark this as V1+ extension; reopen as a follow-up story when historical Lighthouse baselines stabilise (LHCI Server self-hosted, post-MVP).
- **DF4** — `tukio/no-hardcoded-text` has no autofix (AC3 said "best-effort"). Add `suggest` for `useTranslations()` wrapping in a future iteration when typed `t()` patterns are settled.
- **DF5** — `deploy-staging.yml` + `deploy-production.yml` are placeholders per Story 0.11 scope; Story 0.12 finalises ArgoCD wiring. The `workflow_run` chain from Build Images means frontend-only merges currently skip the staging trigger — to be revisited in 0.12 with separate frontend deploy paths or unified `push: main` trigger.

## Deferred from: code review of 0-12-digitalocean-droplets-docker-compose (2026-05-15)

- **D-12-1** — Frontend `depends_on: service_started` (pas `service_healthy`) pour gateway-api dans `apps.prod.yml`. Pre-existing : gateway-api n'a pas de healthcheck avant Epic 1. `unless-stopped` couvre le gap MVP.
- **D-12-2** — `docker exec tukio-apps-caddy-1` nom de container auto-généré, fragile si project name change. MVP stable ; à réviser si renommage.
- **D-12-3** — gateway-api partage la DB `tukio_identity` avec identity-svc (non documenté en ADR). Décision architecturale à formaliser dans un ADR dédié avant Epic 1.
- **D-12-4** — Credentials DB/Meili exportés comme env vars dans le heredoc SSH (visible via `docker inspect`). Contrainte MVP sans Vault/Doppler. À traiter V1+ avec secret manager.
- **D-12-5** — Smoke test fires avant que les migrations DB soient appliquées → faux green possible. Aucune migration TypeORM en Sprint 0 ; à revisiter quand les migrations Epic 1 seront wired dans le deploy workflow.

## Deferred from: code review of 0-14-merge-public-customer-apex-tukio-one (2026-05-15)

- **AUTH_GATED ne couvre pas cart / checkout** — À mettre à jour lors de l'implémentation de Story 4.3 quand les routes `/fr/cart` et `/fr/checkout` seront ajoutées sous `(authenticated)/`.
- **Cookie acquisition : attributs perdus lors du forward auth-gate → redirect response** — `acqResponse.cookies.getAll()` retourne `{name,value}` sans `Domain`/`Max-Age`/`SameSite`. Pattern pré-existant sur le branch i18n. Impact : cookie acquisition devient session-only sur les redirections auth-gate. À corriger en refactorisant le transfert de cookies (utiliser `ResponseCookies` API directement plutôt que `getAll()`).
- **app.tukio.one redir 301 downgrade POST** — 301 peut changer POST en GET. Aucun endpoint POST frontend actuellement. Remplacer par 308 si des intégrations POST apparaissent sur `app.tukio.one` avant expiration du record DNS (~2026-11).
- **Caddy : retirer le bloc app.tukio.one quand DNS supprimé (~2026-11)** — Le bloc `app.tukio.one { redir ... }` tentera un renouvellement cert ACME HTTP-01 toutes les 60 jours. À supprimer du Caddyfile + redéployer quand le record DNS A est retiré de Squarespace.
- **build-images.yml : liste services en 3 exemplaires** — shell string + case pattern + JS Set doivent rester synchrones. Refactoriser vers source unique si le nombre de services augmente.
- **Story 4.3 spec : chemins apps/customer/ stale + logique addLine** — Toutes les références `apps/customer/` dans le corps de la story 4.3 (chemins fichiers, code Zustand) doivent être récrites lors du dev de Story 4.3 en suivant le bandeau ADR-016 en tête de fichier.

## Deferred from: code review of 0-13b-frontend-images-build-deploy (2026-05-15)

- **Caddy reload race — 502 window on first deploy** — `docker compose up -d` est non-bloquant ; le reload Caddy peut arriver avant que les containers frontends écoutent. Ajouter un retry loop ou un `docker compose wait` pour les frontends avant le reload.
- **Caddy container name `tukio-apps-caddy-1` hardcodé** — si `COMPOSE_PROJECT_NAME` change, l'exec échoue silencieusement. Remplacer par `docker compose -f apps.prod.yml exec caddy caddy reload ...`.
- **Caddyfile-only push ne déclenche pas de deploy** — `infra/docker-compose/Caddyfile` absent des `paths:` filter de `build-images.yml`. Un commit Caddyfile seul nécessite un `workflow_dispatch` manuel. Ajouter `infra/docker-compose/**` aux paths triggers si besoin d'auto-deploy.
- **Smoke test vérifie uniquement `api.tukio.one/health`** — les frontends (public, seller, admin) peuvent avoir crashé sans déclencher de rollback. Ajouter une vérification `curl https://tukio.one/` dans le smoke post-deploy.
- **Admin HEALTHCHECK root → 401/403 possible quand auth-gate active** — prévoir une route `/healthz` ou vérifier `/_next/static/` pour le healthcheck Dockerfile admin.
- **`webpack.tukio.cjs` absent du template frontend dans gen-dockerfiles.sh** — inconsistance avec le template backend. Pas de risque immédiat (Next.js n'utilise pas ce fichier), mais à surveiller si des packages workspace utilisent webpack au build.
- **sleep 20 insuffisant pour Next.js cold start CI** — remplacer par un poll (`until curl ... ; do sleep 5; done`) avec timeout de 60s.

## Deferred from: code review of 1-2a-contracts-identity-domain-usecase (2026-05-15)

- **`UserProfileTypeormRepository.runInTransaction` stub throws "Story 1.2b"** [`apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts:47`] — Real impl (TypeORM QueryRunner + shared with `OutboxPublisher` Story 0.7) is the explicit core deliverable of Story 1.2b. Production controllers must NOT be wired against this repository until 1.2b ships, else any register-customer request 500s. Add a boot-time assertion or controller gate before 1.2b lands.
- **`TransactionContext.userProfileRepo` typed as `Pick<…, 'save'>` limits in-transaction reads** [`apps/identity-svc/src/domain/ports/user-profile.repository.port.ts:11`] — Deliberate narrowing to prevent leaky re-reads, but it means concurrent `register()` can't atomically re-check email uniqueness inside the txn. Race-safety today relies on Keycloak's unique-email constraint + Postgres unique index (1.2b migration). If a future scenario needs in-txn `findByEmail`, extend the `TransactionContext` shape in 1.2b alongside the real impl.
- **`UserProfileMapper.toEntity` drops the 5 new aggregate fields on save (lossy round-trip)** [`apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts:55-73`] — Mapper still on Story 0.6 shape. The new `status`/`emailVerified`/`marketingOptIn`/`acceptTerms`/`acceptTermsAt` fields are silently dropped on `save()`. This MUST be sequenced as part of Story 1.2b's migration + mapper extension, BEFORE any controller wired to `RegisterCustomerUseCase` is enabled. Verify with an integration test that saves + reloads + asserts equality of the new fields.

## Deferred from: code review patch E3 of 1-2a (2026-05-16)

- **`acquisition_content` + `acquisition_term` DB columns + migration + mapper extension** — the contract layer (Zod DTO + AcquisitionContext type + event JSON schema) and domain layer (RegisterAcquisitionInput + UserProfile.register factory + use case event populate) all carry the two new fields end-to-end as of 1.2a. Story 1.2b must add the columns to `user_profiles` (alongside the 5 other new fields from `1715230000000-AddCustomerRegistrationFields`) and update `UserProfileMapper.toEntity`/`toDomain` to round-trip them. Without this, the persisted row drops both UTM fields silently — the published event still carries them (good for analytics V1 / Story 7.5 multi-touch attribution) but BI joins against the `user_profiles` table will see nulls.

## Deferred from: code review of 1-2b (2026-05-16)

- **Role cache TTL + invalidation** [`apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.ts:104`] — Process-lifetime `Map<string, RoleRep>` cache without TTL. If realm rebootstrap (Story 1.1 re-import, ops mistake) recreates the role with a new id, cached lookup yields stale id → `addRealmRoleMappings` 404 → pod throw until restart. Acceptable for MVP (realm rebootstrap rare). V1+ : 5min TTL + refresh-on-404 retry.
- **`publicBaseUrl` captured at module-init time in `REGISTER_CUSTOMER_USECASES_PROXY` factory** [`apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts:60`] — `config.getPublicBaseUrl()` evaluated once at boot. Env reload (Doppler push / secret rotation) leaves stale verify-URL until pod restart. Acceptable for MVP (no hot-reload story). V1+ : pass `() => config.getPublicBaseUrl()` thunk into use case constructor.

## Deferred from: code review of 1-2d-frontend-signup-middleware-e2e-observability (2026-05-16)

- **First-touch race condition entre tabs simultanés** — Deux tabs avec UTM différentes en parallèle peuvent racer sur l'écriture du cookie `tk_acq` ; la cohérence avec `tukio-acquisition` (multi-touch tracking) peut diverger. Acceptable pour MVP per K-04 first-touch wins "best effort". Story 7.5 multi-touch attribution pourra ajouter une stratégie déterministe.
- **`document.cookie` non-déterministe avec deux `tk_acq` cross-domain** — Si deux cookies `tk_acq` existent (un sur apex `.tukio.one`, un sur subdomain), `.find()` sur `document.cookie.split('; ')` est implementation-defined. `Domain=.tukio.one` atténue ; risque réel uniquement si un subdomain rogue écrit son propre `tk_acq`. À surveiller si V1+ ajoute des subdomains pro/admin avec leur propre acquisition tracking.
- **Locale split fallback "fr" pour paths malformés** [`apps/public/src/middleware/auth-gate.ts:35,45`] — `pathname.split('/')[1] ?? 'fr'` ne valide pas que le candidat est dans `LOCALES`. Defense-in-depth ; aucun path actuel sans locale prefix ne tombe dans le gate. Si Story 7.2 ajoute des paths neutres (`/sitemap.xml`, `/api/*`) le fallback "fr" devra être audité.
- **`createTukioApiClient` + `QueryClient` re-instantiated per server render** [`apps/public/src/app/[locale]/auth/sign-up/page.tsx:431`] — Fresh instances par request ; à chaque navigation SPA le cache TanStack est perdu. Refactor architecture : hoist `QueryProvider` + `ApiClientProvider` au `[locale]/layout.tsx`. Hors scope 1.2d ; impact perf modeste pour le MVP (form unique). À reprendre quand plusieurs pages frontend partagent des queries (Stories 3.x catalog + 4.x bookings UI).
- **Convention subpath casing `@tukio/ui/form-field` vs `@tukio/ui/components/Button`** — Les deux notations marchent (exports déclarés dans `packages/ui/package.json`) mais la convention `.agents/context/code-style.md` montre PascalCase sous `/components/`. À régler globalement dans une story de cleanup convention pour éviter de patcher au gré des PRs.
- **File List story 1.2d manque `(authenticated)/layout.tsx`** — Le diff inclut ce fichier nouveau mais il n'est pas listé dans la section `### File List` de la story 1.2d. Paperwork ; à corriger à la passe finale d'update du story file post-merge.

### Decisions from 1-2d code review escalated to defer (2026-05-16)

- **AC8 metrics wiring → Story 1.10** — Les modules `registration.metrics.ts` (gateway-api) et `keycloak.metrics.ts` (identity-svc) sont créés mais leurs counters/histograms ne sont jamais incrémentés (controllers + use-cases pas instrumentés) et aucun endpoint `/metrics` Prometheus n'est exposé. Story 1.10 (`identity-svc-pretre-implementation` final) doit wirer l'instrumentation complète + exposer `/metrics` sur les deux services. Dashboard Grafana `identity-registration.json` shippé ne renverra des séries non-vides qu'après ce wiring.
- **AC8 Slack alert + Prometheus AlertingRule → infra ops phase** — Dépend du wiring metrics (defer précédent) ET du déploiement Prometheus + Alertmanager + Slack receiver sur DO droplet (pas encore en place). À ship en story infra dédiée quand staging Prometheus est up (probablement post-Sprint 1).
- **AC7 Playwright execution + CI workflow update → Ismael run avec docker:up** — Specs Playwright (9 tests) + helpers `e2e/helpers/test-user.ts` livrés mais non exécutés (require `pnpm docker:up` + `KEYCLOAK_CLIENT_SECRET_TUKIO_API` env var). Cohérent avec accord 1.2b/1.2c (Ismael run e2e/integration après livraison code). `.github/workflows/e2e.yml` à updater dans la même passe pour CI parallel chromium-fr + chromium-en. Story 1.2d marquée done sur le code ; validation AC7 "9/9 + axe-core 0 critical + NFR48 p90 ≤ 30s" à valider hors-revue.
- **HMAC signature cookie `tk_acq` → ré-évaluer Story 7.6 (referral codes foundation)** — Cookie acquisition `tk_acq` est `httpOnly: false` (spec, lu par hook JS) et non-signé ; un attaquant peut forger `?utm_source=partner_evil` pour pollution analytics. Modèle de confiance MVP accepté car pas d'affiliation monétaire pré-Story 7.6 ; risque borné, atténué par normalisation source à l'enum `ACQUISITION_SOURCES` + clamp longueur (patch P2 du code-review 1.2d). Réévaluer signature HS256 + revalidation gateway quand Story 7.6 introduit la dimension financière des referrals.

## Deferred from: code review of 1-3d-v2-conversion-wizard-seller-mvp-pro-onboarding (2026-05-17)

- **W1** — `RegisterProUseCase` sentinel conversion invalides (`dateOfBirth: ''`, `legalForm: ''`, `vatStatus: ''`, `categories: []`, `serviceZone: { city: '', radiusKm: 0 }`) — flow supersédé, pas de route active. Nettoyer en V1+ ou ajouter un guard `throw new Error('RegisterProUseCase is deprecated')`.
- **W2** — `KeycloakUserNotFoundError` classe déclarée dans le port mais jamais lancée — dead code. Usecase lance `ExternalServiceException` à la place. Supprimer ou utiliser en V1+.
- **W3** — `ProConversionFields.legalForm` et `vatStatus` typés `string` (pas les union types `LegalForm`/`VatStatus` de contracts) — couplage faible au domaine. Renforcer en V1+.
- **W4** — Code d'erreur `IDENTITY-EMAIL-NOT-VERIFIED-001` suit le pattern `DOMAIN-PHRASE-NNN` au lieu de `DOMAIN-WORD-NNN` — incohérence avec les autres codes. Déféré car brisant de changer maintenant.
- **W5** — `existingAttributes` snapshot Keycloak pris à step 1, utilisé à step 8 après transaction DB — race condition si attributs KC modifiés entre-temps. Best-effort acceptable pour MVP.
- **W6** — Transaction atomicity repose sur `TransactionContext` implicite pour que `txn.userProfileRepo` partage le même `EntityManager` que `proProfileRepo.runInTransaction` — architecture correcte mais sans garantie compile-time. Ajouter un contrat explicite en V1+.
- **W7** — Age check : `Date.UTC` comparé à `Date.now()` pour "not in future" peut avoir une différence de 1 jour en cas de soumission à minuit UTC. Acceptable MVP.
- **W8** — `ProConversionWizard.handleContinue` utilise `document.getElementById('step-identity-continue')?.click()` — couplage DOM fragile. Refactorer avec `useImperativeHandle` en V1+.
- **W9** — `requiresEmailVerification: z.literal(false)` défini dans 1.3a-bis scope au lieu de 1.3b-bis (violation de sequencing decision D1). Sans impact runtime car même branch.

## Deferred from: dev of 1-4b-gateway-api-endpoints-usecases-csrf-e2e (2026-05-18)

- **D1 (1.4b) — Redis replay nonce store for `state.requestId`** — Detect state JWT replay attacks within the 10-min TTL window. Currently the state JWT signature + pkce-cookie binding (`originalState === state`) already mitigate the attack window. Move to Story 1.4d or post-MVP defense-in-depth pass.
- **D4 (1.4b) — Real NATS `LoginAuditEventPublisher` adapter** — Replace `NoopLoginAuditEventPublisher` (logs to pino) with a NATS-backed adapter using `@tukio/messaging/nats/client`. Wire `NatsJetStreamModule` into `app.module.ts` with conditional boot (catch connection failures so gateway-api still boots if NATS is down). Spec marks the `identity.user.logged-in.v1` event as fire-and-forget audit telemetry → losing one on a NATS outage is acceptable. Defer to Story 1.4d (observability sprint already owns NATS metrics + Grafana panels).
- **D-e2e (1.4b) — Keycloak-backed e2e cases** (callback happy path with real OAuth code exchange + refresh rotation + Keycloak DOWN scenarios) — Testcontainer fixture (`test/auth/keycloak-testcontainer.fixture.ts`) is ready but actual flows require minting authorization codes outside a browser. Unit suite covers logic exhaustively (16 cases for `HandleCallbackUseCase` alone). Defer to Story 1.4d which already owns chaos + observability coverage.

## Deferred from: code review of 1-4b-gateway-api-endpoints-usecases-csrf-e2e (2026-05-18)

- **D1-review (1.4b) — Unverified JWT for admin redirect routing** — `decodeJwt` (no signature check) in `HandleCallbackUseCase.extractJwtClaims` drives the post-login redirect decision including admin routing. Pre-existing architectural constraint: `KeycloakJwtGuard` verifies signature on all subsequent API calls; TLS + PKCE mitigates MITM at the callback. Move full token verification at callback to Story 1.4d if deemed necessary.
- **D2-review (1.4b) — Parallel login overwrites pkce-state cookie** — Inherent limitation of single-cookie PKCE: two simultaneous login flows from the same browser overwrite each other's JWE cookie, causing a confusing `AUTH-INVALID-STATE-001` 400 error. Redis nonce store (already deferred as D1 from Story 1.4a) would fix. Acceptable for MVP single-device use pattern.
- **D3-review (1.4b) — revokeSession axiosRetry could block under KC outage** — Latency concern: 3 retries × 9s = 27s worst-case blocking on `POST /v1/auth/logout`. Not a correctness bug. Add an explicit per-call timeout to `revokeSession` in Story 1.4d or infra ops.
- **D4-review (1.4b) — ipHash spoofable via X-Forwarded-For** — `@Ip()` returns proxy IP if `trustProxy` is not enabled on the Fastify adapter. Infrastructure-level fix (set `trustProxy` when behind Caddy/Nginx). Not a correctness bug.
- **D5-review (1.4b) — Refresh token cookie path `/v1/auth` fragile with proxy prefix** — If gateway-api is mounted behind a proxy with a path prefix (e.g. `/api`), the browser won't send the refresh-token cookie. Infrastructure concern; fix via Caddy/Nginx rewrite rules if needed.
- **D6-review (1.4b) — ThrottlerModule.forFeature not used** — Spec called for `ThrottlerModule.forFeature` scopes; implementation uses per-route `@Throttle({ default: … })` overrides which achieve identical rate-limit values. Behaviour equivalent.
- **D7-review (1.4b) — getCsrfTimingSafe() absent from EnvironmentConfigService** — AC8 spec called for this method but no code path uses it and the CsrfGuard always uses `timingSafeEqual`. Low-risk spec wording gap.
- **D8-review (1.4b) — safeEqual length short-circuit leaks 1 bit** — CSRF guard returns `false` early when token lengths differ instead of comparing a dummy buffer. Fixed-length base64url tokens (always 43 chars for `randomBytes(32).toString('base64url')`) make this theoretical. Documented acceptable for MVP.

## Deferred from: code review of story-0.15 (2026-05-21)

- **W1-review (0.15) — Locale-prefixed `/fr/api/*` not in TECH_BYPASS** — `coming-soon-gate-decision.ts` TECH_BYPASS regex only matches `^/api/`, not locale-prefixed. No current locale-prefixed API routes exist; future RSC payload endpoints with locale segment could be silently rewritten.
- **W2-review (0.15) — POST/PUT/DELETE rewritten to GET coming-soon page** — Middleware rewrites all HTTP methods. Stale form submissions during pre-launch return coming-soon HTML instead of parseable error. Acceptable since pre-launch traffic is ~100% GET.
- **W3-review (0.15) — `x-next-intl-locale` unconditional override** — `coming-soon-gate.ts` unconditionally sets the header from URL-derived locale, overriding any upstream proxy value. No upstream proxy currently sets this.
- **W4-review (0.15) — `decision.kind` not exhaustively narrowed in TS** — Wrapper only early-returns for `'pass'`; a future `ComingSoonDecision` variant would crash accessing `decision.locale`.
- **W5-review (0.15) — `safeLocaleFromPath('//foo')` returns DEFAULT_LOCALE silently** — Double-slash URLs normalised by Next.js upstream.
- **W6-review (0.15) — Whitelist regex `[a-z]{2}` permissive** — Invalid locales like `/zz/coming-soon` pass through whitelist; layout's `hasLocale()` cleanup via `notFound()` works as designed but loose.
- **W7-review (0.15) — Seller layout missing `hasLocale()` guard before `setRequestLocale`** — Pre-existing Sprint 0 condition. Seller layout never validated locale param before `setRequestLocale(locale)` call.
- **W8-review (0.15) — Rewrite drops query string (UTM/reset-tokens/OAuth state)** — Pre-launch tradeoff acknowledged in runbook section 4. Affects deferred deep-links e.g. password-reset URLs sent during testing window.
- **W9-review (0.15) — Sitemap missing hreflang alternates** — Story 0.21 scope (spec explicit). Pre-launch sitemap entries treated as duplicates across locales.
- **W10-review (0.15) — Hardcoded `https://tukio.one` base URL in robots.ts + sitemap.ts** — Story 0.21 will introduce `NEXT_PUBLIC_SITE_URL` indirection. Staging deployments emit prod sitemap reference.
- **W11-review (0.15) — No CSP/Cache-Control headers on rewrite response** — Broader caching strategy needed. CDN may serve stale coming-soon HTML for paths that switch to Epic 1 content post-launch.
- **W12-review (0.15) — Sitemap noindex contradiction** — `coming-soon/page.tsx` has `robots:{index:false}` but sitemap advertises it at priority 1.0. Story 0.17 + 0.21 will resolve by shipping final content + flipping robots:true.
- **W13-review (0.15) — Cleanup PR section 3 of runbook incomplete** — Missing references to layout `setRequestLocale` edits + apps.prod.yml env block. Update during cleanup PR sprint.
- **W14-review (0.15) — Coming-soon noindex propagates to rewritten URL** — `/fr/auth/sign-up` rewritten during pre-launch inherits noindex from coming-soon page; Google cache may persist after flag flip. Story 0.21 SEO foundation will flip robots policy.
- **W15-review (0.15) — Apex `/devenir-pro` whitelist orphans seller `/devenir-pro` final destination** — Apex placeholder is whitelisted; placeholder comment says "final landing on seller.tukio.one/devenir-pro". Story 0.18 will deliver the seller version with apex CTA cross-zone redirect.
- **W16-review (0.15) — Strict flag parsing fail-open posture** — `process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'` means typos (`'TRUE'`, `'1'`, whitespace) silently disable the gate. By spec AC1 design.
- **W17-review (0.15) — UTM cookie dropped during entire pre-launch window** — `acquisitionCookieMiddleware` runs after gate, so rewrite responses skip cookie set. Spec design (Story 0.20 landing form is the acquisition path).
- **W18-review (0.15) — Two parallel `decideComingSoon` implementations (apex + seller)** — By spec design; whitelist contents + rewrite target differ between apps. Drift risk acknowledged.
- **W19-review (0.15) — `setRequestLocale` only in layouts, not in pages** — Placeholders don't use i18n; Stories 0.17/0.18/0.19 will add per-page `setRequestLocale` when pages start consuming `getTranslations`.
- **W20-review (0.15) — Tests use literal FR strings → break post-Story 0.17** — Test selectors coupled to placeholder copy. Story 0.17 will rewrite tests with stable selectors (`data-testid`).
- **W21-review (0.15) — Apex AC13 reversibility test doesn't submit form** — Only checks heading + 2 input labels visible. Stories 1.2b-d convention "specs livrées + non-exécutées" — Ismael runs manual smoke.
- **W22-review (0.15) — Seller robots `Allow: ['/']` indexes URLs rewritten as duplicate** — Story 0.21 SEO foundation will add canonical tags + scope crawl exclusions for seller subdomain.

## Deferred from: code review of 0-16-design-system-atoms-pre-launch (2026-05-21)

- **W23-review (0.16) — Copyright FR hardcodé dans Footer minimal default** — `© tukio.one · ${year} · Made in Loire-Atlantique` est un fallback FR dans `@tukio/ui`. Stories 0.17-0.19 overrideront toujours via prop `legal={t('footer.legal')}`. Fallback de sécurité, jamais utilisé en production bilingue.
- **W24-review (0.16) — `role="banner"` redondant sur SiteHeader `<header>`** — `<header>` hors sectioning content a le rôle implicit `banner`. Explicit override inoffensif. À nettoyer si règle ESLint `jsx-a11y/no-redundant-roles` est ajoutée.
- **W25-review (0.16) — Nom `Block` générique dans exports EditorialPageShell** — Subpath imports `@tukio/ui/patterns/EditorialPageShell` protège des collisions. Si un 2e `Block` apparaît dans le design system, renommer en `EditorialBlock`.
- **W26-review (0.16) — `key={item.href}` dans SiteHeader navItems + Footer inlineLinks** — Si 2 items partagent un href, React drop silencieusement l'un. Consumer doit garantir uniquicité des hrefs passés.
- **W27-review (0.16) — SiteHeader pas de gestion overflow nav mobile (<768px avec 3+ items)** — Wrapping potentiel sur 320-375px. Hamburger/drawer = post-launch Epic 1+.
- **W28-review (0.16) — `maxWidth` prop sans validation (0 ou négatif collapse layout)** — TypeScript `number` ne garantit pas les positifs. Consumer responsibility. Branded type `PositiveInt` = over-engineering MVP.
- **W29-review (0.16) — `globals.css` `@source` ne scanne pas `../patterns/`** — Classes Tailwind des patterns (SiteHeader, Footer, EditorialPageShell) dépendent du bundler Next.js pour la résolution via symlink. Risque si packaging change. Monitorer si pnpm pack ou Storybook est ajouté.
- **W30-review (0.16) — Pill `icon` sans mécanisme d'accessible label** — `aria-hidden="true"` sur le wrapper icon = décoratif par design. Si un icône doit être sémantique, ajouter prop `iconLabel?: string` → V1+.
- **W31-review (0.16) — Multiples navItems `active: true` possibles par type** — Viole ARIA `aria-current="page"` single-element constraint. Active state doit être calculé par le consumer (Next.js `usePathname()`).
- **W32-review (0.16) — Pill contraste ratio non vérifié avec Lighthouse** — axe-core en jsdom ne compute pas les couleurs CSS custom properties. Variants `cream` et `charcoal` à vérifier en Story 0.17 (Lighthouse + DevTools Accessibility panel).
- **W33-review (0.16) — `children: ReactNode` dans h1/h2 (EditorialPageShell + Block)** — Block-level JSX dans h1/h2 est invalid HTML. Spec permet ReactNode pour composition `<em>`. Consumer responsibility de n'utiliser que des inline elements.
- **W34-review (0.16) — `animations.ts` token `pulse` string duplique la valeur CSS var** — Deux sources de vérité: `animations.ts` + `theme.css`. Pattern existant (typing/shimmer pareil). Le test `tokens-css-sync.spec.ts` pourrait être étendu pour assertions d'animations.
- **W35-review (0.16) — `mainClassName` absent sur EditorialPageShell** — Pas de prop override pour le padding du `<main>`. Stories 0.17-0.19 n'ont pas ce besoin. Si Story 0.19 Contact page nécessite full-bleed, ajouter `mainClassName`.

## Deferred from: code review of 0-17-landing-coming-soon-apex (2026-05-21)

- **W36-review (0.17) — PII firstName + position en query string `/coming-soon/success?firstName=...&position=...`** — Pattern post-signup standard (équivalent verify-email-required Story 1.6 spec). Plausible Analytics et access logs à configurer pour scrub ces params pre-launch.
- **W37-review (0.17) — `rgpdOptIn` defaultValue `undefined` au lieu de `true` (spec AC3)** — Implementation GDPR-conforme (opt-in affirmatif requis par CNIL). Spec à corriger pour ce point précis : pre-checked viole guidance CNIL post-2017.
- **W38-review (0.17) — Position max validation 999_999** — Story 0.20 livrera positions réelles depuis Resend Audience count. Clamp à 9999 max possible si Story 0.20 confirme range.
- **W39-review (0.17) — `Math.random()` non-déterministe dans mock hook** — Mock only, Story 0.20 remplace par real fetch retournant position from Resend.
- **W40-review (0.17) — setState après unmount dans mock hook** — React 19 gère gracieusement (warn, pas error). Story 0.20 real hook utilise TanStack Query qui gère natively l'unmount.
- **W41-review (0.17) — Sanitizer firstName denylist `[<>'"&]` vs allowlist Unicode names** — Hardening V1+ post-MVP. Denylist suffit pour XSS standard ; allowlist plus strict requis si firstName passe dans email templates non-React (Resend handler Story 0.20 → JSON-LD Story 0.21).
- **W42-review (0.17) — FR `selectordinal` `two`/`few` branches dead code** — CLDR fr ordinal n'a que `one` + `other`. Branches `two`/`few` jamais sélectionnées par Intl.PluralRules mais output accidentellement correct via `other` fallback. Cosmetic clean-up V1+.
- **W43-review (0.17) — `handleSubmit` ne `await` pas la Promise `mutate`** — Pattern Story 1.2d strict. `isSubmitting` RHF drop avant fin mutate, mais `isPending` du hook reste correct → UI safe. Si Story 0.20 hook utilise `useMutation` TanStack, await sera nécessaire.
- **W44-review (0.17) — `?role=professional` whitelist strict (seulement `?role=pro`)** — UX enhancement V1+ : accepter `professional` + `pro` + `org` + `organizer` comme alias. Si Marketing emails utilisent format différent, casser silencieusement.
- **W45-review (0.17) — Bundle size landing ~30 KB gzip (RHF + Zod core + Radix Checkbox + lucide icons)** — Sous le seuil ≤ 50 KB AC10. Story 0.21 ajoutera Plausible (~1 KB). Monitorer Lighthouse perf.
- **W46-review (0.17) — `validation` kind manquant dans `classifyPreLaunchError`** — Spec AC3 inclut `validation` avec `fieldErrors?`. Story 0.20 ajoutera quand le real handler retournera 422 + Zod issues. Pour le moment classifier minimal suffit.
- **W47-review (0.17) — Mock hook pas de path `onError` simulé** — Story 0.20 fournira real `onError` paths (rate_limited, network, validation, generic). Mock minimal aujourd'hui ne permet pas de tester les branches error en dev sans manual injection.
