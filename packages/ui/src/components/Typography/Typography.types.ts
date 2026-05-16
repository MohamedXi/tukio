import type { ElementType, HTMLAttributes, ReactNode } from 'react';

/**
 * MUI-aligned typography variants. Each variant pins a semantic recipe
 * (font family + size + weight + line-height + tracking) so screens never
 * hand-pick Tailwind text utilities.
 */
export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle1'
  | 'subtitle2'
  | 'body1'
  | 'body2'
  | 'caption'
  | 'overline'
  | 'kicker'
  | 'button';

/** Semantic color tokens — maps to the design-system charcoal / brand / functional scales. */
export type TypographyColor =
  | 'default'
  | 'muted'
  | 'subtle'
  | 'inverse'
  | 'brand'
  | 'success'
  | 'warning'
  | 'error'
  | 'inherit';

export type TypographyAlign = 'left' | 'center' | 'right';

export interface TypographyOwnProps {
  /** Typography recipe. Default `body1`. */
  variant?: TypographyVariant;
  /**
   * Override the rendered HTML element. Defaults to the variant's natural tag
   * (e.g. `h2` for variant `h2`, `p` for body variants, `span` for inline).
   * Use for semantic-vs-visual hierarchy mismatches: a hero "h1 look" rendered
   * inside an article that already has its own h1 should use `as="h2"`.
   */
  as?: ElementType;
  /** Color token. Default `default` keeps the variant's natural color. */
  color?: TypographyColor;
  /** Shortcut for `text-{align}`. */
  align?: TypographyAlign;
  /** Truncate with ellipsis on a single line (no wrap, no overflow). */
  noWrap?: boolean;
  /** Adds `mb-2` (MUI's gutterBottom equivalent) for stack rhythm. */
  gutterBottom?: boolean;
  children?: ReactNode;
  className?: string;
}

export type TypographyProps = TypographyOwnProps &
  Omit<HTMLAttributes<HTMLElement>, keyof TypographyOwnProps>;
