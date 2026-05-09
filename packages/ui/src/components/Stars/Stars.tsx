'use client';
import { useId } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { StarsProps } from './Stars.types';

export function Stars({
  value,
  count,
  size = 14,
  interactive,
  onChange,
  countLabel = 'reviews',
  className,
}: StarsProps) {
  const groupId = useId();

  if (interactive) {
    return (
      // P7 fix: use native <input type="radio"> for proper radiogroup keyboard navigation
      // (browsers handle arrow-key navigation natively within same name group)
      <div
        className={cn('inline-flex items-center gap-1', className)}
        role="radiogroup"
        aria-label="Star rating"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            className="cursor-pointer focus-within:ring-2 focus-within:ring-brand-200 rounded"
          >
            <input
              type="radio"
              name={`stars-${groupId}`}
              value={star}
              checked={star === value}
              onChange={() => onChange?.(star)}
              className="sr-only"
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            />
            <Star
              size={size}
              fill={star <= value ? 'var(--color-brand-500)' : 'transparent'}
              color={star <= value ? 'var(--color-brand-500)' : 'var(--color-charcoal-400)'}
              strokeWidth={2}
              aria-hidden="true"
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', className)}>
      <Star
        size={size}
        fill="var(--color-brand-500)"
        color="var(--color-brand-500)"
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="text-charcoal-700 tabular-nums">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-charcoal-400 font-normal">
          &middot; {count} {countLabel}
        </span>
      )}
    </span>
  );
}

Stars.displayName = 'Stars';
