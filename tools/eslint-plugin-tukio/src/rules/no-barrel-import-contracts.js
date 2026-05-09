'use strict';

const SUBPATH_HINT =
  'Use a specific subpath import instead: ' +
  '@tukio/contracts/envelope, @tukio/contracts/types, ' +
  '@tukio/contracts/events/<service>/<event>.v1, or @tukio/contracts/dtos/<resource>.';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow barrel imports from @tukio/contracts — use specific subpath imports.',
      recommended: true,
    },
    messages: {
      barrelImport: SUBPATH_HINT,
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (
          node.source.value === '@tukio/contracts' &&
          node.specifiers.some((s) => s.type === 'ImportSpecifier')
        ) {
          context.report({
            node,
            messageId: 'barrelImport',
          });
        }
      },
    };
  },
};
