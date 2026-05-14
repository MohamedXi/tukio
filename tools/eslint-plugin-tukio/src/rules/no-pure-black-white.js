'use strict';

// Pure black / pure white forbidden by the Tukio design system (UX spec line 711).
// Use brand tokens: `text-charcoal-700`, `bg-cream-50`, `border-cream-300`, etc.
// Flags Tailwind classes (text-black / bg-white …) and raw CSS values (#000 / #fff / rgb(0,0,0)).

const TAILWIND_FORBIDDEN_REGEX =
  /\b(?:text|bg|border|fill|stroke|ring|placeholder|caret|outline|divide|decoration|shadow|from|via|to|accent)-(?:black|white)\b/;

const CSS_BLACK_WHITE_REGEX =
  /(?:#000(?:000)?(?:[a-f0-9]{2})?\b|#fff(?:fff)?(?:[a-f0-9]{2})?\b|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(?:,\s*[\d.]+\s*)?\)|rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(?:,\s*[\d.]+\s*)?\))/i;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow pure black/white in Tailwind classes and CSS values — use Tukio tokens (charcoal/cream).',
      recommended: true,
    },
    schema: [],
    messages: {
      tailwind:
        'Pure black/white Tailwind class "{{ match }}" forbidden. Use Tukio tokens (`text-charcoal-700`, `bg-cream-50`, `border-cream-300`). See UX spec line 711 + @tukio/ui/styles/theme.css.',
      cssValue:
        'Pure black/white CSS value "{{ match }}" forbidden. Use Tukio tokens (charcoal/cream palette). See @tukio/ui/styles/theme.css.',
    },
  },
  create(context) {
    function check(node, value) {
      if (typeof value !== 'string') return;
      const tw = value.match(TAILWIND_FORBIDDEN_REGEX);
      if (tw) {
        context.report({ node, messageId: 'tailwind', data: { match: tw[0] } });
        return;
      }
      const css = value.match(CSS_BLACK_WHITE_REGEX);
      if (css) {
        context.report({ node, messageId: 'cssValue', data: { match: css[0] } });
      }
    }
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value && node.value.cooked);
      },
      JSXAttribute(node) {
        if (
          node.name &&
          node.name.type === 'JSXIdentifier' &&
          (node.name.name === 'className' || node.name.name === 'class') &&
          node.value
        ) {
          if (node.value.type === 'Literal') {
            check(node.value, node.value.value);
          } else if (
            node.value.type === 'JSXExpressionContainer' &&
            node.value.expression.type === 'Literal'
          ) {
            check(node.value.expression, node.value.expression.value);
          }
        }
      },
    };
  },
};
