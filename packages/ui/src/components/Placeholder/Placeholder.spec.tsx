import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Placeholder } from './Placeholder';

describe('Placeholder', () => {
  it('renders with role=img', () => {
    render(<Placeholder label="Event photo" />);
    expect(screen.getByRole('img', { name: 'Event photo' })).toBeInTheDocument();
  });

  it('renders label text', () => {
    render(<Placeholder label="4:3 image placeholder" />);
    expect(screen.getByText('4:3 image placeholder')).toBeInTheDocument();
  });

  it('applies background stripe style', () => {
    const { container } = render(<Placeholder label="Test" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundImage).toContain('repeating-linear-gradient');
  });

  it('applies aspect ratio', () => {
    const { container } = render(<Placeholder aspect="4/3" label="Photo" />);
    expect(container.firstChild).toHaveClass('aspect-[4/3]');
  });

  it('applies numeric height', () => {
    const { container } = render(<Placeholder height={200} label="Photo" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('200px');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Placeholder label="Event photo placeholder" aspect="4/3" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — no label', async () => {
    const { container } = render(<Placeholder height={100} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
