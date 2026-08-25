export function speechEnvelope(t, seed = 0) {
  const wander = Math.sin(t * 0.61 + seed * 2.3);
  const word = 0.5 + 0.5 * Math.sin(t * 1.57 + wander * 2.1 + seed);
  const gate = 0.18 + 0.82 * Math.pow(word, 1.5);
  const s1 = Math.sin(t * 7.3 + Math.sin(t * 3.1 + seed) * 1.6);
  const s2 = Math.sin(t * 11.7 + seed * 4.0) * 0.35;
  const syl = Math.pow(Math.min(1, Math.abs(s1 + s2) / 1.35), 0.8);
  const breath = 0.85 + 0.15 * Math.sin(t * 0.77 + seed * 1.3);
  return Math.max(0, Math.min(1, syl * gate * breath));
}
