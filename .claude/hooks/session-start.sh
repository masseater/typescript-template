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
if ! command -v mise >/dev/null 2>&1; then
  curl -fsSL https://mise.run | sh >&2
  export PATH="$HOME/.local/bin:$PATH"
fi
mise trust --quiet mise.toml
mise install --locked >&2
echo "export PATH=\"$HOME/.local/bin:$HOME/.local/share/mise/shims:\$PATH\"" >>"$CLAUDE_ENV_FILE"
vp env on >&2
vp install --frozen-lockfile >&2
