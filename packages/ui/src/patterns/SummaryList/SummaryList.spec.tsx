import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { SummaryList } from './SummaryList';

describe('SummaryList', () => {
  it('renders all items with label and value', () => {
    render(
      <SummaryList>
        <SummaryList.Item icon={<span>A</span>} label="Identity" value="Léa Martineau" />
        <SummaryList.Item icon={<span>B</span>} label="Activity" value="Atelier Tente" />
      </SummaryList>,
    );
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Léa Martineau')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Atelier Tente')).toBeInTheDocument();
  });

  it('renders the edit button when onEdit is provided', async () => {
    const onEdit = vi.fn();
    render(
      <SummaryList>
        <SummaryList.Item
          icon={<span>A</span>}
          label="Identity"
          value="Léa Martineau"
          onEdit={onEdit}
          editLabel="Edit"
        />
      </SummaryList>,
    );
    const btn = screen.getByRole('button', { name: 'Edit' });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('does not render an edit button when onEdit is omitted', () => {
    render(
      <SummaryList>
        <SummaryList.Item icon={<span>A</span>} label="Identity" value="—" />
      </SummaryList>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <SummaryList>
        <SummaryList.Item icon={<span>A</span>} label="Identity" value="X" />
        <SummaryList.Item
          icon={<span>B</span>}
          label="Activity"
          value="Y"
          onEdit={() => {}}
          editLabel="Edit"
        />
      </SummaryList>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
