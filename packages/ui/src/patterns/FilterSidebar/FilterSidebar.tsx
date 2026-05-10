'use client';
import { useState, useId } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check, ChevronDown, Filter as FilterIcon } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal/Modal';
import { cn } from '../../utils/cn';
import type {
  FilterSidebarProps,
  FilterGroup,
  FilterValues,
  CheckboxFilter,
  RadioFilter,
  RangeFilter,
  ToggleFilter,
} from './FilterSidebar.types';

// P22 fix: runtime guard — if a consumer passes string instead of array, treat as empty
function asArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

// P23 fix: detect if a range value differs from its default [min, max]
function isRangeModified(current: unknown, group: RangeFilter): boolean {
  if (!Array.isArray(current) || current.length !== 2) return false;
  return current[0] !== group.min || current[1] !== group.max;
}

/** P17 fix: collapsible group wrapper with aria-expanded/aria-controls */
function CollapsibleFieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const contentId = `filter-group-${id}`;
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex items-center justify-between w-full text-sm font-semibold text-charcoal-700 mb-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 rounded"
      >
        <legend className="contents">{legend}</legend>
        <ChevronDown
          size={14}
          className={cn('transition-transform', !open && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      <div id={contentId} hidden={!open} className="flex flex-col gap-2">
        {children}
      </div>
    </fieldset>
  );
}

function FilterGroupRenderer({
  group,
  values,
  onChange,
}: {
  group: FilterGroup;
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  switch (group.type) {
    case 'checkbox':
      return <CheckboxFilterControl group={group} values={values} onChange={onChange} />;
    case 'radio':
      return <RadioFilterControl group={group} values={values} onChange={onChange} />;
    case 'range':
      return <RangeFilterControl group={group} values={values} onChange={onChange} />;
    case 'toggle':
      return <ToggleFilterControl group={group} values={values} onChange={onChange} />;
  }
}

function CheckboxFilterControl({
  group,
  values,
  onChange,
}: {
  group: CheckboxFilter;
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  const current = asArray(values[group.id]);
  return (
    <CollapsibleFieldset legend={group.legend}>
      {group.options.map((opt) => {
        const checked = current.includes(opt.value);
        return (
          <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox.Root
              checked={checked}
              onCheckedChange={(c) => {
                const next = c ? [...current, opt.value] : current.filter((v) => v !== opt.value);
                onChange({ ...values, [group.id]: next });
              }}
              className="h-4 w-4 rounded border border-cream-300 bg-cream-50 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <Checkbox.Indicator className="flex items-center justify-center text-cream-50">
                <Check size={12} />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span className="flex-1 text-charcoal-700">{opt.label}</span>
            {opt.count !== undefined && (
              <span className="text-charcoal-400 text-xs">({opt.count})</span>
            )}
          </label>
        );
      })}
    </CollapsibleFieldset>
  );
}

function RadioFilterControl({
  group,
  values,
  onChange,
}: {
  group: RadioFilter;
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  const current = typeof values[group.id] === 'string' ? (values[group.id] as string) : undefined;
  return (
    <CollapsibleFieldset legend={group.legend}>
      {group.options.map((opt) => (
        <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            name={group.id}
            value={opt.value}
            checked={current === opt.value}
            onChange={() => onChange({ ...values, [group.id]: opt.value })}
            className="h-4 w-4 accent-brand-500"
          />
          <span className="flex-1 text-charcoal-700">{opt.label}</span>
        </label>
      ))}
    </CollapsibleFieldset>
  );
}

function RangeFilterControl({
  group,
  values,
  onChange,
}: {
  group: RangeFilter;
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  // P24 fix: validate array length before destructuring; fall back to [min, max]
  const raw = values[group.id];
  const current: [number, number] =
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === 'number' &&
    typeof raw[1] === 'number'
      ? [raw[0], raw[1]]
      : [group.min, group.max];
  const formatValue = group.formatValue ?? ((v: number) => v.toString());
  return (
    <CollapsibleFieldset legend={group.legend}>
      <Slider.Root
        value={current}
        min={group.min}
        max={group.max}
        step={group.step ?? 1}
        onValueChange={(v) => onChange({ ...values, [group.id]: v })}
        className="relative flex items-center select-none touch-none w-full h-5"
      >
        <Slider.Track className="bg-cream-200 relative grow rounded-full h-1">
          <Slider.Range className="absolute bg-brand-500 rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={`${group.legend} minimum`}
          aria-valuetext={formatValue(current[0])}
          className="block w-4 h-4 bg-cream-50 border-2 border-brand-500 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        />
        <Slider.Thumb
          aria-label={`${group.legend} maximum`}
          aria-valuetext={formatValue(current[1])}
          className="block w-4 h-4 bg-cream-50 border-2 border-brand-500 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        />
      </Slider.Root>
      <div className="flex justify-between text-xs text-charcoal-600 tabular-nums">
        <span>{formatValue(current[0])}</span>
        <span>{formatValue(current[1])}</span>
      </div>
    </CollapsibleFieldset>
  );
}

function ToggleFilterControl({
  group,
  values,
  onChange,
}: {
  group: ToggleFilter;
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  const current = Boolean(values[group.id]);
  return (
    <fieldset className="border-0 p-0">
      <legend className="sr-only">{group.legend}</legend>
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
        <Checkbox.Root
          checked={current}
          onCheckedChange={(c) => onChange({ ...values, [group.id]: Boolean(c) })}
          className="h-4 w-4 rounded border border-cream-300 bg-cream-50 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
        >
          <Checkbox.Indicator className="flex items-center justify-center text-cream-50">
            <Check size={12} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <span className="text-charcoal-700">{group.label}</span>
      </label>
    </fieldset>
  );
}

function FilterContent({
  groups,
  values,
  onChange,
  onApply,
  resultCount,
  applyLabel,
  clearLabel,
}: Pick<FilterSidebarProps, 'groups' | 'values' | 'onChange' | 'onApply' | 'resultCount'> & {
  applyLabel: string;
  clearLabel: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <FilterGroupRenderer key={group.id} group={group} values={values} onChange={onChange} />
      ))}
      <div className="flex flex-col gap-2 pt-4 border-t border-cream-200">
        {/* P7 fix: Apply button now has onClick wired to onApply prop */}
        <Button variant="primary" className="w-full" onClick={onApply}>
          {resultCount !== undefined ? `${applyLabel} (${resultCount})` : applyLabel}
        </Button>
        <Button variant="ghost" onClick={() => onChange({})}>
          {clearLabel}
        </Button>
      </div>
    </div>
  );
}

export function FilterSidebar({
  groups,
  values,
  onChange,
  onApply,
  resultCount,
  applyLabel = 'View results',
  clearLabel = 'Clear all',
  mobileToggleLabel = 'Filters',
  className,
}: FilterSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // P23 fix: only count truly modified filters (not default range values)
  const activeCount = groups.reduce((acc, group) => {
    const v = values[group.id];
    if (group.type === 'range') return acc + (isRangeModified(v, group) ? 1 : 0);
    if (group.type === 'checkbox') return acc + (Array.isArray(v) && v.length > 0 ? 1 : 0);
    if (group.type === 'radio') return acc + (typeof v === 'string' && v ? 1 : 0);
    if (group.type === 'toggle') return acc + (v ? 1 : 0);
    return acc;
  }, 0);

  // Apply handler that also closes the mobile drawer
  const handleApply = () => {
    onApply?.();
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col gap-4 w-[280px] p-4 bg-cream-50 border border-cream-200 rounded-lg',
          className,
        )}
        aria-label="Filters"
      >
        <FilterContent
          groups={groups}
          values={values}
          onChange={onChange}
          onApply={handleApply}
          resultCount={resultCount}
          applyLabel={applyLabel}
          clearLabel={clearLabel}
        />
      </aside>

      {/* Mobile toggle */}
      <Button
        variant="secondary"
        size="default"
        icon={<FilterIcon size={16} />}
        onClick={() => setMobileOpen(true)}
        className="md:hidden"
      >
        {mobileToggleLabel}
        {activeCount > 0 && ` (${activeCount})`}
      </Button>

      {/* Mobile drawer */}
      <Modal open={mobileOpen} onOpenChange={setMobileOpen} title={mobileToggleLabel} size="lg">
        <Modal.Body>
          <FilterContent
            groups={groups}
            values={values}
            onChange={onChange}
            onApply={handleApply}
            resultCount={resultCount}
            applyLabel={applyLabel}
            clearLabel={clearLabel}
          />
        </Modal.Body>
      </Modal>
    </>
  );
}

FilterSidebar.displayName = 'FilterSidebar';
