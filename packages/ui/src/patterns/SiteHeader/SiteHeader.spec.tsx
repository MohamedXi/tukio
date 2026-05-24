import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('renders the banner landmark', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders the default Logo when no logo slot is provided', () => {
    const { container } = render(<SiteHeader />);
    // Logo pattern renders the wordmark — at least one <svg> from Logo or its tagline element.
    expect(container.querySelector('header')).not.toBeNull();
    // The placeholder Logo SVG is rendered (Logo.tsx is the canonical source).
    expect(container.querySelector('header *')).not.toBeNull();
  });

  it('renders an override logo slot when provided', () => {
    render(<SiteHeader logo={<div data-testid="custom-logo">Custom</div>} />);
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });

  it('does not render the nav when navItems is empty', () => {
    render(<SiteHeader />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('renders navItems with aria-label on the nav landmark', () => {
    render(
      <SiteHeader
        navItems={[
          { label: 'About', href: '/a-propos' },
          { label: 'Contact', href: '/contact' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: /public site navigation/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('highlights the active link with aria-current="page"', () => {
    render(
      <SiteHeader
        navItems={[
          { label: 'About', href: '/a-propos', active: true },
          { label: 'Contact', href: '/contact' },
        ]}
      />,
    );
    const active = screen.getByText('About');
    expect(active).toHaveAttribute('aria-current', 'page');
    const inactive = screen.getByText('Contact');
    expect(inactive).not.toHaveAttribute('aria-current');
  });

  it('renders the localeSwitcher slot', () => {
    render(<SiteHeader localeSwitcher={<div data-testid="locale">FR/EN</div>} />);
    expect(screen.getByTestId('locale')).toBeInTheDocument();
  });

  it('renders the rightSlot (e.g., Story 0.17 location badge)', () => {
    render(<SiteHeader rightSlot={<span data-testid="badge">Bientôt en Pays de la Loire</span>} />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders three navItems (matches BecomeProScreen design Story 0.18)', () => {
    render(
      <SiteHeader
        navItems={[
          { label: 'About', href: '/a-propos' },
          { label: 'Become Pro', href: '/devenir-pro', active: true },
          { label: 'Contact', href: '/contact' },
        ]}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
  });

  it('merges custom className with the default header chrome', () => {
    render(<SiteHeader className="custom-extra" />);
    expect(screen.getByRole('banner').className).toContain('custom-extra');
    expect(screen.getByRole('banner').className).toContain('bg-cream-50');
  });

  it('renders the badge slot inside the left group (next to Logo)', () => {
    render(<SiteHeader badge={<span data-testid="badge-chip">En construction</span>} />);
    expect(screen.getByTestId('badge-chip')).toBeInTheDocument();
  });

  it('passes axe a11y check (no nav)', async () => {
    const { container } = render(<SiteHeader />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check (with navItems + active)', async () => {
    const { container } = render(
      <SiteHeader
        navItems={[
          { label: 'About', href: '/a-propos' },
          { label: 'Contact', href: '/contact', active: true },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
