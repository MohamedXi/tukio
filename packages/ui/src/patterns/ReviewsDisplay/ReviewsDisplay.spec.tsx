import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ReviewsDisplay } from './ReviewsDisplay';
import type { Review } from './ReviewsDisplay.types';

const reviews: Review[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  authorName: `User ${i}`,
  rating: 4,
  date: '2026-01-01',
  comment: `Comment ${i}`,
}));

describe('ReviewsDisplay', () => {
  it('renders summary with rating and count', () => {
    render(<ReviewsDisplay rating={4.8} count={42} reviews={reviews} />);
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('renders only first pageSize reviews initially', () => {
    render(<ReviewsDisplay rating={4} count={6} reviews={reviews} pageSize={3} />);
    expect(screen.getByText('Comment 0')).toBeInTheDocument();
    expect(screen.getByText('Comment 2')).toBeInTheDocument();
    expect(screen.queryByText('Comment 3')).not.toBeInTheDocument();
  });

  it('load more button reveals next batch', async () => {
    render(<ReviewsDisplay rating={4} count={6} reviews={reviews} pageSize={3} />);
    await userEvent.click(screen.getByRole('button', { name: 'Load more reviews' }));
    expect(screen.getByText('Comment 3')).toBeInTheDocument();
  });

  it('renders EmptyState when reviews is empty', () => {
    render(<ReviewsDisplay rating={0} count={0} reviews={[]} />);
    expect(screen.getByRole('heading', { name: /No reviews/i })).toBeInTheDocument();
  });

  it('renders breakdown when provided', () => {
    render(
      <ReviewsDisplay
        rating={4.8}
        count={42}
        reviews={reviews}
        breakdown={{ punctuality: 4.9, communication: 4.7 }}
      />,
    );
    expect(screen.getByText('Punctuality')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <ReviewsDisplay rating={4.8} count={3} reviews={reviews.slice(0, 3)} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
