export const fontFamily = {
  display: '"Fraunces", "Tiempos Headline", Georgia, serif',
  body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export const fontSize = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '20px',
  xl: '25px',
  '2xl': '31px',
  '3xl': '39px',
  '4xl': '49px',
  '5xl': '61px',
  '6xl': '76px',
} as const;

export const fontWeight = {
  thin: 100,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const letterSpacing = {
  tight: '-0.01em',
  normal: '0',
  wide: '0.04em',
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.625,
} as const;
