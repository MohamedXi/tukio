'use client';
import { LayoutDashboard, Tag, Inbox, MessageSquare, Star, Settings } from 'lucide-react';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Logo } from '../Logo/Logo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { cn } from '../../utils/cn';
import type { SellerTopBarProps } from './TopBar.types';

const NAV_ITEMS = [
  { key: 'dashboard' as const, icon: LayoutDashboard, defaultLabel: 'Dashboard', href: '/seller' },
  { key: 'services' as const, icon: Tag, defaultLabel: 'Services', href: '/seller/services' },
  { key: 'bookings' as const, icon: Inbox, defaultLabel: 'Bookings', href: '/seller/bookings' },
  {
    key: 'messages' as const,
    icon: MessageSquare,
    defaultLabel: 'Messages',
    href: '/seller/messages',
  },
  { key: 'reviews' as const, icon: Star, defaultLabel: 'Reviews', href: '/seller/reviews' },
  { key: 'settings' as const, icon: Settings, defaultLabel: 'Settings', href: '/seller/settings' },
];

export function ProSidebar({
  labels,
  userName,
  userAvatarSrc,
  badges,
  locale,
  onLocaleChange,
  availableLocales,
  className,
}: SellerTopBarProps) {
  return (
    <aside
      className={cn(
        'sticky top-4 left-4 flex flex-col bg-charcoal-700 text-cream-50 rounded-lg p-4',
        'w-[248px] h-[calc(100vh-32px)]',
        className,
      )}
      aria-label="Seller navigation"
    >
      <div className="px-2 pb-4 mb-4 border-b border-charcoal-600">
        <Logo size={28} mono color="var(--color-cream-50)" />
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ key, icon: Icon, defaultLabel, href }) => {
          const label = labels?.[key] ?? defaultLabel;
          const count = badges?.[key];
          return (
            <a
              key={key}
              href={href}
              className="inline-flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm hover:bg-charcoal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <span className="inline-flex items-center gap-3">
                <Icon size={16} aria-hidden="true" />
                {label}
              </span>
              {count !== undefined && count > 0 && <Badge variant="brand">{count}</Badge>}
            </a>
          );
        })}
      </nav>
      <div className="pt-4 mt-4 border-t border-charcoal-600 flex items-center gap-3">
        <Avatar name={userName} src={userAvatarSrc} size={32} tone="brand" />
        <span className="text-sm font-medium flex-1 truncate">{userName}</span>
        {locale && onLocaleChange && (
          <LocaleSwitcher
            locale={locale}
            onLocaleChange={onLocaleChange}
            availableLocales={availableLocales}
          />
        )}
      </div>
    </aside>
  );
}

ProSidebar.displayName = 'TopBar.ProSidebar';
