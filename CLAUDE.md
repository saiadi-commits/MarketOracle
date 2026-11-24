# MarketOracle

Vite + React 19 + TypeScript forecast dashboard.

- Dev server: `npm run dev` · Build (typecheck + bundle): `npm run build` · Lint: `npm run lint` (oxlint)
- No test suite yet.

## gstack

Cloud sessions install [gstack](https://github.com/garrytan/gstack) via
`.claude/hooks/session-start.sh` (pinned release, telemetry off). Useful here:

- `/review` — review the branch diff before merging
- `/qa` — exercise the running dev server in a real browser and fix bugs
- `/cso` — security audit
- `/plan-eng-review` — before larger changes (new data sources, model changes)

Locally, install with:
`git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`
