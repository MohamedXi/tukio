import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders initials from name', () => {
    render(<Avatar name="Camille Renard" />);
    expect(screen.getByText('CR')).toBeInTheDocument();
  });

  it('takes at most 2 initials', () => {
    render(<Avatar name="Jean Marc Dupont" />);
    expect(screen.getByText('JM')).toBeInTheDocument();
  });

  it('renders status dot when status provided', () => {
    const { container } = render(<Avatar name="User" status="online" />);
    expect(container.querySelector('[aria-label="online"]')).toBeInTheDocument();
  });

  it('renders img when src provided', () => {
    const { container } = render(<Avatar name="User" src="https://example.com/a.jpg" />);
    // Outer span is role="img" with aria-label; inner <img> uses alt="" (presentational)
    expect(screen.getByRole('img', { name: 'User' })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(<Avatar name="Camille R" tone="brand" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('falls back to initials after image error (onError callback)', () => {
    const { container } = render(
      <Avatar name="User Test" src="https://broken.example.com/img.jpg" />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    // Simulate image load failure — triggers onError → setImgError(true)
    fireEvent.error(img!);
    // Avatar container remains accessible; img is removed in favour of initials
    expect(screen.getByRole('img', { name: 'User Test' })).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('passes axe a11y check — with status', async () => {
    const { container } = render(<Avatar name="User" status="busy" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
