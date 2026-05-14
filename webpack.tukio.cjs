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
// Bundling everything (workspace packages included) into a single dist/main.js
// sidesteps both issues. When Story 0.2 D8 lands real package builds (each
// package emits dist/, exports point to dist/), this file can be removed and
// services can return to plain `nest start --watch`.
//
// To switch to Rspack later, replace the import line in each service's
// `webpack.config.cjs` from `webpack` to `@rspack/core` — the config syntax
// is 95% compatible. No change needed in this file.

const TUKIO_WORKSPACE_PACKAGE = /^@tukio\//;

// Pure-JS deps used transitively by @tukio/* packages but NOT declared as
// direct deps in apps/*/package.json. Bundling them keeps the final image
// self-contained without forcing every service to mirror the deps of every
// @tukio/* package it pulls in.
// Adding to this list: must be pure JS (no native bindings, no worker_threads
// shenanigans). Verify with `pnpm why <pkg>` that it doesn't pull in C addons.
const ALWAYS_BUNDLE = new Set(['prom-client', 'jose', 'nats']);

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
      // Bundle the transitive runtime deps coming from @tukio/* (so apps
      // don't need to declare them — `pnpm deploy --legacy` would not
      // include them in /deploy/node_modules otherwise).
      if (request && ALWAYS_BUNDLE.has(request)) {
        return callback();
      }
      // Externalize every other npm package (NestJS default — keeps the bundle
      // small and lets Node resolve runtime deps from node_modules).
      if (
        request &&
        /^[a-z@]/i.test(request) &&
        !request.startsWith('.') &&
        !request.startsWith('/')
      ) {
        return callback(null, 'commonjs ' + request);
      }
      return callback();
    },
  ],
});
