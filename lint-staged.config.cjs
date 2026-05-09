// Note: ESLint is enforced via `pnpm lint` (CI) — running it here at root would
// fail because root config doesn't carry the TS/React parsers (apps and svc each
// have their own eslint.config.mjs). Pre-commit stays format-only for speed.
module.exports = {
  '*.{ts,tsx,js,jsx,mjs,cjs,json,md,yaml,yml,css,scss}': ['prettier --write'],
};
