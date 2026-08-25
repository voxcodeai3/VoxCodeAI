const STATUS_STYLES = {
  online: { label: 'ONLINE', color: 'text-emerald-300', dot: 'bg-emerald-400', anim: '' },
  listening: { label: 'LISTENING', color: 'text-cyan-300', dot: 'bg-cyan-400', anim: 'animate-pulse' },
  thinking: { label: 'THINKING', color: 'text-amber-300', dot: 'bg-amber-400', anim: 'animate-pulse' },
  speaking: { label: 'SPEAKING', color: 'text-sky-300', dot: 'bg-sky-400', anim: 'animate-pulse' },
  offline: { label: 'OFFLINE', color: 'text-rose-400', dot: 'bg-rose-500', anim: '' },
};

function AIStatus({ state = 'online', compact = false, className = '' }) {
  const s = STATUS_STYLES[state] || STATUS_STYLES.online;
  return (
    <div className={`flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${s.dot} ${s.anim} shadow-[0_0_8px_currentColor]`} />
      {!compact && <span className={`text-[11px] font-semibold tracking-[0.25em] uppercase ${s.color}`}>{s.label}</span>}
    </div>
  );
}

export default AIStatus;