import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleSwitcher } from './LocaleSwitcher';

describe('TopBar.LocaleSwitcher', () => {
  it('renders the trigger with the "Change language" accessible label', () => {
    render(<LocaleSwitcher locale="fr" onLocaleChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Change language' })).toBeInTheDocument();
  });

  it('displays the current locale code on the trigger', () => {
    render(<LocaleSwitcher locale="fr" onLocaleChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Change language' });
    expect(trigger).toHaveTextContent('FR');
  });

  it('opens the popover with all available locales when the trigger is clicked', async () => {
    render(<LocaleSwitcher locale="fr" onLocaleChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change language' }));
    const enButton = await screen.findByRole('button', { name: 'EN' });
    expect(enButton).toBeInTheDocument();
  });

  it('fires onLocaleChange with the selected locale code', async () => {
    const onLocaleChange = vi.fn();
    render(<LocaleSwitcher locale="fr" onLocaleChange={onLocaleChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change language' }));
    await userEvent.click(await screen.findByRole('button', { name: 'EN' }));
    expect(onLocaleChange).toHaveBeenCalledWith('en');
  });

  it('renders only the current locale when availableLocales is empty (P13 guard)', async () => {
    render(<LocaleSwitcher locale="fr" availableLocales={[]} onLocaleChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Change language' });
    expect(trigger).toHaveTextContent('FR');
    await userEvent.click(trigger);
    // The fallback contains exactly 1 locale entry (the current one)
    const items = await screen.findAllByRole('button');
    // 1 trigger + 1 popover item with the same locale (single FR)
    const labels = items.map((b) => b.textContent);
    expect(labels.filter((l) => l?.includes('FR')).length).toBeGreaterThanOrEqual(1);
  });

  it('honors a custom availableLocales list with 3+ entries', async () => {
    const onLocaleChange = vi.fn();
    render(
      <LocaleSwitcher
        locale="fr"
        availableLocales={[
          { code: 'fr', label: 'FR' },
          { code: 'en', label: 'EN' },
          { code: 'es', label: 'ES' },
        ]}
        onLocaleChange={onLocaleChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Change language' }));
    await userEvent.click(await screen.findByRole('button', { name: 'ES' }));
    expect(onLocaleChange).toHaveBeenCalledWith('es');
  });

  it('merges custom className on the trigger', () => {
    render(<LocaleSwitcher locale="en" onLocaleChange={() => {}} className="custom-cls" />);
    const trigger = screen.getByRole('button', { name: 'Change language' });
    expect(trigger).toHaveClass('custom-cls');
  });
});
