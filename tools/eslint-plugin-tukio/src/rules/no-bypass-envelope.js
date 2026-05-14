'use strict';

// Backend controllers must return DTOs raw — the global ResponseEnvelopeInterceptor (Story 0.6)
// wraps them into the canonical envelope { method, code, data | error, pagination?, meta }.
// Calling response.json() / response.send() bypasses the envelope (memory feedback_api_envelope_response.md).
// Only applies to controllers under `apps/<svc>/src/infrastructure/http/`.

const FORBIDDEN_METHODS = new Set(['json', 'send', 'jsonp']);
const SCOPE_REGEX = /apps\/[^/]+\/src\/infrastructure\/http\//;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow bypassing the canonical REST envelope by calling response.json()/send() directly from controllers.',
      recommended: true,
    },
    schema: [],
    messages: {
      bypass:
        'Calling `{{ object }}.{{ method }}()` bypasses the global ResponseEnvelopeInterceptor. Return the DTO directly — the interceptor wraps it. See memory feedback_api_envelope_response.md + Story 0.6.',
    },
  },
  create(context) {
    // ESLint 9 flat config: context.physicalFilename is the canonical accessor.
    // Normalise Windows path separators before regex testing.
    const rawFilename =
      context.physicalFilename ||
      context.filename ||
      (context.getFilename && context.getFilename()) ||
      '';
    const filename = rawFilename.replace(/\\/g, '/');
    if (!SCOPE_REGEX.test(filename)) {
      return {};
    }
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          FORBIDDEN_METHODS.has(callee.property.name) &&
          callee.object.type === 'Identifier' &&
          /^(response|res|reply)$/i.test(callee.object.name)
        ) {
          context.report({
            node,
            messageId: 'bypass',
            data: { object: callee.object.name, method: callee.property.name },
          });
        }
      },
    };
  },
};
