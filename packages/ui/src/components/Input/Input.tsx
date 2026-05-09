'use client';
import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { InputProps } from './Input.types';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, prefix, suffix, error, clearable, onClear, value, onChange, disabled, ...props },
    ref,
  ) => {
    const hasPrefix = Boolean(prefix);
    // Use strict check so value=0 or value="" still correctly shows/hides the clear button
    const hasValue = value != null && value !== '';
    const hasSuffix = Boolean(suffix) || Boolean(clearable && hasValue);

    return (
      <div className="relative flex items-center w-full">
        {prefix && (
          <span className="absolute left-3 flex items-center pointer-events-none text-charcoal-400">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            'h-10 bg-cream-50 border border-cream-300 rounded-sm text-base text-charcoal-700 w-full outline-none transition-colors',
            'placeholder:text-charcoal-400',
            'focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(194,65,12,0.18)]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-cream-100',
            error &&
              'border-error-500 focus:border-error-500 focus:shadow-[0_0_0_3px_rgba(185,28,28,0.18)]',
            // Use explicit pl-/pr- to avoid px-3 conflicting with pl-10/pr-10 via tailwind-merge
            hasPrefix ? 'pl-10' : 'pl-3',
            hasSuffix ? 'pr-10' : 'pr-3',
            className,
          )}
          {...props}
        />
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={() => {
              if (onClear) {
                onClear();
              } else if (onChange) {
                // Construct a minimal synthetic event that includes `name` for React Hook Form
                onChange({
                  target: {
                    value: '',
                    name: (props as { name?: string }).name ?? '',
                  } as HTMLInputElement,
                  currentTarget: { value: '' } as HTMLInputElement,
                  nativeEvent: new InputEvent('input', { bubbles: true }),
                  type: 'change',
                  preventDefault: () => {},
                  stopPropagation: () => {},
                  persist: () => {},
                  isDefaultPrevented: () => false,
                  isPropagationStopped: () => false,
                  bubbles: true,
                  cancelable: true,
                  eventPhase: 0,
                  isTrusted: false,
                  timeStamp: Date.now(),
                } as unknown as React.ChangeEvent<HTMLInputElement>);
              }
            }}
            className="absolute right-3 flex items-center text-charcoal-400 hover:text-charcoal-700"
            aria-label="Clear input"
          >
            <X size={14} />
          </button>
        )}
        {!clearable && suffix && (
          <span className="absolute right-3 flex items-center pointer-events-none text-charcoal-400">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
