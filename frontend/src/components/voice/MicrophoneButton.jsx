import { Mic } from 'lucide-react';

function MicrophoneButton({ state = 'idle', onToggle, className = '' }) {
  const listening = state === 'listening';
  const disabled = state === 'disabled';

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={listening ? 'Stop listening' : 'Tap to speak'}
        aria-pressed={listening}
        className="group relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {/* animated rings */}
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full border border-cyan-400/50 animate-ping" />
            <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-pulse" />
          </>
        )}
        <span
          className={`absolute inset-0 rounded-full border transition-all duration-300 ${
            listening
              ? 'border-cyan-300 bg-cyan-400/15 shadow-[0_0_40px_-6px_rgba(34,211,238,0.8)]'
              : 'border-cyan-400/30 bg-[#040a14]/40 group-hover:border-cyan-300/60 group-hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.6)]'
          }`}
        />
        {listening ? (
          <Mic className="relative z-10 h-8 w-8 text-cyan-200 animate-pulse" />
        ) : (
          <Mic className="relative z-10 h-8 w-8 text-cyan-300 group-hover:scale-110 transition-transform" />
        )}
      </button>

      <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-cyan-300/80">
        {listening ? '● Listening' : 'Tap to Speak'}
      </span>
    </div>
  );
}

export default MicrophoneButton;
