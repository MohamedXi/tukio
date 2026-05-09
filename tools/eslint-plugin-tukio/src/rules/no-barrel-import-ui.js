'use strict';

const SUBPATH_HINT =
  'Use a specific subpath import instead: ' +
  '@tukio/ui/styles/globals.css (CSS), ' +
  '@tukio/ui/tokens/<resource> (tokens), ' +
  '@tukio/ui/themes/<theme> (themes), or ' +
  '@tukio/ui/components/<Component> (components — Story 0.4).';

const BARREL_SOURCE = '@tukio/ui';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow barrel imports/exports of named values from @tukio/ui — use specific subpath imports.',
      recommended: true,
    },
    messages: {
      barrelImport: SUBPATH_HINT,
    },
    schema: [],
  },
  create(context) {
    return {
      // Covers:
      //   import { X } from '@tukio/ui'  (named)
      //   import X from '@tukio/ui'      (default)
      //   import * as X from '@tukio/ui' (namespace)
      //
      // Allowed:
      //   import '@tukio/ui/styles/globals.css'  (side-effect, source != barrel)
      //   import type { BrandShade } from '@tukio/ui'  (type-only — global types are allowed)
      ImportDeclaration(node) {
        if (node.source.value !== BARREL_SOURCE) return;
        if (node.specifiers.length === 0) return; // side-effect import — allowed
        // Type-only imports (whole declaration) are allowed for global types
        if (node.importKind === 'type') return;
        // Mixed — flag any non-type specifier
        const hasValueSpecifier = node.specifiers.some(
          (s) => !('importKind' in s) || s.importKind !== 'type',
        );
        if (hasValueSpecifier) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
      // Covers: export { X } from '@tukio/ui'
      ExportNamedDeclaration(node) {
        if (node.source && node.source.value === BARREL_SOURCE) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
      // Covers: export * from '@tukio/ui'
      ExportAllDeclaration(node) {
        if (node.source && node.source.value === BARREL_SOURCE) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
      // Covers: await import('@tukio/ui')
      ImportExpression(node) {
        if (node.source && node.source.type === 'Literal' && node.source.value === BARREL_SOURCE) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
    };
  },
};
