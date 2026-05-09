'use strict';

const eventNaming = require('./rules/event-naming.js');
const noBarrelImportContracts = require('./rules/no-barrel-import-contracts.js');
const noBarrelImportUi = require('./rules/no-barrel-import-ui.js');

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
  rules: {
    'event-naming': eventNaming,
    'no-barrel-import-contracts': noBarrelImportContracts,
    'no-barrel-import-ui': noBarrelImportUi,
  },
  configs: {
    recommended: {
      plugins: ['tukio'],
      rules: {
        'tukio/event-naming': 'error',
        'tukio/no-barrel-import-contracts': 'warn',
        'tukio/no-barrel-import-ui': 'warn',
      },
    },
  },
};
