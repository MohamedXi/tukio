'use client';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ToastOptions, ToastEntry, ToastContextValue, ToasterProps } from './Toast.types';

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <Toaster>');
  return ctx;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const variantStyles = {
  success: 'border-success-500 bg-success-50',
  error: 'border-error-500 bg-error-50',
  warning: 'border-warning-500 bg-warning-50',
  info: 'border-info-500 bg-info-50',
} as const;

const iconStyles = {
  success: 'text-success-500',
  error: 'text-error-500',
  warning: 'text-warning-500',
  info: 'text-info-500',
} as const;

export function Toaster({ children, swipeThreshold = 50, duration = 5000 }: ToasterProps) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const toast = useCallback((opts: ToastOptions) => {
    const id = crypto.randomUUID();
    setEntries((prev) => [...prev, { ...opts, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <ToastPrimitive.Provider
        swipeDirection="right"
        duration={duration}
        swipeThreshold={swipeThreshold}
      >
        {children}
        {entries.map((e) => {
          const variant = e.variant ?? 'info';
          const Icon = iconMap[variant];
          const isAlert = variant === 'error' || variant === 'warning';
          const toastDuration = e.duration ?? (isAlert ? 8000 : 5000);

          return (
            <ToastPrimitive.Root
              key={e.id}
              duration={toastDuration}
              type={isAlert ? 'foreground' : 'background'}
              className={cn(
                'rounded-lg shadow-md p-4 flex items-start gap-3 border',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
                'data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
                variantStyles[variant],
              )}
              onOpenChange={(open) => !open && dismiss(e.id)}
            >
              {/* P10 fix: remove inner role/aria-live wrapper — Radix Toast.Root with
                  type="foreground" already manages its own assertive live region announcement.
                  Nesting role="alert" caused double announcement to screen readers. */}
              <Icon
                size={20}
                className={cn('flex-shrink-0', iconStyles[variant])}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <ToastPrimitive.Title className="font-semibold text-charcoal-800">
                  {e.title}
                </ToastPrimitive.Title>
                {e.description && (
                  <ToastPrimitive.Description className="text-sm text-charcoal-500 mt-1">
                    {e.description}
                  </ToastPrimitive.Description>
                )}
              </div>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)] outline-none z-50" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = ToastPrimitive.Viewport;
