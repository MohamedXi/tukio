import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { EditorialPageShell } from './EditorialPageShell';

describe('EditorialPageShell', () => {
  it('renders title h1 (minimal props)', () => {
    render(
      <EditorialPageShell title="À propos">
        <p>Body</p>
      </EditorialPageShell>,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('À propos');
  });

  it('renders kicker above the h1 when provided', () => {
    render(
      <EditorialPageShell kicker="Editorial" title="Title">
        Body
      </EditorialPageShell>,
    );
    expect(screen.getByText('Editorial')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders intro paragraph when provided', () => {
    render(
      <EditorialPageShell title="Title" intro="A short intro paragraph.">
        Body
      </EditorialPageShell>,
    );
    expect(screen.getByText('A short intro paragraph.')).toBeInTheDocument();
  });

  it('renders header + footer slots', () => {
    render(
      <EditorialPageShell
        title="Title"
        header={<div data-testid="hdr">Header</div>}
        footer={<div data-testid="ftr">Footer</div>}
      >
        Body
      </EditorialPageShell>,
    );
    expect(screen.getByTestId('hdr')).toBeInTheDocument();
    expect(screen.getByTestId('ftr')).toBeInTheDocument();
  });

  it('applies default max-width 880px to main', () => {
    const { container } = render(<EditorialPageShell title="Title">Body</EditorialPageShell>);
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.getAttribute('style')).toContain('max-width: 880px');
  });

  it('overrides max-width when prop provided', () => {
    const { container } = render(
      <EditorialPageShell title="Title" maxWidth={960}>
        Body
      </EditorialPageShell>,
    );
    expect(container.querySelector('main')?.getAttribute('style')).toContain('max-width: 960px');
  });

  it('accepts ReactNode title for italic composition', () => {
    render(
      <EditorialPageShell
        title={
          <>
            Tukio <em data-testid="italic">marketplace</em>
          </>
        }
      >
        Body
      </EditorialPageShell>,
    );
    expect(screen.getByTestId('italic')).toBeInTheDocument();
  });

  it('renders main landmark', () => {
    render(<EditorialPageShell title="Title">Body</EditorialPageShell>);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('merges custom className with the root wrapper', () => {
    const { container } = render(
      <EditorialPageShell title="T" className="custom-root">
        Body
      </EditorialPageShell>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('custom-root');
  });

  it('passes axe a11y check (minimal)', async () => {
    const { container } = render(
      <EditorialPageShell title="Title">
        <p>Body content.</p>
      </EditorialPageShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check (full props)', async () => {
    const { container } = render(
      <EditorialPageShell
        kicker="Editorial"
        title="Title"
        intro="Intro."
        header={<header role="banner">Top</header>}
        footer={<footer role="contentinfo">Bottom</footer>}
      >
        <p>Body.</p>
      </EditorialPageShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
