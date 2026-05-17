'use client';
import { Children, isValidElement, type ReactElement } from 'react';
import { cn } from '../../utils/cn';
import type { SummaryListItemProps, SummaryListProps } from './SummaryList.types';

/**
 * Vertical list of summary rows enclosed in a rounded card. Each row is a
 * `SummaryList.Item` with leading icon, label/value pair and an optional
 * Edit button. Used by wizard recap screens, booking confirmation, checkout
 * summary, settings detail rows, etc.
 *
 * Rows are visually separated by a thin `border-cream-200` line — applied
 * automatically by the wrapper so consumers don't need to thread an `isFirst`
 * prop.
 */
export function SummaryList({ children, className }: SummaryListProps) {
  const items = Children.toArray(children).filter((c): c is ReactElement => isValidElement(c));
  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-cream-200 bg-cream-50', className)}
    >
      {items.map((child, i) => (
        <div
          key={(child.key as string | null) ?? i}
          className={i === 0 ? '' : 'border-t border-cream-200'}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

function SummaryListItem({
  icon,
  label,
  value,
  onEdit,
  editLabel,
  className,
}: SummaryListItemProps) {
  return (
    <div className={cn('flex items-center gap-4 px-5 py-4', className)}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-charcoal-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-charcoal-800">{value}</p>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-xs font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          {editLabel}
        </button>
      )}
    </div>
  );
}

SummaryListItem.displayName = 'SummaryList.Item';
SummaryList.Item = SummaryListItem;
SummaryList.displayName = 'SummaryList';
