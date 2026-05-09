/** Tukio shadow scale — warm-tinted (charcoal-700 base rgba). */
export const shadows = {
  sm: '0 1px 2px rgba(31, 29, 24, 0.05)',
  default: '0 2px 8px rgba(31, 29, 24, 0.06)',
  md: '0 4px 16px rgba(31, 29, 24, 0.08)',
  lg: '0 12px 32px rgba(31, 29, 24, 0.12)',
  xl: '0 24px 64px rgba(31, 29, 24, 0.16)',
} as const;

export type ShadowKey = keyof typeof shadows;
