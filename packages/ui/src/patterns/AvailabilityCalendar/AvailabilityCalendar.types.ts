export type DayStatus = 'available' | 'booked' | 'unavailable';

export type AvailabilityMap = Record<string, DayStatus>;

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface FormatDateLabelArgs {
  date: Date;
  status: DayStatus;
  isSelected: boolean;
}

export interface AvailabilityCalendarProps {
  month: Date;
  availability: AvailabilityMap;
  selectedDate?: Date | null;
  range?: DateRange;
  onSelectDate?: (date: Date) => void;
  onMonthChange?: (newMonth: Date) => void;
  monthNames?: string[];
  dayNamesShort?: string[];
  formatDateLabel?: (args: FormatDateLabelArgs) => string;
  nextMonthLabel?: string;
  previousMonthLabel?: string;
  className?: string;
}
