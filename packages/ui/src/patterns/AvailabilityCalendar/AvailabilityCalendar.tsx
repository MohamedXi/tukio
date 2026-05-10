'use client';
import { useMemo, useRef, type KeyboardEvent } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addDays,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { cn } from '../../utils/cn';
import type {
  AvailabilityCalendarProps,
  DayStatus,
  FormatDateLabelArgs,
} from './AvailabilityCalendar.types';

const DEFAULT_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DEFAULT_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const dayClasses: Record<DayStatus, string> = {
  available: 'bg-cream-50 hover:bg-cream-100 text-charcoal-700',
  booked: 'bg-cream-200 text-charcoal-400 line-through cursor-not-allowed',
  unavailable: 'bg-cream-200 text-charcoal-400 cursor-not-allowed',
};

function defaultFormatLabel({ date, status, isSelected }: FormatDateLabelArgs): string {
  const base = format(date, 'EEEE, MMMM d, yyyy');
  const statusText =
    status === 'available' ? 'available' : status === 'booked' ? 'booked' : 'unavailable';
  return `${base}, ${statusText}${isSelected ? ', selected' : ''}`;
}

export function AvailabilityCalendar({
  month,
  availability,
  selectedDate,
  range,
  onSelectDate,
  onMonthChange,
  monthNames = DEFAULT_MONTHS,
  dayNamesShort = DEFAULT_DAYS,
  formatDateLabel = defaultFormatLabel,
  nextMonthLabel = 'Next month',
  previousMonthLabel = 'Previous month',
  className,
}: AvailabilityCalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: Date) => {
    let next: Date | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = addDays(current, -1);
        break;
      case 'ArrowRight':
        next = addDays(current, 1);
        break;
      case 'ArrowUp':
        next = addDays(current, -7);
        break;
      case 'ArrowDown':
        next = addDays(current, 7);
        break;
      case 'Home':
        next = startOfDay(addDays(current, -current.getDay() + 1));
        break;
      case 'End':
        next = endOfDay(addDays(current, 7 - current.getDay()));
        break;
      case 'PageUp':
        e.preventDefault();
        onMonthChange?.(subMonths(month, 1));
        return;
      case 'PageDown':
        e.preventDefault();
        onMonthChange?.(addMonths(month, 1));
        return;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const key = format(current, 'yyyy-MM-dd');
        const status = availability[key] ?? 'unavailable';
        if (status === 'available' && onSelectDate) {
          onSelectDate(current);
        }
        return;
      }
      default:
        return;
    }
    if (next) {
      e.preventDefault();
      const buttons =
        gridRef.current?.querySelectorAll<HTMLButtonElement>('button[role="gridcell"]');
      const targetKey = format(next, 'yyyy-MM-dd');
      buttons?.forEach((btn) => {
        if (btn.dataset.date === targetKey) btn.focus();
      });
    }
  };

  const isInRange = (date: Date): boolean => {
    if (!range?.start) return false;
    if (!range.end) return isSameDay(date, range.start);
    return date >= range.start && date <= range.end;
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size={16} />}
          onClick={() => onMonthChange?.(subMonths(month, 1))}
          aria-label={previousMonthLabel}
        >
          {''}
        </Button>
        <h3 className="text-base font-semibold text-charcoal-800">
          {monthNames[month.getMonth()]} {month.getFullYear()}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronRight size={16} />}
          onClick={() => onMonthChange?.(addMonths(month, 1))}
          aria-label={nextMonthLabel}
        >
          {''}
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-charcoal-400 font-medium text-center">
        {dayNamesShort.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div ref={gridRef} role="grid" aria-label="Calendar" className="flex flex-col gap-1">
        {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
          <div key={weekIdx} role="row" className="grid grid-cols-7 gap-1">
            {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((date) => {
              const key = format(date, 'yyyy-MM-dd');
              const status = availability[key] ?? 'unavailable';
              const inMonth = isSameMonth(date, month);
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              const inRange = isInRange(date);
              const isDisabled = status !== 'available';

              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  data-date={key}
                  tabIndex={isSelected ? 0 : -1}
                  disabled={isDisabled}
                  aria-disabled={isDisabled || undefined}
                  aria-pressed={isSelected || undefined}
                  aria-label={formatDateLabel({ date, status, isSelected })}
                  onClick={() => !isDisabled && onSelectDate?.(date)}
                  onKeyDown={(e) => handleKeyDown(e, date)}
                  className={cn(
                    'aspect-square rounded-md text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200',
                    dayClasses[status],
                    !inMonth && 'opacity-40',
                    isSelected && 'bg-brand-500 text-cream-50',
                    inRange && !isSelected && 'bg-brand-100 text-brand-700',
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

AvailabilityCalendar.displayName = 'AvailabilityCalendar';
