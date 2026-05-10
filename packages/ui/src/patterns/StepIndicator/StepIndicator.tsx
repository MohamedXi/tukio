'use client';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { StepIndicatorProps, StepStatus } from './StepIndicator.types';

function getStatus(index: number, current: number): StepStatus {
  if (index < current) return 'completed';
  if (index === current) return 'current';
  return 'upcoming';
}

const circleClasses: Record<StepStatus, string> = {
  completed: 'bg-success-500 text-cream-50',
  current: 'bg-brand-500 text-cream-50',
  upcoming: 'bg-cream-200 text-charcoal-400',
};

function defaultFormatLabel({
  index,
  total,
  label,
  status,
}: {
  index: number;
  total: number;
  label: string;
  status: StepStatus;
}): string {
  const statusText =
    status === 'completed' ? 'completed' : status === 'current' ? 'in progress' : 'upcoming';
  return `Step ${index + 1} of ${total}: ${label}, ${statusText}`;
}

export function StepIndicator({
  steps,
  current,
  orientation = 'horizontal',
  onStepClick,
  formatStepLabel = defaultFormatLabel,
  className,
}: StepIndicatorProps) {
  const isVertical = orientation === 'vertical';

  return (
    <ol className={cn('flex', isVertical ? 'flex-col gap-4' : 'items-center gap-3', className)}>
      {steps.map((label, index) => {
        const status = getStatus(index, current);
        const isClickable = Boolean(onStepClick) && status === 'completed';
        const ariaLabel = formatStepLabel({ index, total: steps.length, label, status });
        const ariaCurrent = status === 'current' ? ('step' as const) : undefined;

        const circle = (
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0',
              'w-6 h-6 text-xs',
              circleClasses[status],
            )}
            aria-hidden="true"
          >
            {status === 'completed' ? <Check size={14} /> : index + 1}
          </span>
        );

        const content = (
          <>
            {circle}
            <span className="text-sm font-medium text-charcoal-700">{label}</span>
          </>
        );

        return (
          <li
            key={index}
            className={cn('flex items-center gap-2', !isVertical && 'flex-1')}
            aria-current={ariaCurrent}
          >
            {isClickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                aria-label={ariaLabel}
                className="inline-flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 rounded"
              >
                {content}
              </button>
            ) : (
              <span aria-label={ariaLabel} className="inline-flex items-center gap-2">
                {content}
              </span>
            )}
            {!isVertical && index < steps.length - 1 && (
              <span className="flex-1 border-t border-cream-200" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

StepIndicator.displayName = 'StepIndicator';
