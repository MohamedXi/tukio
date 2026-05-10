'use client';
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { cn } from '../../utils/cn';
import type { ConversationThreadProps } from './ConversationThread.types';

export function ConversationThread({
  messages,
  currentUserId,
  onSendMessage,
  isOtherTyping,
  formatRelativeTime = (d) => (typeof d === 'string' ? d : d.toLocaleTimeString()),
  typingLabel = 'The other user is typing',
  sendLabel = 'Send',
  placeholderLabel = 'Type a message...',
  className,
}: ConversationThreadProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-scroll to last message on new message
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isOtherTyping]);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-cream-50', className)}>
      <ul
        ref={listRef}
        className="flex-1 overflow-y-auto flex flex-col gap-3 p-4"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation messages"
      >
        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          return (
            <li
              key={msg.id}
              className={cn('flex items-end gap-2', isOwn ? 'justify-end' : 'justify-start')}
            >
              {!isOwn && msg.senderName && (
                <Avatar name={msg.senderName} src={msg.senderAvatar} size={28} tone="cream" />
              )}
              <div className="flex flex-col gap-1 max-w-[70%]">
                <div
                  className={cn(
                    'px-4 py-2 rounded-2xl text-sm',
                    isOwn
                      ? 'bg-brand-500 text-cream-50 rounded-br-sm'
                      : 'bg-cream-100 text-charcoal-700 rounded-bl-sm',
                  )}
                >
                  {msg.text}
                </div>
                <span className="text-xs text-charcoal-400 px-1">
                  {formatRelativeTime(msg.timestamp)}
                </span>
              </div>
            </li>
          );
        })}
        {isOtherTyping && (
          <li className="flex items-center gap-2" aria-label={typingLabel}>
            <span className="bg-cream-100 text-charcoal-500 px-3 py-2 rounded-2xl rounded-bl-sm inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-charcoal-500 rounded-full animate-[tk-typing_1.4s_ease-in-out_infinite]" />
              <span
                className="w-1.5 h-1.5 bg-charcoal-500 rounded-full animate-[tk-typing_1.4s_ease-in-out_infinite]"
                style={{ animationDelay: '0.2s' }}
              />
              <span
                className="w-1.5 h-1.5 bg-charcoal-500 rounded-full animate-[tk-typing_1.4s_ease-in-out_infinite]"
                style={{ animationDelay: '0.4s' }}
              />
            </span>
          </li>
        )}
      </ul>
      <div className="flex items-center gap-2 p-3 border-t border-cream-200">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderLabel}
          aria-label={placeholderLabel}
        />
        <Button
          variant="primary"
          size="default"
          onClick={handleSubmit}
          disabled={!draft.trim()}
          icon={<Send size={16} />}
          aria-label={sendLabel}
        >
          {sendLabel}
        </Button>
      </div>
    </div>
  );
}

ConversationThread.displayName = 'ConversationThread';
