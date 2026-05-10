export type StepStatus = 'completed' | 'current' | 'upcoming';

export interface StepLabelArgs {
  index: number;
  total: number;
  label: string;
  status: StepStatus;
}

export interface StepIndicatorProps {
  steps: string[];
  current: number;
  orientation?: 'horizontal' | 'vertical';
  onStepClick?: (index: number) => void;
  formatStepLabel?: (args: StepLabelArgs) => string;
  className?: string;
}
