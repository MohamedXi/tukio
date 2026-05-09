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
