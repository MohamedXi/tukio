'use strict';

const VALID_EVENT_TYPE_REGEX = /^[a-z]+(?:\.[a-z][a-z0-9-]*)+\.v\d+$/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce NATS event type naming convention: <service>.<aggregate>.<event>.v<n>',
      recommended: true,
    },
    messages: {
      invalidEventType:
        'Event type "{{value}}" does not match the required format: ' +
        '<service>.<aggregate>.<event>.v<n> ' +
        '(lowercase, dot-separated tokens, dashes allowed within tokens).',
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.key?.type === 'Identifier' &&
          node.key.name === 'eventType' &&
          node.value?.type === 'Literal' &&
          typeof node.value.value === 'string' &&
          !VALID_EVENT_TYPE_REGEX.test(node.value.value)
        ) {
          context.report({
            node: node.value,
            messageId: 'invalidEventType',
            data: { value: node.value.value },
          });
        }
      },
    };
  },
};
