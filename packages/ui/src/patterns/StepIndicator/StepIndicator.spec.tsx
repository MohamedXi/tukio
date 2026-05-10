import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { StepIndicator } from './StepIndicator';

const STEPS = ['Profile', 'KYC', 'Stripe', 'Service'];

describe('StepIndicator', () => {
  it('renders all steps', () => {
    render(<StepIndicator steps={STEPS} current={1} />);
    STEPS.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });

  it('marks current step with aria-current', () => {
    render(<StepIndicator steps={STEPS} current={1} />);
    const current = screen
      .getAllByRole('listitem')
      .find((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toBeDefined();
  });

  it('completed steps are clickable when onStepClick provided', async () => {
    const handler = vi.fn();
    render(<StepIndicator steps={STEPS} current={2} onStepClick={handler} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    await userEvent.click(buttons[0]!);
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('upcoming steps are NOT clickable', () => {
    render(<StepIndicator steps={STEPS} current={0} onStepClick={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders vertical orientation', () => {
    const { container } = render(
      <StepIndicator steps={STEPS} current={1} orientation="vertical" />,
    );
    expect(container.querySelector('ol')).toHaveClass('flex-col');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <StepIndicator steps={STEPS} current={1} onStepClick={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
