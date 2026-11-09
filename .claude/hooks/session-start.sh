#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v vp >/dev/null 2>&1; then
  curl -fsSL https://vite.plus | VP_NODE_MANAGER=no bash >&2
  echo ". \"$HOME/.config/vite-plus/env\"" >>"$CLAUDE_ENV_FILE"
  . "$HOME/.config/vite-plus/env"
fi

for chrome in /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
  if [ -x "$chrome" ] && [ -z "${CHROME_PATH:-}" ]; then
    echo "export CHROME_PATH=\"$chrome\"" >>"$CLAUDE_ENV_FILE"
  fi
done

cd "$CLAUDE_PROJECT_DIR"
vp env on >&2
vp install --frozen-lockfile >&2
