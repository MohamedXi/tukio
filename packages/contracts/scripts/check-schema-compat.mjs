#!/usr/bin/env node
/**
 * Schema compatibility checker — Story 0.2 (Task 9, hardened in review).
 * Detects breaking changes vs origin/main: deletion, modification, malformed JSON.
 * Exit 0 = backward compatible. Exit 1 = breaking change. Exit 2 = setup error.
 * Wired to CI in Story 0.11.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateSchemaCompatibility } = require('json-schema-diff-validator');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const EVENTS_DIR = join(PACKAGE_ROOT, 'src/events');

// ──────────────────────────────────────────────────────────────
// Pre-flight: verify origin/main exists
// ──────────────────────────────────────────────────────────────
const refCheck = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main'], {
  encoding: 'utf8',
});
if (refCheck.status !== 0) {
  console.error('❌ origin/main ref not found — cannot check schema compatibility.');
  console.error('   Possible causes:');
  console.error('   - No "origin" remote configured (run: git remote add origin <url>)');
  console.error('   - Shallow CI clone — use fetch-depth: 0 or git fetch --unshallow origin main');
  console.error('   - Working on a fresh repo before first push to origin/main');
  console.error('');
  console.error('   In a fresh-repo CI workflow, skip this script until origin/main exists.');
  process.exit(2);
}

// ──────────────────────────────────────────────────────────────
// Discovery
// ──────────────────────────────────────────────────────────────

/** @param {string} dir @returns {string[]} absolute paths */
function findSchemasOnDisk(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSchemasOnDisk(fullPath));
    } else if (entry.name.endsWith('.schema.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

/** @returns {Set<string>} git-relative paths under packages/contracts/src/events */
function findSchemasOnMain() {
  const result = spawnSync(
    'git',
    ['ls-tree', '-r', '--name-only', 'origin/main', '--', 'packages/contracts/src/events'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) return new Set();
  return new Set(
    result.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.endsWith('.schema.json')),
  );
}

const localSchemas = findSchemasOnDisk(EVENTS_DIR);
const mainSchemas = findSchemasOnMain();
const localGitPaths = new Set(
  localSchemas.map((p) => `packages/contracts/${relative(PACKAGE_ROOT, p)}`),
);

let hasBreakingChanges = false;

// ──────────────────────────────────────────────────────────────
// Check 1 — Deleted schemas (present on origin/main, missing locally)
// ──────────────────────────────────────────────────────────────
for (const mainPath of mainSchemas) {
  if (!localGitPaths.has(mainPath)) {
    console.error(`  ❌ DELETED   ${mainPath}`);
    console.error(`              Removing a v1 schema is a breaking change. Bump to v2 instead.`);
    hasBreakingChanges = true;
  }
}

// ──────────────────────────────────────────────────────────────
// Check 2 — Modified schemas (compare each local schema with origin/main)
// ──────────────────────────────────────────────────────────────
for (const schemaPath of localSchemas) {
  const relPath = relative(PACKAGE_ROOT, schemaPath);
  const gitPath = `packages/contracts/${relPath}`;

  const gitResult = spawnSync('git', ['show', `origin/main:${gitPath}`], {
    encoding: 'utf8',
  });

  if (gitResult.status !== 0) {
    // Schema not on origin/main = new schema, OK
    console.log(`  ✅ NEW        ${relPath}`);
    continue;
  }

  let mainSchema;
  try {
    mainSchema = JSON.parse(gitResult.stdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠️  Cannot parse origin/main version of ${relPath} — skipping. (${message})`);
    continue;
  }

  let currentSchema;
  try {
    currentSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ MALFORMED  ${relPath} — local file is not valid JSON: ${message}`);
    hasBreakingChanges = true;
    continue;
  }

  try {
    validateSchemaCompatibility(mainSchema, currentSchema);
    console.log(`  ✅ OK         ${relPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ BREAKING   ${relPath}`);
    console.error(`              ${message}`);
    hasBreakingChanges = true;
  }
}

// ──────────────────────────────────────────────────────────────
// Verdict
// ──────────────────────────────────────────────────────────────
if (hasBreakingChanges) {
  console.error(
    '\n💥 Breaking schema changes detected.' +
      ' Bump to v2 (e.g. booking-requested.v2.schema.json) instead of modifying or deleting v1.',
  );
  process.exit(1);
}

console.log('\n✅ All schemas are backward compatible with origin/main.');
process.exit(0);
