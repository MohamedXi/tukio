'use strict';

// FR slug → EN slug mapping. URL paths must stay 100% EN (NFR58 + memory feedback_tech_layer_english.md).
// FR SEO slugs live in *_translations tables and are derived at render time.
const FR_TO_EN_SLUG = {
  categorie: 'category',
  profil: 'profile',
  parametres: 'settings',
  aide: 'help',
  recherche: 'search',
  panier: 'cart',
  vendeur: 'seller',
  acheteur: 'customer',
  reservation: 'booking',
  reservations: 'bookings',
  paiement: 'payment',
  paiements: 'payments',
  factures: 'invoices',
  facture: 'invoice',
  inscription: 'register',
  connexion: 'login',
  motdepasseoublie: 'forgot-password',
};

const FR_SLUGS = Object.keys(FR_TO_EN_SLUG);
// Strict anchor: must be preceded by `/` (root or sub-path) and followed by `/` or end.
// Locale prefix `fr|en` is REQUIRED — bare `/profil` is not a URL we care about
// (could be a JSON key or filesystem path).
const FR_PATH_REGEX = new RegExp(`(^|/)(fr|en)/(${FR_SLUGS.join('|')})(/|$)`);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow FR slugs in URL paths — paths must be 100% English (NFR58).',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      frPath:
        'FR slug "{{ frSlug }}" forbidden in URL path "{{ path }}". Use EN equivalent: "{{ enSlug }}". See NFR58 + memory feedback_tech_layer_english.md.',
    },
  },
  create(context) {
    function isImportOrRequireSource(node) {
      const parent = node.parent;
      if (!parent) return false;
      // ESM import/export from '...'
      if (
        (parent.type === 'ImportDeclaration' ||
          parent.type === 'ExportNamedDeclaration' ||
          parent.type === 'ExportAllDeclaration' ||
          parent.type === 'ImportExpression') &&
        parent.source === node
      ) {
        return true;
      }
      // CJS require('...')
      if (
        parent.type === 'CallExpression' &&
        parent.callee.type === 'Identifier' &&
        parent.callee.name === 'require' &&
        parent.arguments[0] === node
      ) {
        return true;
      }
      return false;
    }

    function check(node, raw) {
      if (typeof raw !== 'string' || raw.length === 0) return;
      if (isImportOrRequireSource(node)) return;
      if (!FR_PATH_REGEX.test(raw)) return;
      const fixed = raw.replace(
        new RegExp(`(^|/)(fr|en)/(${FR_SLUGS.join('|')})(/|$)`, 'g'),
        (_m, pre, locale, slug, post) => `${pre}${locale}/${FR_TO_EN_SLUG[slug]}${post}`,
      );
      const match = raw.match(FR_PATH_REGEX);
      const frSlug = match && match[3];
      context.report({
        node,
        messageId: 'frPath',
        data: { frSlug, enSlug: FR_TO_EN_SLUG[frSlug], path: raw },
        fix: (fixer) => {
          if (node.type === 'Literal') {
            return fixer.replaceText(node, JSON.stringify(fixed));
          }
          if (node.type === 'TemplateElement') {
            return fixer.replaceTextRange([node.range[0] + 1, node.range[1] - 1], fixed);
          }
          return null;
        },
      });
    }

    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value && node.value.cooked);
      },
    };
  },
};
