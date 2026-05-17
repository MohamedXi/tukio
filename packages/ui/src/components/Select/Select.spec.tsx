import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Select } from './Select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('Select', () => {
  it('renders options from options prop', () => {
    render(<Select options={OPTIONS} aria-label="letters" />);
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gamma' })).toBeInTheDocument();
  });

  it('renders children when options prop is omitted', () => {
    render(
      <Select aria-label="letters">
        <option value="x">X-ray</option>
      </Select>,
    );
    expect(screen.getByRole('option', { name: 'X-ray' })).toBeInTheDocument();
  });

  it('renders placeholder as a disabled hidden first option', () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Pick one" aria-label="letters" />,
    );
    const placeholderOpt = container.querySelector('option[value=""]') as HTMLOptionElement | null;
    expect(placeholderOpt).not.toBeNull();
    expect(placeholderOpt!.textContent).toBe('Pick one');
    expect(placeholderOpt!.disabled).toBe(true);
    expect(placeholderOpt!.hidden).toBe(true);
  });

  it('fires onChange when user selects a value', async () => {
    const handler = vi.fn();
    render(<Select options={OPTIONS} onChange={handler} aria-label="letters" defaultValue="a" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'b');
    expect(handler).toHaveBeenCalled();
  });

  it('respects disabled prop', () => {
    render(<Select options={OPTIONS} disabled aria-label="letters" />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('renders error state with aria-invalid', () => {
    render(<Select options={OPTIONS} error aria-label="letters" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <Select options={OPTIONS} aria-label="letters" defaultValue="a" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
