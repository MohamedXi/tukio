export const breakpoints = {
  xs: '0px',
  sm: '481px',
  md: '641px',
  lg: '1025px',
  xl: '1281px',
  '2xl': '1537px',
} as const;

export type BreakpointKey = keyof typeof breakpoints;
