export interface ConversationMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date | string;
  senderName?: string;
  senderAvatar?: string;
}

export interface ConversationThreadProps {
  messages: ConversationMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  isOtherTyping?: boolean;
  formatRelativeTime?: (date: Date | string) => string;
  typingLabel?: string;
  sendLabel?: string;
  placeholderLabel?: string;
  className?: string;
}
