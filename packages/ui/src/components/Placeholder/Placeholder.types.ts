import type { HTMLAttributes } from 'react';

export interface PlaceholderProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  aspect?: '4/3' | '16/9' | 'square' | string;
  height?: number | string;
}
