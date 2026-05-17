import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders children as label', () => {
    render(<Checkbox>Accept terms</Checkbox>);
    expect(screen.getByLabelText('Accept terms')).toBeInTheDocument();
  });

  it('reflects checked prop', () => {
    render(
      <Checkbox checked onChange={() => {}}>
        X
      </Checkbox>,
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('fires onChange when clicked', async () => {
    const handler = vi.fn();
    render(<Checkbox onChange={handler}>X</Checkbox>);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(handler).toHaveBeenCalled();
  });

  it('respects disabled prop', async () => {
    const handler = vi.fn();
    render(
      <Checkbox disabled onChange={handler}>
        X
      </Checkbox>,
    );
    const cb = screen.getByRole('checkbox');
    expect(cb).toBeDisabled();
    await userEvent.click(cb);
    expect(handler).not.toHaveBeenCalled();
  });

  it('renders error state with aria-invalid', () => {
    render(<Checkbox error>X</Checkbox>);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('supports indeterminate prop', () => {
    render(<Checkbox indeterminate>X</Checkbox>);
    const cb = screen.getByRole('checkbox') as HTMLInputElement;
    expect(cb.indeterminate).toBe(true);
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Checkbox>Accept terms</Checkbox>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
