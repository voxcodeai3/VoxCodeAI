import { useState } from 'react'

function Particles({ count }) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 9 + Math.random() * 12,
      delay: Math.random() * 10,
      opacity: 0.25 + Math.random() * 0.45,
    })),
  )

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full bg-cyan-300 animate-float"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            boxShadow: '0 0 6px 1px rgba(34,211,238,0.7)',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function FuturisticBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#020409]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,25,45,0.9),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(23,37,84,0.55),transparent_55%)]" />

      <div className="vox-grid absolute inset-0 animate-grid" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[120vh] w-[120vh] rounded-full bg-cyan-500/6 blur-[140px] animate-drift" />
      <div className="absolute left-[8%] top-[20%] h-[40vh] w-[40vh] rounded-full bg-blue-600/10 blur-[120px] animate-drift-alt" />
      <div className="absolute right-[6%] bottom-[12%] h-[38vh] w-[38vh] rounded-full bg-cyan-400/8 blur-[130px] animate-drift" />

      <div className="absolute inset-y-0 left-6 hidden w-px md:block bg-gradient-to-b from-transparent via-cyan-400/25 to-transparent" />
      <div className="absolute inset-y-0 right-6 hidden w-px md:block bg-gradient-to-b from-transparent via-cyan-400/25 to-transparent" />
      <div className="vox-scanline absolute inset-x-0 top-[18%] h-40 animate-grid" />

      <Particles count={42} />

      <div className="vox-line absolute left-0 top-0 h-px w-1/4" />
      <div className="vox-line absolute right-0 top-0 h-px w-1/4" />
      <div className="vox-line absolute bottom-0 left-0 h-px w-1/4" />
      <div className="vox-line absolute bottom-0 right-0 h-px w-1/4" />

      <div className="absolute left-0 top-0 h-24 w-24 opacity-60 [background:linear-gradient(135deg,rgba(34,211,238,0.5)_2px,transparent_2px,transparent_calc(100%-2px),rgba(34,211,238,0.5)_calc(100%-2px))]" />
      <div className="absolute right-0 bottom-0 h-24 w-24 rotate-180 opacity-60 [background:linear-gradient(135deg,rgba(34,211,238,0.5)_2px,transparent_2px,transparent_calc(100%-2px),rgba(34,211,238,0.5)_calc(100%-2px))]" />
    </div>
  )
}

export default FuturisticBackground