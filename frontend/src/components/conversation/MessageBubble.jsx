import { Copy, Volume2 } from 'lucide-react';

function MessageBubble({ message }) {
  const isUser = message.type === 'user';
  const isAi = message.type === 'ai';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} max-w-[80%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
      <div className={`${isUser ? 'bg-cyan-400/20' : 'bg-white/[0.04]'} rounded-2xl border border-cyan-400/10 px-4 py-3 max-w-[70%] ${isUser ? 'ml-4' : 'mr-4'}`}>
        <div className="flex items-center gap-2 mb-2">
          {isAi && (
            <>
              <div className="h-3 w-3 rounded-full bg-cyan-400" />
              <span className="text-xs text-cyan-300">VOXCODE AI</span>
            </>
          )}
          {isUser && (
            <>
              <div className="h-3 w-3 rounded-full bg-white/[0.04]" />
              <span className="text-xs text-white">YOU</span>
              {message.source === 'voice' && (
                <span className="ml-1 text-xs text-cyan-300">🎙</span>
              )}
              {message.source === 'text' && (
                <span className="ml-1 text-xs text-cyan-300">⌨</span>
              )}
            </>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-white leading-relaxed">{message.content}</p>
          {message.code && (
            <div className="mt-2">
              <div className="bg-[#040a14]/50 rounded-xl border border-cyan-400/10 p-3 overflow-x-auto">
                <pre className="text-xs text-cyan-200">{message.code}</pre>
              </div>
              <button className="mt-2 w-full text-left text-xs text-cyan-300 hover:text-cyan-200/80">
                Copy code
              </button>
            </div>
          )}
          {isAi && (
            <div className="flex items-center gap-3 mt-2">
              <button className="text-xs text-cyan-300 hover:text-cyan-200/80">
                <Volume2 className="h-3 w-3" /> Read aloud
              </button>
              <button className="text-xs text-cyan-300 hover:text-cyan-200/80">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          )}
        </div>
        <div className="text-xs text-cyan-400/50">{message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    </div>
  );
}

export default MessageBubble;