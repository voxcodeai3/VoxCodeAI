import { useCallback, useState } from 'react';
import { Maximize, Minus, X, MessageCircle, Microchip } from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import MessageComposer from './MessageComposer';

const INITIAL_MESSAGES = [
  {
    id: 1,
    type: 'ai',
    content:
      "Hello! I'm VoxCode, your AI coding teacher. How can I help you today?",
    timestamp: new Date(Date.now() - 2000),
    avatar: null,
  },
];

function TextConsole({ expanded = false }) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = useCallback((text) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), type: 'user', content: text, timestamp: new Date(), avatar: null },
    ]);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'ai',
          content:
            'Great question! I can help you with coding concepts, debugging, code reviews, and more. Try asking me about JavaScript, Python, React, or any programming topic!',
          timestamp: new Date(),
          avatar: null,
        },
      ]);
    }, 1500);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-[280px] rounded-2xl border border-cyan-400/20 bg-[#040a14]/80 backdrop-blur-2xl flex flex-col items-center justify-center p-4 text-sm text-cyan-300 transition-all duration-500 hover:scale-[1.02] hover:border-cyan-300/50 hover:bg-white/[0.06] cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="h-4 w-4 text-cyan-300" />
            <span>Ask VoxCode...</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-70">⌨</span>
            <Maximize className="h-4 w-4 text-cyan-300 transition-transform duration-300 group-hover:rotate-90" />
          </div>
        </button>
      )}
      {isExpanded && (
        <div className="w-[70vw] h-[80vh] max-w-[900px] max-h-[700px] rounded-3xl border border-cyan-400/20 bg-[#040a14]/85 backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-500">
          <div className="flex items-center justify-between border-b border-cyan-400/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center">
                <Microchip className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">VOXCODE CONSOLE</p>
                <p className="flex items-center gap-2 text-xs text-cyan-300">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>ONLINE</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Minimize console"
              >
                <Minus className="h-4 w-4 text-cyan-400/60 hover:text-cyan-400 transition-colors" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Close console"
              >
                <X className="h-4 w-4 text-cyan-400/60 hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
          <ConversationPanel
            className="flex-1 overflow-y-auto p-6"
            messages={messages}
            isTyping={isTyping}
          />
          <MessageComposer onSend={handleSend} />
        </div>
      )}
    </div>
  );
}

export default TextConsole;
