import { useState } from 'react';
import { Mic, Send } from 'lucide-react';

function MessageComposer({ onSend }) {
  const [message, setMessage] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMic = () => {
    setIsMicActive(!isMicActive);
    // Simulate microphone activation
    if (isMicActive) {
      setIsMicActive(false);
    } else {
      setIsMicActive(true);
      setTimeout(() => setIsMicActive(false), 3000); // Auto-disable after 3 seconds
    }
  };

  return (
    <div className="flex items-center gap-3 px-6 py-4 border-t border-cyan-400/10 bg-[#040a14]/30">
      <button
        type="button"
        onClick={toggleMic}
        className="transition-colors"
        aria-label="Toggle voice input"
      >
        <Mic
          className={`h-5 w-5 transition-colors ${
            isMicActive ? 'text-cyan-400 animate-pulse' : 'text-cyan-400/50 hover:text-cyan-400'
          }`}
        />
      </button>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask VoxCode..."
        className="flex-1 min-h-[44px] resize-none bg-transparent border-none text-white text-sm placeholder-text-cyan-400/50 focus:outline-none focus:ring-0"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!message.trim()}
        className="transition-colors disabled:opacity-40"
        aria-label="Send message"
      >
        <Send className="h-5 w-5 text-cyan-300 hover:text-cyan-400" />
      </button>
    </div>
  );
}

export default MessageComposer;