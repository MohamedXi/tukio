'use client';
import { useState } from 'react';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import { Stars } from '../../components/Stars/Stars';
import { EmptyState } from '../EmptyState/EmptyState';
import { cn } from '../../utils/cn';
import type {
  ReviewsDisplayProps,
  ReviewsBreakdown,
  BreakdownLabels,
} from './ReviewsDisplay.types';

const defaultLabels: Required<BreakdownLabels> = {
  punctuality: 'Punctuality',
  communication: 'Communication',
  valueForMoney: 'Value for money',
  professionalism: 'Professionalism',
};

export function ReviewsDisplay({
  rating,
  count,
  reviews,
  breakdown,
  breakdownLabels,
  loadMoreLabel = 'Load more reviews',
  pageSize = 3,
  dateFormatter = (date) => (typeof date === 'string' ? date : date.toLocaleDateString()),
  className,
}: ReviewsDisplayProps) {
  const [visible, setVisible] = useState(pageSize);

  if (reviews.length === 0) {
    return <EmptyState variant="reviews-empty" />;
  }

  const labels = { ...defaultLabels, ...breakdownLabels };

  return (
    <section className={cn('flex flex-col gap-6', className)}>
      {/* Summary */}
      <div className="flex items-center gap-3">
        <Stars value={rating} count={count} size={20} />
      </div>

      {/* Breakdown (optional) */}
      {breakdown && (
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          {(Object.keys(breakdown) as Array<keyof ReviewsBreakdown>).map((key) => {
            const value = breakdown[key];
            if (value === undefined) return null;
            return (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-charcoal-600">{labels[key]}</span>
                  <span className="text-charcoal-700 tabular-nums">{value.toFixed(1)}</span>
                </div>
                <ProgressBar
                  value={value}
                  max={5}
                  variant="brand"
                  aria-label={`${labels[key]}: ${value.toFixed(1)} out of 5`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      <ul className="flex flex-col gap-4">
        {reviews.slice(0, visible).map((review) => (
          <li
            key={review.id}
            className="flex flex-col gap-2 p-4 bg-cream-50 border border-cream-200 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Avatar name={review.authorName} src={review.authorAvatar} size={32} tone="cream" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal-800">{review.authorName}</p>
                <p className="text-xs text-charcoal-400">{dateFormatter(review.date)}</p>
              </div>
              <Stars value={review.rating} size={14} />
            </div>
            <p className="text-sm text-charcoal-700">{review.comment}</p>
          </li>
        ))}
      </ul>

      {visible < reviews.length && (
        <Button variant="tertiary" onClick={() => setVisible((v) => v + pageSize)}>
          {loadMoreLabel}
        </Button>
      )}
    </section>
  );
}

ReviewsDisplay.displayName = 'ReviewsDisplay';
