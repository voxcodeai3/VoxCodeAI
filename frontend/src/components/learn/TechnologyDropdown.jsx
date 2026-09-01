import { useState } from 'react';
import { ChevronDown, Play, Check } from 'lucide-react';
import { TECHNOLOGIES } from '../../data/learnCatalog';

export default function TechnologyDropdown({ item, progress, onContinue }) {
  const [open, setOpen] = useState(false);
  const tech = TECHNOLOGIES[item.techId];
  const pct = progress ?? 0;
  const hasProgress = pct > 0;
  const isCompleted = pct >= 100;
  const needsPrereq = item.techId === 'typescript' || item.prerequisite;

  return (
    <div className="border border-white/[0.06] rounded-lg bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40"
      >
        <span className="text-sm font-medium text-white/80">{tech?.name || item.id}</span>
        <span className="flex items-center gap-3">
          {isCompleted ? <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Completed</span>
            : hasProgress ? <span className="text-[11px] text-white/40">{pct}%</span> : null}
          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
          <div className="text-xs text-white/40 mb-2">{item.level} · {item.stages} stages · ~{item.minutes}m</div>
          {needsPrereq && !hasProgress && (
            <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="text-[11px] text-amber-300">Recommended prerequisite: JavaScript Fundamentals</div>
              <div className="text-[11px] text-white/30">You can start TypeScript directly, but JS fundamentals help.</div>
            </div>
          )}
          {hasProgress && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-white/40 mb-1">
                <span>Progress</span><span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {hasProgress && !isCompleted && <div className="text-[11px] text-white/30 mt-1">Current · Functions — keep going</div>}
            </div>
          )}
          <button
            onClick={onContinue}
            className="px-4 py-2 bg-white text-black rounded-lg text-xs font-medium hover:bg-white/90 transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3 h-3" /> {hasProgress ? 'Continue Learning' : 'Start Learning'}
          </button>
        </div>
      )}
    </div>
  );
}
