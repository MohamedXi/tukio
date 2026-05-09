import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Button } from './Button';

describe('Button', () => {
  it('renders with default variant and size', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it.each(['primary', 'secondary', 'tertiary', 'ghost', 'danger'] as const)(
    'renders variant=%s',
    (variant) => {
      const { container } = render(<Button variant={variant}>Btn</Button>);
      expect(container.querySelector('button')).toBeInTheDocument();
    },
  );

  it.each(['sm', 'default', 'lg'] as const)('renders size=%s', (size) => {
    const { container } = render(<Button size={size}>Btn</Button>);
    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders Spinner and sets aria-busy when loading', () => {
    const { container } = render(<Button loading>Click</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('forwards ref to native button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Click</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('passes axe a11y check — primary', async () => {
    const { container } = render(<Button>Reserve</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — danger disabled', async () => {
    const { container } = render(
      <Button variant="danger" disabled>
        Delete
      </Button>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — loading', async () => {
    const { container } = render(<Button loading>Submitting</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
