import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('Tukio Public — homepage placeholder', () => {
  it('renders the placeholder heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tukio Public');
  });
});
