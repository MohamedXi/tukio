'use strict';

// Cross-service events must carry a `correlationId` for distributed tracing
// (Story 0.7 — CorrelationContext). When publishing via OutboxPublisher, the event
// payload object should include a `correlationId` field — typically pulled from
// `correlationContext.getCorrelationId()`.
//
// To avoid false positives on unrelated publishers (Kafka, Redis pub/sub, Nest
// EventEmitter), the rule scopes to two signals:
//   1. The receiver type is named `OutboxPublisher` (exact, PascalCase), or
//   2. The receiver variable name contains "outbox" (case-insensitive).
// Both checks are syntactic; type-aware detection would require the TS project
// service. False negatives are acceptable — this is a warn-only rule.

const OUTBOX_NAME_REGEX = /outbox/i;

function getReceiverName(callee) {
  if (callee.type !== 'MemberExpression') return null;
  if (callee.object.type === 'Identifier') return callee.object.name;
  if (callee.object.type === 'MemberExpression' && callee.object.property.type === 'Identifier') {
    return callee.object.property.name;
  }
  if (callee.object.type === 'ThisExpression') return null;
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Suggest providing `correlationId` on inline event payloads passed to OutboxPublisher.publish().',
      recommended: false,
    },
    schema: [],
    messages: {
      missingCorrelation:
        'Inline event payload passed to `.publish()` is missing `correlationId`. Use `correlationContext.getCorrelationId()` (Story 0.7).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'publish'
        ) {
          return;
        }

        const recvName = getReceiverName(callee);
        if (!recvName || !OUTBOX_NAME_REGEX.test(recvName)) return;

        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;

        const hasCorrelation = arg.properties.some(
          (p) =>
            p.type === 'Property' &&
            ((p.key.type === 'Identifier' && p.key.name === 'correlationId') ||
              (p.key.type === 'Literal' && p.key.value === 'correlationId')),
        );
        if (!hasCorrelation) {
          context.report({ node: arg, messageId: 'missingCorrelation' });
        }
      },
    };
  },
};
