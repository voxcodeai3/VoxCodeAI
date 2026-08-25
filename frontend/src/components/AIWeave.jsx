const RING_NODES = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
]

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function AIWeave({ active = false }) {
  const C = 200

  return (
    <div className={`relative mx-auto aspect-square w-full max-w-[280px] sm:max-w-[340px] md:max-w-[400px] lg:max-w-[460px] xl:max-w-[520px] transition-all duration-700 ${active ? 'scale-[1.04]' : ''}`}>
      <svg
        viewBox="0 0 400 400"
        className={`h-full w-full transition-all duration-700 ${active ? 'drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]' : 'drop-shadow-[0_0_8px_rgba(34,211,238,0.15)]'}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="weave-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id="weave-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="45%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0e7490" stopOpacity="0" />
          </radialGradient>
          <filter id="weave-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* faint static hairlines from core outward */}
        {RING_NODES.map((a) => {
          const p = polar(C, C, 172, a)
          return (
            <line
              key={`line-${a}`}
              x1={C}
              y1={C}
              x2={p.x}
              y2={p.y}
              stroke="url(#weave-g)"
              strokeWidth="0.6"
              opacity="0.18"
            />
          )
        })}

        {/* pulsing wave rings */}
        <g
          style={{ transformOrigin: `${C}px ${C}px` }}
          className="animate-wave"
        >
          <circle cx={C} cy={C} r={112} fill="none" stroke="#22d3ee" strokeWidth="1" opacity={active ? 0.55 : 0.3} className="transition-opacity duration-700" />
        </g>
        <g
          style={{ transformOrigin: `${C}px ${C}px` }}
          className="animate-wave"
        >
          <circle cx={C} cy={C} r={150} fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.2" />
        </g>

        {/* rotating dashed ring */}
        <g
          style={{ transformOrigin: `${C}px ${C}px` }}
          className="animate-spin-slow"
        >
          <circle
            cx={C}
            cy={C}
            r={168}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1"
            strokeDasharray="4 10"
            opacity={active ? 0.7 : 0.4}
            className="transition-opacity duration-700"
          />
          {RING_NODES.map((a) => {
            const p = polar(C, C, 168, a)
            return (
              <circle key={`n1-${a}`} cx={p.x} cy={p.y} r="2.6" fill="#67e8f9" filter="url(#weave-blur)" />
            )
          })}
        </g>

        {/* counter-rotating dashed ring */}
        <g
          style={{ transformOrigin: `${C}px ${C}px` }}
          className="animate-spin-rev"
        >
          <circle
            cx={C}
            cy={C}
            r={130}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.8"
            strokeDasharray="2 14"
            opacity="0.5"
          />
          {RING_NODES.filter((_, i) => i % 2 === 0).map((a) => {
            const p = polar(C, C, 130, a)
            return (
              <circle key={`n2-${a}`} cx={p.x} cy={p.y} r="2" fill="#a5f3fc" opacity="0.8" />
            )
          })}
        </g>

        {/* inner static ring */}
        <circle
          cx={C}
          cy={C}
          r={84}
          fill="none"
          stroke="url(#weave-g)"
          strokeWidth="0.8"
          opacity="0.55"
        />
        {RING_NODES.filter((_, i) => i % 3 === 0).map((a) => {
          const p = polar(C, C, 84, a)
          return <circle key={`n3-${a}`} cx={p.x} cy={p.y} r="1.8" fill="#22d3ee" opacity="0.7" />
        })}

        {/* orbiting bright particles */}
        <g
          style={{ transformOrigin: `${C}px ${C}px` }}
          className="animate-spin-slow"
        >
          <circle cx={C} cy={C - 168} r="3" fill="#67e8f9" filter="url(#weave-blur)" />
        </g>
        <g
          style={{ transformOrigin: `${C}px ${C}px` }}
          className="animate-spin-rev"
        >
          <circle cx={C + 130} cy={C} r="2.4" fill="#a5f3fc" filter="url(#weave-blur)" />
        </g>

        {/* soft wave arcs near core */}
        <path
          d="M160 188 q10 -14 20 0 q10 14 20 0"
          stroke="#22d3ee"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
          className="animate-glow-pulse"
        />
        <path
          d="M200 216 q10 -14 20 0 q10 14 20 0"
          stroke="#38bdf8"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
          className="animate-glow-pulse"
        />

        {/* core glow */}
        <circle cx={C} cy={C} r="30" fill="url(#weave-core)" className={`animate-heartbeat transition-opacity duration-700 ${active ? 'opacity-100' : 'opacity-70'}`} style={{ transformOrigin: `${C}px ${C}px` }} />
        <circle cx={C} cy={C} r="8" fill="#d9faff" className="animate-glow-pulse" />
      </svg>
    </div>
  )
}

export default AIWeave