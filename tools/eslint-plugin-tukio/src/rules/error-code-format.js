'use strict';

// Tukio error codes must follow `<DOMAIN>-<CATEGORY>-<NNN>` shape (Architecture lines 1707-1715).
// Examples: AUTH-NOT-AUTHENTICATED-002, BOOKING-CONFLICT-001, CATALOG-LISTING-NOT-FOUND-014.
// Constraints:
//   - DOMAIN token: 3+ uppercase letters (AUTH, BOOKING, CATALOG…).
//   - At least one CATEGORY token, each 2+ uppercase letters (CONFLICT, NOT-FOUND…).
//   - 3-digit numeric suffix.
const TUKIO_CODE_REGEX = /^[A-Z]{3,}(-[A-Z]{2,})+-\d{3}$/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce Tukio error code shape <DOMAIN>-<CATEGORY>-<NNN> on `tukioCode` properties.',
      recommended: true,
    },
    schema: [],
    messages: {
      invalidCode:
        'Invalid tukioCode "{{ value }}". Expected <DOMAIN>-<CATEGORY>-<NNN> (uppercase, kebab-separated tokens, 3-digit suffix). See Architecture lines 1707-1715.',
    },
  },
  create(context) {
    function check(node, value) {
      if (typeof value !== 'string') return;
      if (!TUKIO_CODE_REGEX.test(value)) {
        context.report({ node, messageId: 'invalidCode', data: { value } });
      }
    }
    return {
      Property(node) {
        if (
          (node.key.type === 'Identifier' && node.key.name === 'tukioCode') ||
          (node.key.type === 'Literal' && node.key.value === 'tukioCode')
        ) {
          if (node.value.type === 'Literal') {
            check(node.value, node.value.value);
          }
        }
      },
      PropertyDefinition(node) {
        if (
          node.key &&
          ((node.key.type === 'Identifier' && node.key.name === 'tukioCode') ||
            (node.key.type === 'Literal' && node.key.value === 'tukioCode')) &&
          node.value &&
          node.value.type === 'Literal'
        ) {
          check(node.value, node.value.value);
        }
      },
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.property.type === 'Identifier' &&
          node.left.property.name === 'tukioCode' &&
          node.right.type === 'Literal'
        ) {
          check(node.right, node.right.value);
        }
      },
    };
  },
};
