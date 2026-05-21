import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Block } from './EditorialPageShell';

describe('Block', () => {
  it('renders the h2 title and children', () => {
    render(
      <Block title="Engagement">
        <p>One paragraph.</p>
      </Block>,
    );
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toHaveTextContent('Engagement');
    expect(screen.getByText('One paragraph.')).toBeInTheDocument();
  });

  it('accepts ReactNode title for italic accents', () => {
    render(
      <Block
        title={
          <>
            Ce que la <em data-testid="italic">plateforme</em> propose
          </>
        }
      >
        Body
      </Block>,
    );
    expect(screen.getByTestId('italic')).toBeInTheDocument();
  });

  it('renders inside a <section> landmark', () => {
    const { container } = render(<Block title="T">Body</Block>);
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('merges custom className', () => {
    const { container } = render(
      <Block title="T" className="custom-block">
        Body
      </Block>,
    );
    expect(container.querySelector('section')?.className).toContain('custom-block');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <Block title="Engagement">
        <p>Body.</p>
      </Block>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
