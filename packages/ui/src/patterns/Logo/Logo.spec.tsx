import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Logo } from './Logo';
import { LogoMark } from './LogoMark';

describe('Logo', () => {
  it('renders with default props', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'tukio.one' })).toBeInTheDocument();
  });

  it('hides domain when showDomain=false', () => {
    const { container } = render(<Logo showDomain={false} />);
    // The wordmark text is split across spans; check raw text content
    expect(container.textContent).not.toContain('.one');
    expect(container.textContent).toContain('tukio');
  });

  it('applies custom color', () => {
    const { container } = render(<Logo color="#000" />);
    const wordmark = container.querySelector('span > span');
    expect(wordmark).toHaveStyle({ color: '#000' });
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Logo />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LogoMark', () => {
  it('renders SVG with role=img', () => {
    render(<LogoMark aria-label="Tukio mark" />);
    expect(screen.getByRole('img', { name: 'Tukio mark' })).toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<LogoMark aria-label="Tukio mark" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
