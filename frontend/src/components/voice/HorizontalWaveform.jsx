import { useEffect, useRef } from 'react';
import { speechEnvelope } from './audioSim';

const AMP = { idle: 0.32, listening: 1.0, transcribing: 0.95, thinking: 0.5, speaking: 1.0, error: 0.2 };
const SPD = { idle: 0.5, listening: 1.25, transcribing: 1.2, thinking: 1.6, speaking: 1.15, error: 0.35 };

export default function HorizontalWaveform({ state = 'idle', frequencyData = null, className = '' }) {
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
    const motion = reduceMotion ? 0.2 : 1;

    let ampCur = AMP[live.current.state] || AMP.idle;
    let spdCur = SPD[live.current.state] || SPD.idle;
    let t = Math.random() * 50;
    let ts = Math.random() * 40;
    let last = performance.now();
    let lvl = 0.16;

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
      const fd = live.current.frequencyData;
      ampCur += (AMP[st] - ampCur) * Math.min(1, dt * 3);
      spdCur += (SPD[st] - spdCur) * Math.min(1, dt * 3);
      t += dt * spdCur * motion;
      ts += dt * 1.15 * motion;

      let targetLvl;
      if (st === 'listening' && fd && fd.length) {
        let sum = 0;
        for (let i = 2; i < Math.min(fd.length, 110); i++) sum += fd[i];
        const avg = sum / Math.max(1, Math.min(fd.length, 110) - 2);
        const raw = Math.min(1, Math.pow(avg / 255, 0.85) * 1.6);
        targetLvl = Math.max(raw, 0.08 + 0.04 * Math.sin(t * 1.4));
      } else if (st === 'speaking') {
        targetLvl = 0.22 + 0.78 * speechEnvelope(ts);
      } else {
        targetLvl = 0.14 + 0.06 * Math.sin(t * 1.15) + 0.03 * Math.sin(t * 2.1 + 1);
      }
      lvl += (targetLvl - lvl) * Math.min(1, dt * (st === 'listening' ? 10 : 5));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cy = h / 2;
      const step = 3;
      const count = Math.ceil(w / step) + 1;
      if (count < 2) return;
      const ys = new Float32Array(count);

      const fdActive = st === 'listening' && fd && fd.length > 4;
      const swell = st === 'speaking'
        ? 0.55 + 0.45 * speechEnvelope(ts * 0.9, 1.7)
        : 0.8 + 0.2 * Math.sin(t * 0.7);

      for (let n = 0; n < count; n++) {
        const x = n * step;
        const u = x / w;
        const env = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.55) * swell;

        let v;
        const s =
          Math.sin(u * 34 + t * 3.1) * 0.55 +
          Math.sin(u * 91 - t * 4.7) * 0.28 +
          Math.sin(u * 13 + t * 1.3) * 0.35;
        if (fdActive) {
          const pos = 2 + u * (fd.length * 0.72 - 2);
          const i0 = Math.floor(pos);
          const fr = pos - i0;
          const fv = (fd[Math.min(fd.length - 1, i0)] * (1 - fr) + fd[Math.min(fd.length - 1, i0 + 1)] * fr) / 255;
          v = s * 0.35 + (fv - 0.12) * 1.7;
        } else {
          v = s * 0.62;
          if (st === 'speaking') v *= 0.65 + 0.7 * speechEnvelope(ts, u * 9.1);
        }
        const shaped = v / (1 + Math.abs(v));
        ys[n] = shaped * env * lvl * ampCur * motion * h * 0.47;
      }

      /* thin baseline */
      ctx.strokeStyle = 'rgba(70,130,255,0.1)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.stroke();

      /* mirrored ribbon fill */
      const fillGrad = ctx.createLinearGradient(0, 0, w, 0);
      fillGrad.addColorStop(0, 'rgba(40,160,255,0)');
      fillGrad.addColorStop(0.18, 'rgba(50,150,255,0.12)');
      fillGrad.addColorStop(0.42, 'rgba(120,80,255,0.18)');
      fillGrad.addColorStop(0.58, 'rgba(190,60,255,0.18)');
      fillGrad.addColorStop(0.82, 'rgba(255,60,200,0.12)');
      fillGrad.addColorStop(1, 'rgba(255,60,200,0)');
      ctx.beginPath();
      for (let n = 0; n < count; n++) {
        const x = n * step;
        if (n === 0) ctx.moveTo(x, cy - ys[n]);
        else ctx.lineTo(x, cy - ys[n]);
      }
      for (let n = count - 1; n >= 0; n--) {
        ctx.lineTo(n * step, cy + ys[n]);
      }
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();

      /* glowing stroke — cyan/blue on the left → violet → magenta on the right */
      ctx.save();
      ctx.shadowColor = 'rgba(110,80,255,0.8)';
      ctx.shadowBlur = 8 + 10 * lvl;
      ctx.lineWidth = 1.5;
      const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
      strokeGrad.addColorStop(0, 'rgba(56,220,255,0.55)');
      strokeGrad.addColorStop(0.28, 'rgba(64,130,255,0.75)');
      strokeGrad.addColorStop(0.52, 'rgba(158,84,255,0.85)');
      strokeGrad.addColorStop(0.78, 'rgba(230,70,220,0.7)');
      strokeGrad.addColorStop(1, 'rgba(255,64,192,0.4)');
      ctx.strokeStyle = strokeGrad;
      ctx.beginPath();
      for (let n = 0; n < count; n++) {
        const x = n * step;
        if (n === 0) ctx.moveTo(x, cy - ys[n]);
        else ctx.lineTo(x, cy - ys[n]);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let n = 0; n < count; n++) {
        const x = n * step;
        if (n === 0) ctx.moveTo(x, cy + ys[n]);
        else ctx.lineTo(x, cy + ys[n]);
      }
      ctx.stroke();
      ctx.restore();
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}
