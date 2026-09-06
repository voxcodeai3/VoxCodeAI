const STEPS = [
  { key: 'teaching', label: 'Teaching' },
  { key: 'checking_understanding', label: 'Understanding' },
  { key: 'mini_quiz', label: 'Quiz' },
  { key: 'ready_for_practice', label: 'Practice' },
  { key: 'completed', label: 'Done' },
];

const STATE_TO_STEP = {
  teaching: 0,
  checking_understanding: 1,
  awaiting_answer: 1,
  reviewing: 1,
  mini_quiz: 2,
  quiz_review: 2,
  ready_for_practice: 3,
  completed: 4,
};

export default function TeachingProgress({ teachingState }) {
  const currentIdx = STATE_TO_STEP[teachingState] ?? 0;

  return (
    <div className="flex items-center gap-1 px-2">
      {STEPS.map((step, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
                isDone ? 'bg-emerald-400' : isActive ? 'bg-cyan-400' : 'bg-white/15'
              }`} />
              <span className={`text-[10px] tracking-wide transition-colors ${
                isActive ? 'text-cyan-300 font-medium' : isDone ? 'text-white/40' : 'text-white/20'
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-3 h-px mx-0.5 ${isDone ? 'bg-emerald-400/40' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
