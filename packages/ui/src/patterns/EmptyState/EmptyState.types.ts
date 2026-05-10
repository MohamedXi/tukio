import type { ReactNode } from 'react';

export type EmptyStateVariant =
  | 'search-no-results'
  | 'cart-empty'
  | 'customer-no-bookings'
  | 'seller-no-bookings'
  | 'seller-no-services'
  | 'messages-empty'
  | 'reviews-empty';

export interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  cta?: ReactNode;
  className?: string;
}
