import type { HTMLAttributes, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { alertVariants } from './Alert';

export interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>, VariantProps<typeof alertVariants> {
  title?: string;
  children?: ReactNode;
  /** Override the default lucide icon for the chosen variant. */
  icon?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;
