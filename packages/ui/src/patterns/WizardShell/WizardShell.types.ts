import type { ReactNode } from 'react';

export interface WizardShellLabels {
  /** "Previous" — left footer button when not on first step. */
  back: string;
  /** "Continue" — right footer button when not on last step. */
  continue: string;
  /** "Submit" — right footer button on the last step. */
  submit: string;
  /** "Cancel" — left footer button on first step (replaces "back"). */
  cancel: string;
  /** "Continue later" — top-right header button (saves draft + leaves). */
  continueLater: string;
  /** Optional draft-saved status line, centered in the header. Hide by omitting. */
  draftSaved?: string;
  /** Small kicker above the page content, e.g. "Step 3 — Documents". */
  stepLabel?: string;
}

export interface WizardShellProps {
  /** 1-based current step number (used to decide first/last-step UI). */
  step: number;
  /** Total number of steps (used to decide last-step UI). */
  totalSteps: number;
  /** Logo node displayed in the header (consumer passes <Logo /> with chosen size). */
  logo: ReactNode;
  /** Stepper band node (typically <WizardStepperBand …/>) rendered below the header. */
  band: ReactNode;
  /** Page content (the step form). */
  children: ReactNode;
  /** Footer nav handlers — undefined disables the corresponding button. */
  onBack?: () => void;
  onContinue?: () => void;
  onCancel?: () => void;
  /** Disable the continue/submit button (e.g. while mutating). */
  isContinueDisabled?: boolean;
  /** Aria-busy for the continue/submit button (loading state). */
  isContinueLoading?: boolean;
  /** Localized labels — consumer is responsible for translation. */
  labels: WizardShellLabels;
}
