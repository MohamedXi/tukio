import type { ReactNode } from 'react';

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  requireExplicitClose?: boolean;
  closeLabel?: string;
  children: ReactNode;
}

export interface ModalSectionProps {
  children: ReactNode;
  className?: string;
}
