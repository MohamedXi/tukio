'use client';
import {
  createContext,
  useContext,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactElement,
} from 'react';
import { cn } from '../../utils/cn';
import { Label } from '../Label/Label';
import { Helper } from '../Helper/Helper';
import type { FormFieldProps, FormFieldContextValue } from './FormField.types';

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function useFormField() {
  return useContext(FormFieldContext);
}

export function FormField({ label, helper, error, required, children, className }: FormFieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, helper && !error ? helperId : null].filter(Boolean).join(' ') ||
    undefined;

  const enrichedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      id,
      'aria-describedby': describedBy,
      'aria-invalid': error ? 'true' : undefined,
      'aria-required': required ? 'true' : undefined,
    });
  });

  return (
    <FormFieldContext.Provider value={{ id, required, error, describedBy }}>
      <div className={cn('flex flex-col', className)}>
        {label && (
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        )}
        {enrichedChildren}
        {error ? (
          <span id={errorId} className="text-xs text-error-500 mt-1" role="alert">
            {error}
          </span>
        ) : helper ? (
          <Helper id={helperId}>{helper}</Helper>
        ) : null}
      </div>
    </FormFieldContext.Provider>
  );
}
