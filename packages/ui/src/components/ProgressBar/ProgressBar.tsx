import { cn } from '../../utils/cn';
import type { ProgressBarProps } from './ProgressBar.types';

const variantMap = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
} as const;

export function ProgressBar({
  value = 0,
  max = 100,
  variant = 'brand',
  indeterminate,
  className,
  'aria-label': ariaLabel = 'Loading',
  ...props
}: ProgressBarProps) {
  // P5 fix: guard against max=0 (division by zero → NaN in style.width)
  const safePct =
    indeterminate || max <= 0 ? undefined : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      aria-busy={indeterminate}
      className={cn('w-full h-2 bg-cream-200 rounded-full overflow-hidden', className)}
      {...props}
    >
      {indeterminate ? (
        <div
          className={cn(
            'h-full rounded-full animate-[tk-shimmer_1.5s_ease-in-out_infinite] w-1/2',
            variantMap[variant],
          )}
        />
      ) : (
        <div
          className={cn('h-full rounded-full transition-all duration-300', variantMap[variant])}
          style={{ width: `${safePct ?? 0}%` }}
        />
      )}
    </div>
  );
}

ProgressBar.displayName = 'ProgressBar';
