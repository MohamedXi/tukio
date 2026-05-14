import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { SubNav } from './SubNav';

const ITEMS = [
  { label: 'Overview', href: '/seller/dashboard' },
  { label: 'Listings', href: '/seller/listings', active: true },
  { label: 'Bookings', href: '/seller/bookings' },
];

describe('TopBar.SubNav', () => {
  it('renders every nav item with its label', () => {
    render(<SubNav items={ITEMS} />);
    for (const item of ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument();
    }
  });

  it('marks the active item with aria-current="page"', () => {
    render(<SubNav items={ITEMS} />);
    const active = screen.getByRole('link', { name: 'Listings' });
    expect(active).toHaveAttribute('aria-current', 'page');
    const inactive = screen.getByRole('link', { name: 'Overview' });
    expect(inactive).not.toHaveAttribute('aria-current');
  });

  it('links each item to its href', () => {
    render(<SubNav items={ITEMS} />);
    expect(screen.getByRole('link', { name: 'Bookings' })).toHaveAttribute(
      'href',
      '/seller/bookings',
    );
  });

  it('applies an accessible label to the navigation landmark', () => {
    render(<SubNav items={ITEMS} />);
    expect(screen.getByRole('navigation', { name: 'Section navigation' })).toBeInTheDocument();
  });

  it('merges a custom className', () => {
    render(<SubNav items={ITEMS} className="custom-class" />);
    expect(screen.getByRole('navigation')).toHaveClass('custom-class');
  });

  it('renders nothing-meaningful when items is empty', () => {
    render(<SubNav items={[]} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(nav.children).toHaveLength(0);
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<SubNav items={ITEMS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
