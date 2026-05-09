import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Badge } from './Badge';

describe('Badge', () => {
  it.each(['brand', 'success', 'warning', 'info', 'neutral', 'danger'] as const)(
    'renders variant=%s',
    (variant) => {
      render(<Badge variant={variant}>Label</Badge>);
      expect(screen.getByText('Label')).toBeInTheDocument();
    },
  );

  it('renders with icon', () => {
    const { container } = render(<Badge icon={<span data-testid="icon" />}>Verified</Badge>);
    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
  });

  it('passes axe a11y check — brand', async () => {
    const { container } = render(<Badge variant="brand">New</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — danger', async () => {
    const { container } = render(<Badge variant="danger">Error</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
