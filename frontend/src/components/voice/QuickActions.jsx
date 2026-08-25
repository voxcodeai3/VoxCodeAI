import { BookOpen, Code2, Bug, ListChecks, UserRoundSearch } from 'lucide-react';

const ACTIONS = [
  { id: 'learn', label: 'Learn Concept', icon: BookOpen },
  { id: 'practice', label: 'Practice Coding', icon: Code2 },
  { id: 'debug', label: 'Debug Code', icon: Bug },
  { id: 'quiz', label: 'Quiz Me', icon: ListChecks },
  { id: 'interview', label: 'Mock Interview', icon: UserRoundSearch },
];

function QuickActions({ selected = null, onSelect, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {ACTIONS.map(({ id, label, icon: Icon }) => {
        const active = selected === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect?.(id)}
            aria-pressed={active}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium tracking-wide transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] ${
              active
                ? 'border-cyan-300/70 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_-4px_rgba(34,211,238,0.7)]'
                : 'border-cyan-400/20 bg-white/[0.03] text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default QuickActions;