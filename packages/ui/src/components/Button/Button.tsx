'use client';
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { Spinner } from '../Spinner/Spinner';
import type { ButtonProps } from './Button.types';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap border border-transparent rounded-md font-medium cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-cream-50 hover:bg-brand-400',
        secondary: 'bg-cream-100 text-charcoal-700 border-cream-300 hover:bg-cream-200',
        tertiary: 'bg-transparent text-brand-700 hover:bg-brand-50',
        ghost: 'bg-transparent text-charcoal-600 hover:bg-cream-100',
        danger: 'bg-danger-500 text-cream-50 hover:bg-danger-600',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        default: 'h-10 px-4 text-base',
        lg: 'h-12 px-5 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      icon,
      iconRight,
      children,
      disabled,
      asChild,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const iconSize = size === 'sm' ? 14 : 16;
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size="sm" color="currentColor" aria-hidden={true} />}
        {!loading && icon && (
          <span
            className="inline-flex items-center"
            aria-hidden="true"
            style={{ fontSize: iconSize }}
          >
            {icon}
          </span>
        )}
        <span>{children}</span>
        {iconRight && (
          <span
            className="inline-flex items-center"
            aria-hidden="true"
            style={{ fontSize: iconSize }}
          >
            {iconRight}
          </span>
        )}
      </Comp>
    );
  },
);

Button.displayName = 'Button';
