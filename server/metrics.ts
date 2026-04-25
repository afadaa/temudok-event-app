type RouteStats = {
  samples: number[];
};

const MAX_SAMPLES = 1000;
const store: Record<string, RouteStats> = {};

export function recordTiming(route: string, ms: number) {
  if (!store[route]) store[route] = { samples: [] };
  const s = store[route].samples;
  s.push(ms);
  if (s.length > MAX_SAMPLES) s.shift();
}

function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a,b)=>a-b);
  const idx = Math.min(sorted.length - 1, Math.floor((p/100) * sorted.length));
  return sorted[idx];
}

export function getStats() {
  const out: Record<string, any> = {};
  for (const k of Object.keys(store)) {
    const s = store[k].samples;
    const count = s.length;
    const total = s.reduce((a,b)=>a+b, 0);
    out[k] = {
      count,
      avg: count ? Math.round(total / count) : 0,
      p50: percentile(s, 50),
      p95: percentile(s, 95),
      p99: percentile(s, 99),
    };
  }
  return out;
}
