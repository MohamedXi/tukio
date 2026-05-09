import type { HTMLAttributes, ReactNode, ElementType } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  hoverable?: boolean;
  interactive?: boolean;
}

export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}
