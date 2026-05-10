import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { AvailabilityCalendar } from './AvailabilityCalendar';

const month = new Date(2026, 5, 1); // June 2026
const availability = {
  '2026-06-15': 'available' as const,
  '2026-06-22': 'booked' as const,
  '2026-06-29': 'unavailable' as const,
};

describe('AvailabilityCalendar', () => {
  it('renders month/year header', () => {
    render(<AvailabilityCalendar month={month} availability={{}} />);
    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('renders grid with role=grid', () => {
    render(<AvailabilityCalendar month={month} availability={{}} />);
    expect(screen.getByRole('grid', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('available day is clickable, booked is disabled', async () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityCalendar month={month} availability={availability} onSelectDate={onSelect} />,
    );
    const cells = screen.getAllByRole('gridcell');
    const available = cells.find((c) => c.getAttribute('data-date') === '2026-06-15');
    const booked = cells.find((c) => c.getAttribute('data-date') === '2026-06-22');
    expect(available).not.toBeDisabled();
    expect(booked).toBeDisabled();
    await userEvent.click(available!);
    expect(onSelect).toHaveBeenCalled();
  });

  it('navigates month via prev/next buttons', async () => {
    const onMonthChange = vi.fn();
    render(<AvailabilityCalendar month={month} availability={{}} onMonthChange={onMonthChange} />);
    await userEvent.click(screen.getByLabelText('Next month'));
    expect(onMonthChange).toHaveBeenCalled();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <AvailabilityCalendar month={month} availability={availability} onSelectDate={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
