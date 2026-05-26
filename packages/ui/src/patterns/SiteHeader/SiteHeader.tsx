import { cn } from '../../utils/cn';
import { Logo } from '../Logo/Logo';
import type { SiteHeaderProps } from './SiteHeader.types';

/**
 * Minimalist header for institutional/editorial public pages (About, Privacy,
 * Legal, Contact, Devenir Pro, Coming Soon — Stories 0.17/0.18/0.19).
 *
 * Distinct from `TopBar variant="public"` which is the post-launch app header
 * (search input + categories + login/signup buttons). SiteHeader carries only
 * a logo, optional nav links, an optional locale switcher, and a free-form
 * right slot for badges or CTAs.
 */
export function SiteHeader({
  logo,
  badge,
  navItems = [],
  localeSwitcher,
  rightSlot,
  className,
}: SiteHeaderProps) {
  return (
    <header
      role="banner"
      className={cn(
        'flex items-center justify-between px-10 py-5 bg-cream-50 border-b border-cream-200',
        'max-md:px-4 max-md:py-4',
        className,
      )}
    >
      <div className="flex items-center gap-8 max-md:gap-3">
        {logo ?? <Logo size={22} />}
        {badge}
        {navItems.length > 0 && (
          <nav
            aria-label="Public site navigation"
            className="flex items-center gap-6 max-md:hidden"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm text-charcoal-600 hover:text-charcoal-900 transition-colors',
                  item.active && 'text-brand-700 font-semibold',
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-4">
        {localeSwitcher}
        {rightSlot}
      </div>
    </header>
  );
}

SiteHeader.displayName = 'SiteHeader';
