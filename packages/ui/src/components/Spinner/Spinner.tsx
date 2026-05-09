import { cn } from '../../utils/cn';
import type { SpinnerProps } from './Spinner.types';

const sizeMap = { xs: 12, sm: 16, default: 24, lg: 32 } as const;
const colorMap = {
  brand: 'text-brand-500',
  cream: 'text-cream-50',
  currentColor: 'text-current',
} as const;

export function Spinner({
  size = 'default',
  color = 'brand',
  'aria-label': ariaLabel = 'Loading',
  'aria-hidden': ariaHidden,
  className,
}: SpinnerProps) {
  const px = sizeMap[size];
  const isHidden = ariaHidden === true || ariaHidden === 'true';
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', colorMap[color], className)}
      aria-label={isHidden ? undefined : ariaLabel}
      aria-hidden={isHidden ? 'true' : undefined}
      role={isHidden ? undefined : 'status'}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="40 60"
      />
    </svg>
  );
}

Spinner.displayName = 'Spinner';
