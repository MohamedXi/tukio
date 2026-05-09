#!/usr/bin/env node
/**
 * Schema compatibility checker — Story 0.2 (Task 9).
 * Detects breaking changes vs origin/main by comparing JSON Schemas.
 * Exit 0 = backward compatible. Exit 1 = breaking change detected.
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

/**
 * Recursively find all *.schema.json files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function findSchemas(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSchemas(fullPath));
    } else if (entry.name.endsWith('.schema.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

const schemas = findSchemas(EVENTS_DIR);
if (schemas.length === 0) {
  console.log('No event schemas found — nothing to check.');
  process.exit(0);
}

let hasBreakingChanges = false;

for (const schemaPath of schemas) {
  const relPath = relative(PACKAGE_ROOT, schemaPath);
  const gitPath = `packages/contracts/${relPath}`;

  // Try to read the schema from origin/main
  const gitResult = spawnSync('git', ['show', `origin/main:${gitPath}`], {
    encoding: 'utf8',
  });

  if (gitResult.status !== 0) {
    // Schema not present on origin/main — new schema, skip
    console.log(`  ✅ NEW  ${relPath}`);
    continue;
  }

  let mainSchema;
  try {
    mainSchema = JSON.parse(gitResult.stdout);
  } catch {
    console.warn(`  ⚠️  Could not parse origin/main version of ${relPath} — skipping.`);
    continue;
  }

  const currentSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  try {
    validateSchemaCompatibility(mainSchema, currentSchema);
    console.log(`  ✅ OK   ${relPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ BREAKING  ${relPath}`);
    console.error(`              ${message}`);
    hasBreakingChanges = true;
  }
}

if (hasBreakingChanges) {
  console.error(
    '\n💥 Breaking schema changes detected without version bump.' +
      ' Create a new version (e.g. booking-requested.v2.schema.json) instead of modifying v1.',
  );
  process.exit(1);
} else {
  console.log('\n✅ All schemas are backward compatible with origin/main.');
  process.exit(0);
}
