import { X, FilePlus, Replace, ArrowDownToLine } from 'lucide-react';

export default function InsertOptionsDialog({ isOpen, onClose, onInsert, onReplace, onCreateNew, language }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[90vw] max-w-[340px] rounded-2xl border border-cyan-400/15 bg-[#0a1020]/95 backdrop-blur-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white/80">Insert Code</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[10px] text-white/30">
          How would you like to add this code?
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { onInsert(); onClose(); }}
            className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-cyan-400/20 hover:bg-cyan-400/[0.04] transition-all"
          >
            <ArrowDownToLine className="h-4 w-4 text-cyan-300/60 shrink-0" />
            <div>
              <p className="text-xs text-white/70">Insert at cursor</p>
              <p className="text-[10px] text-white/25">Add code where your cursor is</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => { onReplace(); onClose(); }}
            className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-amber-400/20 hover:bg-amber-400/[0.04] transition-all"
          >
            <Replace className="h-4 w-4 text-amber-300/60 shrink-0" />
            <div>
              <p className="text-xs text-white/70">Replace entire file</p>
              <p className="text-[10px] text-white/25">Overwrite the current file content</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => { onCreateNew(); onClose(); }}
            className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-emerald-400/20 hover:bg-emerald-400/[0.04] transition-all"
          >
            <FilePlus className="h-4 w-4 text-emerald-300/60 shrink-0" />
            <div>
              <p className="text-xs text-white/70">Create new file</p>
              <p className="text-[10px] text-white/25">Save as a separate file</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
