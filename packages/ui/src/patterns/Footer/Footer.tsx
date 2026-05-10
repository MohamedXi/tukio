import { Logo } from '../Logo/Logo';
import { cn } from '../../utils/cn';
import type { FooterProps } from './Footer.types';

export function Footer({
  columns,
  brandTagline,
  legal = '© 2026 tukio.one — Made in Nantes',
  legalRight = 'Hébergeur LCEN · Tiers de confiance Stripe',
  className,
}: FooterProps) {
  const gridCols = `1.5fr repeat(${columns.length}, 1fr)`;

  return (
    <footer
      className={cn(
        'bg-cream-50 border-t border-cream-200',
        'px-20 pt-16 pb-10',
        'max-md:px-4 max-md:pt-8 max-md:pb-6',
        className,
      )}
    >
      <div
        className="grid gap-12 mb-12 max-md:grid-cols-2 max-md:gap-8 max-sm:grid-cols-1"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="flex flex-col gap-3 max-w-[280px]">
          <Logo size={28} />
          {brandTagline && <p className="text-sm text-charcoal-500">{brandTagline}</p>}
        </div>
        {columns.map((column, index) => (
          <div key={index} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-charcoal-700">{column.title}</h3>
            <ul className="flex flex-col gap-2.5">
              {column.links.map((link, linkIndex) => (
                <li key={linkIndex}>
                  <a href={link.href} className="text-sm text-charcoal-500 hover:text-charcoal-700">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-6 border-t border-cream-200 text-xs text-charcoal-400 max-sm:flex-col max-sm:gap-2">
        <span>{legal}</span>
        <span>{legalRight}</span>
      </div>
    </footer>
  );
}

Footer.displayName = 'Footer';
