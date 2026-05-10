import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ErrorPage } from './ErrorPage';

describe('ErrorPage', () => {
  it.each(['404', '500', 'maintenance'] as const)('renders variant=%s', (variant) => {
    render(<ErrorPage variant={variant} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows eventId only for 500 variant', () => {
    const { rerender } = render(<ErrorPage variant="500" eventId="abc-123" />);
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
    rerender(<ErrorPage variant="404" eventId="abc-123" />);
    expect(screen.queryByText(/abc-123/)).not.toBeInTheDocument();
  });

  it('calls onRetry and onGoHome', async () => {
    const onRetry = vi.fn();
    const onGoHome = vi.fn();
    render(<ErrorPage variant="500" onRetry={onRetry} onGoHome={onGoHome} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onGoHome).toHaveBeenCalledOnce();
  });

  it('has role=alert on container', () => {
    render(<ErrorPage variant="500" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <ErrorPage variant="500" eventId="evt-abc" onRetry={() => {}} onGoHome={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
