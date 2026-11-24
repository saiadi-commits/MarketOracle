#!/bin/bash
# SessionStart hook: installs project deps and gstack (github.com/garrytan/gstack)
# in Claude Code cloud sessions. Local machines are left alone.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# ── Project npm dependencies ────────────────────────────────────
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm install --no-audit --no-fund
  sha256sum package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi

# ── gstack skills, pinned to a reviewed release ────────────────
# Bump GSTACK_REF deliberately (review the diff of ./setup first).
GSTACK_REF=71c5e34d706831154dae2fb144a7c50e0e46beda   # v1.103.0.0
GSTACK_DIR="$HOME/.claude/skills/gstack"
gshash="$GSTACK_DIR/.session-start.ref"

if [ "$(cat "$gshash" 2>/dev/null)" != "$GSTACK_REF" ]; then
  rm -f "$gshash"
  if [ ! -d "$GSTACK_DIR/.git" ]; then
    rm -rf "$GSTACK_DIR"
    mkdir -p "$(dirname "$GSTACK_DIR")"
    git init -q "$GSTACK_DIR"
    git -C "$GSTACK_DIR" remote add origin https://github.com/garrytan/gstack.git
  fi
  git -C "$GSTACK_DIR" fetch -q --depth 1 origin "$GSTACK_REF"
  git -C "$GSTACK_DIR" checkout -q --force FETCH_HEAD

  # Telemetry off before setup runs (setup sends an onboarding event otherwise).
  "$GSTACK_DIR/bin/gstack-config" set telemetry off >/dev/null
  # Skip gstack's own Chromium download: the container already ships one.
  (cd "$GSTACK_DIR" && GSTACK_SKIP_PLAYWRIGHT=1 GSTACK_SKIP_FONTS=1 ./setup --quiet) >&2
  echo "$GSTACK_REF" > "$gshash"
fi

# ── Every session: point gstack's browser at the preinstalled Chromium ──
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  chrome=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | sort -V | tail -1 || true)
  if [ -n "$chrome" ]; then
    echo "export GSTACK_CHROMIUM_PATH=\"$chrome\"" >> "$CLAUDE_ENV_FILE"
    echo "export GSTACK_CHROMIUM_NO_SANDBOX=1" >> "$CLAUDE_ENV_FILE"
  fi
fi
