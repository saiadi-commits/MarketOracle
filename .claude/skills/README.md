# Project skills

The `trader-*` folders are the
[Day Trader skill pack](https://github.com/Jakeschincariol/day-trader-skill)
by Jake Schincariol, vendored at commit `3d0f4ef6986f4984b7c6bd46f7ff4f87744c3abd` (v2.0.0), MIT licensed
(see `LICENSE-day-trader-skill`). They are unmodified copies; to update,
re-copy the `trader-*` folders from upstream.

Each skill is a `SKILL.md` plus a standard-library Python 3.8+ tool. They
read free public data (Yahoo Finance, Stooq, SEC EDGAR, Nasdaq Trader, the
House Clerk) and write their state to a `trader/` folder at the repo root,
which is gitignored because it holds your config, orders and portfolio.
