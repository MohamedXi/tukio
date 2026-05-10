'use client';
import * as Popover from '@radix-ui/react-popover';
import { Globe } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { LocaleSwitcherProps } from './TopBar.types';

const DEFAULT_LOCALES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

export function LocaleSwitcher({
  locale,
  availableLocales = DEFAULT_LOCALES,
  onLocaleChange,
  className,
}: LocaleSwitcherProps) {
  const current = availableLocales.find((l) => l.code === locale) ?? availableLocales[0]!;

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-charcoal-700',
          'hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200',
          className,
        )}
        aria-label="Change language"
      >
        <Globe size={14} aria-hidden="true" />
        <span>{current.label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="bg-cream-50 border border-cream-200 rounded-md shadow-md p-1 min-w-[100px] z-50"
        >
          {availableLocales.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => onLocaleChange(l.code)}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm rounded',
                'hover:bg-cream-100 focus-visible:outline-none focus-visible:bg-cream-100',
                l.code === locale ? 'text-brand-700 font-medium' : 'text-charcoal-700',
              )}
            >
              {l.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

LocaleSwitcher.displayName = 'TopBar.LocaleSwitcher';
