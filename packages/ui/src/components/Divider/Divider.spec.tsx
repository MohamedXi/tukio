import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Divider } from './Divider';

describe('Divider', () => {
  it('renders horizontal hr by default', () => {
    const { container } = render(<Divider />);
    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Divider label="OR" />);
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('renders vertical divider', () => {
    const { container } = render(<Divider orientation="vertical" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('passes axe a11y check — horizontal', async () => {
    const { container } = render(<Divider />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — with label', async () => {
    const { container } = render(<Divider label="OR" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
