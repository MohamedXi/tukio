import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { FilterSidebar } from './FilterSidebar';
import type { FilterGroup } from './FilterSidebar.types';

const groups: FilterGroup[] = [
  {
    id: 'category',
    legend: 'Category',
    type: 'checkbox',
    options: [
      { value: 'photo', label: 'Photographer' },
      { value: 'caterer', label: 'Caterer' },
    ],
  },
  {
    id: 'photos',
    legend: 'With photos',
    type: 'toggle',
    label: 'Photos only',
  },
];

describe('FilterSidebar', () => {
  it('renders all groups with fieldset/legend', () => {
    render(<FilterSidebar groups={groups} values={{}} onChange={() => {}} />);
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Photos only')).toBeInTheDocument();
  });

  it('checkbox group toggles values', async () => {
    const onChange = vi.fn();
    render(<FilterSidebar groups={groups} values={{}} onChange={onChange} />);
    await userEvent.click(screen.getByText('Photographer'));
    expect(onChange).toHaveBeenCalledWith({ category: ['photo'] });
  });

  it('shows resultCount in apply button', () => {
    render(<FilterSidebar groups={groups} values={{}} onChange={() => {}} resultCount={42} />);
    // Multiple buttons may match (desktop + mobile drawer triggers); take first
    const buttons = screen.getAllByRole('button', { name: /View results.*42/ });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('Clear all resets values', async () => {
    const onChange = vi.fn();
    render(<FilterSidebar groups={groups} values={{ category: ['photo'] }} onChange={onChange} />);
    const clearButtons = screen.getAllByRole('button', { name: 'Clear all' });
    await userEvent.click(clearButtons[0]!);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<FilterSidebar groups={groups} values={{}} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
