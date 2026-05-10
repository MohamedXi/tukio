import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  describe('public variant', () => {
    it('renders search trigger and CTAs', () => {
      render(<TopBar variant="public" />);
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    });

    it('calls onSearch / onLogin / onSignup', async () => {
      const onSearch = vi.fn();
      const onLogin = vi.fn();
      const onSignup = vi.fn();
      render(<TopBar variant="public" onSearch={onSearch} onLogin={onLogin} onSignup={onSignup} />);
      await userEvent.click(screen.getByLabelText('Search'));
      await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
      await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
      expect(onSearch).toHaveBeenCalledOnce();
      expect(onLogin).toHaveBeenCalledOnce();
      expect(onSignup).toHaveBeenCalledOnce();
    });

    it('passes axe a11y check', async () => {
      const { container } = render(
        <TopBar
          variant="public"
          locale="en"
          onLocaleChange={() => {}}
          onSearch={() => {}}
          onLogin={() => {}}
          onSignup={() => {}}
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('customer variant', () => {
    it('renders user avatar', () => {
      render(<TopBar variant="customer" userName="Camille R" />);
      expect(screen.getByLabelText('Account')).toBeInTheDocument();
    });

    it('passes axe a11y check', async () => {
      const { container } = render(<TopBar variant="customer" userName="Camille R" />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('seller variant (renders ProSidebar)', () => {
    it('renders sidebar with nav items and badges', () => {
      render(<TopBar variant="seller" userName="Pro User" badges={{ bookings: 3 }} />);
      expect(screen.getByLabelText('Seller navigation')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('passes axe a11y check', async () => {
      const { container } = render(<TopBar variant="seller" userName="Pro User" />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('admin variant', () => {
    it('shows MFA badge when mfaActive', () => {
      render(<TopBar variant="admin" userName="Admin" mfaActive />);
      expect(screen.getByText('MFA active')).toBeInTheDocument();
    });

    it('passes axe a11y check', async () => {
      const { container } = render(<TopBar variant="admin" userName="Admin" mfaActive />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
