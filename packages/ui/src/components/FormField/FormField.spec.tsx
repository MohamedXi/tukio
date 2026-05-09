import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { FormField, useFormField } from './FormField';
import { Input } from '../Input/Input';

describe('FormField', () => {
  it('renders label and input together', () => {
    render(
      <FormField label="Email">
        <Input />
      </FormField>,
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('injects aria-invalid on child when error is set', () => {
    const { container } = render(
      <FormField label="Email" error="Required">
        <Input />
      </FormField>,
    );
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders error message with role=alert', () => {
    render(
      <FormField label="Email" error="Invalid email">
        <Input />
      </FormField>,
    );
    const errorMsg = screen.getByText('Invalid email');
    expect(errorMsg).toBeInTheDocument();
    expect(errorMsg).toHaveAttribute('role', 'alert');
  });

  it('renders helper text when no error', () => {
    render(
      <FormField label="Email" helper="We never share your email">
        <Input />
      </FormField>,
    );
    expect(screen.getByText('We never share your email')).toBeInTheDocument();
  });

  it('passes axe a11y check — normal', async () => {
    const { container } = render(
      <FormField label="Email" helper="Format: you@example.com">
        <Input />
      </FormField>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('useFormField returns context values inside FormField', () => {
    const captured: { ctx: ReturnType<typeof useFormField> } = { ctx: null };
    function ContextCapture() {
      captured.ctx = useFormField();
      return null;
    }
    render(
      <FormField label="Email" error="Invalid" required>
        <ContextCapture />
        <Input />
      </FormField>,
    );
    expect(captured.ctx).not.toBeNull();
    expect(captured.ctx!.error).toBe('Invalid');
    expect(captured.ctx!.required).toBe(true);
    expect(captured.ctx!.id).toBeDefined();
  });

  it('passes axe a11y check — error state', async () => {
    const { container } = render(
      <FormField label="Email" error="Invalid email">
        <Input />
      </FormField>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
