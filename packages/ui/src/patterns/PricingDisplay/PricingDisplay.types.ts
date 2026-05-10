export interface PricingItem {
  label: string;
  amount: number;
  currency: string;
}

export interface PricingDisplayProps {
  items: PricingItem[];
  total: PricingItem;
  formatMoney: (amount: number, currency: string) => string;
  variant?: 'detailed' | 'compact';
  className?: string;
}
