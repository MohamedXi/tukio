import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Kicker } from './Kicker';

describe('Kicker', () => {
  it('renders default brand variant uppercase mono', () => {
    render(<Kicker>Rester informé·e</Kicker>);
    const el = screen.getByText('Rester informé·e');
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('font-mono');
    expect(el.className).toContain('uppercase');
    expect(el.className).toContain('text-brand-700');
  });

  it.each(['brand', 'charcoal', 'cream', 'success'] as const)('renders color=%s', (color) => {
    render(<Kicker color={color}>Label</Kicker>);
    const el = screen.getByText('Label');
    expect(el.className).toContain(
      `text-${color === 'brand' ? 'brand-700' : color === 'charcoal' ? 'charcoal-500' : color === 'cream' ? 'cream-200' : 'success-700'}`,
    );
  });

  it('renders size=md with text-[13px]', () => {
    render(<Kicker size="md">Label</Kicker>);
    expect(screen.getByText('Label').className).toContain('text-[13px]');
  });

  it('default size is sm (text-[11px])', () => {
    render(<Kicker>Label</Kicker>);
    expect(screen.getByText('Label').className).toContain('text-[11px]');
  });

  it('accepts ref', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Kicker ref={ref}>Label</Kicker>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('accepts ReactNode children (composition)', () => {
    render(
      <Kicker>
        <strong data-testid="strong">Bold</strong> normal
      </Kicker>,
    );
    expect(screen.getByTestId('strong')).toBeInTheDocument();
  });

  it('spreads HTMLSpanElement props', () => {
    render(
      <Kicker data-testid="kicker" title="tooltip text">
        Label
      </Kicker>,
    );
    const el = screen.getByTestId('kicker');
    expect(el).toHaveAttribute('title', 'tooltip text');
  });

  it('merges custom className with variants', () => {
    render(<Kicker className="custom-class">Label</Kicker>);
    expect(screen.getByText('Label').className).toContain('custom-class');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Kicker>Label</Kicker>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
