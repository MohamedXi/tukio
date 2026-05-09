import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Label } from './Label';

describe('Label', () => {
  it('renders text content', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders required asterisk when required', () => {
    const { container } = render(<Label required>Email</Label>);
    expect(container.querySelector('span')).toHaveClass('text-error-500');
  });

  it('passes htmlFor to native label', () => {
    render(<Label htmlFor="my-input">Email</Label>);
    expect(screen.getByText('Email').closest('label')).toHaveAttribute('for', 'my-input');
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="f">Name</Label>
        <input id="f" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
