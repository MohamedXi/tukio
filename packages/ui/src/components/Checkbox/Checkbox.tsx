'use client';
import { forwardRef, useEffect, useRef, type Ref } from 'react';
import { cn } from '../../utils/cn';
import type { CheckboxProps } from './Checkbox.types';

function composeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, wrapperClassName, children, error, indeterminate, disabled, ...props },
    forwardedRef,
  ) => {
    const innerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    return (
      <label
        className={cn(
          'inline-flex items-start gap-3 text-sm leading-relaxed',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          error ? 'text-error-700' : 'text-charcoal-600',
          wrapperClassName,
        )}
      >
        <input
          ref={composeRefs(innerRef, forwardedRef)}
          type="checkbox"
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          className={cn('mt-0.5 accent-brand-500', error && 'accent-error-500', className)}
          {...props}
        />
        {children && <span className="min-w-0 flex-1">{children}</span>}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
