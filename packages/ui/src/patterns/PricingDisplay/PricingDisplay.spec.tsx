import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PricingDisplay } from './PricingDisplay';

const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);

const items = [
  { label: 'Subtotal', amount: 80000, currency: 'EUR' },
  { label: 'VAT 20%', amount: 16000, currency: 'EUR' },
];
const total = { label: 'Total', amount: 96000, currency: 'EUR' };

describe('PricingDisplay', () => {
  it('renders all items in detailed variant', () => {
    render(<PricingDisplay items={items} total={total} formatMoney={fmt} />);
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('VAT 20%')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('uses formatMoney prop for amount formatting', () => {
    render(<PricingDisplay items={items} total={total} formatMoney={fmt} />);
    expect(screen.getByText('€800.00')).toBeInTheDocument();
    expect(screen.getByText('€960.00')).toBeInTheDocument();
  });

  it('compact variant renders only total', () => {
    render(<PricingDisplay items={items} total={total} formatMoney={fmt} variant="compact" />);
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<PricingDisplay items={items} total={total} formatMoney={fmt} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
