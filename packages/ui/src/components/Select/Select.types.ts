import type { ReactNode, SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Optional declarative options. When provided, the component renders an
   * <option> per entry. Otherwise children are rendered directly so callers
   * keep control (e.g. <optgroup>, dynamic option rendering).
   */
  options?: SelectOption[];
  /** Optional disabled-by-default first option used as a placeholder. */
  placeholder?: string;
  /** Red border + aria-invalid for error states. */
  error?: boolean;
  children?: ReactNode;
}
