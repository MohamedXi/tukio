import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Pill } from './Pill';

describe('Pill', () => {
  it('renders default brand variant', () => {
    render(<Pill>En construction</Pill>);
    const el = screen.getByText('En construction');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('bg-brand-50');
    expect(el.className).toContain('text-brand-700');
  });

  it.each([
    ['brand', 'bg-brand-50'],
    ['charcoal', 'bg-charcoal-400/10'],
    ['success', 'bg-success-50'],
    ['cream', 'bg-cream-100'],
  ] as const)('renders variant=%s with bg class %s', (variant, expectedBg) => {
    render(<Pill variant={variant}>Label</Pill>);
    const el = screen.getByText('Label');
    expect(el.className).toContain(expectedBg);
  });

  it('renders pulseDot when true with aria-hidden + pulse animation', () => {
    const { container } = render(<Pill pulseDot>Live</Pill>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('style')).toContain('var(--animate-pulse)');
    // bg-current makes the dot inherit text color — no explicit color class needed.
    expect(dot?.className).toContain('bg-current');
    expect(dot?.className).toContain('rounded-full');
  });

  it('omits pulseDot when prop is false/absent', () => {
    const { container } = render(<Pill>No dot</Pill>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('renders icon slot', () => {
    render(<Pill icon={<span data-testid="icon">★</span>}>Label</Pill>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders pulseDot + icon together, dot before icon before text', () => {
    const { container } = render(
      <Pill pulseDot icon={<span data-testid="icon">★</span>}>
        Live event
      </Pill>,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    const icon = screen.getByTestId('icon');
    expect(dot).not.toBeNull();
    expect(icon).toBeInTheDocument();
    // DOM order: dot precedes icon, icon precedes text node
    const root = container.firstChild as HTMLElement;
    expect(root.children[0]).toBe(dot);
  });

  it('accepts ref', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Pill ref={ref}>Label</Pill>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('spreads HTMLSpanElement props and merges className', () => {
    render(
      <Pill data-testid="pill" title="tooltip" className="custom">
        Label
      </Pill>,
    );
    const el = screen.getByTestId('pill');
    expect(el).toHaveAttribute('title', 'tooltip');
    expect(el.className).toContain('custom');
  });

  it('passes axe a11y check with pulseDot', async () => {
    const { container } = render(<Pill pulseDot>Live</Pill>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check without pulseDot', async () => {
    const { container } = render(<Pill variant="success">Notified</Pill>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
