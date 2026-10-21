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

## Day Trader skills

The repo ships the eleven project-local Claude Code skills from the
[Day Trader skill pack](https://github.com/Jakeschincariol/day-trader-skill)
under `.claude/skills/`: `/trader-scanner`, `/trader-news`, `/trader-entry`,
`/trader-exit`, `/trader-timemachine`, `/trader-budget`, `/trader-risk`,
`/trader-broker`, `/trader-alerts`, `/trader-analyst` and `/trader-pelosi`.
They need Python 3.8+ and nothing to install. Their state lives in a
gitignored `trader/` folder at the repo root; start from
`.claude/skills/trader-budget/config.example.json` and put your name and
email in `sec_user_agent` for the SEC tools.

Paper trading is the default and nothing places an order without your yes.
Not financial advice. See `.claude/skills/README.md` for the vendored version.
