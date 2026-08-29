import { useState, useRef, useEffect } from 'react';
import { Terminal, Copy, Check, ChevronDown, ChevronUp, ArrowDownToLine, Replace, Send, Microchip } from 'lucide-react';
import { useAI } from '../../context/AIContext';

export default function OutputPanel({ onInsertCode, onReplaceCode }) {
  const { messages, sendMessage, isThinking } = useAI();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text || isThinking) return;
    sendMessage(text, 'text');
    setChatInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  // Get the latest AI message with code.
  const lastAiMessage = [...messages].reverse().find((m) => m.type === 'ai');
  const hasCode = !!lastAiMessage?.code;
  const hasExplanation = !!lastAiMessage?.content;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-cyan-400/50" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            AI Output
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasCode && onReplaceCode && (
            <button
              type="button"
              onClick={() => onReplaceCode(lastAiMessage.code)}
              className="rounded p-1 text-violet-400/50 hover:text-violet-300 transition-colors"
              title="Replace file content"
            >
              <Replace className="h-3 w-3" />
            </button>
          )}
          {hasCode && onInsertCode && (
            <button
              type="button"
              onClick={() => onInsertCode(lastAiMessage.code)}
              className="rounded p-1 text-emerald-400/50 hover:text-emerald-300 transition-colors"
              title="Insert at cursor"
            >
              <ArrowDownToLine className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const text = lastAiMessage?.code || lastAiMessage?.content || '';
              handleCopy(text);
            }}
            className="rounded p-1 text-white/30 hover:text-white/60 transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Messages area */}
      {expanded && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-[10px] text-white/15">
              Ask VoxCode anything about your code
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'ai' && (
                <div className="h-5 w-5 rounded-full border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Microchip className="h-2.5 w-2.5 text-cyan-300" />
                </div>
              )}
              <div className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                msg.type === 'user'
                  ? 'bg-cyan-400/10 text-white/70'
                  : 'bg-white/[0.03] text-white/60'
              }`}>
                {msg.content && (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.code && (
                  <pre className="mt-1.5 rounded bg-black/30 p-2 overflow-x-auto">
                    <code className="text-[10px] font-mono text-emerald-300/70 whitespace-pre">{msg.code}</code>
                  </pre>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-2 justify-start">
              <div className="h-5 w-5 rounded-full border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center shrink-0 mt-0.5">
                <Microchip className="h-2.5 w-2.5 text-cyan-300" />
              </div>
              <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/30">
                Thinking...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat input */}
      <div className="border-t border-white/[0.04] p-2 shrink-0">
        <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg border border-white/[0.06] px-2.5 py-1.5">
          <input
            ref={inputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask VoxCode..."
            className="flex-1 bg-transparent text-[11px] text-white/60 placeholder-white/20 outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!chatInput.trim() || isThinking}
            className="rounded-md p-1 text-cyan-400/40 hover:text-cyan-300 transition-colors disabled:opacity-30"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
