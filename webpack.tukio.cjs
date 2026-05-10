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
