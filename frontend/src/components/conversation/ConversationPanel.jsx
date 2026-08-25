import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

function ConversationPanel({ className = '', messages = [], isTyping = false }) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isTyping && <TypingIndicator />}
    </div>
  );
}

export default ConversationPanel;
