'use client';
import { Search } from 'lucide-react';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Logo } from '../Logo/Logo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { SubNav } from './SubNav';
import { ProSidebar } from './ProSidebar';
import { cn } from '../../utils/cn';
import type {
  TopBarProps,
  PublicTopBarProps,
  CustomerTopBarProps,
  AdminTopBarProps,
} from './TopBar.types';

function PublicTopBar({
  labels,
  onSearch,
  onLogin,
  onSignup,
  locale,
  onLocaleChange,
  availableLocales,
  className,
}: PublicTopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center gap-6 px-6 py-3 bg-cream-50 border-b border-cream-200',
        className,
      )}
    >
      <Logo size={28} />
      <div className="flex-1 max-w-md">
        {/* Clickable readOnly Input — click + Enter/Space delegate to onSearch */}
        <Input
          placeholder={labels?.search ?? 'Search services...'}
          prefix={<Search size={16} />}
          readOnly
          aria-label={labels?.search ?? 'Search'}
          onClick={onSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSearch?.();
            }
          }}
          className="cursor-pointer"
        />
      </div>
      <nav className="flex items-center gap-4 max-md:hidden">
        <a href="/categories" className="text-sm text-charcoal-700 hover:text-charcoal-900">
          {labels?.categories ?? 'Categories'}
        </a>
        <a href="/become-pro" className="text-sm text-charcoal-700 hover:text-charcoal-900">
          {labels?.becomePro ?? 'Become a pro'}
        </a>
        <a href="/help" className="text-sm text-charcoal-700 hover:text-charcoal-900">
          {labels?.help ?? 'Help'}
        </a>
      </nav>
      <div className="flex items-center gap-2">
        {locale && onLocaleChange && (
          <LocaleSwitcher
            locale={locale}
            onLocaleChange={onLocaleChange}
            availableLocales={availableLocales}
          />
        )}
        <Button variant="ghost" size="sm" onClick={onLogin}>
          {labels?.login ?? 'Log in'}
        </Button>
        <Button variant="primary" size="sm" onClick={onSignup}>
          {labels?.signup ?? 'Sign up'}
        </Button>
      </div>
    </header>
  );
}

function CustomerTopBar({
  labels,
  userName,
  userAvatarSrc,
  locale,
  onLocaleChange,
  availableLocales,
  className,
  children,
}: CustomerTopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex flex-col bg-cream-50 border-b border-cream-200',
        className,
      )}
    >
      <div className="flex items-center gap-6 px-6 py-3">
        <Logo size={28} />
        <nav className="flex items-center gap-4 flex-1 max-md:hidden">
          <a href="/" className="text-sm text-charcoal-700 hover:text-charcoal-900">
            {labels?.discover ?? 'Discover'}
          </a>
          <a href="/inspirations" className="text-sm text-charcoal-700 hover:text-charcoal-900">
            {labels?.inspirations ?? 'Inspirations'}
          </a>
          <a href="/help" className="text-sm text-charcoal-700 hover:text-charcoal-900">
            {labels?.help ?? 'Help'}
          </a>
        </nav>
        <div className="flex items-center gap-3 ml-auto">
          {locale && onLocaleChange && (
            <LocaleSwitcher
              locale={locale}
              onLocaleChange={onLocaleChange}
              availableLocales={availableLocales}
            />
          )}
          <a
            href="/account"
            aria-label={labels?.account ?? 'Account'}
            className="inline-flex items-center gap-2"
          >
            <Avatar name={userName} src={userAvatarSrc} size={32} tone="brand" />
          </a>
        </div>
      </div>
      {children}
    </header>
  );
}

function AdminTopBar({
  labels,
  userName,
  mfaActive,
  locale,
  onLocaleChange,
  availableLocales,
  className,
}: AdminTopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center gap-6 px-6 py-3 bg-charcoal-900 text-cream-50',
        className,
      )}
    >
      <Logo size={28} mono color="var(--color-cream-50)" />
      <nav className="flex items-center gap-4 flex-1">
        <a href="/admin/verifications" className="text-sm hover:text-cream-200">
          {labels?.verifications ?? 'Verifications'}
        </a>
        <a href="/admin/moderation" className="text-sm hover:text-cream-200">
          {labels?.moderation ?? 'Moderation'}
        </a>
        <a href="/admin/transactions" className="text-sm hover:text-cream-200">
          {labels?.transactions ?? 'Transactions'}
        </a>
        <a href="/admin/audit" className="text-sm hover:text-cream-200">
          {labels?.audit ?? 'Audit'}
        </a>
        <a href="/admin/config" className="text-sm hover:text-cream-200">
          {labels?.config ?? 'Config'}
        </a>
      </nav>
      <div className="flex items-center gap-3">
        {mfaActive && (
          <span className="text-xs px-2 py-0.5 bg-success-500 text-cream-50 rounded-full">
            MFA active
          </span>
        )}
        {locale && onLocaleChange && (
          <LocaleSwitcher
            locale={locale}
            onLocaleChange={onLocaleChange}
            availableLocales={availableLocales}
          />
        )}
        <Avatar name={userName} size={32} tone="brand" />
      </div>
    </header>
  );
}

export function TopBarRoot(props: TopBarProps) {
  if (props.variant === 'public') return <PublicTopBar {...props} />;
  if (props.variant === 'customer') return <CustomerTopBar {...props} />;
  if (props.variant === 'seller') return <ProSidebar {...props} />;
  return <AdminTopBar {...props} />;
}

TopBarRoot.displayName = 'TopBar';

export const TopBar = Object.assign(TopBarRoot, {
  LocaleSwitcher,
  SubNav,
  ProSidebar,
});
