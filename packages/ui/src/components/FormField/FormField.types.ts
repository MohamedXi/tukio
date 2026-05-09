import type { ReactNode } from 'react';

export interface FormFieldProps {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export interface FormFieldContextValue {
  id: string;
  required?: boolean;
  error?: string;
  describedBy?: string;
}
