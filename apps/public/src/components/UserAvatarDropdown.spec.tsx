import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserAvatarDropdown } from './UserAvatarDropdown.js';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      becomePro: 'Devenir pro',
      proSpace: 'Mon espace pro',
    };
    return map[key] ?? key;
  },
  useLocale: () => 'fr',
}));

vi.mock('@tukio/i18n-client/config', () => ({
  isLocale: (v: unknown) => v === 'fr' || v === 'en',
}));

const assignMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { assign: assignMock },
  writable: true,
});

beforeEach(() => {
  assignMock.mockClear();
  vi.stubEnv('NEXT_PUBLIC_SELLER_BASE_URL', 'http://localhost:3002');
});

describe('UserAvatarDropdown', () => {
  it('opens menu on avatar click', () => {
    render(
      <UserAvatarDropdown firstName="Alice" lastName="D" email="alice@test.com" role="client" />,
    );
    fireEvent.click(screen.getByTestId('avatar-trigger'));
    expect(screen.getByTestId('avatar-menu')).toBeInTheDocument();
  });

  it('shows "Devenir pro" CTA for customer role (client)', () => {
    render(
      <UserAvatarDropdown firstName="Alice" lastName="D" email="alice@test.com" role="client" />,
    );
    fireEvent.click(screen.getByTestId('avatar-trigger'));
    expect(screen.getByTestId('become-pro-cta')).toBeInTheDocument();
    expect(screen.getByTestId('become-pro-cta')).toHaveTextContent('Devenir pro');
  });

  it('hides "Devenir pro" CTA for pro role', () => {
    render(<UserAvatarDropdown firstName="Alice" lastName="D" email="alice@test.com" role="pro" />);
    fireEvent.click(screen.getByTestId('avatar-trigger'));
    expect(screen.queryByTestId('become-pro-cta')).not.toBeInTheDocument();
  });

  it('shows "Mon espace pro" for pro role', () => {
    render(<UserAvatarDropdown firstName="Alice" lastName="D" email="alice@test.com" role="pro" />);
    fireEvent.click(screen.getByTestId('avatar-trigger'));
    expect(screen.getByTestId('pro-space-link')).toBeInTheDocument();
    expect(screen.getByTestId('pro-space-link')).toHaveTextContent('Mon espace pro');
  });

  it('clicking "Devenir pro" navigates cross-zone to seller onboarding/identity FR', () => {
    render(
      <UserAvatarDropdown firstName="Alice" lastName="D" email="alice@test.com" role="client" />,
    );
    fireEvent.click(screen.getByTestId('avatar-trigger'));
    fireEvent.click(screen.getByTestId('become-pro-cta'));
    expect(assignMock).toHaveBeenCalledWith('http://localhost:3002/fr/seller/onboarding/identity');
  });
});
