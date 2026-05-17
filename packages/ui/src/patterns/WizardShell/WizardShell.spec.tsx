import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { WizardShell } from './WizardShell';

const labels = {
  back: 'Back',
  continue: 'Continue',
  submit: 'Submit',
  cancel: 'Cancel',
  continueLater: 'Continue later',
  draftSaved: 'Draft saved 1 min ago',
  stepLabel: 'Step 1 — Identity',
};

const baseProps = {
  step: 1,
  totalSteps: 4,
  logo: <span data-testid="logo">logo</span>,
  band: <div data-testid="band">band</div>,
  children: <div data-testid="content">content</div>,
  labels,
};

describe('WizardShell', () => {
  it('renders logo, band and children in order', () => {
    render(<WizardShell {...baseProps} />);
    expect(screen.getByTestId('logo')).toBeInTheDocument();
    expect(screen.getByTestId('band')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders the step label kicker', () => {
    render(<WizardShell {...baseProps} />);
    expect(screen.getByText('Step 1 — Identity')).toBeInTheDocument();
  });

  it('shows Cancel button on first step and not Back', () => {
    render(<WizardShell {...baseProps} step={1} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();
  });

  it('shows Back button on non-first step', () => {
    render(<WizardShell {...baseProps} step={2} />);
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('shows Submit on last step and Continue otherwise', () => {
    const { rerender } = render(<WizardShell {...baseProps} step={1} totalSteps={4} />);
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeInTheDocument();
    rerender(<WizardShell {...baseProps} step={4} totalSteps={4} />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('fires onBack / onContinue / onCancel handlers', async () => {
    const onBack = vi.fn();
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    render(
      <WizardShell
        {...baseProps}
        step={2}
        onBack={onBack}
        onContinue={onContinue}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(onContinue).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Continue later' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('respects isContinueDisabled and aria-busy', () => {
    render(<WizardShell {...baseProps} isContinueDisabled isContinueLoading />);
    const cta = screen.getByRole('button', { name: 'Continue →' });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute('aria-busy', 'true');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<WizardShell {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
