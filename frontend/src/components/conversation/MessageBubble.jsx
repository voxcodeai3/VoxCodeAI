import { useState } from 'react';
import { Copy, Volume2, Square, RotateCcw } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { useAI } from '../../context/AIContext';

function MessageBubble({ message }) {
  const isUser = message.type === 'user';
  const isAi = message.type === 'ai';
  const { spokenMessageId, speakResponse, stopSpeaking, support, isSpeaking } = useVoice();
  const { retryLast } = useAI();

  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isThisSpeaking = spokenMessageId === message.id && isSpeaking;
  const canSpeak = isAi && support.tts && !isUser;

  const handleSpeak = () => {
    if (isThisSpeaking) {
      stopSpeaking();
      return;
    }
    const spokenText = message.code ? `${message.content} Here is the code.` : message.content;
    speakResponse(spokenText, message.id);
  };

  const copyText = async (text, setFlag) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setFlag(true);
    setTimeout(() => setFlag(false), 1500);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} max-w-[80%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
      <div className={`${isUser ? 'bg-cyan-400/20' : 'bg-white/[0.04]'} rounded-2xl border ${message.failed ? 'border-red-400/30' : 'border-cyan-400/10'} px-4 py-3 max-w-[70%] ${isUser ? 'ml-4' : 'mr-4'}`}>
        <div className="flex items-center gap-2 mb-2">
          {isAi && (
            <>
              <div className={`h-3 w-3 rounded-full ${message.failed ? 'bg-red-400' : 'bg-cyan-400'}`} />
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
          <p className="whitespace-pre-wrap text-sm text-white leading-relaxed">{message.content}</p>
          {message.code && (
            <div className="mt-2">
              <div className="bg-[#040a14]/50 rounded-xl border border-cyan-400/10 p-3 overflow-x-auto">
                <pre className="text-xs text-cyan-200">{message.code}</pre>
              </div>
              <button
                type="button"
                onClick={() => copyText(message.code, setCopiedCode)}
                className="mt-2 w-full text-left text-xs text-cyan-300 hover:text-cyan-200/80"
              >
                {copiedCode ? 'Copied!' : 'Copy code'}
              </button>
            </div>
          )}
          {isAi && !message.failed && (
            <div className="flex items-center gap-3 mt-2">
              {canSpeak && (
                <button
                  type="button"
                  onClick={handleSpeak}
                  className="text-xs text-cyan-300 hover:text-cyan-200/80 flex items-center gap-1"
                >
                  {isThisSpeaking ? (
                    <>
                      <Square className="h-3 w-3" /> Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3" /> Read aloud
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => copyText(message.content + (message.code ? `\n\n${message.code}` : ''), setCopied)}
                className="text-xs text-cyan-300 hover:text-cyan-200/80 flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
          {message.failed && (
            <button
              type="button"
              onClick={retryLast}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-400/20"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
        <div className="text-xs text-cyan-400/50 mt-1">{message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    </div>
  );
}

export default MessageBubble;
