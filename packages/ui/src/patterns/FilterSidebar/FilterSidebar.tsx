'use client';
import { useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check, Filter as FilterIcon } from 'lucide-react';
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
  const current = (values[group.id] as string[]) ?? [];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-charcoal-700 mb-2">{group.legend}</legend>
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
    </fieldset>
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
  const current = values[group.id] as string | undefined;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-charcoal-700 mb-2">{group.legend}</legend>
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
    </fieldset>
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
  const current = (values[group.id] as number[]) ?? [group.min, group.max];
  const formatValue = group.formatValue ?? ((v: number) => v.toString());
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-charcoal-700 mb-2">{group.legend}</legend>
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
          className="block w-4 h-4 bg-cream-50 border-2 border-brand-500 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          aria-label={`${group.legend} min`}
        />
        <Slider.Thumb
          className="block w-4 h-4 bg-cream-50 border-2 border-brand-500 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          aria-label={`${group.legend} max`}
        />
      </Slider.Root>
      <div className="flex justify-between text-xs text-charcoal-600 tabular-nums">
        <span>{formatValue(current[0]!)}</span>
        <span>{formatValue(current[1]!)}</span>
      </div>
    </fieldset>
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
    <fieldset>
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
  resultCount,
  applyLabel,
  clearLabel,
}: Pick<FilterSidebarProps, 'groups' | 'values' | 'onChange' | 'resultCount'> & {
  applyLabel: string;
  clearLabel: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <FilterGroupRenderer key={group.id} group={group} values={values} onChange={onChange} />
      ))}
      <div className="flex flex-col gap-2 pt-4 border-t border-cream-200">
        <Button variant="primary" className="w-full">
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
  resultCount,
  applyLabel = 'View results',
  clearLabel = 'Clear all',
  mobileToggleLabel = 'Filters',
  className,
}: FilterSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = Object.values(values).filter((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v),
  ).length;

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
