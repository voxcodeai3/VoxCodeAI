import { useState } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useAI } from '../../context/AIContext';

function MessageComposer({ onSend }) {
  const [message, setMessage] = useState('');
  const {
    isListening,
    isThinking,
    startListening,
    stopListening,
    support,
  } = useVoice();
  const { sendMessage } = useAI();

  const handleSend = () => {
    const text = message.trim();
    if (!text || isThinking) return;
    if (onSend) {
      onSend(text);
    } else {
      sendMessage(text, 'text');
    }
    setMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMic = () => {
    if (isThinking) return;
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <div className="flex items-center gap-3 px-6 py-4 border-t border-cyan-400/10 bg-[#040a14]/30">
      {support.speech ? (
        <button
          type="button"
          onClick={toggleMic}
          disabled={isThinking}
          className="transition-colors disabled:opacity-40"
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        >
          <Mic
            className={`h-5 w-5 transition-colors ${
              isListening
                ? 'text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                : 'text-cyan-400/50 hover:text-cyan-400'
            }`}
          />
        </button>
      ) : (
        <MicOff className="h-5 w-5 text-cyan-400/30" aria-label="Voice input unavailable" />
      )}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask VoxCode..."
        rows={1}
        className="flex-1 min-h-[44px] resize-none bg-transparent border-none text-white text-sm placeholder-text-cyan-400/50 focus:outline-none focus:ring-0"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!message.trim() || isThinking}
        className="transition-colors disabled:opacity-40"
        aria-label="Send message"
      >
        <Send className="h-5 w-5 text-cyan-300 hover:text-cyan-400" />
      </button>
    </div>
  );
}

export default MessageComposer;
