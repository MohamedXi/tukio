import { cn } from '../../utils/cn';
import type { LogoMarkProps } from './Logo.types';

/**
 * Tukio brand mark — minimal arch SVG (terracotta) without wordmark.
 * Used for favicon, mobile compact, og:image.
 */
export function LogoMark({
  size = 32,
  color = 'var(--color-brand-500)',
  className,
  'aria-label': ariaLabel = 'Tukio',
}: LogoMarkProps) {
  // Empty aria-label means decorative (used inside <Logo> which carries the label)
  const isDecorative = ariaLabel === '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={isDecorative ? undefined : 'img'}
      aria-label={isDecorative ? undefined : ariaLabel}
      aria-hidden={isDecorative ? 'true' : undefined}
      className={cn('inline-block flex-shrink-0', className)}
    >
      {/* Arch shape: a half-ellipse representing a celebratory event arch */}
      <path
        d="M4 24 Q4 8 16 8 Q28 8 28 24"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Anchor dot at the keystone */}
      <circle cx="16" cy="8" r="2" fill={color} />
    </svg>
  );
}

LogoMark.displayName = 'LogoMark';
