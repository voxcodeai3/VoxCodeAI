import { MessageSquare, Trash2 } from 'lucide-react';

function ConversationItem({ conversation, isActive, onSelect, onDelete }) {
  const date = new Date(conversation.updatedAt);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeLabel = isToday
    ? 'Today'
    : isYesterday
      ? 'Yesterday'
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(conversation.id);
        }
      }}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-cyan-400/10 border border-cyan-400/20'
          : 'border border-transparent hover:bg-white/[0.03] hover:border-cyan-400/10'
      }`}
    >
      <MessageSquare className="h-4 w-4 shrink-0 text-cyan-400/30" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isActive ? 'text-cyan-300' : 'text-white/80'}`}>
          {conversation.title || 'Untitled'}
        </p>
        <p className="text-[10px] text-cyan-400/30 mt-0.5">
          {timeLabel}
          {conversation.messageCount > 0 && (
            <span className="ml-1.5">{conversation.messageCount} msg{conversation.messageCount !== 1 ? 's' : ''}</span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(conversation.id, conversation.title);
        }}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg text-cyan-400/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
        aria-label={`Delete ${conversation.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default ConversationItem;
