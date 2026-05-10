import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Map } from './Map';

describe('Map (MVP placeholder)', () => {
  it('renders placeholder with default label', () => {
    render(<Map />);
    expect(screen.getByText('Interactive map (V1)')).toBeInTheDocument();
  });

  it('renders custom placeholderLabel', () => {
    render(<Map placeholderLabel="Custom map" />);
    expect(screen.getByText('Custom map')).toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Map />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
