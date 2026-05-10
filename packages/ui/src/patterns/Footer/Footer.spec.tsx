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
});
