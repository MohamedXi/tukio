import { cn } from '../../utils/cn';
import type { SkeletonProps } from './Skeleton.types';

const roundedMap = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const;

export function Skeleton({
  width,
  height,
  rounded = 'md',
  variant = 'pulse',
  className,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        roundedMap[rounded],
        // P12 fix: bg-cream-200 only for pulse; shimmer uses gradient which replaces background
        // Story 0.16 overrides --animate-pulse → use Tailwind's built-in 'pulse' keyframe directly
        variant === 'pulse' && 'bg-cream-200 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]',
        variant === 'shimmer' &&
          'animate-[tk-shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-cream-100 via-cream-200 to-cream-100 bg-[length:1000px_100%]',
        className,
      )}
      style={{
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height:
          height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

Skeleton.displayName = 'Skeleton';
