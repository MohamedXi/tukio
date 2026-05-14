'use strict';

const eventNaming = require('./rules/event-naming.js');
const noBarrelImportContracts = require('./rules/no-barrel-import-contracts.js');
const noBarrelImportUi = require('./rules/no-barrel-import-ui.js');
const noDirectEventPublish = require('./rules/no-direct-event-publish.js');
// Story 0.11 — 8 new rules.
const noFrPaths = require('./rules/no-fr-paths.js');
const noHardcodedText = require('./rules/no-hardcoded-text.js');
const noClassValidator = require('./rules/no-class-validator.js');
const errorCodeFormat = require('./rules/error-code-format.js');
const noBuyer = require('./rules/no-buyer.js');
const noBypassEnvelope = require('./rules/no-bypass-envelope.js');
const noPureBlackWhite = require('./rules/no-pure-black-white.js');
const requireCorrelationId = require('./rules/require-correlation-id.js');

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
  rules: {
    'event-naming': eventNaming,
    'no-barrel-import-contracts': noBarrelImportContracts,
    'no-barrel-import-ui': noBarrelImportUi,
    'no-direct-event-publish': noDirectEventPublish,
    // Story 0.11
    'no-fr-paths': noFrPaths,
    'no-hardcoded-text': noHardcodedText,
    'no-class-validator': noClassValidator,
    'error-code-format': errorCodeFormat,
    'no-buyer': noBuyer,
    'no-bypass-envelope': noBypassEnvelope,
    'no-pure-black-white': noPureBlackWhite,
    'require-correlation-id': requireCorrelationId,
  },
  configs: {
    recommended: {
      plugins: ['tukio'],
      rules: {
        'tukio/event-naming': 'error',
        'tukio/no-barrel-import-contracts': 'error',
        'tukio/no-barrel-import-ui': 'error',
        'tukio/no-direct-event-publish': 'error',
        'tukio/no-fr-paths': 'error',
        'tukio/no-hardcoded-text': 'error',
        'tukio/no-class-validator': 'error',
        'tukio/error-code-format': 'error',
        'tukio/no-buyer': 'error',
        'tukio/no-bypass-envelope': 'error',
        'tukio/no-pure-black-white': 'error',
        'tukio/require-correlation-id': 'warn',
      },
    },
  },
};
