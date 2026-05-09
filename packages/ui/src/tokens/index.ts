export * from './colors.js';
export * from './typography.js';
export * from './spacing.js';
export * from './radius.js';
export * from './shadows.js';
export * from './breakpoints.js';
export * from './animations.js';

import { colors } from './colors.js';
import { fontFamily, fontSize, fontWeight, letterSpacing, lineHeight } from './typography.js';
import { spacing } from './spacing.js';
import { radius } from './radius.js';
import { shadows } from './shadows.js';
import { breakpoints } from './breakpoints.js';
import { keyframes, animations } from './animations.js';

/** Aggregated tokens for programmatic theme generation (Stripe, charts, etc.). */
export const tokens = {
  colors,
  typography: { fontFamily, fontSize, fontWeight, letterSpacing, lineHeight },
  spacing,
  radius,
  shadows,
  breakpoints,
  animations,
  keyframes,
} as const;
