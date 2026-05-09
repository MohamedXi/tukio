'use client';
import { forwardRef } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import type { AlertProps } from './Alert.types';

export const alertVariants = cva('flex items-start gap-3 p-4 rounded-lg border', {
  variants: {
    variant: {
      success: 'bg-success-50 border-success-500 text-success-700',
      warning: 'bg-warning-50 border-warning-500 text-warning-700',
      error: 'bg-error-50 border-error-500 text-error-700',
      info: 'bg-info-50 border-info-500 text-info-700',
    },
  },
  defaultVariants: { variant: 'info' },
});

const IconMap = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant = 'info', title, children, onDismiss, dismissLabel = 'Dismiss', ...props },
    ref,
  ) => {
    const Icon = IconMap[variant ?? 'info'];
    const isAlert = variant === 'error' || variant === 'warning';

    return (
      <div
        ref={ref}
        className={cn(alertVariants({ variant }), className)}
        role={isAlert ? 'alert' : 'status'}
        {...props}
      >
        <Icon size={20} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {title && <p className="font-semibold text-base mb-1">{title}</p>}
          {children && <div className="text-sm text-charcoal-600">{children}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="flex-shrink-0 text-current opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  },
);

Alert.displayName = 'Alert';
