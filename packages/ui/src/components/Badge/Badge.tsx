import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import type { BadgeProps } from './Badge.types';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full tracking-tight border',
  {
    variants: {
      variant: {
        brand: 'bg-brand-50 text-brand-700 border-brand-100',
        success: 'bg-success-50 text-success-700 border-transparent',
        warning: 'bg-warning-50 text-warning-700 border-transparent',
        info: 'bg-info-50 text-info-700 border-transparent',
        neutral: 'bg-cream-100 text-charcoal-600 border-cream-200',
        danger: 'bg-danger-50 text-danger-700 border-transparent',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon && (
        <span className="inline-flex" aria-hidden="true" style={{ fontSize: 12 }}>
          {icon}
        </span>
      )}
      {children}
    </span>
  ),
);

Badge.displayName = 'Badge';
