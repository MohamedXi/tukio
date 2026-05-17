export interface WizardStepperBandProps {
  /** Ordered list of step labels. */
  steps: string[];
  /** Index of the current step (0-based). */
  current: number;
  /** Counter sentence shown above the bars (e.g. "Step 3 of 5 · Become a pro"). */
  counterLabel: string;
  /** Optional className passed to the outer band wrapper. */
  className?: string;
}
