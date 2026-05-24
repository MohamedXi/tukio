import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Logo } from './Logo';
import { LogoMark } from './LogoMark';

describe('Logo', () => {
  it('renders the wordmark variant by default with role="img"', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'tukio.one' })).toBeInTheDocument();
  });

  it('renders the wordmark SVG with the correct viewBox', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 447 83');
  });

  it('renders the icon variant when variant="icon"', () => {
    const { container } = render(<Logo variant="icon" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 66 81');
  });

  it('size controls the SVG height (default 28) and width is derived from aspect ratio', () => {
    const { container } = render(<Logo size={50} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('height')).toBe('50');
    // wordmark width = 50 * (447/83) ≈ 269.28
    expect(Number(svg?.getAttribute('width'))).toBeCloseTo(269.28, 1);
  });

  it('icon size scales width from the icon aspect ratio (66/81 ≈ 0.815)', () => {
    const { container } = render(<Logo variant="icon" size={40} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('height')).toBe('40');
    expect(Number(svg?.getAttribute('width'))).toBeCloseTo(32.59, 1);
  });

  it('accepts a custom aria-label', () => {
    render(<Logo aria-label="Logo Tukio personnalisé" />);
    expect(screen.getByRole('img', { name: 'Logo Tukio personnalisé' })).toBeInTheDocument();
  });

  it('merges custom className with the default SVG classes', () => {
    const { container } = render(<Logo className="custom-extra" />);
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal).toContain('custom-extra');
    expect(svg?.className.baseVal).toContain('inline-block');
  });

  it('passes axe a11y check (wordmark)', async () => {
    const { container } = render(<Logo />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check (icon)', async () => {
    const { container } = render(<Logo variant="icon" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LogoMark', () => {
  it('renders SVG with role=img', () => {
    render(<LogoMark aria-label="Tukio mark" />);
    expect(screen.getByRole('img', { name: 'Tukio mark' })).toBeInTheDocument();
  });

  it('renders as decorative when decorative=true (no role="img")', () => {
    const { container } = render(<LogoMark decorative />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<LogoMark aria-label="Tukio mark" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
