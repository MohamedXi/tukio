'use strict';

// Detects UI strings hardcoded in JSX:
//   - JSXText children                  → <button>Reserver</button>
//   - aria-label / placeholder / title / alt → <input placeholder="Email" />
// User-facing content must live in messages/{fr,en}.json and be retrieved via
// next-intl `useTranslations()` / `getTranslations()` (NFR56 + memory feedback_i18n_frontend.md).
// Tech-only strings (slugs, mime types, single chars, no letters…) are whitelisted.

const TRANSLATABLE_ATTRS = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-valuetext',
  'placeholder',
  'title',
  'alt',
  'label',
]);

const WHITELIST_VALUES = new Set([
  'tukio',
  'Tukio',
  'tukio.one',
  'utf-8',
  'UTF-8',
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/html',
  'all',
  'none',
  'auto',
  'inherit',
  'unset',
  'initial',
  'currentColor',
  'true',
  'false',
  'on',
  'off',
]);

const LETTER_SEQUENCE = /[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/;

// Heuristic differs by context:
//   - jsxText  : permissive — any 3+ letter run is treated as user-facing.
//   - jsxAttr  : stricter — technical slugs (all-lowercase kebab, mime types,
//     "auto"/"none"/etc.) are tolerated because they often legitimately
//     appear in attribute values.
function looksLikeUserText(value, ctx) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 3) return false;
  if (WHITELIST_VALUES.has(trimmed)) return false;
  if (/^[#@.]/.test(trimmed)) return false;
  if (/^https?:\/\//.test(trimmed)) return false;
  if (/^[\d\s.,+\-*/()%]+$/.test(trimmed)) return false;
  if (!LETTER_SEQUENCE.test(trimmed)) return false;
  if (ctx === 'attr') {
    // pure lowercase slug, mime type, or single technical token → tolerate
    if (/^[a-z0-9][-_a-z0-9.]*$/.test(trimmed) && !/\s/.test(trimmed)) return false;
    if (/^[a-z]+\/[a-z]/.test(trimmed)) return false; // mime types
  }
  return true;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded user-facing strings in JSX — use next-intl `useTranslations()` instead (NFR56).',
      recommended: true,
    },
    schema: [],
    messages: {
      jsxText:
        'Hardcoded UI text "{{ value }}". Move it to messages/{fr,en}.json and use `useTranslations()`. See NFR56 + memory feedback_i18n_frontend.md.',
      jsxAttr:
        'Hardcoded UI text in `{{ attr }}` attribute: "{{ value }}". Move it to messages/{fr,en}.json and pass `t(...)`. See NFR56.',
    },
  },
  create(context) {
    // i18n compound components: their children are translation placeholders or
    // structural markup wrapping a translated key. Skipping their subtree
    // avoids flagging the visible English text inside `<Trans>Hello</Trans>`.
    const I18N_CONTAINER_NAMES = new Set([
      'Trans',
      'FormattedMessage',
      'RichText',
      'Markdown',
      'Code',
    ]);

    function isInsideI18nContainer(node) {
      let cur = node.parent;
      while (cur) {
        if (
          cur.type === 'JSXElement' &&
          cur.openingElement &&
          cur.openingElement.name &&
          cur.openingElement.name.type === 'JSXIdentifier' &&
          I18N_CONTAINER_NAMES.has(cur.openingElement.name.name)
        ) {
          return true;
        }
        cur = cur.parent;
      }
      return false;
    }

    return {
      JSXText(node) {
        const value = node.value;
        if (!looksLikeUserText(value, 'text')) return;
        if (isInsideI18nContainer(node)) return;
        context.report({
          node,
          messageId: 'jsxText',
          data: { value: value.trim().slice(0, 60) },
        });
      },
      JSXAttribute(node) {
        const attrName =
          node.name && node.name.type === 'JSXIdentifier'
            ? node.name.name
            : node.name && node.name.type === 'JSXNamespacedName'
              ? `${node.name.namespace.name}:${node.name.name.name}`
              : null;
        if (!attrName || !TRANSLATABLE_ATTRS.has(attrName)) return;
        const v = node.value;
        if (!v) return;
        // attribute="literal"
        if (v.type === 'Literal' && looksLikeUserText(v.value, 'attr')) {
          context.report({
            node: v,
            messageId: 'jsxAttr',
            data: { attr: attrName, value: String(v.value).slice(0, 60) },
          });
          return;
        }
        // attribute={"literal"}
        if (
          v.type === 'JSXExpressionContainer' &&
          v.expression &&
          v.expression.type === 'Literal' &&
          looksLikeUserText(v.expression.value, 'attr')
        ) {
          context.report({
            node: v.expression,
            messageId: 'jsxAttr',
            data: { attr: attrName, value: String(v.expression.value).slice(0, 60) },
          });
        }
      },
    };
  },
};
