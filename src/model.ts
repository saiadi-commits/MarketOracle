export type AssetKey = 'GOLD' | 'SILVER' | 'BTC';

export interface AssetDef {
  label: string;
  color: string;
  vol: number;
  anchors: number[];
}

export const ASSETS: Record<AssetKey, AssetDef> = {
  GOLD: {
    label: 'GOLD · XAU/USD',
    color: '#e8b64c',
    vol: 0.011,
    anchors: [1097, 1420, 1531, 1675, 1202, 1184, 1060, 1152, 1303, 1282, 1517, 1898, 1829, 1824, 2063, 2624, 3320, 3450],
  },
  SILVER: {
    label: 'SILVER · XAG/USD',
    color: '#b9c4d0',
    vol: 0.02,
    anchors: [16.8, 30.9, 27.8, 30.2, 19.4, 15.7, 13.8, 15.9, 16.9, 15.5, 17.8, 26.4, 23.3, 24.0, 23.8, 28.9, 36.2, 37.8],
  },
  BTC: {
    label: 'BITCOIN · BTC/USD',
    color: '#f07f3c',
    vol: 0.045,
    anchors: [0.09, 0.3, 4.7, 13.4, 754, 320, 430, 963, 14156, 3742, 7193, 28994, 46306, 16547, 42258, 93429, 109000, 118500],
  },
};

export const ASSET_KEYS = Object.keys(ASSETS) as AssetKey[];

export interface Horizon {
  label: string;
  days: number;
}

export const HORIZONS: Horizon[] = [
  { label: 'Daily', days: 1 },
  { label: 'Weekly', days: 7 },
  { label: 'Monthly', days: 30 },
  { label: 'Quarterly', days: 91 },
];

export const Z: Record<string, number> = {
  '90': 1.6449,
  '95': 1.96,
  '96': 2.0537,
  '99': 2.5758,
  '99.9': 3.2905,
};

// Seeded RNG (mulberry32) + Box-Muller-style normal draw
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Standard normal CDF (Abramowitz-Stegun approximation)
export function cdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function fmt(p: number): string {
  if (p >= 1000) return '$' + Math.round(p).toLocaleString('en-US');
  if (p >= 100) return '$' + p.toFixed(1);
  return '$' + p.toFixed(2);
}

// 16y of daily prices per asset: Brownian bridge between real yearly closes.
// Cached at module scope since it's a pure, seed-deterministic reconstruction.
let cachedData: Record<AssetKey, number[]> | null = null;

export function getData(): Record<AssetKey, number[]> {
  if (cachedData) return cachedData;
  const out = {} as Record<AssetKey, number[]>;
  let seed = 42;
  for (const key of ASSET_KEYS) {
    const { anchors, vol } = ASSETS[key];
    const rng = makeRng((seed += 1000));
    const series: number[] = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      const n = i === anchors.length - 2 ? 186 : 365; // last segment ends ~July 2026
      const la = Math.log(anchors[i]);
      const lb = Math.log(anchors[i + 1]);
      const steps: number[] = [];
      let cum = 0;
      for (let k = 0; k < n; k++) {
        cum += normal(rng) * vol;
        steps.push(cum);
      }
      const end = cum;
      for (let k = 0; k < n; k++) {
        const t = (k + 1) / n;
        series.push(Math.exp(la + (lb - la) * t + (steps[k] - end * t)));
      }
    }
    out[key] = series;
  }
  cachedData = out;
  return out;
}

export interface ModelResult {
  series: number[];
  last: number;
  mu: number;
  sigma: number;
  isLive: boolean;
}

const scaledCache: Partial<Record<AssetKey, { live: number; series: number[] }>> = {};

// Rescale the whole modeled series so it terminates at the live price —
// keeps history, 24h change, chart, and cone all consistent.
export function model(key: AssetKey, liveValue: number | undefined): ModelResult {
  const raw = getData()[key];
  let series = raw;
  if (liveValue != null) {
    const c = scaledCache[key];
    if (!c || c.live !== liveValue) {
      const f = liveValue / raw[raw.length - 1];
      scaledCache[key] = { live: liveValue, series: raw.map((p) => p * f) };
    }
    series = scaledCache[key]!.series;
  }
  const last = series[series.length - 1];
  const N = 750;
  const rets: number[] = [];
  for (let i = series.length - N; i < series.length; i++) rets.push(Math.log(series[i] / series[i - 1]));
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sigma = Math.sqrt(rets.reduce((a, b) => a + (b - mu) * (b - mu), 0) / (rets.length - 1));
  return { series, last, mu, sigma, isLive: liveValue != null };
}
