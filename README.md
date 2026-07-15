# Market Oracle

Gold · Silver · Bitcoin forecast dashboard. A geometric Brownian motion
(GBM) model fitted by MLE on trailing daily log-returns, producing
daily/weekly/monthly/quarterly price forecasts with confidence bands and
directional probabilities.

- 16 years of daily history per asset (synthetic Brownian-bridge
  reconstruction calibrated to real yearly closes)
- Live spot prices (CoinGecko for BTC, gold-api.com for XAU/XAG),
  auto-refreshing every minute
- Canvas-drawn chart: history line, forecast cone, expected drift path
- 99.9% confidence intervals, 91-day forecast cone

Ported from a Claude Design prototype (`Market Oracle.dc.html`).

## Model note

The confidence band is the *statistical* confidence interval of the
stochastic model — the range the price stays within with that probability
**if the model holds**. It is not forecast accuracy. Not financial advice.

## Quick start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

Zero-config on [Vercel](https://vercel.com) or [Netlify](https://netlify.com)
— both auto-detect the Vite build (`npm run build`, output in `dist/`).
