import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <p>Content</p>
      </Card>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders compound components', () => {
    render(
      <Card>
        <Card.Header>Header</Card.Header>
        <Card.Body>Body</Card.Body>
        <Card.Footer>Footer</Card.Footer>
      </Card>,
    );
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('interactive card handles Enter key', async () => {
    const handler = vi.fn();
    render(
      <Card interactive onClick={handler}>
        Click me
      </Card>,
    );
    const card = screen.getByRole('button');
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(handler).toHaveBeenCalled();
  });

  it('interactive card handles Space key', () => {
    const handler = vi.fn();
    render(
      <Card interactive onClick={handler}>
        Click me
      </Card>,
    );
    const card = screen.getByRole('button');
    card.focus();
    // fireEvent simulates a raw keydown — precise for synthetic Space key handling
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });
    expect(handler).toHaveBeenCalled();
  });

  it('passes axe a11y check — default', async () => {
    const { container } = render(
      <Card>
        <p>Content</p>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe a11y check — interactive', async () => {
    const { container } = render(
      <Card interactive onClick={() => {}}>
        Action
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
