import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import type { HelperProps } from './Helper.types';

export const Helper = forwardRef<HTMLParagraphElement, HelperProps>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-charcoal-400 mt-1', className)} {...props}>
      {children}
    </p>
  ),
);

Helper.displayName = 'Helper';
