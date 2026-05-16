import { cn } from '../../utils/cn';
import type { LogoProps } from './Logo.types';

/**
 * Tukio brand logo — wordmark `tukio.1ne` in Fraunces. Direction B from the
 * Cloud Design exploration: the `.one` becomes a stylised serif `1` paired
 * with `ne` — reads as "tukio + 1 = un seul événement, une seule plateforme".
 *
 * - `tukio` (charcoal-800, Fraunces medium, tight tracking)
 * - `.`    (brand-500, smaller, baseline-lifted to feel like a top dot)
 * - `1`    (brand-600, Fraunces italic medium, with a subtle accent underline)
 * - `ne`   (charcoal-500, Fraunces regular)
 *
 * `mono` collapses every accent onto the word color (used on dark/photo bgs).
 * `slogan` renders the "Un événement. Une plateforme." kicker beneath the mark.
 */
export function Logo({
  size = 28,
  mono = false,
  showDomain = true,
  slogan = false,
  color,
  className,
  'aria-label': ariaLabel = 'tukio.1ne — un événement, une plateforme',
}: LogoProps) {
  const wordColor = color ?? 'var(--color-charcoal-800)';
  const accentColor = mono ? wordColor : 'var(--color-brand-500)';
  const oneColor = mono ? wordColor : 'var(--color-brand-600)';
  const neColor = mono ? wordColor : 'var(--color-charcoal-500)';
  // Fraunces medium font-size scaled from the height (78% feels right at all sizes)
  const wordSize = size * 0.78;
  // The dot is rendered as a circle vertically centered on the cap-height of
  // the wordmark (~0.7 × fontSize). Diameter ~16% of the cap-height feels
  // proportional at every size; bump the slot width to keep horizontal rhythm.
  const capHeight = wordSize * 0.7;
  const dotDiameter = capHeight * 0.22;
  const dotSlotWidth = dotDiameter * 1.6;
  // The slogan kicker reuses the design-system kicker recipe (mono, uppercase, tracking).
  const sloganSize = Math.max(10, size * 0.42);

  return (
    <span
      className={cn('inline-flex select-none flex-col items-start gap-1', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <span
        className="inline-flex items-baseline leading-none"
        style={{ height: size }}
        aria-hidden="true"
      >
        {/* tukio */}
        <span
          className="font-display font-medium"
          style={{ fontSize: wordSize, color: wordColor, letterSpacing: '-0.025em' }}
        >
          tukio
        </span>

        {showDomain && (
          <>
            {/* Dot — circle centered on the cap-height of the wordmark.
                The outer span reserves baseline-aligned horizontal space; the
                inner circle is absolutely centered on the cap-height line so it
                doesn't sit at the baseline like a punctuation dot. */}
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                position: 'relative',
                width: dotSlotWidth,
                height: capHeight,
                verticalAlign: 'baseline',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: dotDiameter,
                  height: dotDiameter,
                  background: accentColor,
                  borderRadius: '9999px',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </span>
            {/* 1 — italic serif numeral with subtle accent underline */}
            <span
              className="font-display font-medium italic"
              style={{
                fontSize: wordSize,
                color: oneColor,
                letterSpacing: '-0.04em',
                position: 'relative',
                display: 'inline-block',
              }}
            >
              1
              {!mono && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: -1,
                    right: -1,
                    bottom: wordSize * 0.2,
                    height: Math.max(1, wordSize * 0.03),
                    background: 'var(--color-brand-300)',
                    opacity: 0.4,
                  }}
                />
              )}
            </span>
            {/* ne — regular weight, muted */}
            <span
              className="font-display"
              style={{
                fontSize: wordSize,
                color: neColor,
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              ne
            </span>
          </>
        )}
      </span>

      {slogan && (
        <span
          className="font-mono uppercase"
          style={{
            fontSize: sloganSize,
            letterSpacing: '0.08em',
            color: mono ? wordColor : 'var(--color-charcoal-500)',
            opacity: 0.85,
          }}
          aria-hidden="true"
        >
          un événement · une plateforme
        </span>
      )}
    </span>
  );
}

Logo.displayName = 'Logo';
