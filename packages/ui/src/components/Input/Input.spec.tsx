import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Input } from './Input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Email" aria-label="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('applies error styling when error prop is true', () => {
    const { container } = render(<Input error aria-label="Email" />);
    const input = container.querySelector('input');
    expect(input?.className).toContain('border-error-500');
  });

  it('forwards ref to native input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('fires onChange when typing', async () => {
    const handler = vi.fn();
    render(<Input onChange={handler} aria-label="test" />);
    await userEvent.type(screen.getByRole('textbox'), 'hello');
    expect(handler).toHaveBeenCalled();
  });

  it('renders clear button when clearable and value is set', () => {
    render(<Input clearable value="hello" onChange={() => {}} aria-label="test" />);
    expect(screen.getByLabelText('Clear input')).toBeInTheDocument();
  });

  it('is disabled when disabled prop set', () => {
    render(<Input disabled aria-label="test" />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <label>
        Email
        <Input placeholder="you@example.com" />
      </label>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('clear button calls onClear when provided', async () => {
    const onClear = vi.fn();
    render(
      <Input clearable value="hello" onClear={onClear} onChange={() => {}} aria-label="test" />,
    );
    await userEvent.click(screen.getByLabelText('Clear input'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('clear button fires synthetic onChange when onClear is not provided', async () => {
    const handler = vi.fn();
    render(<Input clearable value="hello" onChange={handler} aria-label="test" name="myfield" />);
    await userEvent.click(screen.getByLabelText('Clear input'));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '', name: 'myfield' }) }),
    );
  });

  it('passes axe a11y check — error state', async () => {
    const { container } = render(
      <div>
        <label htmlFor="email">Email</label>
        <Input id="email" error aria-invalid="true" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
