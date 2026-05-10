import { cn } from '../../utils/cn';
import type { LogoMarkProps } from './Logo.types';

/**
 * Tukio brand mark — minimal arch SVG (terracotta) without wordmark.
 * Used for favicon, mobile compact, og:image.
 *
 * - When `decorative={true}` (P25 fix): renders aria-hidden, no role="img" — used by <Logo>
 * - Otherwise: role="img" + aria-label for standalone branding use
 *
 * P29 fix: stroke/fill use `currentColor` so consumers can theme via CSS color.
 */
export function LogoMark({
  size = 32,
  color,
  className,
  'aria-label': ariaLabel = 'Tukio',
  decorative = false,
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? 'true' : undefined}
      style={color ? { color } : undefined}
      className={cn('inline-block flex-shrink-0 text-brand-500', className)}
    >
      {/* Arch shape: a half-ellipse representing a celebratory event arch */}
      <path
        d="M4 24 Q4 8 16 8 Q28 8 28 24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Anchor dot at the keystone */}
      <circle cx="16" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

LogoMark.displayName = 'LogoMark';
