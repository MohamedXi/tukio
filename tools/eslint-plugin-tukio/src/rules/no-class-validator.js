'use strict';

// class-validator is forbidden. DTOs use Zod schemas from @tukio/contracts/dtos/* exclusively
// (decision: Story 0.2 envelope + memory feedback_clean_architecture_explicit.md).
// Also detects @IsString() / @IsEmail() / @Is*() decorator usage (AC3).

const FORBIDDEN_SOURCES = new Set(['class-validator', 'class-transformer']);
const DECORATOR_REGEX = /^(Is|Validate|Allow|Min|Max|Length|Matches|Contains|Equals)(?:[A-Z]\w*)?$/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow class-validator / class-transformer — use Zod schemas from @tukio/contracts/dtos/* instead.',
      recommended: true,
    },
    schema: [],
    messages: {
      forbiddenImport:
        'Importing "{{ source }}" is forbidden. Use Zod schemas from @tukio/contracts/dtos/* and `ZodValidationPipe` from `@tukio/contracts/validation` (Story 0.2).',
      forbiddenDecorator:
        'Decorator `@{{ name }}()` looks like a class-validator decorator. Use Zod schemas from @tukio/contracts/dtos/*.',
    },
  },
  create(context) {
    function checkSource(node, source) {
      if (FORBIDDEN_SOURCES.has(source)) {
        context.report({ node, messageId: 'forbiddenImport', data: { source } });
      }
    }

    return {
      ImportDeclaration(node) {
        // type-only imports are erased at compile time → harmless.
        if (node.importKind === 'type') return;
        if (node.source && typeof node.source.value === 'string') {
          checkSource(node, node.source.value);
        }
      },
      ImportExpression(node) {
        if (
          node.source &&
          node.source.type === 'Literal' &&
          typeof node.source.value === 'string'
        ) {
          checkSource(node, node.source.value);
        }
      },
      CallExpression(node) {
        // require('class-validator')
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length === 1 &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          checkSource(node, node.arguments[0].value);
        }
      },
      // @IsString() / @IsEmail() / @MinLength(5) etc. on DTO properties / params
      Decorator(node) {
        const expr = node.expression;
        let name = null;
        if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
          name = expr.callee.name;
        } else if (expr.type === 'Identifier') {
          name = expr.name;
        }
        if (name && DECORATOR_REGEX.test(name)) {
          context.report({ node, messageId: 'forbiddenDecorator', data: { name } });
        }
      },
    };
  },
};
