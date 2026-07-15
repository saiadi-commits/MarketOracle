import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import Chart from './Chart';
import type { Range } from './Chart';
import { ASSET_KEYS, ASSETS, HORIZONS, Z, cdf, fmt, model } from './model';
import type { AssetKey } from './model';

// Last-configured values from the design session (Tweaks panel in Claude Design
// is a design-tool-only affordance; these are the values the user landed on).
const CONFIDENCE = '99.9';
const CONE_DAYS = 91;
const REFRESH_MINUTES = 1;

type LivePrices = Partial<Record<AssetKey, number>>;

export default function App() {
  const [asset, setAsset] = useState<AssetKey>('BTC');
  const [range, setRange] = useState<Range>('5Y');
  const [live, setLive] = useState<LivePrices>({});
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const fetchLive = useCallback(async () => {
    const next: LivePrices = {};
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const j = await r.json();
      if (j?.bitcoin?.usd) next.BTC = j.bitcoin.usd;
    } catch {
      // live feed unavailable; fall back to modeled price
    }
    for (const [sym, key] of [
      ['XAU', 'GOLD'],
      ['XAG', 'SILVER'],
    ] as const) {
      try {
        const r = await fetch('https://api.gold-api.com/price/' + sym);
        const j = await r.json();
        if (j?.price) next[key] = j.price;
      } catch {
        // live feed unavailable; fall back to modeled price
      }
    }
    setLive((prev) => ({ ...prev, ...next }));
    setLastFetch(Date.now());
  }, []);

  const fetchLiveRef = useRef(fetchLive);
  fetchLiveRef.current = fetchLive;

  useEffect(() => {
    fetchLiveRef.current();
    const iv = setInterval(() => fetchLiveRef.current(), REFRESH_MINUTES * 60 * 1000);
    const tick = setInterval(() => setNow(Date.now()), 20000);
    return () => {
      clearInterval(iv);
      clearInterval(tick);
    };
  }, []);

  const z = Z[CONFIDENCE] ?? 2.0537;
  const m = model(asset, live[asset]);
  const color = ASSETS[asset].color;

  const anyLive = Object.keys(live).length > 0;
  let nextRefresh = '—';
  if (lastFetch != null) {
    const remain = Math.max(0, REFRESH_MINUTES * 60000 - (now - lastFetch));
    const mm = Math.floor(remain / 60000);
    nextRefresh = mm >= 1 ? 'in ' + mm + 'm' : '<1m';
  }

  const confLabel = CONFIDENCE + '%';
  const coneLabel = CONE_DAYS >= 90 ? '3-month' : CONE_DAYS + '-day';

  const stats = [
    { label: 'ANNUALIZED DRIFT μ', value: ((Math.exp(m.mu * 365) - 1) * 100).toFixed(1) + '%', color: m.mu >= 0 ? '#5fb87a' : '#d96a6a' },
    { label: 'ANNUALIZED VOL σ', value: (m.sigma * Math.sqrt(365) * 100).toFixed(1) + '%', color: '#e8eaed' },
    { label: 'OBSERVATIONS', value: m.series.length.toLocaleString() + ' days', color: '#e8eaed' },
    { label: 'FIT WINDOW', value: '750 days', color: '#e8eaed' },
    { label: 'CONFIDENCE Z', value: z.toFixed(4), color: '#e8b64c' },
  ];

  const horizons = HORIZONS.map((h) => {
    const mean = Math.log(m.last) + m.mu * h.days;
    const s = m.sigma * Math.sqrt(h.days);
    const exp = Math.exp(mean);
    const lo = Math.exp(mean - z * s);
    const hi = Math.exp(mean + z * s);
    const pUp = cdf((m.mu * Math.sqrt(h.days)) / m.sigma);
    const expPct = (exp / m.last - 1) * 100;
    const frac = (m.last - lo) / (hi - lo);
    return {
      label: h.label,
      days: h.days,
      expected: fmt(exp),
      expPct: (expPct >= 0 ? '+' : '') + expPct.toFixed(2) + '%',
      expColor: expPct >= 0 ? '#5fb87a' : '#d96a6a',
      low: fmt(lo),
      high: fmt(hi),
      barLeft: Math.max(0, Math.min(96, frac * 100 - 2)).toFixed(1) + '%',
      pUp: (pUp * 100).toFixed(1) + '%',
      pDown: ((1 - pUp) * 100).toFixed(1) + '%',
    };
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0e1013',
        padding: '28px clamp(16px,4vw,48px) 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: '1px solid rgba(255,255,255,.09)',
          paddingBottom: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '.18em', color: 'rgba(232,234,237,.5)' }}>
            QUANT FORECAST MODEL · GBM / MLE LOG-RETURNS
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-.01em' }}>
            Market Oracle <span style={{ color: 'rgba(232,234,237,.4)', fontWeight: 400 }}>— Gold · Silver · Bitcoin</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: anyLive ? '#5fb87a' : '#e8b64c',
                animation: 'pulse 2s infinite',
              }}
            />
            <span style={{ color: 'rgba(232,234,237,.7)' }}>
              {anyLive ? 'LIVE FEED · ' + Object.keys(live).length + '/3 assets' : 'MODEL PRICES (feed unavailable)'}
            </span>
          </div>
          <div style={{ color: 'rgba(232,234,237,.45)' }}>next refresh {nextRefresh}</div>
          <button className="refresh-btn" onClick={() => fetchLive()}>
            REFRESH ↻
          </button>
        </div>
      </header>

      {/* Asset tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {ASSET_KEYS.map((key) => {
          const mk = model(key, live[key]);
          const prev = mk.series[mk.series.length - 2];
          const chgP = (mk.last / prev - 1) * 100;
          const on = key === asset;
          return (
            <button
              key={key}
              className={'asset-tab' + (on ? ' selected' : '')}
              style={{ '--accent': ASSETS[key].color } as React.CSSProperties}
              onClick={() => setAsset(key)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: '.12em', color: ASSETS[key].color }}>
                  {ASSETS[key].label}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'rgba(232,234,237,.4)' }}>
                  {mk.isLive ? 'LIVE' : 'MODEL'}
                </span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 24, fontWeight: 600, color: '#e8eaed' }}>{fmt(mk.last)}</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: chgP >= 0 ? '#5fb87a' : '#d96a6a' }}>
                {(chgP >= 0 ? '+' : '') + chgP.toFixed(2) + '%'} <span style={{ color: 'rgba(232,234,237,.35)' }}>24h (model)</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Chart panel */}
      <div
        style={{
          background: '#14171b',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 14,
          padding: '20px 20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {ASSETS[asset].label}{' '}
            <span style={{ color: 'rgba(232,234,237,.4)', fontWeight: 400, fontSize: 13 }}>
              · 16y daily history + {coneLabel} forecast cone ({confLabel} CI)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['1Y', '5Y', 'ALL'] as Range[]).map((r) => (
              <button key={r} className={'range-tab' + (r === range ? ' selected' : '')} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <Chart asset={asset} range={range} series={m.series} last={m.last} mu={m.mu} sigma={m.sigma} color={color} z={z} coneDays={CONE_DAYS} />
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'rgba(232,234,237,.38)', paddingBottom: 4 }}>
          shaded cone = {confLabel} confidence interval · dashed = expected path (drift)
        </div>
      </div>

      {/* Model stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: '#14171b',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: 'rgba(232,234,237,.45)' }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 18, fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Forecast horizons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
          Forecasts — {ASSETS[asset].label}{' '}
          <span style={{ color: 'rgba(232,234,237,.4)', fontWeight: 400, fontSize: 13 }}>({confLabel} confidence intervals)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
          {horizons.map((h) => (
            <div
              key={h.label}
              style={{
                background: '#14171b',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{h.label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'rgba(232,234,237,.4)' }}>+{h.days}d</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 600, color: '#e8eaed' }}>{h.expected}</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: h.expColor }}>{h.expPct} expected drift</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11,
                    color: 'rgba(232,234,237,.6)',
                  }}
                >
                  <span>{h.low}</span>
                  <span style={{ color: 'rgba(232,234,237,.35)' }}>{confLabel} band</span>
                  <span>{h.high}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: h.barLeft, width: '4%', top: 0, bottom: 0, background: color, borderRadius: 3 }} />
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 12,
                  borderTop: '1px solid rgba(255,255,255,.07)',
                  paddingTop: 10,
                }}
              >
                <span style={{ color: '#5fb87a' }}>▲ {h.pUp}</span>
                <span style={{ color: '#d96a6a' }}>▼ {h.pDown}</span>
                <span style={{ marginLeft: 'auto', color: 'rgba(232,234,237,.4)' }}>P(direction)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          border: '1px solid rgba(232,182,76,.25)',
          background: 'rgba(232,182,76,.05)',
          borderRadius: 12,
          padding: '14px 18px',
          fontSize: 12.5,
          lineHeight: 1.55,
          color: 'rgba(232,234,237,.65)',
        }}
      >
        <strong style={{ color: '#e8b64c' }}>Model note.</strong> "{confLabel}" is the statistical confidence interval of the stochastic model
        (geometric Brownian motion, parameters fitted by MLE on the trailing 3 years of daily log-returns) — the band the price stays within
        with that probability <em>if the model holds</em>. It is not forecast accuracy. History is a modeled reconstruction calibrated to real
        yearly closes; live spot prices are fetched every minute when available. Not financial advice.
      </div>
    </div>
  );
}
