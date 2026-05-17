import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { WizardStepperBand } from './WizardStepperBand';

const STEPS = ['Identity', 'Activity', 'Documents', 'Review'];

describe('WizardStepperBand', () => {
  it('renders the counter label', () => {
    render(
      <WizardStepperBand
        steps={STEPS}
        current={2}
        counterLabel="Step 3 of 4 · Become a pro on tukio"
      />,
    );
    expect(screen.getByText('Step 3 of 4 · Become a pro on tukio')).toBeInTheDocument();
  });

  it('renders the embedded StepIndicator with all steps', () => {
    render(<WizardStepperBand steps={STEPS} current={1} counterLabel="Step 2 of 4" />);
    STEPS.forEach((label, i) => {
      expect(screen.getByText(`${i + 1}. ${label}`)).toBeInTheDocument();
    });
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <WizardStepperBand steps={STEPS} current={0} counterLabel="Step 1 of 4" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
