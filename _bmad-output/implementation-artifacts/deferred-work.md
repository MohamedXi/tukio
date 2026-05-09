# Deferred Work

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
