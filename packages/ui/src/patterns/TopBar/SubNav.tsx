import { cn } from '../../utils/cn';
import type { SubNavProps } from './TopBar.types';

export function SubNav({ items, className }: SubNavProps) {
  return (
    <nav
      className={cn(
        'flex items-center gap-6 px-6 py-3 bg-cream-50 border-b border-cream-200',
        className,
      )}
      aria-label="Section navigation"
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'text-sm font-medium',
            item.active ? 'text-brand-700' : 'text-charcoal-600 hover:text-charcoal-800',
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

SubNav.displayName = 'TopBar.SubNav';
