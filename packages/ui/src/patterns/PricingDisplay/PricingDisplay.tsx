'use client';
import { cn } from '../../utils/cn';
import type { PricingDisplayProps } from './PricingDisplay.types';

export function PricingDisplay({
  items,
  total,
  formatMoney,
  variant = 'detailed',
  className,
}: PricingDisplayProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-between', className)}>
        <span className="text-charcoal-600 text-sm">{total.label}</span>
        <span className="text-2xl font-display text-charcoal-800 tabular-nums">
          {formatMoney(total.amount, total.currency)}
        </span>
      </div>
    );
  }

  return (
    <dl className={cn('flex flex-col gap-2', className)}>
      {/* P20 fix: composite key from label + amount avoids state corruption on reorder */}
      {items.map((item) => (
        <div key={`${item.label}-${item.amount}`} className="flex items-center justify-between">
          <dt className="text-charcoal-600 text-sm">{item.label}</dt>
          <dd className="text-charcoal-700 text-sm tabular-nums">
            {formatMoney(item.amount, item.currency)}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-cream-200 pt-3 mt-3">
        <dt className="font-semibold text-charcoal-800">{total.label}</dt>
        <dd className="text-2xl font-display text-charcoal-800 tabular-nums">
          {formatMoney(total.amount, total.currency)}
        </dd>
      </div>
    </dl>
  );
}

PricingDisplay.displayName = 'PricingDisplay';
