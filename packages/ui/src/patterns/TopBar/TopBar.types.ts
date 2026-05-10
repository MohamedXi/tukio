import type { ReactNode } from 'react';

export type TopBarVariant = 'public' | 'customer' | 'seller' | 'admin';

export interface PublicLabels {
  search?: string;
  categories?: string;
  becomePro?: string;
  help?: string;
  login?: string;
  signup?: string;
}

export interface CustomerLabels {
  discover?: string;
  inspirations?: string;
  help?: string;
  account?: string;
}

export interface SellerLabels {
  dashboard?: string;
  services?: string;
  bookings?: string;
  messages?: string;
  reviews?: string;
  settings?: string;
}

export interface AdminLabels {
  verifications?: string;
  moderation?: string;
  transactions?: string;
  audit?: string;
  config?: string;
}

export interface TopBarBaseProps {
  variant: TopBarVariant;
  locale?: string;
  onLocaleChange?: (locale: string) => void;
  availableLocales?: Array<{ code: string; label: string }>;
  className?: string;
  children?: ReactNode;
}

export interface PublicTopBarProps extends TopBarBaseProps {
  variant: 'public';
  labels?: PublicLabels;
  onSearch?: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
}

export interface CustomerTopBarProps extends TopBarBaseProps {
  variant: 'customer';
  labels?: CustomerLabels;
  userName: string;
  userAvatarSrc?: string;
}

export interface SellerTopBarProps extends TopBarBaseProps {
  variant: 'seller';
  labels?: SellerLabels;
  userName: string;
  userAvatarSrc?: string;
  badges?: Partial<Record<keyof SellerLabels, number>>;
}

export interface AdminTopBarProps extends TopBarBaseProps {
  variant: 'admin';
  labels?: AdminLabels;
  userName: string;
  mfaActive?: boolean;
}

export type TopBarProps =
  | PublicTopBarProps
  | CustomerTopBarProps
  | SellerTopBarProps
  | AdminTopBarProps;

export interface LocaleSwitcherProps {
  locale: string;
  availableLocales?: Array<{ code: string; label: string }>;
  onLocaleChange: (locale: string) => void;
  className?: string;
}

export interface SubNavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface SubNavProps {
  items: SubNavItem[];
  className?: string;
}
