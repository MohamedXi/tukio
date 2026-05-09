import type { Appearance } from '@stripe/stripe-js';
import { colors } from '../tokens/colors.js';
import { fontFamily } from '../tokens/typography.js';
import { radius } from '../tokens/radius.js';

/**
 * Stripe Elements appearance derived from Tukio design tokens.
 * Wired into checkout in Story 4.5; here we just expose the typed object
 * to verify the Stripe Appearance contract is satisfied at compile time.
 */
export const stripeElementsTheme: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: colors.brand[500],
    colorBackground: colors.cream[50],
    colorText: colors.charcoal[700],
    colorDanger: colors.error[500],
    colorTextPlaceholder: colors.charcoal[400],
    fontFamily: fontFamily.body,
    spacingUnit: '4px',
    borderRadius: radius.md,
  },
  rules: {
    '.Input': {
      border: `1px solid ${colors.charcoal[400]}`,
      boxShadow: 'none',
    },
    '.Input:focus': {
      borderColor: colors.brand[500],
      boxShadow: `0 0 0 2px ${colors.brand[200]}`,
    },
  },
};
