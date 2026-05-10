import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { EmptyState } from './EmptyState';
import type { EmptyStateVariant } from './EmptyState.types';

const variants: EmptyStateVariant[] = [
  'search-no-results',
  'cart-empty',
  'customer-no-bookings',
  'seller-no-bookings',
  'seller-no-services',
  'messages-empty',
  'reviews-empty',
];

describe('EmptyState', () => {
  it.each(variants)('renders variant=%s with default labels', (variant) => {
    render(<EmptyState variant={variant} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('reviews-empty variant does NOT render CTA', () => {
    render(
      <EmptyState variant="reviews-empty" actionLabel="Should not show" onAction={() => {}} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onAction when CTA clicked', async () => {
    const handler = vi.fn();
    render(<EmptyState variant="cart-empty" onAction={handler} actionLabel="Browse" />);
    await userEvent.click(screen.getByRole('button', { name: 'Browse' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('overrides default labels via props', () => {
    render(<EmptyState variant="search-no-results" title="Custom" description="Override" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Override')).toBeInTheDocument();
  });

  it('passes axe a11y check — search-no-results', async () => {
    const { container } = render(<EmptyState variant="search-no-results" onAction={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — reviews-empty (no CTA)', async () => {
    const { container } = render(<EmptyState variant="reviews-empty" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
