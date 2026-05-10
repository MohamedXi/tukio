'use client';
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { cn } from '../../utils/cn';
import type { ConversationThreadProps, ConversationMessage } from './ConversationThread.types';

/** P14 fix: Bubble sub-component extracted for reuse. */
export interface BubbleProps {
  message: ConversationMessage;
  isOwn: boolean;
  formatTimestamp?: (date: Date | string) => string;
  showAvatar?: boolean;
  className?: string;
}

function Bubble({ message, isOwn, formatTimestamp, showAvatar = true, className }: BubbleProps) {
  return (
    <div className={cn('flex items-end gap-2', isOwn ? 'justify-end' : 'justify-start', className)}>
      {!isOwn && showAvatar && message.senderName && (
        <Avatar name={message.senderName} src={message.senderAvatar} size={28} tone="cream" />
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
          {message.text}
        </div>
        {formatTimestamp && (
          <span className="text-xs text-charcoal-400 px-1">
            {formatTimestamp(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}
Bubble.displayName = 'ConversationThread.Bubble';

/** P14 fix: Composer sub-component extracted for reuse. */
export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  sendLabel?: string;
  disabled?: boolean;
}

function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  sendLabel = 'Send',
  disabled,
}: ComposerProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape') {
      (e.target as HTMLInputElement).blur();
    }
  };
  return (
    <div className="flex items-center gap-2 p-3 border-t border-cream-200">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <Button
        variant="primary"
        size="default"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        icon={<Send size={16} />}
        aria-label={sendLabel}
      >
        {sendLabel}
      </Button>
    </div>
  );
}
Composer.displayName = 'ConversationThread.Composer';

// P26 fix: stable formatter to avoid SSR/client locale mismatch
const stableTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function ConversationThreadRoot({
  messages,
  currentUserId,
  onSendMessage,
  isOtherTyping,
  formatRelativeTime = (d) => stableTimeFormatter.format(typeof d === 'string' ? new Date(d) : d),
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

  return (
    <div className={cn('flex flex-col h-full bg-cream-50', className)}>
      <ul
        ref={listRef}
        className="flex-1 overflow-y-auto flex flex-col gap-3 p-4"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation messages"
      >
        {messages.map((msg) => (
          <li key={msg.id}>
            <Bubble
              message={msg}
              isOwn={msg.senderId === currentUserId}
              formatTimestamp={formatRelativeTime}
            />
          </li>
        ))}
        {isOtherTyping && (
          <li className="flex items-center gap-2" aria-label={typingLabel}>
            <span className="bg-cream-100 text-charcoal-500 px-3 py-2 rounded-2xl rounded-bl-sm inline-flex items-center gap-1 motion-reduce:animate-none">
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
      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        placeholder={placeholderLabel}
        sendLabel={sendLabel}
      />
    </div>
  );
}

ConversationThreadRoot.displayName = 'ConversationThread';

// P14 fix: Object.assign exposes Bubble + Composer sub-components
export const ConversationThread = Object.assign(ConversationThreadRoot, {
  Bubble,
  Composer,
});
