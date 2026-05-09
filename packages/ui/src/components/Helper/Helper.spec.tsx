import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Helper } from './Helper';

describe('Helper', () => {
  it('renders children text', () => {
    render(<Helper>Hint text</Helper>);
    expect(screen.getByText('Hint text')).toBeInTheDocument();
  });

  it('applies correct classes', () => {
    const { container } = render(<Helper>Hint</Helper>);
    expect(container.querySelector('p')).toHaveClass('text-xs');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Helper>Email format: you@example.com</Helper>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
