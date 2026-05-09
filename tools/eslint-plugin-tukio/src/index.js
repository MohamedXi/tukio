'use strict';

const eventNaming = require('./rules/event-naming.js');
const noBarrelImportContracts = require('./rules/no-barrel-import-contracts.js');

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
  rules: {
    'event-naming': eventNaming,
    'no-barrel-import-contracts': noBarrelImportContracts,
  },
  configs: {
    recommended: {
      plugins: ['tukio'],
      rules: {
        'tukio/event-naming': 'error',
        'tukio/no-barrel-import-contracts': 'warn',
      },
    },
  },
};
