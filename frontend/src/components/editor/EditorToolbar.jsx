import { Code, Bug, Lightbulb, Wand2, RefreshCw, FileText, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const ACTIONS = [
  { id: 'generate', label: 'Generate', icon: Wand2, color: 'text-violet-300' },
  { id: 'explain', label: 'Explain', icon: Lightbulb, color: 'text-amber-300' },
  { id: 'debug', label: 'Debug', icon: Bug, color: 'text-red-300' },
  { id: 'refactor', label: 'Refactor', icon: RefreshCw, color: 'text-emerald-300' },
  { id: 'document', label: 'Document', icon: FileText, color: 'text-sky-300' },
];

export default function EditorToolbar({ onAction, isThinking, selectedCode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!selectedCode) return;
    try {
      await navigator.clipboard.writeText(selectedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="flex items-center gap-1 border-b border-white/[0.04] bg-[#080d1a] px-2 py-1.5">
      {ACTIONS.map(({ id, label, icon: Icon, color }) => (
        <button
          key={id}
          type="button"
          onClick={() => onAction(id)}
          disabled={isThinking}
          className={`flex items-center gap-1.5 rounded-lg border border-white/[0.04] px-2.5 py-1.5 text-[10px] transition-all hover:border-white/[0.08] hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-not-allowed ${color}`}
          title={label}
        >
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}

      <div className="flex-1" />

      {selectedCode && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg border border-white/[0.04] px-2 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
          title="Copy selected code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
