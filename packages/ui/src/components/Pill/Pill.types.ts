import type { HTMLAttributes, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { pillVariants } from './Pill';

export interface PillProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  /** Renders a pulsing dot before children. Dot inherits text color via bg-current. */
  pulseDot?: boolean;
  /** Optional leading icon (typically a lucide-react glyph). */
  icon?: ReactNode;
  children: ReactNode;
}

export type PillVariant = NonNullable<VariantProps<typeof pillVariants>['variant']>;
