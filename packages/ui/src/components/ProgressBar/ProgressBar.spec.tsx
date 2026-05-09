import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders with role=progressbar', () => {
    render(<ProgressBar value={42} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow correctly', () => {
    render(<ProgressBar value={42} max={100} aria-label="Upload" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
  });

  it('sets aria-busy for indeterminate', () => {
    render(<ProgressBar indeterminate aria-label="Loading" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-busy')).toBe('true');
  });

  it('clamps value to max', () => {
    render(<ProgressBar value={150} max={100} aria-label="Upload" />);
    const inner = screen.getByRole('progressbar').firstChild as HTMLElement;
    expect(inner.style.width).toBe('100%');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<ProgressBar value={50} aria-label="Upload progress" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — indeterminate', async () => {
    const { container } = render(<ProgressBar indeterminate aria-label="Loading" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
