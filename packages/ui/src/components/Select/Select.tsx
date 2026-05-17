'use client';
import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { SelectProps } from './Select.types';

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, error, disabled, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'h-10 w-full appearance-none bg-cream-50 border border-cream-300 rounded-sm text-base text-charcoal-700 outline-none transition-colors',
            'pl-3 pr-10',
            'focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(194,65,12,0.18)]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-cream-100',
            error &&
              'border-error-500 focus:border-error-500 focus:shadow-[0_0_0_3px_rgba(185,28,28,0.18)]',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400"
        />
      </div>
    );
  },
);

Select.displayName = 'Select';
