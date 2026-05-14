// Shared NestJS/webpack config for every backend app in the Tukio workspace.
//
// Usage: each NestJS app's `webpack.config.cjs` simply re-exports this:
//
//   module.exports = require('../../webpack.tukio.cjs');
//
// Why this exists (workaround for two pieces of tech debt):
//   1. `@tukio/*` packages declare `package.json` `exports` that point to TS
//      sources (Story 0.2 D8 deferred work). Node cannot execute TS at runtime.
//   2. `tsconfig.base.json` maps `@tukio/*` → `./packages/*/src` (TS sources),
//      which inflates `rootDir` of any consumer and breaks `dist/main.js` layout.
//
// Bundling strategy (post Story 0.11 lessons learned):
//
//   Bundle by default. Externalize only a curated list (NEVER_BUNDLE).
//
// Rationale: an "allow-list to bundle" approach (the previous strategy) required
// hunting down every transitive dep when a new one surfaced — prom-client →
// tdigest → bintrees → @opentelemetry/api each crashed the smoke test in turn.
// The current strategy bundles everything pure-JS by default and externalizes
// only deps with native bindings, large size, or runtime resolution needs
// (Nest decorator metadata, pino worker threads, pg native binding, …).
//
// When adding a new direct dep to apps/*/package.json:
//   - If it has native bindings or pulls in tons of transitives → add to
//     NEVER_BUNDLE (so pnpm deploy --legacy ships it in node_modules).
//   - If it's pure JS → it'll be bundled automatically.

const TUKIO_WORKSPACE_PACKAGE = /^@tukio\//;

// Curated externals — kept OUT of the webpack bundle. These ship in
// /deploy/node_modules via `pnpm deploy --legacy`, which means each app's
// package.json MUST list them (directly or transitively via direct deps).
//
// Adding here means: this dep has native bindings, worker threads, or is
// otherwise unsafe to inline in a single webpack chunk.
const NEVER_BUNDLE_EXACT = new Set([
  'typeorm', // huge + uses dynamic require for drivers
  'pg', // native binding
  'pg-native', // native
  'reflect-metadata', // Nest decorator runtime — must be unique global
  'rxjs', // Nest internal observables — must be unique instance
  'zod', // shared at type level with nestjs-zod
  'nestjs-zod', // Nest pipe registration
  'nestjs-pino', // worker threads + pino transport resolution
  'pino', // worker threads transport resolution
  'pino-pretty',
  'pino-http',
  'class-transformer', // Nest serialization
  'class-validator', // forbidden by tukio/no-class-validator but listed for safety
]);

// Prefix-based externals — anything under these namespaces stays external.
const NEVER_BUNDLE_PREFIX = ['@nestjs/', '@fastify/', '@types/', 'pino-'];

function shouldExternalize(request) {
  if (!request) return false;
  if (NEVER_BUNDLE_EXACT.has(request)) return true;
  for (const prefix of NEVER_BUNDLE_PREFIX) {
    if (request.startsWith(prefix)) return true;
  }
  return false;
}

module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    extensionAlias: {
      // nodenext convention: source files import with `.js` extension even
      // though they are `.ts`. Webpack does not swap extensions automatically.
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
    },
  },
  externals: [
    function externalize({ request }, callback) {
      // Always bundle workspace packages — they ship TS sources only.
      if (request && TUKIO_WORKSPACE_PACKAGE.test(request)) {
        return callback();
      }
      // Externalize curated natives + large deps.
      if (shouldExternalize(request)) {
        return callback(null, 'commonjs ' + request);
      }
      // Everything else (pure JS npm deps, transitives of @tukio/*) gets
      // bundled. This avoids the "Cannot find module 'X'" runtime errors
      // that plagued earlier builds when webpack externalized transitive
      // deps not declared in apps/*/package.json.
      return callback();
    },
  ],
});
