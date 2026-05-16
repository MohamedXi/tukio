import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Logo } from './Logo';
import { LogoMark } from './LogoMark';

describe('Logo', () => {
  it('renders with default props (direction B: tukio.1ne)', () => {
    render(<Logo />);
    // Default aria-label was updated to direction B + slogan companion text.
    expect(
      screen.getByRole('img', { name: 'tukio.1ne — un événement, une plateforme' }),
    ).toBeInTheDocument();
  });

  it('hides domain when showDomain=false', () => {
    const { container } = render(<Logo showDomain={false} />);
    // The wordmark text is split across spans; check raw text content.
    expect(container.textContent).not.toContain('1ne');
    expect(container.textContent).toContain('tukio');
  });

  it('renders the 1ne suffix when showDomain=true (default)', () => {
    const { container } = render(<Logo />);
    expect(container.textContent).toContain('tukio');
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('ne');
  });

  it('renders the slogan when slogan=true', () => {
    const { container } = render(<Logo slogan />);
    expect(container.textContent).toContain('un événement');
    expect(container.textContent).toContain('une plateforme');
  });

  it('omits the slogan by default', () => {
    const { container } = render(<Logo />);
    expect(container.textContent).not.toContain('un événement');
  });

  it('accepts a custom aria-label', () => {
    render(<Logo aria-label="Logo Tukio" />);
    expect(screen.getByRole('img', { name: 'Logo Tukio' })).toBeInTheDocument();
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
