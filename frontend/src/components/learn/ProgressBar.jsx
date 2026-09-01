export default function ProgressBar({ value, className='' }) {
  return (
    <div className={`h-2 bg-white/5 rounded-full overflow-hidden ${className}`}>
      <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
