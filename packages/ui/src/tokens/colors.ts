/**
 * Tukio color tokens — single source of truth: theme.css.
 * Mirrored here for programmatic access (Stripe Elements, charts, tests).
 * If you change a value here, update theme.css too (sync test catches drift).
 */
export const colors = {
  brand: {
    50: '#FCF3EE',
    100: '#F8E0D0',
    200: '#F1B996',
    300: '#E89160',
    400: '#DC6E33',
    500: '#C2410C',
    600: '#9A340A',
    700: '#7A2A09',
    800: '#5C2008',
    900: '#3E1606',
  },
  cream: {
    50: '#FAF7F2',
    100: '#F5F1EA',
    200: '#EBE5D9',
    300: '#DDD4C2',
  },
  charcoal: {
    400: '#6B6657',
    500: '#4A453A',
    600: '#2F2C25',
    700: '#1F1D18',
    800: '#14130F',
    900: '#0A0A07',
  },
  success: { 50: '#ECF1ED', 500: '#4D7C5E', 700: '#345240' },
  warning: { 50: '#F8ECD9', 200: '#F0D8B8', 500: '#B45309', 700: '#7A380A' },
  error: { 50: '#FCE8E8', 500: '#B91C1C', 700: '#7F1414' },
  danger: { 50: '#FCE8E8', 500: '#C84838', 600: '#B53A2B', 700: '#8E2C20' },
  info: { 50: '#E2EEF3', 500: '#1E5F7E', 700: '#143F54' },
} as const;

export type ColorScale = keyof typeof colors;
export type BrandShade = keyof typeof colors.brand;
