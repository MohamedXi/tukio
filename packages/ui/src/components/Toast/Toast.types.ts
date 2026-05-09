import type { ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastEntry extends ToastOptions {
  id: string;
}

export interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
  dismiss: (id: string) => void;
}

export interface ToasterProps {
  children: ReactNode;
  swipeThreshold?: number;
  duration?: number;
}
