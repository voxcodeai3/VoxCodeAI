import { TECHNOLOGIES } from '../../data/learnCatalog';

function TechPill({ id }) {
  const t = TECHNOLOGIES[id];
  return <span className="text-[11px] px-2 py-1 rounded-full bg-white/[0.06] border border-white/[0.06] text-white/60">{t?.name || id}</span>;
}

export default function LearningStackCard({ stack, progress, onContinue, onView }) {
  const pct = progress ?? 0;
  const hasStarted = pct > 0;
  return (
    <div className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.02] flex flex-col gap-3 hover:bg-white/[0.03] transition-colors">
      <div>
        <div className="text-sm font-medium text-white mb-2">{stack.title}</div>
        <div className="flex flex-wrap gap-1.5">
          {stack.techs.map(t => <TechPill key={t} id={t} />)}
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-white/40">
        <span className="capitalize">{stack.difficulty}</span>
        <span>·</span>
        <span>{stack.stages} stages</span>
        <span>·</span>
        <span>{stack.duration}</span>
      </div>
      {hasStarted && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-white/40 mb-1"><span>Progress</span><span>{pct}%</span></div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      <div className="flex gap-2 mt-1">
        <button onClick={onContinue} className="px-4 py-2 bg-white text-black rounded-lg text-xs font-medium hover:bg-white/90 transition-colors">
          {hasStarted ? 'Continue' : 'Start Learning'}
        </button>
        <button onClick={onView} className="px-4 py-2 bg-white/[0.06] text-white/70 rounded-lg text-xs hover:bg-white/10 transition-colors">
          View Path
        </button>
      </div>
    </div>
  );
}
