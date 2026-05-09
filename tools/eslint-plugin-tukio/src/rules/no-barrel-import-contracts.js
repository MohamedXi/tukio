'use strict';

const SUBPATH_HINT =
  'Use a specific subpath import instead: ' +
  '@tukio/contracts/envelope, @tukio/contracts/types, ' +
  '@tukio/contracts/events/<service>/<event>.v1, or @tukio/contracts/dtos/<resource>.';

const BARREL_SOURCE = '@tukio/contracts';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow all forms of barrel imports/exports from @tukio/contracts — use specific subpath imports.',
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
      //   import { X } from '@tukio/contracts'       (ImportSpecifier)
      //   import X from '@tukio/contracts'           (ImportDefaultSpecifier)
      //   import * as X from '@tukio/contracts'      (ImportNamespaceSpecifier)
      ImportDeclaration(node) {
        if (node.source.value === BARREL_SOURCE && node.specifiers.length > 0) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
      // Covers: export { X } from '@tukio/contracts'
      ExportNamedDeclaration(node) {
        if (node.source && node.source.value === BARREL_SOURCE) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
      // Covers: export * from '@tukio/contracts'
      ExportAllDeclaration(node) {
        if (node.source && node.source.value === BARREL_SOURCE) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
      // Covers: await import('@tukio/contracts')
      ImportExpression(node) {
        if (node.source && node.source.type === 'Literal' && node.source.value === BARREL_SOURCE) {
          context.report({ node, messageId: 'barrelImport' });
        }
      },
    };
  },
};
