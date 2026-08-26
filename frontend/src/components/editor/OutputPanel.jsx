import { useState } from 'react';
import { Terminal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useAI } from '../../context/AIContext';

export default function OutputPanel() {
  const { messages } = useAI();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Get the latest AI message that has code or explanation.
  const lastAiMessage = [...messages].reverse().find((m) => m.type === 'ai');

  if (!lastAiMessage) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-white/15">
        AI output will appear here
      </div>
    );
  }

  const hasCode = !!lastAiMessage.code;
  const hasExplanation = !!lastAiMessage.content;

  const handleCopy = async () => {
    const text = lastAiMessage.code || lastAiMessage.content || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-cyan-400/50" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            AI Output
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
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

      {expanded && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Explanation */}
          {hasExplanation && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Explanation</p>
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                {lastAiMessage.content}
              </p>
            </div>
          )}

          {/* Code block */}
          {hasCode && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Generated Code</p>
              <pre className="rounded-lg bg-black/30 border border-white/[0.04] p-3 overflow-x-auto">
                <code className="text-[11px] font-mono text-emerald-300/70 whitespace-pre">
                  {lastAiMessage.code}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
