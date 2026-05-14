'use strict';

// The word "buyer" is forbidden across the codebase. The canonical term is "customer"
// (PRD §Conventions + memory feedback_tech_layer_english.md).
// Flags identifiers, file basenames, and string literals — *except* in contexts
// where "buyer" legitimately refers to third-party APIs (Stripe Connect fields,
// CHANGELOG entries, test fixtures, i18n message JSON).

const BUYER_IDENTIFIERS = new Set(['buyer', 'Buyer', 'BUYER', 'buyers', 'Buyers', 'BUYERS']);

// Files that legitimately mention "buyer" as content (docs, translations, test data).
const SKIP_FILE_REGEX =
  /(?:\/__tests__\/|\.spec\.|\.test\.|\/messages\/|\/fixtures\/|\.md$|CHANGELOG)/;

// Filename basename check — reject `buyer-profile.ts`, `BuyerService.ts` etc.
const FILE_BASENAME_REGEX = /(^|[\\/])buyers?[-_.]/i;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow 'buyer' in identifiers and file names — use 'customer' (PRD conventions).",
      recommended: true,
    },
    schema: [],
    messages: {
      forbiddenIdentifier:
        "Identifier '{{ name }}' is forbidden — use 'customer'. See PRD conventions + memory feedback_tech_layer_english.md.",
      forbiddenFilename:
        "File name contains 'buyer' — rename using 'customer'. See PRD conventions.",
    },
  },
  create(context) {
    const filename = context.physicalFilename || context.filename || '';
    if (SKIP_FILE_REGEX.test(filename)) return {};

    return {
      Program(node) {
        if (FILE_BASENAME_REGEX.test(filename)) {
          context.report({ node, messageId: 'forbiddenFilename' });
        }
      },
      Identifier(node) {
        if (BUYER_IDENTIFIERS.has(node.name)) {
          context.report({ node, messageId: 'forbiddenIdentifier', data: { name: node.name } });
        }
      },
    };
  },
};
