/**
 * Tukio UI design system — root barrel.
 *
 * Only global types are re-exported here. Components, tokens, themes, and styles
 * MUST be imported via their dedicated subpaths:
 *   import { colors } from '@tukio/ui/tokens/colors';
 *   import '@tukio/ui/styles/globals.css';
 *   import { stripeElementsTheme } from '@tukio/ui/themes/stripe-elements';
 *
 * The lint rule `tukio/no-barrel-import-ui` enforces this at lint time.
 */
export type { ColorScale, BrandShade } from './tokens/colors.js';
