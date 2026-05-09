import type { HTMLAttributes } from 'react';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'brand' | 'success' | 'warning' | 'error';
  indeterminate?: boolean;
  'aria-label'?: string;
}
