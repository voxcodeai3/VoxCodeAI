import { useEffect, useRef } from 'react';
import { speechEnvelope } from './audioSim';

const NB = 520;

const PARAMS = {
  idle:        { speed: 0.45, glow: 0.7,  reach: 0.8,   particles: 0.5 },
  listening:   { speed: 0.95, glow: 1.15, reach: 1.15,  particles: 1.0 },
  transcribing:{ speed: 1.0,  glow: 1.1,  reach: 1.08,  particles: 1.05 },
  thinking:    { speed: 1.6,  glow: 0.9,  reach: 0.9,   particles: 1.3 },
  speaking:    { speed: 1.08, glow: 1.2,  reach: 1.25,  particles: 1.15 },
  error:       { speed: 0.55, glow: 0.65, reach: 0.75,  particles: 0.45 },
};

const CYAN    = [64, 226, 255];
const BLUE    = [70, 120, 255];
const VIOLET  = [158, 84, 255];
const MAGENTA = [255, 64, 192];
const STOPS   = [CYAN, BLUE, VIOLET, MAGENTA, CYAN];

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(a, b, t, alpha) {
  return `rgba(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))},${alpha})`;
}
function pal(u, alpha) {
  const x = (((u % 1) + 1) % 1) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  return mix(STOPS[i], STOPS[i + 1], x - i, alpha);
}

function h1(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function h2(i) {
  const x = Math.sin(i * 269.5 + 183.3) * 28001.8384;
  return x - Math.floor(x);
}

export default function VoiceWeave({
  state = 'idle',
  frequencyData = null,
  className = '',
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const live = useRef({ state, frequencyData });

  useEffect(() => {
    live.current.state = state;
    live.current.frequencyData = frequencyData;
  }, [state, frequencyData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = reduceMotion ? 0.18 : 1;

    const cur = { ...(PARAMS[live.current.state] || PARAMS.idle) };
    let t = Math.random() * 100;
    let ts = Math.random() * 60;
    let last = performance.now();
    let lvl = 0.16;

    const smooth = new Float32Array(NB);
    const hashes1 = Array.from({ length: NB }, (_, i) => h1(i));
    const hashes2 = Array.from({ length: NB }, (_, i) => h2(i));

    const motes = Array.from({ length: 64 }, () => ({
      th: Math.random() * Math.PI * 2,
      rr: 0.56 + Math.random() * 0.16,
      spd: (0.06 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1),
      sz: Math.random() * 1.4 + 0.3,
      ph: Math.random() * Math.PI * 2,
      ws: 0.6 + Math.random() * 1.4,
      hue: 0.5 + Math.random() * 0.5,
    }));

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const st = live.current.state;
      const tgt = PARAMS[st] || PARAMS.idle;
      for (const k in tgt) cur[k] += (tgt[k] - cur[k]) * Math.min(1, dt * 3);

      const spd = cur.speed * motion;
      t += dt * spd;
      ts += dt * 1.15 * motion;

      const fd = live.current.frequencyData;
      const fdLen = fd ? fd.length : 0;

      let targetLvl;
      if (st === 'listening' && fdLen) {
        let sum = 0;
        for (let i = 2; i < Math.min(fdLen, 110); i++) sum += fd[i];
        const avg = sum / Math.max(1, Math.min(fdLen, 110) - 2);
        targetLvl = Math.min(1, Math.pow(avg / 255, 0.7) * 2.8);
        targetLvl = Math.max(targetLvl, 0.12 + 0.06 * Math.sin(t * 1.4));
      } else if (st === 'speaking') {
        targetLvl = 0.3 + 0.7 * speechEnvelope(ts);
      } else if (st === 'thinking') {
        targetLvl = 0.22 + 0.18 * Math.sin(t * 1.8) + 0.08 * Math.sin(t * 2.9);
      } else {
        targetLvl = 0.14 + 0.08 * Math.sin(t * 1.1) + 0.05 * Math.sin(t * 1.9 + 2);
      }
      lvl += (targetLvl - lvl) * Math.min(1, dt * (st === 'listening' ? 12 : 6));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const S = Math.min(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const dyn = motion < 0.5 ? 0.3 : 1;

      /* base ring radius — the centerline the waveform oscillates around */
      const R = S * 0.27;
      /* max extent inward and outward from the ring */
      const innerMax = R * 0.80;
      const outerMax = R * 0.85;
      const envG = st === 'speaking' ? speechEnvelope(ts) : 0;
      const rot = t * 0.025;
      const mw = Math.max(0.85, S * 0.002);

      /* ambient glow — fades to transparent before canvas edge */
      const glow = ctx.createRadialGradient(cx, cy, S * 0.04, cx, cy, S * 0.46);
      glow.addColorStop(0, `rgba(80,40,180,${(0.35 + 0.40 * lvl) * cur.glow})`);
      glow.addColorStop(0.5, `rgba(45,20,120,${(0.24 + 0.26 * lvl) * cur.glow})`);
      glow.addColorStop(1, 'rgba(4,6,20,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.46, 0, Math.PI * 2);
      ctx.fill();

      /* dark occluder — blocks horizontal signal from crossing the title */
      const occ = ctx.createRadialGradient(cx, cy, S * 0.03, cx, cy, R * 0.65);
      occ.addColorStop(0, 'rgba(4,7,20,0.97)');
      occ.addColorStop(0.6, 'rgba(6,10,28,0.92)');
      occ.addColorStop(1, 'rgba(6,10,28,0)');
      ctx.fillStyle = occ;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.65, 0, Math.PI * 2);
      ctx.fill();

      /* ══════ BIDIRECTIONAL RADIAL SPIKES ══════ */
      const innerR = new Float32Array(NB);
      const outerR = new Float32Array(NB);
      const cosA = new Float32Array(NB);
      const sinA = new Float32Array(NB);

      for (let i = 0; i < NB; i++) {
        const u = i / NB;
        const a = u * Math.PI * 2 + rot;
        cosA[i] = Math.cos(a);
        sinA[i] = Math.sin(a);

        let v;
        if (st === 'listening' && fdLen) {
          const bin = Math.max(0, Math.min(fdLen - 1,
            Math.floor(Math.pow(u, 1.3) * fdLen * 0.75) +
            Math.floor((hashes1[i] - 0.5) * 8)));
          v = Math.min(1, Math.pow(fd[bin] / 255, 1.0) * 1.8);
        } else if (st === 'speaking') {
          const n1 = 0.5 + 0.5 * Math.sin(ts * (3 + u * 8) + hashes1[i] * 37.7) *
            Math.sin(ts * (6.7 + u * 15) + hashes2[i] * 23.3);
          const n2 = 0.5 + 0.5 * Math.sin(ts * (11 + u * 21) + hashes1[i] * 91);
          v = Math.min(1, envG * 1.2 * (0.3 + 0.7 * n1) * (0.5 + 0.5 * n2));
        } else {
          const s1 = Math.sin(t * 2.4 + i * 0.53) * 0.5;
          const s2 = Math.sin(t * 3.9 - i * 0.29 + 1.7) * 0.3;
          const s3 = Math.sin(t * 1.2 + i * 0.87) * 0.2;
          v = Math.pow(Math.max(0, (s1 + s2 + s3 + 1) / 2), 1.5)
            * (0.7 + 0.3 * Math.sin(u * 12 + t * 0.9))
            * (st === 'thinking' ? 0.72 : 0.5);
        }

        /* per-spike noise — breaks uniformity, creates organic tufts */
        v *= 0.6 + 0.4 * Math.sin(u * 41 + t * (st === 'idle' ? 0.6 : 1.4) + hashes2[i] * 5.3);

        /* asymmetric smoothing */
        const prev = smooth[i];
        smooth[i] = prev + (v - prev) * Math.min(1, dt * (v > prev ? 22 : 5));

        const amp = smooth[i] * cur.reach * dyn;
        innerR[i] = R - amp * innerMax;
        outerR[i] = R + amp * outerMax;
      }

      /* glow pass — single blurred path */
      ctx.save();
      ctx.shadowColor = `rgba(130,80,255,${0.6 + 0.4 * lvl})`;
      ctx.shadowBlur = 26 + 16 * lvl;
      ctx.strokeStyle = `rgba(130,90,255,${0.25 + 0.35 * lvl})`;
      ctx.lineWidth = mw * 3.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < NB; i++) {
        ctx.moveTo(cx + cosA[i] * innerR[i], cy + sinA[i] * innerR[i]);
        ctx.lineTo(cx + cosA[i] * outerR[i], cy + sinA[i] * outerR[i]);
      }
      ctx.stroke();
      ctx.restore();

      /* main pass — each spike colored by angle */
      ctx.lineCap = 'round';
      for (let i = 0; i < NB; i++) {
        const u = i / NB;
        ctx.strokeStyle = pal(u + t * 0.008, 0.55 + smooth[i] * 0.45);
        ctx.lineWidth = mw * (0.85 + smooth[i] * 0.5);
        ctx.beginPath();
        ctx.moveTo(cx + cosA[i] * innerR[i], cy + sinA[i] * innerR[i]);
        ctx.lineTo(cx + cosA[i] * outerR[i], cy + sinA[i] * outerR[i]);
        ctx.stroke();
      }

      /* bright cores on the strongest spikes */
      ctx.lineWidth = mw * 0.85;
      ctx.beginPath();
      for (let i = 0; i < NB; i++) {
        if (smooth[i] < 0.35 || hashes2[i] < 0.28) continue;
        const mid = (innerR[i] + outerR[i]) / 2;
        const ext = (outerR[i] - innerR[i]) * 0.35;
        ctx.moveTo(cx + cosA[i] * (mid - ext), cy + sinA[i] * (mid - ext));
        ctx.lineTo(cx + cosA[i] * (mid + ext), cy + sinA[i] * (mid + ext));
      }
      ctx.strokeStyle = `rgba(210,235,255,${0.35 + 0.50 * lvl})`;
      ctx.stroke();

      /* fine particles drifting outside the spectrum */
      for (const m of motes) {
        m.th += dt * spd * m.spd * 0.5 * cur.particles;
        const wob = S * m.rr * (1 + 0.02 * Math.sin(ts * m.ws + m.ph));
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.6 + m.ph));
        ctx.fillStyle = pal(m.hue, (0.06 + 0.28 * twinkle) * (0.35 + 0.65 * cur.glow));
        ctx.beginPath();
        ctx.arc(cx + Math.cos(m.th) * wob, cy + Math.sin(m.th) * wob,
          m.sz * (0.5 + 0.5 * cur.glow), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}
