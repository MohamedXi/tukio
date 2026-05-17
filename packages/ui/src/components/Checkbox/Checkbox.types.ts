import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
> {
  /** Label content rendered next to the checkbox. Supports rich nodes (links, formatting). */
  children?: ReactNode;
  /** Red accent + aria-invalid for error states (e.g. required charter not accepted). */
  error?: boolean;
  /** Sets the input.indeterminate flag — visual only, not part of HTML attrs. */
  indeterminate?: boolean;
  /** Extra class applied to the wrapping <label>. */
  wrapperClassName?: string;
}
