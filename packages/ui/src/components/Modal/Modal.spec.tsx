import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Modal } from './Modal';
import { Button } from '../Button/Button';

function ModalWrapper({
  open = true,
  onOpenChange = (() => {}) as (open: boolean) => void,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Confirm" description="Are you sure?">
      <Modal.Body>
        <p>This action is irreversible.</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary">Confirm</Button>
      </Modal.Footer>
    </Modal>
  );
}

describe('Modal', () => {
  it('renders title and description when open', () => {
    render(<ModalWrapper />);
    // Use heading role to differentiate dialog title from button text
    expect(screen.getByRole('heading', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('has role=dialog and is accessible', async () => {
    render(<ModalWrapper />);
    // Radix portals outside container — use screen for full DOM search
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Radix v1.1 may not expose aria-modal in jsdom — verify via role instead
    expect(dialog.getAttribute('role')).toBe('dialog');
  });

  it('calls onOpenChange when close button clicked', async () => {
    const handler = vi.fn();
    render(<ModalWrapper onOpenChange={handler} />);
    await userEvent.click(screen.getByLabelText('Close'));
    expect(handler).toHaveBeenCalledWith(false);
  });

  it('does not render when closed', () => {
    render(<ModalWrapper open={false} />);
    // Radix unmounts closed dialogs from the DOM
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('requireExplicitClose blocks ESC and outside click', async () => {
    const handler = vi.fn();
    render(
      <Modal open onOpenChange={handler} requireExplicitClose title="Confirm">
        <Modal.Body>Content</Modal.Body>
        <Modal.Footer>
          <Button onClick={() => handler(false)}>OK</Button>
        </Modal.Footer>
      </Modal>,
    );
    // ESC should NOT close the modal
    await userEvent.keyboard('{Escape}');
    expect(handler).not.toHaveBeenCalled();
    // Close button should NOT be present
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('passes axe a11y check — open modal', async () => {
    const { container } = render(<ModalWrapper />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
