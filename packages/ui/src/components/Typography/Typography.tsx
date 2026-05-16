import type { ElementType } from 'react';
import { cn } from '../../utils/cn';
import type {
  TypographyAlign,
  TypographyColor,
  TypographyProps,
  TypographyVariant,
} from './Typography.types';

/**
 * Default HTML element per variant. Override via the `as` prop when the visual
 * hierarchy and the document-outline hierarchy diverge.
 */
const VARIANT_TO_ELEMENT: Record<TypographyVariant, ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  subtitle1: 'p',
  subtitle2: 'p',
  body1: 'p',
  body2: 'p',
  caption: 'span',
  overline: 'span',
  kicker: 'span',
  button: 'span',
};

/**
 * Tailwind recipes per variant. Sizes come from the modular scale (1.250)
 * defined in `packages/ui/src/styles/theme.css`. Tracking + line-height are
 * baked in so each variant is visually self-contained — call-sites never need
 * to override `text-*`, `font-*`, `tracking-*`, or `leading-*`.
 */
const VARIANT_CLASSES: Record<TypographyVariant, string> = {
  // Display family — Fraunces, tight tracking, balanced line-height.
  h1: 'font-display text-5xl font-medium leading-[1.05] tracking-[-0.02em] text-charcoal-800',
  h2: 'font-display text-4xl font-medium leading-[1.1] tracking-[-0.015em] text-charcoal-800',
  h3: 'font-display text-3xl font-medium leading-[1.1] tracking-[-0.01em] text-charcoal-800',
  h4: 'font-display text-2xl font-medium leading-[1.2] tracking-[-0.01em] text-charcoal-800',
  h5: 'font-display text-xl font-medium leading-[1.3] tracking-[-0.005em] text-charcoal-800',
  // h6 switches to sans-serif (UI weight) — better at small sizes than Fraunces.
  h6: 'font-body text-lg font-semibold leading-[1.4] text-charcoal-800',

  // Subtitle family — sans-serif, lighter weight than h6, used above/below body copy.
  subtitle1: 'font-body text-base font-medium leading-[1.5] text-charcoal-700',
  subtitle2: 'font-body text-sm font-semibold leading-[1.5] text-charcoal-700',

  // Body family — default reading text.
  body1: 'font-body text-base font-normal leading-[1.6] text-charcoal-700',
  body2: 'font-body text-sm font-normal leading-[1.55] text-charcoal-700',

  // Inline marks.
  caption: 'font-body text-xs font-normal leading-[1.5] text-charcoal-500',
  // overline = MUI uppercase mark (12px-ish)
  overline:
    'font-body text-[11px] font-semibold uppercase leading-[1.2] tracking-[0.06em] text-charcoal-500',
  // kicker = Tukio variant of overline coloured brand-700 (above H1 in hero/auth headers)
  kicker:
    'font-body text-[11px] font-semibold uppercase leading-[1.2] tracking-[0.06em] text-brand-700',

  // Button label recipe — used by the Button atom and any CTA-shaped link.
  button: 'font-body text-sm font-medium leading-none tracking-[0.01em]',
};

const COLOR_CLASSES: Record<TypographyColor, string> = {
  default: '',
  muted: 'text-charcoal-500',
  subtle: 'text-charcoal-400',
  inverse: 'text-cream-50',
  brand: 'text-brand-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  error: 'text-error-700',
  inherit: 'text-inherit',
};

const ALIGN_CLASSES: Record<TypographyAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Typography — the only place in the codebase that maps a semantic role
 * (heading level, body weight, caption…) to a concrete styling recipe.
 *
 * @example
 * <Typography variant="h2">Trouvez les bons pros</Typography>
 * <Typography variant="body2" color="muted">30 secondes, pas de carte bancaire.</Typography>
 * <Typography variant="kicker">Créer un compte · client</Typography>
 * <Typography variant="h3" as="h2">Display look, semantic H2</Typography>
 */
export function Typography({
  variant = 'body1',
  as,
  color = 'default',
  align,
  noWrap,
  gutterBottom,
  className,
  children,
  ...rest
}: TypographyProps) {
  const Tag = (as ?? VARIANT_TO_ELEMENT[variant]) as ElementType;
  return (
    <Tag
      className={cn(
        VARIANT_CLASSES[variant],
        color !== 'default' ? COLOR_CLASSES[color] : null,
        align ? ALIGN_CLASSES[align] : null,
        noWrap ? 'truncate' : null,
        gutterBottom ? 'mb-2' : null,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

Typography.displayName = 'Typography';
