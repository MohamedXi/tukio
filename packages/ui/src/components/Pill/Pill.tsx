import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import type { PillProps } from './Pill.types';

export const pillVariants = cva(
  'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border font-mono',
  {
    variants: {
      variant: {
        brand: 'bg-brand-50 text-brand-700 border-brand-100',
        charcoal: 'bg-charcoal-400/10 text-charcoal-700 border-charcoal-400/20',
        success: 'bg-success-50 text-success-700 border-success-500/30',
        cream: 'bg-cream-100 text-charcoal-600 border-cream-200',
      },
    },
    defaultVariants: { variant: 'brand' },
  },
);

export const Pill = forwardRef<HTMLSpanElement, PillProps>(
  ({ className, variant, pulseDot, icon, children, ...props }, ref) => (
    <span ref={ref} className={cn(pillVariants({ variant }), className)} {...props}>
      {pulseDot && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: 'var(--animate-pulse)' }}
        />
      )}
      {icon && (
        <span className="inline-flex" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  ),
);

Pill.displayName = 'Pill';
