import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import type { LabelProps } from './Label.types';

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm text-charcoal-500 font-semibold mb-1.5 block', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-error-500 ml-1" aria-hidden="true">
          *
        </span>
      )}
    </label>
  ),
);

Label.displayName = 'Label';
