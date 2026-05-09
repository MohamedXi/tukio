import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Alert } from './Alert';

describe('Alert', () => {
  it.each(['success', 'warning', 'error', 'info'] as const)('renders variant=%s', (variant) => {
    render(
      <Alert variant={variant} title="Title">
        Content
      </Alert>,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('renders error/warning with role=alert', () => {
    render(
      <Alert variant="error" title="Error">
        Msg
      </Alert>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders success/info with role=status', () => {
    render(
      <Alert variant="success" title="Ok">
        Msg
      </Alert>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders dismiss button when onDismiss provided', () => {
    render(
      <Alert onDismiss={() => {}} title="Info">
        Msg
      </Alert>,
    );
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const handler = vi.fn();
    render(
      <Alert onDismiss={handler} title="Info">
        Msg
      </Alert>,
    );
    await userEvent.click(screen.getByLabelText('Dismiss'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes axe a11y check — error', async () => {
    const { container } = render(
      <Alert variant="error" title="Error">
        Payment refused.
      </Alert>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — info with dismiss', async () => {
    const { container } = render(
      <Alert variant="info" onDismiss={() => {}} title="Info">
        Message
      </Alert>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
