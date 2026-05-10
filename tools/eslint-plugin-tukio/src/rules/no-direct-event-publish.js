'use strict';

// Rule: tukio/no-direct-event-publish
// Prevents direct NATS client publish calls inside use-case files.
// Use cases must publish events via OutboxPublisher (transactional consistency).
//
// Detects: this.natsClient.publish(...), nats.publish(...), jetsreamClient.publish(...)
// Exempts: this.outboxPublisher.publish(...) — correct pattern
// Scope: apps/*-svc/src/usecases/**/*.ts  (applied via eslint.config.mjs `files` filter)

const DIRECT_PUBLISH_IDENTIFIERS = new Set([
  'natsClient',
  'nats',
  'jetStreamClient',
  'jsClient',
  'natsJetStreamClient',
  'natsConnection',
  'js',
  'nc',
]);

const SAFE_IDENTIFIERS = new Set([
  'outboxPublisher',
  // 'eventPublisher' excluded: naming alone does not guarantee outbox-backed implementation.
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce outbox-first event publishing in use cases — direct NATS publish bypasses transactional consistency.',
      recommended: false,
    },
    messages: {
      directPublish:
        'Direct NATS publish detected via "{{obj}}.publish()". Use OutboxPublisher instead: ' +
        '`this.outboxPublisher.publish(event)`. Direct publish bypasses the outbox pattern and ' +
        'can cause events to be emitted even when the business transaction rolls back.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property?.type !== 'Identifier' ||
          node.callee.property.name !== 'publish'
        ) {
          return;
        }

        const obj = node.callee.object;
        let objName = null;

        if (obj.type === 'Identifier') {
          objName = obj.name;
        } else if (obj.type === 'MemberExpression' && obj.property?.type === 'Identifier') {
          // this.natsClient.publish() → objName = 'natsClient'
          objName = obj.property.name;
        }

        if (!objName) return;
        if (SAFE_IDENTIFIERS.has(objName)) return;
        if (DIRECT_PUBLISH_IDENTIFIERS.has(objName)) {
          context.report({
            node,
            messageId: 'directPublish',
            data: { obj: objName },
          });
        }
      },
    };
  },
};
