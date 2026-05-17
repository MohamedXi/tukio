'use client';
import { cn } from '../../utils/cn';
import type { StepIndicatorProps, StepStatus } from './StepIndicator.types';

function getStatus(index: number, current: number): StepStatus {
  if (index < current) return 'completed';
  if (index === current) return 'current';
  return 'upcoming';
}

const barClasses: Record<StepStatus, string> = {
  completed: 'bg-success-500',
  current: 'bg-brand-500',
  upcoming: 'bg-cream-200',
};

const labelColorClasses: Record<StepStatus, string> = {
  completed: 'text-success-700',
  current: 'text-brand-700',
  upcoming: 'text-charcoal-400',
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
    <ol className={cn('flex', isVertical ? 'flex-col gap-3' : 'gap-1.5', className)}>
      {steps.map((label, index) => {
        const status = getStatus(index, current);
        const isClickable = Boolean(onStepClick) && status === 'completed';
        const ariaLabel = formatStepLabel({ index, total: steps.length, label, status });
        const ariaCurrent = status === 'current' ? ('step' as const) : undefined;

        const inner = (
          <span className={cn('flex flex-col gap-2', !isVertical && 'w-full')}>
            <span
              className={cn(
                'block rounded-full transition-colors duration-300',
                isVertical ? 'h-full w-1' : 'h-1 w-full',
                barClasses[status],
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'text-xs transition-colors duration-300',
                status === 'current' ? 'font-semibold' : 'font-medium',
                labelColorClasses[status],
              )}
            >
              {index + 1}. {label}
            </span>
          </span>
        );

        return (
          <li
            key={index}
            className={cn('flex', !isVertical && 'flex-1')}
            aria-current={ariaCurrent}
          >
            {isClickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                aria-label={ariaLabel}
                className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 rounded"
              >
                {inner}
              </button>
            ) : (
              <span aria-label={ariaLabel} className="w-full">
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

StepIndicator.displayName = 'StepIndicator';
