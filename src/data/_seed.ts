// Deterministic pseudo-random helpers for static mock snapshots.
// Same input → same output on every render: nothing ticks or random-walks over time.

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: string): () => number {
  let a = hashString(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** 24-point static sparkline that ends exactly at `end` after a `changePct` day move. */
export function buildSparkline(seed: string, end: number, changePct: number, digits: number, points = 24): number[] {
  const rand = seededRandom(`spark:${seed}`);
  const start = end / (1 + changePct / 100);
  const amplitude = Math.abs(end - start) * 0.55 + end * 0.0009;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const drift = start + (end - start) * t;
    const noise = i === points - 1 ? 0 : (rand() - 0.5) * amplitude;
    out.push(roundTo(drift + noise, digits));
  }
  return out;
}
