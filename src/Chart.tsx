import { useEffect, useRef } from 'react';
import { fmt } from './model';
import type { AssetKey } from './model';

export type Range = '1Y' | '5Y' | 'ALL';

interface ChartProps {
  asset: AssetKey;
  range: Range;
  series: number[];
  last: number;
  mu: number;
  sigma: number;
  color: string;
  z: number;
  coneDays: number;
}

export default function Chart({ asset, range, series, last, mu, sigma, color, z, coneDays }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      const rangeDays = { '1Y': 365, '5Y': 1826, ALL: series.length }[range];
      const hist = series.slice(-rangeDays);
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth || 800;
      const H = 380;
      c.width = W * dpr;
      c.height = H * dpr;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      const useLog = asset === 'BTC' && range === 'ALL';
      const tf = useLog ? Math.log : (x: number) => x;

      // domain
      const cone: { d: number; mid: number; lo: number; hi: number }[] = [];
      for (let d = 0; d <= coneDays; d += Math.max(1, Math.round(coneDays / 60))) {
        const m = Math.log(last) + mu * d;
        const s = sigma * Math.sqrt(d);
        cone.push({ d, mid: Math.exp(m), lo: Math.exp(m - z * s), hi: Math.exp(m + z * s) });
      }
      let vmin = Infinity;
      let vmax = -Infinity;
      for (const p of hist) {
        if (p < vmin) vmin = p;
        if (p > vmax) vmax = p;
      }
      for (const p of cone) {
        if (p.lo < vmin) vmin = p.lo;
        if (p.hi > vmax) vmax = p.hi;
      }
      const pad = { l: 62, r: 14, t: 14, b: 26 };
      const tmin = tf(vmin);
      const tmax = tf(vmax);
      const totalX = hist.length + coneDays;
      const X = (i: number) => pad.l + (i / totalX) * (W - pad.l - pad.r);
      const Y = (v: number) => pad.t + (1 - (tf(v) - tmin) / (tmax - tmin || 1)) * (H - pad.t - pad.b);

      // gridlines
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.fillStyle = 'rgba(232,234,237,.4)';
      ctx.font = '10px IBM Plex Mono, monospace';
      ctx.textAlign = 'right';
      for (let g = 0; g <= 4; g++) {
        const tv = tmin + ((tmax - tmin) * g) / 4;
        const v = useLog ? Math.exp(tv) : tv;
        const y = Y(v);
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(W - pad.r, y);
        ctx.stroke();
        ctx.fillText(fmt(v).replace('$', '$'), pad.l - 8, y + 3);
      }

      // x-axis time labels (series is 365 pts/year from Jan 2010)
      const startIdx = series.length - hist.length;
      ctx.textAlign = 'center';
      const drawTick = (i: number, text: string) => {
        const x = X(i);
        if (Math.abs(x - X(hist.length - 1)) < 34) return; // avoid 'now' label
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, H - pad.b);
        ctx.stroke();
        ctx.fillStyle = 'rgba(232,234,237,.45)';
        ctx.fillText(text, x, H - 10);
      };
      if (range === '1Y') {
        const MON = ['Jan', 'Apr', 'Jul', 'Oct'];
        for (let i = 0; i < hist.length; i++) {
          const gi = startIdx + i;
          const doy = gi % 365;
          const q = [0, 91, 182, 274].indexOf(doy);
          if (q >= 0) drawTick(i, MON[q] + " '" + String(2010 + Math.floor(gi / 365)).slice(2));
        }
      } else {
        const step = range === 'ALL' ? 2 : 1;
        for (let i = 0; i < hist.length; i++) {
          const gi = startIdx + i;
          const yr = 2010 + Math.floor(gi / 365);
          if (gi % 365 === 0 && yr % step === 0) drawTick(i, String(yr));
        }
      }

      // history line
      ctx.beginPath();
      hist.forEach((p, i) => {
        const x = X(i);
        const y = Y(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // history fill
      ctx.lineTo(X(hist.length - 1), H - pad.b);
      ctx.lineTo(X(0), H - pad.b);
      ctx.closePath();
      ctx.fillStyle = color + '14';
      ctx.fill();

      // cone band
      const x0 = hist.length - 1;
      ctx.beginPath();
      cone.forEach((p, i) => {
        const x = X(x0 + p.d);
        const y = Y(p.hi);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      for (let i = cone.length - 1; i >= 0; i--) ctx.lineTo(X(x0 + cone[i].d), Y(cone[i].lo));
      ctx.closePath();
      ctx.fillStyle = color + '2a';
      ctx.fill();
      ctx.strokeStyle = color + '66';
      ctx.lineWidth = 1;
      ctx.stroke();

      // expected path
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      cone.forEach((p, i) => {
        const x = X(x0 + p.d);
        const y = Y(p.mid);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#e8eaed';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);

      // "now" marker
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.beginPath();
      ctx.moveTo(X(x0), pad.t);
      ctx.lineTo(X(x0), H - pad.b);
      ctx.stroke();
      ctx.fillStyle = 'rgba(232,234,237,.5)';
      ctx.textAlign = 'center';
      ctx.fillText('now', X(x0), H - 10);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(X(x0), Y(last), 3.5, 0, 7);
      ctx.fill();
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [asset, range, series, last, mu, sigma, color, z, coneDays]);

  return <canvas ref={canvasRef} height={380} style={{ width: '100%', height: '380px', display: 'block' }} />;
}
