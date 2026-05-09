import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(<Skeleton width="200px" height="20px" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies pulse variant by default', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies numeric width/height as px strings', () => {
    const { container } = render(<Skeleton width={100} height={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100px');
    expect(el.style.height).toBe('20px');
  });

  it('applies shimmer variant classes (no bg-cream-200 in shimmer)', () => {
    const { container } = render(<Skeleton variant="shimmer" width="200px" height="20px" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('bg-gradient-to-r');
    expect(el.className).not.toContain('animate-pulse');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Skeleton width="200px" height="16px" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
