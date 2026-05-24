import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Spacer } from './Spacer';

describe('Spacer', () => {
  it('renders an aria-hidden span', () => {
    const { container } = render(<Spacer />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to vertical axis with size 4 (1rem height)', () => {
    const { container } = render(<Spacer />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('block');
    expect(span?.className).not.toContain('inline-block');
    expect(span?.getAttribute('style')).toContain('height: 1rem');
  });

  it('renders horizontal axis as inline-block with width', () => {
    const { container } = render(<Spacer axis="horizontal" size={8} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('inline-block');
    expect(span?.getAttribute('style')).toContain('width: 2rem');
  });

  it('merges custom className', () => {
    const { container } = render(<Spacer className="custom-class" />);
    expect(container.querySelector('span')?.className).toContain('custom-class');
  });

  it('scales size correctly (size * 0.25rem)', () => {
    const { container } = render(<Spacer size={12} />);
    expect(container.querySelector('span')?.getAttribute('style')).toContain('height: 3rem');
  });
});
