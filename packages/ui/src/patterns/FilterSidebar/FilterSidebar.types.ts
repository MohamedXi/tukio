export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface CheckboxFilter {
  id: string;
  legend: string;
  type: 'checkbox';
  options: FilterOption[];
}

export interface RadioFilter {
  id: string;
  legend: string;
  type: 'radio';
  options: FilterOption[];
}

export interface RangeFilter {
  id: string;
  legend: string;
  type: 'range';
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
}

export interface ToggleFilter {
  id: string;
  legend: string;
  type: 'toggle';
  label: string;
}

export type FilterGroup = CheckboxFilter | RadioFilter | RangeFilter | ToggleFilter;

export type FilterValues = Record<string, string[] | string | number[] | boolean>;

export interface FilterSidebarProps {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  /** P7 fix: Called when user clicks Apply (mobile drawer auto-closes). */
  onApply?: () => void;
  resultCount?: number;
  applyLabel?: string;
  clearLabel?: string;
  mobileToggleLabel?: string;
  className?: string;
}
