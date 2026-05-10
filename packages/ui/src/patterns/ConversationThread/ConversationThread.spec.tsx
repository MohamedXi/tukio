import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ConversationThread } from './ConversationThread';
import type { ConversationMessage } from './ConversationThread.types';

const messages: ConversationMessage[] = [
  {
    id: '1',
    senderId: 'other-1',
    text: 'Hello!',
    timestamp: '2026-05-01T10:00:00Z',
    senderName: 'Camille',
  },
  { id: '2', senderId: 'me', text: 'Hi there!', timestamp: '2026-05-01T10:01:00Z' },
];

describe('ConversationThread', () => {
  it('renders messages with correct alignment', () => {
    const { container } = render(
      <ConversationThread messages={messages} currentUserId="me" onSendMessage={() => {}} />,
    );
    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
    // After Bubble extraction (P14): alignment classes are on the inner div, not <li>
    const items = container.querySelectorAll('li');
    expect(items[0]?.firstElementChild).toHaveClass('justify-start');
    expect(items[1]?.firstElementChild).toHaveClass('justify-end');
  });

  it('list has aria-live=polite', () => {
    render(<ConversationThread messages={messages} currentUserId="me" onSendMessage={() => {}} />);
    const list = screen.getByLabelText('Conversation messages');
    expect(list).toHaveAttribute('aria-live', 'polite');
  });

  it('typing indicator appears when isOtherTyping', () => {
    render(
      <ConversationThread
        messages={messages}
        currentUserId="me"
        onSendMessage={() => {}}
        isOtherTyping
      />,
    );
    expect(screen.getByLabelText('The other user is typing')).toBeInTheDocument();
  });

  it('Enter sends message and clears input', async () => {
    const onSend = vi.fn();
    render(<ConversationThread messages={messages} currentUserId="me" onSendMessage={onSend} />);
    const input = screen.getByPlaceholderText('Type a message...');
    await userEvent.type(input, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('Send button disabled when input empty', () => {
    render(<ConversationThread messages={messages} currentUserId="me" onSendMessage={() => {}} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('passes axe a11y check', async () => {
    const { container } = render(
      <ConversationThread messages={messages} currentUserId="me" onSendMessage={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
