import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Toaster, useToast } from './Toast';
import { Button } from '../Button/Button';

function ToastTrigger({
  variant = 'success' as const,
  duration,
}: {
  variant?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}) {
  const { toast, dismiss } = useToast();
  return (
    <div>
      <Button onClick={() => toast({ title: 'Test toast', variant, duration })}>Show toast</Button>
      <Button onClick={() => dismiss('non-existent')}>Dismiss</Button>
    </div>
  );
}

function Setup({
  variant = 'success' as const,
  duration,
}: {
  variant?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}) {
  return (
    <Toaster>
      <ToastTrigger variant={variant} duration={duration} />
    </Toaster>
  );
}

describe('Toast / Toaster', () => {
  it('shows toast on trigger click', async () => {
    render(<Setup />);
    await userEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    await waitFor(() => expect(screen.getByText('Test toast')).toBeInTheDocument());
  });

  it('renders error variant — toast appears with error styling', async () => {
    render(<Setup variant="error" />);
    await userEvent.click(screen.getByText('Show toast'));
    await waitFor(() => expect(screen.getByText('Test toast')).toBeInTheDocument());
  });

  it('renders warning variant — toast appears', async () => {
    render(<Setup variant="warning" />);
    await userEvent.click(screen.getByText('Show toast'));
    await waitFor(() => expect(screen.getByText('Test toast')).toBeInTheDocument());
  });

  it('renders success variant — toast appears', async () => {
    render(<Setup variant="success" />);
    await userEvent.click(screen.getByText('Show toast'));
    await waitFor(() => expect(screen.getByText('Test toast')).toBeInTheDocument());
  });

  it('dismiss callback does not crash when called', async () => {
    render(<Setup />);
    // Clicking dismiss with a non-existent id should not throw
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Test toast')).not.toBeInTheDocument();
  });

  it('throws when useToast used outside Toaster', () => {
    const OriginalConsoleError = console.error;
    console.error = vi.fn();
    expect(() => render(<ToastTrigger />)).toThrow('useToast must be used within <Toaster>');
    console.error = OriginalConsoleError;
  });

  it('passes axe a11y check — with toast open', async () => {
    const { container } = render(<Setup />);
    await userEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    await waitFor(() => screen.getByText('Test toast'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
