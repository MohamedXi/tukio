import type { HTMLAttributes, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { kickerVariants } from './Kicker';

export interface KickerProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'>, VariantProps<typeof kickerVariants> {
  /** Uppercase mono label — fed by next-intl t() in consumer apps. */
  children: ReactNode;
}

export type KickerColor = NonNullable<VariantProps<typeof kickerVariants>['color']>;
export type KickerSize = NonNullable<VariantProps<typeof kickerVariants>['size']>;
