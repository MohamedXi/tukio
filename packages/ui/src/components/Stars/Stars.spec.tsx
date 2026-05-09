import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Stars } from './Stars';

describe('Stars', () => {
  it('renders formatted value', () => {
    render(<Stars value={4.8} />);
    expect(screen.getByText('4.8')).toBeInTheDocument();
  });

  it('renders count when provided', () => {
    render(<Stars value={4.5} count={42} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('interactive mode renders radiogroup', () => {
    render(<Stars interactive value={3} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('interactive mode calls onChange on click', async () => {
    const handler = vi.fn();
    render(<Stars interactive value={3} onChange={handler} />);
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    expect(handler).toHaveBeenCalledWith(5);
  });

  it('passes axe a11y check — display', async () => {
    const { container } = render(<Stars value={4.0} count={12} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — interactive', async () => {
    const { container } = render(<Stars interactive value={3} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
