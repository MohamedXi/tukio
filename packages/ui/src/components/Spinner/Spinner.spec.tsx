import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders with default props', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('width', '24');
  });

  it('renders xs size', () => {
    const { container } = render(<Spinner size="xs" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '12');
  });

  it('renders sm size', () => {
    const { container } = render(<Spinner size="sm" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });

  it('renders lg size', () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
  });

  it('renders with aria-hidden when specified', () => {
    const { container } = render(<Spinner aria-hidden={true} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders with role=status when visible', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')).toHaveAttribute('role', 'status');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Spinner />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('passes axe with aria-hidden', async () => {
    const { container } = render(<Spinner aria-hidden={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
