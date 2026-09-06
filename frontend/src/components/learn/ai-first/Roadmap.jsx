import { ChevronRight, CheckCircle2, Circle, RotateCcw, ArrowRight } from 'lucide-react';

const STATUS_ICON = {
  completed: CheckCircle2,
  current: ArrowRight,
  upcoming: Circle,
  review: RotateCcw,
};

const STATUS_STYLE = {
  completed: 'text-emerald-400',
  current: 'text-cyan-400',
  upcoming: 'text-white/25',
  review: 'text-amber-400',
};

const STATUS_LABEL = {
  completed: 'Completed',
  current: 'Current',
  upcoming: 'Upcoming',
  review: 'Needs Review',
};

export default function Roadmap({ roadmap, summary, currentTopicId, completedTopicIds, reviewTopicIds, onTopicClick }) {
  if (!roadmap?.stages?.length) {
    return (
      <div className="text-xs text-white/40 p-4">No roadmap data available.</div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {roadmap.stages.map((stage, si) => (
        <div key={stage.id || si}>
          <div className="text-[11px] font-semibold tracking-widest text-white/40 uppercase mb-2 px-1">
            {stage.title}
          </div>
          <div className="space-y-0.5">
            {(stage.topics || []).map((topic, ti) => {
              const tid = topic.id || topic._id;
              const isCompleted = completedTopicIds.has(tid);
              const isCurrent = tid === currentTopicId;
              const isReview = reviewTopicIds.has(tid);
              const status = isCompleted ? 'completed' : isCurrent ? 'current' : isReview ? 'review' : 'upcoming';
              const Icon = STATUS_ICON[status];

              return (
                <button
                  key={tid || ti}
                  onClick={() => onTopicClick?.(topic, stage)}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded text-left text-xs transition-colors min-h-[36px] ${
                    isCurrent
                      ? 'bg-cyan-400/10 text-cyan-300'
                      : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${STATUS_STYLE[status]}`} />
                  <span className="flex-1 truncate">{topic.title}</span>
                  {isCurrent && (
                    <span className="text-[9px] tracking-wider text-cyan-400/60 uppercase shrink-0">now</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {summary && (
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between text-[11px] text-white/40 mb-1">
            <span>Progress</span>
            <span>{summary.completed}/{summary.total} topics</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400/60 transition-all duration-500"
              style={{ width: `${summary.percent || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
