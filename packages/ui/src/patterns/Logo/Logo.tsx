import { cn } from '../../utils/cn';
import { LogoMark } from './LogoMark';
import type { LogoProps } from './Logo.types';

/**
 * Tukio brand logo — wordmark "tukio.one" in Fraunces with terracotta dot.
 * Defaults: size=28px, mono=false (dot in brand-500), showDomain=true.
 */
export function Logo({
  size = 28,
  mono = false,
  showDomain = true,
  color,
  className,
  'aria-label': ariaLabel = 'tukio.one',
}: LogoProps) {
  const wordColor = color ?? 'var(--color-charcoal-800)';
  const dotColor = mono ? wordColor : 'var(--color-brand-500)';

  return (
    <span
      className={cn('inline-flex items-center gap-2 select-none', className)}
      role="img"
      aria-label={ariaLabel}
      style={{ height: size }}
    >
      <LogoMark size={size} color={dotColor} aria-label="" />
      <span
        className="font-display font-medium leading-none"
        style={{ fontSize: size * 0.78, color: wordColor, letterSpacing: '-0.01em' }}
        aria-hidden="true"
      >
        tukio
        {showDomain && (
          <span style={{ color: dotColor }} aria-hidden="true">
            .
          </span>
        )}
        {showDomain && <span aria-hidden="true">one</span>}
      </span>
    </span>
  );
}

Logo.displayName = 'Logo';
