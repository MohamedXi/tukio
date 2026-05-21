import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import type { KickerProps } from './Kicker.types';

export const kickerVariants = cva('inline-block font-mono uppercase tracking-[0.08em]', {
  variants: {
    color: {
      brand: 'text-brand-700',
      charcoal: 'text-charcoal-500',
      cream: 'text-cream-200',
      success: 'text-success-700',
    },
    size: {
      sm: 'text-[11px]',
      md: 'text-[13px]',
    },
  },
  defaultVariants: { color: 'brand', size: 'sm' },
});

export const Kicker = forwardRef<HTMLSpanElement, KickerProps>(
  ({ className, color, size, children, ...props }, ref) => (
    <span ref={ref} className={cn(kickerVariants({ color, size }), className)} {...props}>
      {children}
    </span>
  ),
);

Kicker.displayName = 'Kicker';
