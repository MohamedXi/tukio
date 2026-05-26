import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Footer } from './Footer';

const columns = [
  {
    title: 'Tukio',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  { title: 'Help', links: [{ label: 'Contact', href: '/contact' }] },
];

describe('Footer', () => {
  it('renders all columns and links', () => {
    render(<Footer columns={columns} />);
    expect(screen.getByText('Tukio')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('renders brandTagline', () => {
    render(<Footer columns={columns} brandTagline="Marketplace événementielle" />);
    expect(screen.getByText('Marketplace événementielle')).toBeInTheDocument();
  });

  it('renders legal text', () => {
    render(<Footer columns={columns} legal="© 2026 Custom" legalRight="LCEN" />);
    expect(screen.getByText('© 2026 Custom')).toBeInTheDocument();
    expect(screen.getByText('LCEN')).toBeInTheDocument();
  });

  it('uses footer landmark role', () => {
    render(<Footer columns={columns} />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Footer columns={columns} brandTagline="Test" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  describe("variant='minimal' (Story 0.16)", () => {
    const inlineLinks = [
      { label: 'Devenir pro pilote', href: '/become-pro' },
      { label: 'Mentions légales', href: '/legal' },
      { label: 'contact@tukio.one', href: 'mailto:contact@tukio.one' },
    ];

    it('renders minimal layout with copyright + inline links', () => {
      render(<Footer variant="minimal" inlineLinks={inlineLinks} />);
      expect(screen.getByLabelText('Footer links')).toBeInTheDocument();
      expect(screen.getByText('Devenir pro pilote')).toBeInTheDocument();
      expect(screen.getByText('Mentions légales')).toBeInTheDocument();
      expect(screen.getByText('contact@tukio.one')).toBeInTheDocument();
    });

    it('renders copyright fallback when legal prop omitted', () => {
      render(<Footer variant="minimal" />);
      // Fallback contains the current year and tukio.one wordmark.
      const year = new Date().getFullYear();
      expect(
        screen.getByText(new RegExp(`tukio\\.one.*${year}.*Loire-Atlantique`)),
      ).toBeInTheDocument();
    });

    it('overrides copyright with legal prop', () => {
      render(<Footer variant="minimal" legal="© tukio.one · 2026 · Made in Loire-Atlantique" />);
      expect(screen.getByText('© tukio.one · 2026 · Made in Loire-Atlantique')).toBeInTheDocument();
    });

    it('omits nav when inlineLinks is empty', () => {
      render(<Footer variant="minimal" />);
      expect(screen.queryByLabelText('Footer links')).toBeNull();
    });

    it('renders logo override slot', () => {
      render(
        <Footer
          variant="minimal"
          logo={<span data-testid="custom-logo">Logo</span>}
          inlineLinks={inlineLinks}
        />,
      );
      expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
    });

    it('uses the contentinfo landmark role', () => {
      render(<Footer variant="minimal" />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('passes axe a11y check', async () => {
      const { container } = render(<Footer variant="minimal" inlineLinks={inlineLinks} />);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('does not render the full-variant grid (regression: no 4-column layout)', () => {
      const { container } = render(<Footer variant="minimal" inlineLinks={inlineLinks} />);
      // Minimal footer has a single <footer> with a flex layout, not a grid.
      const footers = container.querySelectorAll('footer');
      expect(footers).toHaveLength(1);
      expect(footers[0]?.className).toContain('flex');
      expect(footers[0]?.className).not.toContain('grid');
    });
  });
});
