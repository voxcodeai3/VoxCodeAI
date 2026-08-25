function VoxLogo({ compact = false }) {
  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center">
          <svg
            viewBox="0 0 40 40"
            className="h-11 w-11 animate-glow-pulse"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="vox-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <path
              d="M20 6 L30 34 H25 L20 20 L15 34 H10 Z"
              stroke="url(#vox-g)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M4 20 H11 M29 20 H36"
              stroke="url(#vox-g)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.8"
            />
            <circle cx="20" cy="20" r="3" fill="#67e8f9" />
          </svg>
        </div>

        <div className="flex flex-col leading-none">
          <span
            className={`vox-text-glow font-bold tracking-[0.35em] text-transparent bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text ${
              compact ? "text-2xl" : "text-3xl"
            }`}
          >
            VOXCODE
          </span>
        </div>
      </div>

      {!compact && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.55em] text-cyan-200/80">
          Speak. Code. Learn.
        </p>
      )}
    </div>
  )
}

export default VoxLogo